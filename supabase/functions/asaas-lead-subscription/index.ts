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

// Contas Asaas aceitas no CRM (Fabrício, 04/11/2026: "quero integrar também o banco Asaas UNV Social").
//   principal → segredo ASAAS_API_KEY do projeto (provider "asaas")
//   social    → conta "Asaas UNV Social" de asaas_accounts; a chave fica em
//               tenant_integration_secrets (reference_id = id da conta), como nas outras functions
type Conta = "principal" | "social";
const PROVIDER_POR_CONTA: Record<Conta, string> = { principal: "asaas", social: "asaas_social" };

async function resolverChave(supabase: any, conta: Conta): Promise<{ key: string; nome: string }> {
  if (conta === "principal") return { key: Deno.env.get("ASAAS_API_KEY") || "", nome: "Asaas" };
  const { data: acc } = await supabase.from("asaas_accounts")
    .select("id, name, api_key_secret_name").eq("is_active", true).ilike("name", "%social%")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!acc) return { key: "", nome: "Asaas UNV Social" };
  let key = "";
  const { data: porRef } = await supabase.from("tenant_integration_secrets")
    .select("secret_value").eq("provider", "asaas").eq("reference_id", acc.id).limit(1);
  key = porRef?.[0]?.secret_value || "";
  if (!key && acc.api_key_secret_name) {
    const { data: porNome } = await supabase.from("tenant_integration_secrets")
      .select("secret_value").eq("secret_name", acc.api_key_secret_name).limit(1);
    key = porNome?.[0]?.secret_value || Deno.env.get(acc.api_key_secret_name) || "";
  }
  return { key, nome: acc.name || "Asaas UNV Social" };
}

