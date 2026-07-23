import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_BASE = "https://api.asaas.com/v3";
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function asaas(path: string, method: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": ASAAS_KEY },
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
  if (!ASAAS_KEY) return j({ ok: false, error: "Asaas não configurado (falta a chave no servidor)" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return j({ ok: false, error: "JSON inválido" }, 400); }

  const { lead_id } = body;
  const dueDay = Number(body.due_day);
  if (!lead_id) return j({ ok: false, error: "lead_id obrigatório" }, 400);
  if (![1, 5, 10, 15, 20, 25].includes(dueDay)) return j({ ok: false, error: "dia de vencimento deve ser 1, 5, 10, 15, 20 ou 25" }, 400);

  const { data: lead } = await supabase
    .from("crm_leads").select("id, name, email, phone, document, opportunity_value")
    .eq("id", lead_id).maybeSingle();
  if (!lead) return j({ ok: false, error: "lead não encontrado" }, 404);

  const cpf = String(lead.document || "").replace(/\D/g, "");
  if (!cpf) return j({ ok: false, error: "preencha o CPF/CNPJ do lead (o Asaas exige pra PIX)" }, 400);

  const amountCents = Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0
    ? Math.round(Number(body.amount_cents))
    : Math.round(Number(lead.opportunity_value || 0) * 100);
  if (!amountCents || amountCents < 100) return j({ ok: false, error: "valor inválido (mínimo R$ 1,00)" }, 400);

  const description = String(body.description || `Assinatura mensal — ${lead.name || "Cliente"}`).slice(0, 240);
  const phone = String(lead.phone || "").replace(/\D/g, "");

  try {
    // 1) Cliente Asaas (busca por CPF, cria se não existir)
    let customerId: string | null = null;
    const found = await asaas(`/customers?cpfCnpj=${cpf}`, "GET");
    if (found?.data?.length) customerId = found.data[0].id;
    if (!customerId) {
      const created = await asaas("/customers", "POST", {
        name: lead.name || "Cliente", cpfCnpj: cpf,
        email: lead.email || undefined,
        mobilePhone: phone || undefined,
      });
      customerId = created.id;
    }

    // 2) Assinatura mensal via PIX, vencimento no dia escolhido
    const sub = await asaas("/subscriptions", "POST", {
      customer: customerId, billingType: "PIX", value: amountCents / 100,
      cycle: "MONTHLY", nextDueDate: nextDueDate(dueDay), description,
    });

    // 3) Link do 1º pagamento (página PIX do Asaas)
    let url = "";
    let firstPaymentId = "";
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const pays = await asaas(`/subscriptions/${sub.id}/payments`, "GET");
      if (pays?.data?.length) { url = pays.data[0].invoiceUrl || pays.data[0].bankSlipUrl || ""; firstPaymentId = String(pays.data[0].id || ""); }
    } catch { /* segue sem link imediato */ }

    // 4) Lançamento no Financeiro (a receber, recorrente). Vinculado por asaas_payment_id.
    const { data: rec } = await supabase.from("financial_receivables").insert({
      description, amount: amountCents / 100, due_date: nextDueDate(dueDay),
      status: "pending", payment_method: "PIX", payment_link: url, is_recurring: true,
      asaas_payment_id: firstPaymentId || null, notes: `CRM · lead ${lead.name || lead_id}`,
    }).select("id").single();

    // 5) Registra o pagamento do lead
    const { data: row } = await supabase.from("crm_lead_payments").insert({
      lead_id, amount_cents: amountCents, description, provider: "asaas",
      billing_type: "PIX", recurring: true, due_day: dueDay,
      provider_ref: firstPaymentId || String(sub.id), url, status: "pending",
      receivable_id: rec?.id || null,
    }).select("id").single();

    return j({ ok: true, id: row?.id, url, subscription_id: sub.id, next_due: nextDueDate(dueDay) });
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) }, 400);
  }
});
