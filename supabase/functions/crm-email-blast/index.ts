// Disparador de e-mails do CRM Comercial (Resend).
// Ações:
//  - preview  {filters}                → total, com e-mail, supressos, amostra
//  - create   {name, subject, body_text, from_email, filters} → cria campanha + destinatários
//  - process  {campaign_id}            → envia um LOTE de pendentes (o front chama em loop)
//  - optout   GET ?e=<b64 email>       → descadastro público (grava em suppressed_emails)
// Personalização no corpo/assunto: {nome} (primeiro nome do lead).
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BATCH = 60;           // e-mails por chamada (o front repete até acabar)
const DELAY_MS = 550;       // ~2/s — respeita rate limit do Resend

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const firstName = (n?: string | null) => String(n || "").trim().split(/\s+/)[0] || "";
const render = (tpl: string, name?: string | null) => tpl.replace(/\{nome\}/gi, firstName(name));

function toHtml(text: string, optoutUrl: string): string {
  const body = text
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="margin:0;background:#f4f5f7;padding:24px 12px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 30px;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a2332">
${body}
</div>
<p style="max-width:600px;margin:14px auto 0;text-align:center;font-size:11px;color:#94a3b8;font-family:Arial,sans-serif">
UNV — Universidade Nacional de Vendas · <a href="${optoutUrl}" style="color:#94a3b8">não quero receber e-mails</a>
</p></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);

  // ── descadastro público (link do rodapé) ──
  if (req.method === "GET" && url.searchParams.get("e")) {
    try {
      const email = atob(url.searchParams.get("e")!.replace(/-/g, "+").replace(/_/g, "/")).toLowerCase().trim();
      if (EMAIL_RX.test(email)) {
        await supabase.from("suppressed_emails").upsert(
          { email, reason: "unsubscribe", metadata: { source: "crm_blast" } }, { onConflict: "email", ignoreDuplicates: true },
        );
      }
    } catch { /* ignora */ }
    return new Response(
      "<html><body style='font-family:Arial;text-align:center;padding-top:80px'><h2>Pronto.</h2><p>Você não vai mais receber nossos e-mails.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    // autenticação: staff ativo
    const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return j({ error: "não autenticado" }, 401);
    const { data: staff } = await supabase
      .from("onboarding_staff").select("id, role")
      .eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!staff) return j({ error: "sem permissão" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ── monta a lista de leads pelo filtro (funil/etapa/origem) ──
    const buildRecipients = async (filters: any) => {
      let q = supabase.from("crm_leads")
        .select("id, name, email")
        .not("email", "is", null)
        .limit(20000);
      if (filters?.pipeline_id) q = q.eq("pipeline_id", filters.pipeline_id);
      if (filters?.stage_id) q = q.eq("stage_id", filters.stage_id);
      if (filters?.origin_id) q = q.eq("origin_id", filters.origin_id);
      const { data: leads, error } = await q;
      if (error) throw new Error(error.message);
      const seen = new Set<string>();
      const valid: { lead_id: string; email: string; name: string | null }[] = [];
      let invalid = 0;
      (leads || []).forEach((l: any) => {
        const e = String(l.email || "").toLowerCase().trim();
        if (!EMAIL_RX.test(e)) { invalid++; return; }
        if (seen.has(e)) return;
        seen.add(e);
        valid.push({ lead_id: l.id, email: e, name: l.name });
      });
      // remove supressos (descadastrados/bounces)
      const emails = valid.map(v => v.email);
      const suppressed = new Set<string>();
      for (let i = 0; i < emails.length; i += 500) {
        const { data: sup } = await supabase.from("suppressed_emails")
          .select("email").in("email", emails.slice(i, i + 500));
        (sup || []).forEach((s: any) => suppressed.add(String(s.email).toLowerCase()));
      }
      const final = valid.filter(v => !suppressed.has(v.email));
      return { final, invalid, suppressedCount: valid.length - final.length, totalLeads: (leads || []).length };
    };

    if (action === "preview") {
      const { final, invalid, suppressedCount, totalLeads } = await buildRecipients(body.filters || {});
      return j({
        ok: true, total_leads: totalLeads, enviaveis: final.length,
        invalidos: invalid, supressos: suppressedCount,
        amostra: final.slice(0, 5).map(f => ({ nome: f.name, email: f.email })),
      });
    }

    if (action === "create") {
      const { name, subject, body_text, from_email, filters } = body;
      if (!subject || !body_text) return j({ error: "assunto e corpo obrigatórios" }, 400);
      const from = String(from_email || "").includes("@unvholdings.com.br")
        ? String(from_email) : "comercial@unvholdings.com.br";
      const { final } = await buildRecipients(filters || {});
      if (!final.length) return j({ error: "nenhum destinatário enviável com esse filtro" }, 400);
      const { data: camp, error } = await supabase.from("crm_email_campaigns").insert({
        name: name || subject, subject, body_text, from_email: from,
        filters: filters || {}, status: "sending", total: final.length, created_by: staff.id,
      }).select("id").single();
      if (error || !camp) return j({ error: error?.message || "falha ao criar campanha" }, 500);
      for (let i = 0; i < final.length; i += 500) {
        await supabase.from("crm_email_recipients").insert(
          final.slice(i, i + 500).map(f => ({ campaign_id: camp.id, ...f })),
        );
      }
      return j({ ok: true, campaign_id: camp.id, total: final.length });
    }

    if (action === "process") {
      if (!RESEND_KEY) return j({ error: "RESEND_API_KEY não configurada" }, 500);
      const campaignId = String(body.campaign_id || "");
      const { data: camp } = await supabase.from("crm_email_campaigns")
        .select("*").eq("id", campaignId).maybeSingle();
      if (!camp) return j({ error: "campanha não encontrada" }, 404);
      const { data: pend } = await supabase.from("crm_email_recipients")
        .select("id, lead_id, email, name")
        .eq("campaign_id", campaignId).eq("status", "pending").limit(BATCH);
      let sent = 0, failed = 0;
      for (const r of pend || []) {
        const b64 = btoa(r.email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const optoutUrl = `${SUPABASE_URL}/functions/v1/crm-email-blast?e=${b64}`;
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `UNV <${camp.from_email}>`,
              to: [r.email],
              subject: render(camp.subject, r.name),
              html: toHtml(render(camp.body_text, r.name), optoutUrl),
              headers: { "List-Unsubscribe": `<${optoutUrl}>` },
            }),
          });
          if (resp.ok) {
            sent++;
            await supabase.from("crm_email_recipients").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", r.id);
            await supabase.from("email_send_log").insert({ template_name: `crm_blast:${campaignId}`, recipient_email: r.email, status: "sent" });
          } else {
            const err = await resp.text();
            failed++;
            await supabase.from("crm_email_recipients").update({ status: "failed", error: err.slice(0, 300) }).eq("id", r.id);
          }
        } catch (e) {
          failed++;
          await supabase.from("crm_email_recipients").update({ status: "failed", error: String(e).slice(0, 300) }).eq("id", r.id);
        }
        await new Promise(res => setTimeout(res, DELAY_MS));
      }
      const { count: remaining } = await supabase.from("crm_email_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId).eq("status", "pending");
      const done = (remaining || 0) === 0;
      await supabase.from("crm_email_campaigns").update({
        sent: (camp.sent || 0) + sent,
        failed: (camp.failed || 0) + failed,
        status: done ? "done" : "sending",
        finished_at: done ? new Date().toISOString() : null,
      }).eq("id", campaignId);
      return j({ ok: true, batch_sent: sent, batch_failed: failed, remaining: remaining || 0, done });
    }

    return j({ error: "ação inválida" }, 400);
  } catch (e) {
    return j({ error: String((e as Error).message || e) }, 500);
  }
});
