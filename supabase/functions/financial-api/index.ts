import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth: require either Bearer token (Supabase JWT) or x-api-key header
    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("x-api-key");

    if (!authHeader && !apiKey) {
      return new Response(JSON.stringify({ error: "Não autorizado. Envie Authorization: Bearer <token> ou x-api-key: <chave>" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If using Bearer token, validate user
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Verify staff access
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff) {
        return new Response(JSON.stringify({ error: "Acesso restrito a membros da equipe" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If using x-api-key, validate against stored keys
    if (apiKey && !authHeader) {
      const { data: keyRecord } = await supabase
        .from("api_keys")
        .select("id, is_active")
        .eq("key", apiKey)
        .eq("is_active", true)
        .maybeSingle();

      if (!keyRecord) {
        return new Response(JSON.stringify({ error: "API Key inválida" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "summary";
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const companyId = url.searchParams.get("company_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "500"), 2000);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    switch (endpoint) {
      case "summary": return await getSummary(supabase, corsHeaders);
      case "receivables": return await getReceivables(supabase, corsHeaders, { status, dateFrom, dateTo, companyId, limit, offset });
      case "payables": return await getPayables(supabase, corsHeaders, { status, dateFrom, dateTo, limit, offset });
      case "banks": return await getBanks(supabase, corsHeaders);
      case "transactions": return await getTransactions(supabase, corsHeaders, { dateFrom, dateTo, limit, offset });
      case "recurring": return await getRecurring(supabase, corsHeaders, { companyId });
      case "companies": return await getCompaniesFinancial(supabase, corsHeaders, { status });
      default:
        return new Response(JSON.stringify({
          error: "Endpoint não encontrado",
          available_endpoints: ["summary", "receivables", "payables", "banks", "transactions", "recurring", "companies"],
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("financial-api error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonResponse(data: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// ============ SUMMARY ============
async function getSummary(supabase: any, headers: Record<string, string>) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [invoicesRes, payablesRes, banksRes, recurringRes] = await Promise.all([
    supabase.from("company_invoices").select("id, amount_cents, due_date, status, paid_at, paid_amount_cents, late_fee_cents, interest_cents, discount_cents").limit(2000),
    supabase.from("financial_payables").select("id, amount, due_date, status, paid_amount, category_id").limit(2000),
    supabase.from("financial_banks").select("id, name, current_balance_cents").eq("is_active", true),
    supabase.from("company_recurring_charges").select("id, amount_cents, recurrence, is_active").eq("is_active", true),
  ]);

  const invoices = invoicesRes.data || [];
  const payables = payablesRes.data || [];
  const banks = banksRes.data || [];
  const recurring = recurringRes.data || [];

  const pendingReceivables = invoices.filter((i: any) => i.status === "pending");
  const overdueReceivables = pendingReceivables.filter((i: any) => i.due_date < today);
  const paidThisMonth = invoices.filter((i: any) => i.status === "paid" && i.paid_at && i.paid_at >= startOfMonth);

  const pendingPayables = payables.filter((p: any) => p.status === "pending");
  const overduePayables = pendingPayables.filter((p: any) => p.due_date < today);
  const paidPayablesMonth = payables.filter((p: any) => p.status === "paid" && p.paid_amount);

  const totalBankBalance = banks.reduce((s: number, b: any) => s + (Number(b.current_balance_cents || 0) / 100), 0);

  const mrr = recurring.reduce((s: number, r: any) => {
    let monthly = (r.amount_cents || 0) / 100;
    if (r.recurrence === "quarterly") monthly /= 3;
    if (r.recurrence === "semiannual") monthly /= 6;
    if (r.recurrence === "annual") monthly /= 12;
    return s + monthly;
  }, 0);

  return jsonResponse({
    date: today,
    bank_balance: {
      total: totalBankBalance,
      accounts: banks.map((b: any) => ({
        id: b.id,
        name: b.name,
        balance: Number(b.current_balance_cents || 0) / 100,
      })),
    },
    receivables: {
      total_pending: pendingReceivables.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0) / 100,
      total_overdue: overdueReceivables.reduce((s: number, i: any) => s + (i.amount_cents || 0), 0) / 100,
      received_this_month: paidThisMonth.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100,
      count_pending: pendingReceivables.length,
      count_overdue: overdueReceivables.length,
    },
    payables: {
      total_pending: pendingPayables.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      total_overdue: overduePayables.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      count_pending: pendingPayables.length,
      count_overdue: overduePayables.length,
    },
    mrr,
    active_recurring_charges: recurring.length,
  }, headers);
}

// ============ RECEIVABLES ============
async function getReceivables(supabase: any, headers: Record<string, string>, filters: any) {
  let query = supabase.from("company_invoices")
    .select("id, company_id, description, amount_cents, due_date, status, paid_at, paid_amount_cents, late_fee_cents, interest_cents, discount_cents, total_with_fees_cents, payment_method, installment_number, total_installments, notes, custom_receiver_name, created_at, updated_at")
    .order("due_date", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("due_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("due_date", filters.dateTo);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);

  const { data, error, count } = await query;
  if (error) throw error;

  return jsonResponse({
    data: (data || []).map((i: any) => ({
      ...i,
      amount: (i.amount_cents || 0) / 100,
      paid_amount: i.paid_amount_cents ? i.paid_amount_cents / 100 : null,
      late_fee: (i.late_fee_cents || 0) / 100,
      interest: (i.interest_cents || 0) / 100,
      discount: (i.discount_cents || 0) / 100,
      total_with_fees: i.total_with_fees_cents ? i.total_with_fees_cents / 100 : null,
    })),
    pagination: { limit: filters.limit, offset: filters.offset },
  }, headers);
}

// ============ PAYABLES ============
async function getPayables(supabase: any, headers: Record<string, string>, filters: any) {
  let query = supabase.from("financial_payables")
    .select("id, supplier_name, description, amount, due_date, status, paid_date, paid_amount, payment_method, category_id, cost_center_id, cost_center, cost_type, reference_month, installment_number, total_installments, notes, created_at, updated_at")
    .order("due_date", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("due_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("due_date", filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  return jsonResponse({
    data: data || [],
    pagination: { limit: filters.limit, offset: filters.offset },
  }, headers);
}

// ============ BANKS ============
async function getBanks(supabase: any, headers: Record<string, string>) {
  const { data, error } = await supabase.from("financial_banks")
    .select("id, name, bank_code, agency, account_number, initial_balance_cents, current_balance_cents, is_active, created_at")
    .order("name");

  if (error) throw error;

  return jsonResponse({
    data: (data || []).map((b: any) => ({
      ...b,
      initial_balance: (b.initial_balance_cents || 0) / 100,
      current_balance: (b.current_balance_cents || 0) / 100,
    })),
  }, headers);
}

// ============ TRANSACTIONS ============
async function getTransactions(supabase: any, headers: Record<string, string>, filters: any) {
  let query = supabase.from("financial_bank_transactions")
    .select("id, bank_id, type, amount_cents, description, reference_type, reference_id, discount_cents, interest_cents, fee_cents, created_at")
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  return jsonResponse({
    data: (data || []).map((t: any) => ({
      ...t,
      amount: (t.amount_cents || 0) / 100,
      discount: (t.discount_cents || 0) / 100,
      interest: (t.interest_cents || 0) / 100,
      fee: (t.fee_cents || 0) / 100,
    })),
    pagination: { limit: filters.limit, offset: filters.offset },
  }, headers);
}

// ============ RECURRING ============
async function getRecurring(supabase: any, headers: Record<string, string>, filters: any) {
  let query = supabase.from("company_recurring_charges")
    .select("id, company_id, description, amount_cents, payment_method, installments, recurrence, next_charge_date, is_active, customer_name, customer_email, customer_phone, notes, created_at")
    .order("created_at", { ascending: false });

  if (filters.companyId) query = query.eq("company_id", filters.companyId);

  const { data, error } = await query;
  if (error) throw error;

  return jsonResponse({
    data: (data || []).map((r: any) => ({
      ...r,
      amount: (r.amount_cents || 0) / 100,
    })),
  }, headers);
}

// ============ COMPANIES FINANCIAL ============
async function getCompaniesFinancial(supabase: any, headers: Record<string, string>, filters: any) {
  let query = supabase.from("onboarding_companies")
    .select("id, name, status, contract_value, segment, billing_day, contact_email, contact_phone, cnpj")
    .eq("is_simulator", false)
    .order("name");

  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  return jsonResponse({ data: data || [] }, headers);
}
