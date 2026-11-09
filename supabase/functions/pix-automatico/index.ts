// pix-automatico — página pública do Pix Automático e ações da autorização (09/11/2026)
// Fabrício: "quero poder escolher se quero que seja pix recorrência, que é aquele que o cliente autoriza
// a recorrência via pix ser descontada automaticamente".
//
// A autorização nasce em asaas-subscription (recorrência da empresa) ou asaas-lead-subscription (lead do
// CRM) e fica em asaas_pix_automatico. Aqui:
//   { action: "ver", id }       público (página /#/pix-automatico/<id>): QR Code, valor e status.
//                               Se ainda não está ativa, confere no Asaas (no máximo a cada 20 s).
//   { action: "cancelar", id }  staff logado: cancela a autorização no Asaas (DELETE) e marca CANCELLED.
//   { action: "webhooks" }      diagnóstico: quais eventos PIX_AUTOMATIC_* o webhook da conta recebe.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_BASE = "https://api.asaas.com/v3";
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function asaas(key: string, path: string, method: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, { method, headers: { "Content-Type": "application/json", "access_token": key } });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* noop */ }
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas HTTP ${res.status}`);
  return data;
}

// Mesma resolução de chave das funções que criam a autorização
async function chaveDa(supabase: any, row: any): Promise<string> {
  const porConta = async (accId: string, secretName?: string | null) => {
    const { data: porRef } = await supabase.from("tenant_integration_secrets")
      .select("secret_value").eq("provider", "asaas").eq("reference_id", accId).limit(1);
    if (porRef?.[0]?.secret_value) return porRef[0].secret_value as string;
    if (secretName) {
      const { data: porNome } = await supabase.from("tenant_integration_secrets").select("secret_value").eq("secret_name", secretName).limit(1);
      return (porNome?.[0]?.secret_value as string) || Deno.env.get(secretName) || "";
    }
    return "";
  };
  if (row?.origem === "empresa" && row.asaas_account_id) {
    const { data: acc } = await supabase.from("asaas_accounts").select("id, api_key_secret_name").eq("id", row.asaas_account_id).maybeSingle();
    if (acc) { const k = await porConta(acc.id, acc.api_key_secret_name); if (k) return k; }
  }
  if (row?.origem === "lead" && row.conta_crm === "social") {
    const { data: acc } = await supabase.from("asaas_accounts").select("id, api_key_secret_name").eq("is_active", true)
      .ilike("name", "%social%").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (acc) return await porConta(acc.id, acc.api_key_secret_name);
    return "";
  }
  return Deno.env.get("ASAAS_API_KEY") || "";
}

const publico = (r: any) => ({
  id: r.id, status: r.status, valor_cents: r.valor_cents, frequencia: r.frequencia, descricao: r.descricao,
  cliente_nome: r.cliente_nome, primeira_cobranca: r.primeira_cobranca, start_date: r.start_date,
  qr_payload: r.status === "CREATED" ? r.qr_payload : null,
  qr_image: r.status === "CREATED" ? r.qr_image : null,
  qr_expira_em: r.qr_expira_em, pago: !!r.pago_em,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any = {};
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }, 400); }
  const id = String(body.id || "").trim();

  try {
    if (body.action === "ver") {
      if (!/^[0-9a-f-]{20,60}$/i.test(id)) return j({ ok: false, error: "link inválido" }, 400);
      let { data: row } = await supabase.from("asaas_pix_automatico").select("*").eq("id", id).maybeSingle();
      if (!row) return j({ ok: false, error: "autorização não encontrada" }, 404);
      const velha = Date.now() - new Date(row.atualizado_em).getTime() > 20000;
      if (row.status === "CREATED" && velha) {
        try {
          const key = await chaveDa(supabase, row);
          if (key) {
            const au = await asaas(key, `/pix/automatic/authorizations/${id}`, "GET");
            const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
            if (au?.status && au.status !== row.status) { patch.status = au.status; patch.ultimo_evento = "consulta"; }
            if (au?.subscriptionId && !row.subscription_id) patch.subscription_id = au.subscriptionId;
            await supabase.from("asaas_pix_automatico").update(patch).eq("id", id);
            if (au?.subscriptionId && row.recurring_charge_id) {
              await supabase.from("company_recurring_charges").update({ pagarme_plan_id: au.subscriptionId }).eq("id", row.recurring_charge_id).is("pagarme_plan_id", null);
            }
            row = { ...row, ...patch };
          }
        } catch (e) { console.error("[pix-automatico] consulta", String((e as Error).message || e)); }
      }
      return j({ ok: true, autorizacao: publico(row) });
    }

    if (body.action === "cancelar") {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } as any };
      if (!u?.user) return j({ ok: false, error: "não autorizado" }, 401);
      const { data: staff } = await supabase.from("onboarding_staff").select("id").eq("user_id", u.user.id).eq("is_active", true).limit(1);
      if (!staff?.length) return j({ ok: false, error: "não autorizado" }, 403);
      const { data: row } = await supabase.from("asaas_pix_automatico").select("*").eq("id", id).maybeSingle();
      if (!row) return j({ ok: false, error: "autorização não encontrada" }, 404);
      if (row.status === "CANCELLED") return j({ ok: true, status: "CANCELLED" });
      const key = await chaveDa(supabase, row);
      if (!key) return j({ ok: false, error: "chave da conta Asaas não encontrada" });
      const au = await asaas(key, `/pix/automatic/authorizations/${id}`, "DELETE");
      await supabase.from("asaas_pix_automatico").update({ status: au?.status || "CANCELLED", ultimo_evento: "cancelada no Nexus", atualizado_em: new Date().toISOString() }).eq("id", id);
      return j({ ok: true, status: au?.status || "CANCELLED" });
    }

    if (body.action === "webhooks") {
      if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);
      const key = Deno.env.get("ASAAS_API_KEY") || "";
      const hooks = await asaas(key, "/webhooks", "GET");
      return j({
        ok: true,
        webhooks: (hooks?.data || []).map((h: any) => ({
          name: h.name, url: h.url, enabled: h.enabled,
          pix_automatico: (h.events || []).filter((e: string) => String(e).startsWith("PIX_AUTOMATIC_")),
          total_eventos: (h.events || []).length,
        })),
      });
    }

    return j({ ok: false, error: "ação desconhecida" }, 400);
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) });
  }
});
