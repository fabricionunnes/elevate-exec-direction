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

    // Auth
    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("x-api-key");

    if (!authHeader && !apiKey) {
      return json({ error: "Não autorizado. Envie Authorization: Bearer <token> ou x-api-key: <chave>" }, 401);
    }

    let callerTenantId: string | null = null; // null = master UNV

    if (authHeader && !apiKey) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return json({ error: "Token inválido" }, 401);
      const { data: staff } = await supabase.from("onboarding_staff").select("id, role, tenant_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!staff) return json({ error: "Acesso restrito a membros da equipe" }, 403);
      callerTenantId = (staff as any).tenant_id ?? null;
    }

    if (apiKey && !authHeader) {
      const { data: keyRecord } = await supabase.from("api_keys").select("id, is_active, tenant_id").eq("key", apiKey).eq("is_active", true).maybeSingle();
      if (!keyRecord) return json({ error: "API Key inválida" }, 401);
      // Update last_used_at
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() } as any).eq("id", keyRecord.id);
      callerTenantId = (keyRecord as any).tenant_id ?? null;
    }

    // Isolamento por tenant: a Financial API ainda não filtra dados por tenant_id.
    // Por segurança, apenas o tenant master UNV (tenant_id = NULL) pode usar esta API.
    // Tenants White-Label devem usar a UI; o acesso programático será liberado quando o filtro
    // por tenant for aplicado em cada endpoint.
    if (callerTenantId !== null) {
      return json({
        error: "Acesso à API indisponível para este tenant. Esta API ainda não está liberada para tenants White-Label.",
        code: "TENANT_API_DISABLED",
      }, 403);
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "summary";
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("date_from");
    const dateTo = url.searchParams.get("date_to");
    const companyId = url.searchParams.get("company_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "500"), 5000);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const filters = { status, dateFrom, dateTo, companyId, limit, offset };

    const handlers: Record<string, () => Promise<Response>> = {
      summary: () => getSummary(supabase),
      receivables: () => getReceivables(supabase, filters),
      payables: () => getPayables(supabase, filters),
      banks: () => getBanks(supabase),
      transactions: () => getTransactions(supabase, filters),
      recurring: () => getRecurring(supabase, filters),
      companies: () => getCompanies(supabase, filters),
      suppliers: () => getSuppliers(supabase, filters),
      categories: () => getCategories(supabase),
      cost_centers: () => getCostCenters(supabase),
      contracts: () => getContracts(supabase, filters),
      payment_links: () => getPaymentLinks(supabase, filters),
      billing_rules: () => getBillingRules(supabase),
      overdue_clients: () => getOverdueClients(supabase),
      delinquency_report: () => getDelinquencyReport(supabase),
      cashflow: () => getCashflow(supabase, filters),
      dre: () => getDRE(supabase, filters),
    };

    const handler = handlers[endpoint];
    if (!handler) {
      return json({ error: "Endpoint não encontrado", available_endpoints: Object.keys(handlers) }, 404);
    }
    return await handler();
  } catch (e) {
    console.error("financial-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function centsToReal(cents: number | null | undefined) {
  return (Number(cents) || 0) / 100;
}

// ===== SUMMARY =====
async function getSummary(sb: any) {
  const today = new Date().toISOString().split("T")[0];
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [inv, pay, banks, rec] = await Promise.all([
    sb.from("company_invoices").select("id, amount_cents, due_date, status, paid_at, paid_amount_cents").limit(5000),
    sb.from("financial_payables").select("id, amount, due_date, status, paid_amount").limit(5000),
    sb.from("financial_banks").select("id, name, current_balance_cents").eq("is_active", true),
    sb.from("company_recurring_charges").select("id, amount_cents, recurrence").eq("is_active", true),
  ]);

  const invoices = inv.data || [];
  const payables = pay.data || [];
  const banksList = banks.data || [];
  const recurring = rec.data || [];

  const pending = invoices.filter((i: any) => i.status === "pending");
  const overdue = pending.filter((i: any) => i.due_date < today);
  const paidMonth = invoices.filter((i: any) => i.status === "paid" && i.paid_at >= startOfMonth);
  const pendingPay = payables.filter((p: any) => p.status === "pending");
  const overduePay = pendingPay.filter((p: any) => p.due_date < today);

  const mrr = recurring.reduce((s: number, r: any) => {
    let m = centsToReal(r.amount_cents);
    if (r.recurrence === "quarterly") m /= 3;
    if (r.recurrence === "semiannual") m /= 6;
    if (r.recurrence === "annual") m /= 12;
    return s + m;
  }, 0);

  return json({
    date: today,
    bank_balance: {
      total: banksList.reduce((s: number, b: any) => s + centsToReal(b.current_balance_cents), 0),
      accounts: banksList.map((b: any) => ({ id: b.id, name: b.name, balance: centsToReal(b.current_balance_cents) })),
    },
    receivables: {
      total_pending: pending.reduce((s: number, i: any) => s + centsToReal(i.amount_cents), 0),
      total_overdue: overdue.reduce((s: number, i: any) => s + centsToReal(i.amount_cents), 0),
      received_this_month: paidMonth.reduce((s: number, i: any) => s + centsToReal(i.paid_amount_cents || i.amount_cents), 0),
      count_pending: pending.length,
      count_overdue: overdue.length,
    },
    payables: {
      total_pending: pendingPay.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      total_overdue: overduePay.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
      count_pending: pendingPay.length,
      count_overdue: overduePay.length,
    },
    mrr,
    active_recurring_charges: recurring.length,
    total_invoices: invoices.length,
    total_payables: payables.length,
  });
}

// ===== RECEIVABLES =====
async function getReceivables(sb: any, f: any) {
  let q = sb.from("company_invoices")
    .select("id, company_id, description, amount_cents, due_date, status, paid_at, paid_amount_cents, late_fee_cents, interest_cents, discount_cents, total_with_fees_cents, payment_method, installment_number, total_installments, notes, custom_receiver_name, category_id, cost_center_id, bank_id, recurring_charge_id, payment_link_url, created_at, updated_at")
    .order("due_date", { ascending: false }).range(f.offset, f.offset + f.limit - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.dateFrom) q = q.gte("due_date", f.dateFrom);
  if (f.dateTo) q = q.lte("due_date", f.dateTo);
  if (f.companyId) q = q.eq("company_id", f.companyId);
  const { data, error } = await q;
  if (error) throw error;
  return json({
    data: (data || []).map((i: any) => ({
      ...i, amount: centsToReal(i.amount_cents), paid_amount: i.paid_amount_cents ? centsToReal(i.paid_amount_cents) : null,
      late_fee: centsToReal(i.late_fee_cents), interest: centsToReal(i.interest_cents), discount: centsToReal(i.discount_cents),
      total_with_fees: i.total_with_fees_cents ? centsToReal(i.total_with_fees_cents) : null,
    })),
    pagination: { limit: f.limit, offset: f.offset },
  });
}

// ===== PAYABLES =====
async function getPayables(sb: any, f: any) {
  let q = sb.from("financial_payables")
    .select("id, supplier_name, description, amount, due_date, status, paid_date, paid_amount, payment_method, category_id, cost_center_id, cost_center, cost_type, bank_id, reference_month, installment_number, total_installments, notes, is_recurring, recurrence_type, created_at, updated_at")
    .order("due_date", { ascending: false }).range(f.offset, f.offset + f.limit - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.dateFrom) q = q.gte("due_date", f.dateFrom);
  if (f.dateTo) q = q.lte("due_date", f.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return json({ data: data || [], pagination: { limit: f.limit, offset: f.offset } });
}

// ===== BANKS =====
async function getBanks(sb: any) {
  const { data, error } = await sb.from("financial_banks")
    .select("id, name, bank_code, agency, account_number, initial_balance_cents, current_balance_cents, is_active, created_at").order("name");
  if (error) throw error;
  return json({ data: (data || []).map((b: any) => ({ ...b, initial_balance: centsToReal(b.initial_balance_cents), current_balance: centsToReal(b.current_balance_cents) })) });
}

// ===== TRANSACTIONS =====
async function getTransactions(sb: any, f: any) {
  let q = sb.from("financial_bank_transactions")
    .select("id, bank_id, type, amount_cents, description, reference_type, reference_id, discount_cents, interest_cents, fee_cents, created_at")
    .order("created_at", { ascending: false }).range(f.offset, f.offset + f.limit - 1);
  if (f.dateFrom) q = q.gte("created_at", f.dateFrom);
  if (f.dateTo) q = q.lte("created_at", f.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return json({
    data: (data || []).map((t: any) => ({ ...t, amount: centsToReal(t.amount_cents), discount: centsToReal(t.discount_cents), interest: centsToReal(t.interest_cents), fee: centsToReal(t.fee_cents) })),
    pagination: { limit: f.limit, offset: f.offset },
  });
}

// ===== RECURRING =====
async function getRecurring(sb: any, f: any) {
  let q = sb.from("company_recurring_charges")
    .select("id, company_id, description, amount_cents, payment_method, installments, recurrence, next_charge_date, is_active, customer_name, customer_email, customer_phone, customer_document, notes, category_id, cost_center_id, asaas_account_id, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (f.companyId) q = q.eq("company_id", f.companyId);
  if (f.status === "active") q = q.eq("is_active", true);
  if (f.status === "inactive") q = q.eq("is_active", false);
  const { data, error } = await q;
  if (error) throw error;
  return json({ data: (data || []).map((r: any) => ({ ...r, amount: centsToReal(r.amount_cents) })) });
}

// ===== COMPANIES =====
async function getCompanies(sb: any, f: any) {
  let q = sb.from("onboarding_companies")
    .select("id, name, status, contract_value, segment, billing_day, contact_email, contact_phone, cnpj, responsible_staff_id, created_at, updated_at")
    .eq("is_simulator", false).order("name");
  if (f.status) q = q.eq("status", f.status);
  const { data, error } = await q;
  if (error) throw error;
  return json({ data: data || [] });
}

// ===== SUPPLIERS =====
async function getSuppliers(sb: any, f: any) {
  let q = sb.from("financial_suppliers")
    .select("id, name, cnpj, email, phone, contact_name, notes, is_active, created_at, updated_at")
    .order("name");
  if (f.status === "active") q = q.eq("is_active", true);
  if (f.status === "inactive") q = q.eq("is_active", false);
  const { data, error } = await q;
  if (error) throw error;
  return json({ data: data || [] });
}

// ===== CATEGORIES =====
async function getCategories(sb: any) {
  const { data, error } = await sb.from("staff_financial_categories")
    .select("id, name, type, group_name, parent_id, dre_line, dfc_section, sort_order, is_active, cost_type, created_at").order("sort_order");
  if (error) throw error;
  return json({ data: data || [] });
}

// ===== COST CENTERS =====
async function getCostCenters(sb: any) {
  const { data, error } = await sb.from("staff_financial_cost_centers")
    .select("id, name, description, is_active, sort_order, created_at").order("sort_order");
  if (error) throw error;
  return json({ data: data || [] });
}

// ===== CONTRACTS =====
async function getContracts(sb: any, f: any) {
  let q = sb.from("financial_contracts")
    .select("id, company_id, contract_name, contract_type, billing_cycle, contract_value, start_date, end_date, payment_day, payment_method, status, notes, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.companyId) q = q.eq("company_id", f.companyId);
  const { data, error } = await q;
  if (error) throw error;
  return json({ data: data || [] });
}

// ===== PAYMENT LINKS =====
async function getPaymentLinks(sb: any, f: any) {
  let q = sb.from("payment_links")
    .select("id, description, amount_cents, payment_method, installments, url, provider, company_id, created_at")
    .order("created_at", { ascending: false }).range(f.offset, f.offset + f.limit - 1);
  if (f.companyId) q = q.eq("company_id", f.companyId);
  const { data, error } = await q;
  if (error) throw error;
  return json({
    data: (data || []).map((l: any) => ({ ...l, amount: centsToReal(l.amount_cents) })),
    pagination: { limit: f.limit, offset: f.offset },
  });
}

// ===== BILLING RULES =====
async function getBillingRules(sb: any) {
  const { data, error } = await sb.from("billing_notification_rules")
    .select("id, name, trigger_type, days_offset, message_template, is_active, include_payment_link, include_interest_info, include_discount_info, created_at, updated_at").order("days_offset");
  if (error) throw error;
  return json({ data: data || [] });
}

// ===== OVERDUE CLIENTS =====
async function getOverdueClients(sb: any) {
  const today = new Date().toISOString().split("T")[0];
  // Inclui status 'pending' e 'overdue' (asaas pode marcar como overdue automaticamente)
  // Usa lte para incluir faturas que vencem hoje
  const { data: overdueInvoices, error } = await sb.from("company_invoices")
    .select("id, company_id, description, amount_cents, due_date, status")
    .in("status", ["pending", "overdue"]).lte("due_date", today).order("due_date");
  if (error) throw error;

  // Group by company
  const companyIds = [...new Set((overdueInvoices || []).map((i: any) => i.company_id).filter(Boolean))];
  let companiesMap: Record<string, any> = {};
  if (companyIds.length > 0) {
    const { data: companies } = await sb.from("onboarding_companies")
      .select("id, name, contact_email, contact_phone, cnpj, segment").in("id", companyIds);
    (companies || []).forEach((c: any) => { companiesMap[c.id] = c; });
  }

  const grouped: Record<string, any> = {};
  (overdueInvoices || []).forEach((inv: any) => {
    // faturas sem company_id são agrupadas como "sem_vinculo"
    const groupKey = inv.company_id || "sem_vinculo";
    if (!grouped[groupKey]) {
      const co = companiesMap[inv.company_id] || {};
      grouped[groupKey] = {
        company_id: inv.company_id || null,
        company_name: co.name || "Desconhecida",
        contact_email: co.contact_email || null,
        contact_phone: co.contact_phone || null,
        cnpj: co.cnpj || null,
        segment: co.segment || null,
        total_overdue: 0,
        invoices_count: 0,
        oldest_due_date: inv.due_date,
        invoices: [],
      };
    }
    grouped[groupKey].total_overdue += centsToReal(inv.amount_cents);
    grouped[groupKey].invoices_count++;
    grouped[groupKey].invoices.push({
      id: inv.id, description: inv.description, amount: centsToReal(inv.amount_cents), due_date: inv.due_date, status: inv.status,
    });
    if (inv.due_date < grouped[groupKey].oldest_due_date) {
      grouped[groupKey].oldest_due_date = inv.due_date;
    }
  });

  const result = Object.values(grouped).sort((a: any, b: any) => b.total_overdue - a.total_overdue);
  return json({ data: result, total_clients: result.length, total_overdue: result.reduce((s: number, c: any) => s + c.total_overdue, 0) });
}

// ===== DELINQUENCY REPORT =====
async function getDelinquencyReport(sb: any) {
  const today = new Date().toISOString().split("T")[0];
  const { data: allInvoices } = await sb.from("company_invoices")
    .select("id, company_id, amount_cents, due_date, status, paid_at").limit(5000);

  const invoices = allInvoices || [];
  const due = invoices.filter((i: any) => i.due_date <= today);
  const overdue = due.filter((i: any) => i.status === "pending");
  const paid = due.filter((i: any) => i.status === "paid");
  const paidLate = paid.filter((i: any) => i.paid_at && i.paid_at.split("T")[0] > i.due_date);

  // By aging
  const now = new Date();
  const aging = { "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  overdue.forEach((i: any) => {
    const days = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000);
    if (days <= 30) aging["1-30"] += centsToReal(i.amount_cents);
    else if (days <= 60) aging["31-60"] += centsToReal(i.amount_cents);
    else if (days <= 90) aging["61-90"] += centsToReal(i.amount_cents);
    else aging["90+"] += centsToReal(i.amount_cents);
  });

  return json({
    total_due_invoices: due.length,
    total_overdue_invoices: overdue.length,
    total_paid_on_time: paid.length - paidLate.length,
    total_paid_late: paidLate.length,
    delinquency_rate: due.length > 0 ? ((overdue.length / due.length) * 100).toFixed(1) + "%" : "0%",
    total_overdue_amount: overdue.reduce((s: number, i: any) => s + centsToReal(i.amount_cents), 0),
    aging_breakdown: aging,
  });
}

// ===== CASHFLOW =====
async function getCashflow(sb: any, f: any) {
  const dateFrom = f.dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const dateTo = f.dateTo || new Date(new Date().getFullYear(), new Date().getMonth() + 3, 0).toISOString().split("T")[0];

  const [invRes, payRes, banksRes] = await Promise.all([
    sb.from("company_invoices").select("id, amount_cents, due_date, status, paid_at, paid_amount_cents").gte("due_date", dateFrom).lte("due_date", dateTo),
    sb.from("financial_payables").select("id, amount, due_date, status, paid_date, paid_amount").gte("due_date", dateFrom).lte("due_date", dateTo),
    sb.from("financial_banks").select("id, name, current_balance_cents").eq("is_active", true),
  ]);

  const invoices = invRes.data || [];
  const payables = payRes.data || [];
  const totalBalance = (banksRes.data || []).reduce((s: number, b: any) => s + centsToReal(b.current_balance_cents), 0);

  // Group by month
  const months: Record<string, { income: number; expense: number; received: number; paid: number }> = {};
  invoices.forEach((i: any) => {
    const m = i.due_date.substring(0, 7);
    if (!months[m]) months[m] = { income: 0, expense: 0, received: 0, paid: 0 };
    months[m].income += centsToReal(i.amount_cents);
    if (i.status === "paid") months[m].received += centsToReal(i.paid_amount_cents || i.amount_cents);
  });
  payables.forEach((p: any) => {
    const m = p.due_date.substring(0, 7);
    if (!months[m]) months[m] = { income: 0, expense: 0, received: 0, paid: 0 };
    months[m].expense += Number(p.amount || 0);
    if (p.status === "paid") months[m].paid += Number(p.paid_amount || p.amount || 0);
  });

  const sortedMonths = Object.keys(months).sort();
  let runningBalance = totalBalance;
  const projection = sortedMonths.map(m => {
    const d = months[m];
    const net = d.income - d.expense;
    const result = { month: m, expected_income: d.income, expected_expense: d.expense, net, projected_balance: runningBalance + net, already_received: d.received, already_paid: d.paid };
    runningBalance += net;
    return result;
  });

  return json({ current_balance: totalBalance, period: { from: dateFrom, to: dateTo }, projection });
}

// ===== DRE =====
async function getDRE(sb: any, f: any) {
  const year = f.dateFrom ? parseInt(f.dateFrom.substring(0, 4)) : new Date().getFullYear();
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  const [invRes, payRes, catRes] = await Promise.all([
    sb.from("company_invoices").select("id, amount_cents, paid_amount_cents, due_date, status, paid_at, category_id").gte("due_date", dateFrom).lte("due_date", dateTo),
    sb.from("financial_payables").select("id, amount, paid_amount, due_date, status, paid_date, category_id").gte("due_date", dateFrom).lte("due_date", dateTo),
    sb.from("staff_financial_categories").select("id, name, type, group_name, dre_line"),
  ]);

  const invoices = invRes.data || [];
  const payables = payRes.data || [];
  const categories = catRes.data || [];
  const catMap: Record<string, any> = {};
  categories.forEach((c: any) => { catMap[c.id] = c; });

  const totalRevenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + centsToReal(i.paid_amount_cents || i.amount_cents), 0);
  const expectedRevenue = invoices.reduce((s: number, i: any) => s + centsToReal(i.amount_cents), 0);
  const totalExpenses = payables.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.paid_amount || p.amount || 0), 0);
  const expectedExpenses = payables.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  // Group expenses by category
  const expensesByCategory: Record<string, number> = {};
  payables.filter((p: any) => p.status === "paid").forEach((p: any) => {
    const cat = p.category_id && catMap[p.category_id] ? catMap[p.category_id].name : "Sem categoria";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(p.paid_amount || p.amount || 0);
  });

  // Monthly breakdown
  const monthly: Record<string, { revenue: number; expenses: number }> = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    monthly[key] = { revenue: 0, expenses: 0 };
  }
  invoices.filter((i: any) => i.status === "paid").forEach((i: any) => {
    const m = (i.paid_at || i.due_date).substring(0, 7);
    if (monthly[m]) monthly[m].revenue += centsToReal(i.paid_amount_cents || i.amount_cents);
  });
  payables.filter((p: any) => p.status === "paid").forEach((p: any) => {
    const m = (p.paid_date || p.due_date).substring(0, 7);
    if (monthly[m]) monthly[m].expenses += Number(p.paid_amount || p.amount || 0);
  });

  return json({
    year,
    realized: { revenue: totalRevenue, expenses: totalExpenses, profit: totalRevenue - totalExpenses, margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) + "%" : "0%" },
    expected: { revenue: expectedRevenue, expenses: expectedExpenses, profit: expectedRevenue - expectedExpenses },
    expenses_by_category: expensesByCategory,
    monthly: Object.entries(monthly).map(([m, d]) => ({ month: m, revenue: d.revenue, expenses: d.expenses, profit: d.revenue - d.expenses })),
  });
}