async function asaas(key: string, path: string, method: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": key },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* noop */ }
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas HTTP ${res.status}`);
  return data;
}

// Próxima data com o dia escolhido (1/5/10/15/20/25), nunca no passado
function nextDueDate(day: number): string {
  const now = new Date(Date.now() - 3 * 3600000); // BRT
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  const useMonth = today < day ? m : m + 1; // se o dia deste mês já passou, vai pro próximo
  const d = new Date(y, useMonth, day);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "use POST" }, 405);
  if (!req.headers.get("authorization")) return j({ ok: false, error: "não autenticado" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }); }

  const conta: Conta = body.account === "social" ? "social" : "principal";
  const { key: ASAAS_KEY, nome: nomeConta } = await resolverChave(supabase, conta);
  if (!ASAAS_KEY) return j({ ok: false, error: `${nomeConta} não configurado (chave da conta não encontrada)` });
  const provider = PROVIDER_POR_CONTA[conta];

  // Diagnóstico (sem expor a chave): conta resolvida e webhooks cadastrados nela
  if (body.action === "diagnostico") {
    try {
      const hooks = await asaas(ASAAS_KEY, "/webhooks", "GET");
      return j({ ok: true, conta: nomeConta, provider, webhooks: (hooks?.data || []).map((h: any) => ({ name: h.name, url: h.url, enabled: h.enabled, events: (h.events || []).length })) });
    } catch (e) { return j({ ok: false, conta: nomeConta, error: String((e as Error).message || e) }); }
  }

  const { lead_id } = body;
  const dueDay = Number(body.due_day);
  if (!lead_id) return j({ ok: false, error: "lead_id obrigatório" });
  if (![1, 5, 10, 15, 20, 25].includes(dueDay)) return j({ ok: false, error: "dia de vencimento deve ser 1, 5, 10, 15, 20 ou 25" });

  const { data: lead } = await supabase
    .from("crm_leads").select("id, name, email, phone, document, opportunity_value")
    .eq("id", lead_id).maybeSingle();
  if (!lead) return j({ ok: false, error: "lead não encontrado" });

  const cpf = String(lead.document || "").replace(/\D/g, "");
  if (!cpf) return j({ ok: false, error: "preencha o CPF/CNPJ do lead (o Asaas exige pra PIX)" });

  const amountCents = Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0
    ? Math.round(Number(body.amount_cents))
    : Math.round(Number(lead.opportunity_value || 0) * 100);
  if (!amountCents || amountCents < 100) return j({ ok: false, error: "valor inválido (mínimo R$ 1,00)" });

  const description = String(body.description || `Assinatura mensal — ${lead.name || "Cliente"}`).slice(0, 240);
  const phone = String(lead.phone || "").replace(/\D/g, "");

  try {
    // 1) Cliente Asaas (busca por CPF, cria se não existir)
    let customerId: string | null = null;
    const found = await asaas(ASAAS_KEY, `/customers?cpfCnpj=${cpf}`, "GET");
    if (found?.data?.length) customerId = found.data[0].id;
    if (!customerId) {
      const created = await asaas(ASAAS_KEY, "/customers", "POST", {
        name: lead.name || "Cliente", cpfCnpj: cpf,
        email: lead.email || undefined,
        mobilePhone: phone || undefined,
      });
      customerId = created.id;
    }

    // 2a) Pix Automático (09/11/2026): o lead paga a 1ª mensalidade por um QR Code que também autoriza
    // os débitos mensais seguintes no banco dele. O Asaas cria a assinatura sozinho a partir do mês seguinte.
    if (body.modo === "pix_automatico") {
      const primeira = nextDueDate(dueDay);
      const d = new Date(`${primeira}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1);
      const startDate = d.toISOString().slice(0, 10);
      const fimDoVencimento = new Date(`${primeira}T23:59:00-03:00`).getTime();
      const expirationSeconds = Math.round(Math.min(30 * 86400, Math.max(2 * 86400, (fimDoVencimento - Date.now()) / 1000)));
      const valor = amountCents / 100;
      const { data: row } = await supabase.from("crm_lead_payments").insert({
        lead_id, amount_cents: amountCents, description, provider,
        billing_type: "PIX_AUTOMATICO", recurring: true, due_day: dueDay,
        provider_ref: null, url: "", status: "pending", receivable_id: null,
      }).select("id").single();
      const contractId = `ld${String(row?.id || crypto.randomUUID()).replace(/-/g, "")}`.slice(0, 35);
      let auth: any;
      try {
        auth = await asaas(ASAAS_KEY, "/pix/automatic/authorizations", "POST", {
          customerId, frequency: "MONTHLY", contractId, startDate, value: valor,
          description: description.slice(0, 35), paymentCreationMode: "SUBSCRIPTION",
          retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
          immediateQrCode: { originalValue: valor, expirationSeconds, description: description.slice(0, 35) },
        });
      } catch (e) {
        if (row?.id) await supabase.from("crm_lead_payments").delete().eq("id", row.id);
        throw e;
      }
      const qrPayload = auth?.immediateQrCode?.payload || auth?.payload || null;
      const qrImage = auth?.immediateQrCode?.encodedImage || auth?.encodedImage || null;
      const link = `https://unvholdings.com.br/#/pix-automatico/${auth.id}`;
      await supabase.from("asaas_pix_automatico").upsert({
        id: auth.id, origem: "lead", lead_id, lead_payment_id: row?.id || null, conta_crm: conta,
        customer_id: customerId, subscription_id: auth.subscriptionId || null, contract_id: contractId,
        valor_cents: amountCents, frequencia: "MONTHLY", primeira_cobranca: primeira, start_date: startDate,
        descricao: description, cliente_nome: lead.name || null, status: auth.status || "CREATED",
        qr_payload: qrPayload, qr_image: qrImage,
        qr_expira_em: new Date(Date.now() + expirationSeconds * 1000).toISOString(),
        ultimo_evento: "criada", atualizado_em: new Date().toISOString(),
      });
      // provider_ref = autorização: o webhook casa o 1º pagamento por pixAutomaticAuthorizationId
      if (row?.id) await supabase.from("crm_lead_payments").update({ provider_ref: auth.id, url: link }).eq("id", row.id);
      return j({
        ok: true, id: row?.id, url: link, pix_automatico: true, authorization_id: auth.id, subscription_id: auth.subscriptionId || null,
        next_due: primeira, start_date: startDate, conta: nomeConta,
        pix_auto: { id: auth.id, status: auth.status || "CREATED", payload: qrPayload, image: qrImage, link, start_date: startDate, primeira_cobranca: primeira },
      });
    }

    // 2) Assinatura mensal via PIX, vencimento no dia escolhido
    const sub = await asaas(ASAAS_KEY, "/subscriptions", "POST", {
      customer: customerId, billingType: "PIX", value: amountCents / 100,
      cycle: "MONTHLY", nextDueDate: nextDueDate(dueDay), description,
    });

    // 3) Link do 1º pagamento (página PIX do Asaas)
    let url = "";
    let firstPaymentId = "";
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const pays = await asaas(ASAAS_KEY, `/subscriptions/${sub.id}/payments`, "GET");
      if (pays?.data?.length) { url = pays.data[0].invoiceUrl || pays.data[0].bankSlipUrl || ""; firstPaymentId = String(pays.data[0].id || ""); }
    } catch { /* segue sem link imediato */ }

    // 4) O lançamento no Financeiro só nasce quando a cobrança é paga de fato
    // (asaas-webhook cria o recebível já pago) — link gerado não polui o
    // Contas a Receber.
    const rec: { id: string } | null = null;

    // 5) Registra o pagamento do lead
    const { data: row } = await supabase.from("crm_lead_payments").insert({
      lead_id, amount_cents: amountCents, description, provider,
      billing_type: "PIX", recurring: true, due_day: dueDay,
      provider_ref: firstPaymentId || String(sub.id), url, status: "pending",
      receivable_id: rec?.id || null,
    }).select("id").single();

    return j({ ok: true, id: row?.id, url, subscription_id: sub.id, next_due: nextDueDate(dueDay), conta: nomeConta });
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) });
  }
});
