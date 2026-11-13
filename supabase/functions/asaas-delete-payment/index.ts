// Exclui um pagamento no Asaas (DELETE /payments/{id}).
// Uso: invocar com { payment_ids: string[] } ou { invoice_ids: string[] } (busca pagarme_charge_id).
//
// Segurança (13/11/2026): antes qualquer pessoa na internet apagava cobranças no Asaas com a chave da UNV.
// Agora só passa: service role (chamada interna) ou usuário logado do time ativo com cargo admin/master
// ou com a permissão de menu "financial" (quem usa a tela Financeiro > Recorrências).
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function autorizado(supabase: any, req: Request): Promise<string | null> {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return null;
  if (bearer === SERVICE_ROLE) return "service";
  const { data: u } = await supabase.auth.getUser(bearer);
  if (!u?.user?.id) return null;
  // a mesma pessoa pode ter mais de um cadastro no time: vale qualquer um ativo
  const { data: cadastros } = await supabase.from("onboarding_staff").select("id, role")
    .eq("user_id", u.user.id).eq("is_active", true).limit(10);
  if (!cadastros?.length) return null;
  const chefe = cadastros.find((s: any) => ["admin", "master"].includes(s.role));
  if (chefe) return `staff:${chefe.id}`;
  const { data: perm } = await supabase.from("staff_menu_permissions").select("staff_id")
    .in("staff_id", cadastros.map((s: any) => s.id)).eq("menu_key", "financial").limit(1);
  return perm?.length ? `staff:${perm[0].staff_id}` : null;
}

async function deleteAsaasPayment(paymentId: string, apiKey: string) {
  const r = await fetch(`${ASAAS_BASE}/payments/${paymentId}`, {
    method: "DELETE",
    headers: { access_token: apiKey, "Content-Type": "application/json" },
  });
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  // 404 = já não existe; tratamos como sucesso idempotente
  if (!r.ok && r.status !== 404) {
    return { ok: false, status: r.status, body };
  }
  return { ok: true, status: r.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "ASAAS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SERVICE_ROLE,
    );
    const quem = await autorizado(supabase, req);
    if (!quem) return json({ ok: false, error: "nao_autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    let paymentIds: string[] = Array.isArray(body.payment_ids) ? body.payment_ids.filter(Boolean) : [];
    const invoiceIds: string[] = Array.isArray(body.invoice_ids) ? body.invoice_ids.filter(Boolean) : [];

    if (invoiceIds.length > 0) {
      const { data } = await supabase
        .from("company_invoices")
        .select("id, pagarme_charge_id")
        .in("id", invoiceIds);
      const extra = (data || []).map((r: any) => r.pagarme_charge_id).filter(Boolean);
      paymentIds = Array.from(new Set([...paymentIds, ...extra]));
    }

    const results: any[] = [];
    for (const pid of paymentIds) {
      try {
        const res = await deleteAsaasPayment(pid, ASAAS_API_KEY);
        results.push({ payment_id: pid, ...res });
      } catch (e: any) {
        results.push({ payment_id: pid, ok: false, error: e.message });
      }
    }

    console.log(`[asaas-delete-payment] por=${quem} pagamentos=${paymentIds.join(",")}`);
    const deleted = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    return new Response(JSON.stringify({ ok: true, deleted, failed_count: failed.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
