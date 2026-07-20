// E-mail de BOAS-VINDAS pra todo usuário novo do Nexus (dono, gerente,
// vendedor, staff). Chamada internamente pelas edges de criação de usuário.
// Provedor: RESEND_API_KEY (https://resend.com) OU SMTP_HOST/PORT/USER/PASS —
// o que estiver configurado nos secrets. Sem provedor → responde erro claro
// (a criação do usuário NUNCA é bloqueada por isso; quem chama é best-effort).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const NAVY = "#0D2B5E";
const RED = "#CC1B1B";

function welcomeHtml(p: { name: string; roleLabel: string; email: string; password?: string | null; loginUrl: string }) {
  const firstName = (p.name || "").trim().split(" ")[0] || "tudo bem";
  const credRows = `
    <tr><td style="padding:6px 0;color:#475569;font-size:14px;">E-mail de acesso</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${p.email}</td></tr>
    ${p.password ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Senha inicial</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${p.password}</td></tr>` : ""}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(13,43,94,.12);">
        <tr><td style="background:${NAVY};padding:28px 32px;">
          <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.5px;">UNV <span style="color:#ffb3b3;">Nexus</span></div>
          <div style="color:#c7d2e5;font-size:12px;margin-top:4px;">Universidade Nacional de Vendas</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:700;">Bem-vindo(a), ${firstName}!</p>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
            Seu acesso ao sistema foi criado com o perfil de <strong style="color:${NAVY};">${p.roleLabel}</strong>.
            Guarde seus dados de acesso:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px 16px;margin-bottom:24px;">
            ${credRows}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="border-radius:10px;background:${RED};">
            <a href="${p.loginUrl}" style="display:inline-block;padding:13px 34px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Acessar o sistema</a>
          </td></tr></table>
          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
            Por segurança, troque sua senha no primeiro acesso. Se você não esperava este e-mail, ignore-o.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;color:#94a3b8;font-size:11px;text-align:center;">
          UNV Holdings — unvholdings.com.br
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

async function sendViaResend(apiKey: string, to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const from = Deno.env.get("WELCOME_FROM") || "UNV Nexus <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!r.ok) return { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}

async function sendViaSmtp(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const host = Deno.env.get("SMTP_HOST")!;
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const user = Deno.env.get("SMTP_USER")!;
  const pass = Deno.env.get("SMTP_PASS")!;
  const from = Deno.env.get("WELCOME_FROM") || `UNV Nexus <${user}>`;
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
  const client = new SMTPClient({
    connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } },
  });
  try {
    await client.send({ from, to, subject, html, content: "auto" });
    await client.close();
    return { ok: true };
  } catch (e) {
    try { await client.close(); } catch { /* já fechado */ }
    return { ok: false, error: String((e as Error).message || e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    // só chamadas internas (service role) podem disparar
    const auth = req.headers.get("authorization") || "";
    if (!auth.includes(SERVICE_ROLE)) return j({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { to, name, role_label, password, login_url } = body;
    if (!to || !name) return j({ ok: false, error: "to e name obrigatórios" }, 400);

    const subject = "Seu acesso ao UNV Nexus foi criado";
    const html = welcomeHtml({
      name,
      roleLabel: role_label || "Usuário",
      email: to,
      password: password || null,
      loginUrl: login_url || "https://unvholdings.com.br/#/onboarding-tasks/login",
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const hasSmtp = !!(Deno.env.get("SMTP_HOST") && Deno.env.get("SMTP_USER") && Deno.env.get("SMTP_PASS"));

    let result: { ok: boolean; error?: string };
    if (resendKey) result = await sendViaResend(resendKey, to, subject, html);
    else if (hasSmtp) result = await sendViaSmtp(to, subject, html);
    else result = { ok: false, error: "nenhum provedor configurado (RESEND_API_KEY ou SMTP_*)" };

    await supabase.from("email_send_log").insert({
      message_id: crypto.randomUUID(),
      template_name: "welcome",
      recipient_email: to,
      status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
    });

    return j(result.ok ? { ok: true, sent: true } : { ok: false, error: result.error }, result.ok ? 200 : 500);
  } catch (e) {
    console.error("send-welcome-email", e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
