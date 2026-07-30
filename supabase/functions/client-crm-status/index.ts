// Integração com o CRM DO CLIENTE (projetos de tráfego no Nexus).
// O CRM do cliente (ou n8n/Zapier/Make) chama quando o lead fecha ou perde:
// casa com o lead da aba Leads (client_traffic_leads), marca o desfecho,
// grava o valor da venda e devolve Purchase pro Meta (CAPI) se configurado.
//
// URL:  /client-crm-status?id=<integration_id>
// Auth: header x-secret = secret da integração
// Body: { "status": "won" | "lost", "phone": "...", "email": "...",
//         "value": 1234.56, "reason": "opcional" }
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

async function sha256(v: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const integrationId = new URL(req.url).searchParams.get("id");
  if (!integrationId) return json({ error: "missing ?id" }, 400);

  const { data: integ } = await supabase.from("client_crm_integrations")
    .select("*").eq("id", integrationId).eq("active", true).maybeSingle();
  if (!integ) return json({ error: "integração não encontrada ou inativa" }, 404);
  if (req.headers.get("x-secret") !== integ.secret) return json({ error: "secret inválido" }, 401);

  const projectId = integ.project_id;
  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "body inválido (JSON)" }, 400); }

  const log = async (action: string, detail: string, leadId?: string | null) => {
    await supabase.from("client_crm_sync_log").insert({
      project_id: projectId, integration_id: integ.id, lead_id: leadId || null,
      action, detail, payload,
    });
  };

  const status = String(payload.status || "").toLowerCase();
  if (!["won", "lost"].includes(status)) {
    await log("error", `status inválido: "${payload.status}" (use won ou lost)`);
    return json({ error: 'status deve ser "won" ou "lost"' }, 200);
  }

  // acha o lead do projeto: telefone (últimos 8 dígitos) > e-mail
  let lead: any = null;
  const d = digits(payload.phone);
  if (d.length >= 8) {
    const { data } = await supabase.from("client_traffic_leads").select("*")
      .eq("project_id", projectId).ilike("phone", `%${d.slice(-8)}`)
      .order("created_at", { ascending: false }).limit(1);
    lead = data?.[0] || null;
  }
  if (!lead && payload.email) {
    const { data } = await supabase.from("client_traffic_leads").select("*")
      .eq("project_id", projectId).ilike("email", String(payload.email).trim())
      .order("created_at", { ascending: false }).limit(1);
    lead = data?.[0] || null;
  }
  if (!lead) {
    await log("not_found", `nenhum lead casou (phone=${payload.phone || "-"} email=${payload.email || "-"})`);
    return json({ ok: false, matched: false, hint: "nenhum lead com esse telefone/e-mail nesse projeto" });
  }

  const value = payload.value != null ? Number(payload.value) : null;
  const upd: Record<string, unknown> = {
    status: status === "won" ? "fechou" : "perdido",
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (status === "won" && value != null && value > 0) upd.sale_value = value;
  const { error: updErr } = await supabase.from("client_traffic_leads").update(upd).eq("id", lead.id);
  if (updErr) {
    await log("error", `falha ao atualizar lead: ${updErr.message}`, lead.id);
    return json({ error: updErr.message }, 200);
  }

  await log(status, status === "won"
    ? `venda confirmada${value ? ` — R$ ${value.toFixed(2)}` : ""} (${lead.name})`
    : `perdido${payload.reason ? ` — ${payload.reason}` : ""} (${lead.name})`, lead.id);
  await supabase.from("client_crm_integrations").update({ last_event_at: new Date().toISOString() }).eq("id", integ.id);

  // Purchase de volta pro Meta (pixel do cliente), quando configurado
  if (status === "won") {
    const { data: t } = await supabase.from("client_tracking").select("*").eq("project_id", projectId).maybeSingle();
    if (t?.meta_pixel_id && t?.meta_capi_token && t.send_purchase) {
      const userData: Record<string, unknown> = {};
      if (lead.phone) userData.ph = [await sha256(digits(lead.phone))];
      if (lead.email) userData.em = [await sha256(String(lead.email).toLowerCase().trim())];
      if (Object.keys(userData).length) {
        try {
          const resp = await fetch(`https://graph.facebook.com/v21.0/${t.meta_pixel_id}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: [{
                event_name: "Purchase",
                event_time: Math.floor(Date.now() / 1000),
                event_id: `nexus-ctl-won-${lead.id}`,
                action_source: "system_generated",
                user_data: userData,
                custom_data: { currency: "BRL", value: value || Number(lead.sale_value) || 0 },
              }],
              access_token: t.meta_capi_token,
            }),
          });
          const out = await resp.json().catch(() => ({}));
          await log(resp.ok ? "capi_sent" : "capi_error", resp.ok
            ? `Purchase enviado pro pixel ${t.meta_pixel_id}`
            : `Meta recusou: ${JSON.stringify(out?.error?.message || out).slice(0, 200)}`, lead.id);
        } catch (e) {
          await log("capi_error", String(e).slice(0, 200), lead.id);
        }
      }
    }
  }

  return json({ ok: true, matched: true, lead_id: lead.id, action: status });
});
