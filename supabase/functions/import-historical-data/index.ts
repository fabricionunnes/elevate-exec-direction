import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, data } = await req.json();

    // Load bank mapping
    const { data: banks } = await supabase.from("financial_banks").select("id, name");
    const bankMap: Record<string, string> = {};
    for (const b of banks || []) {
      bankMap[b.name.toLowerCase()] = b.id;
    }
    // Aliases
    bankMap["conta pj conta azul ip"] = bankMap["conta azul"] || "";
    bankMap["conta c6"] = bankMap["c6 fabrício"] || "";

    // Load category mapping
    const { data: categories } = await supabase.from("financial_categories").select("id, name");
    const catMap: Record<string, string> = {};
    for (const c of categories || []) {
      catMap[c.name.toLowerCase()] = c.id;
    }

    // Load cost center mapping
    const { data: costCenters } = await supabase.from("staff_financial_cost_centers").select("id, name");
    const ccMap: Record<string, string> = {};
    for (const cc of costCenters || []) {
      ccMap[cc.name.toLowerCase()] = cc.id;
    }

    // Category name mapping from spreadsheet → DB
    const categoryMapping: Record<string, string> = {
      "salários": "salários e encargos",
      "pró labore": "salários e encargos",
      "benefícios": "salários e encargos",
      "comissões": "comissões",
      "serviço de marketing": "marketing e anúncios",
      "tráfego pago": "marketing e anúncios",
      "impostos": "impostos e taxas",
      "tecnologia / ferramentas": "ferramentas e software",
      "honorários contábeis": "serviços terceirizados",
      "prestação de serviço": "serviços terceirizados",
      "administrativa": "outros despesas",
      "tarifas bancárias": "impostos e taxas",
      "taxas bancárias": "impostos e taxas",
      "correção de saldo": "outros despesas",
      "aluguel": "infraestrutura",
      "telefonia": "infraestrutura",
      "doações": "outros despesas",
      "investimento": "outros despesas",
      "estorno / reembolso": "outros despesas",
      "brindes": "marketing e anúncios",
      "empréstimos bancários": "outros despesas",
      "distribuição de lucros": "outros despesas",
      "cartão de crédito": "outros despesas",
      "outras despesas": "outros despesas",
      // Receivable categories
      "1.5- outras receitas": "outros receitas",
      "1.1- sirius recorrente": "mensalidades",
      "1.3- taurus recorrente": "mensalidades",
      "1.2- vega recorrente": "mensalidades",
      "1.4- unv holdings": "outros receitas",
      "2.1- sirius à vista / cartão": "projetos avulsos",
      "6.1- devolução": "outros receitas",
      "unv ads": "outros receitas",
    };

    // Cost center name mapping from spreadsheet → DB
    const costCenterMapping: Record<string, string> = {
      "folha de pagamento": "administrativo",
      "comercial": "comercial",
      "marketing": "marketing",
      "filantropia": "filantropia",
      "financeiro": "financeiro",
      "despesas com anúncios": "marketing",
      "site": "marketing",
      "infraestrutura": "administrativo",
      "sistemas": "administrativo",
      "telefonia": "administrativo",
      "outros": "administrativo",
      "despesas com serviços": "administrativo",
      "deduções sobre vendas": "comercial",
      "investimentos": "administrativo",
      "educação": "administrativo",
      "mastermind": "administrativo",
      "liderança": "administrativo",
      "administrativo": "administrativo",
      // Receivable cost centers
      "receita com pretação de serviços": "comercial",
      "diamond": "unv core",
      "platinum 2.0": "unv core",
      "platinum 1.0": "unv core",
      "platinum": "unv core",
      "titanium": "unv core",
      "sirius": "unv core",
      "vega": "unv core",
      "imperium": "unv core",
      "multa de cancelamento": "financeiro",
      "unv holdings": "administrativo",
      "unv social": "unv social" in ccMap ? "unv social" : "administrativo",
      "unv ads": "unv ads" in ccMap ? "unv ads" : "marketing",
    };

    function resolveBankId(bankName: string): string | null {
      if (!bankName) return null;
      // Handle composite bank names like "Conta PJ Conta Azul IP / Itaú - Conta Corrente"
      const firstName = bankName.split(" / ")[0].trim();
      return bankMap[firstName.toLowerCase()] || null;
    }

    function resolveCategoryId(catName: string): string | null {
      if (!catName) return null;
      const lower = catName.toLowerCase().trim();
      // Direct match
      if (catMap[lower]) return catMap[lower];
      // Via mapping
      const mapped = categoryMapping[lower];
      if (mapped && catMap[mapped]) return catMap[mapped];
      return null;
    }

    function resolveCostCenterId(ccName: string): string | null {
      if (!ccName) return null;
      const lower = ccName.toLowerCase().trim();
      // Direct match
      if (ccMap[lower]) return ccMap[lower];
      // Via mapping
      const mapped = costCenterMapping[lower];
      if (mapped && ccMap[mapped]) return ccMap[mapped];
      return null;
    }

    function parseDate(dateStr: string): string | null {
      if (!dateStr) return null;
      // DD/MM/YYYY → YYYY-MM-DD
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      return null;
    }

    function parseAmount(amountStr: string): number {
      if (!amountStr || amountStr === "-") return 0;
      // Handle Brazilian number format: 1.234,56 or 1234.56
      const cleaned = amountStr.replace(/[^\d.,\-]/g, "");
      // If has comma, it's Brazilian format
      if (cleaned.includes(",")) {
        return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
      }
      return parseFloat(cleaned) || 0;
    }

    function mapStatus(situacao: string): string {
      const s = situacao?.toLowerCase().trim();
      if (s === "quitado") return "paid";
      if (s === "quitado parcial") return "partial";
      if (s === "atrasado") return "pending";
      return "pending";
    }

    let inserted = 0;
    let skipped = 0;
    let errors: string[] = [];

    if (type === "receivables") {
      for (const row of data) {
        try {
          const clientName = row.client_name || "";
          const description = row.description || "Sem descrição";
          const amount = parseAmount(row.amount);
          const amountCents = Math.round(amount * 100);
          const paidAmount = parseAmount(row.paid_amount);
          const paidAmountCents = paidAmount > 0 ? Math.round(paidAmount * 100) : null;
          const dueDate = parseDate(row.due_date);
          const paidAt = parseDate(row.paid_at);
          const status = mapStatus(row.status);
          const paymentMethod = row.payment_method || null;
          const bankId = resolveBankId(row.bank_name);
          const notes = row.notes || null;
          const categoryId = resolveCategoryId(row.category_name);
          const costCenterId = resolveCostCenterId(row.cost_center_name);
          const discountCents = Math.round(parseAmount(row.discount) * 100);
          const interestCents = Math.round(parseAmount(row.interest) * 100);
          const lateFee = Math.round(parseAmount(row.late_fee) * 100);

          if (!dueDate || amountCents === 0) {
            skipped++;
            continue;
          }

          // Dedup check: custom_receiver_name + due_date + amount_cents + description
          const { data: existing } = await supabase
            .from("company_invoices")
            .select("id")
            .eq("custom_receiver_name", clientName)
            .eq("due_date", dueDate)
            .eq("amount_cents", amountCents)
            .eq("description", description)
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }

          const { error } = await supabase.from("company_invoices").insert({
            custom_receiver_name: clientName || "Sem nome",
            description,
            amount_cents: amountCents,
            paid_amount_cents: paidAmountCents,
            due_date: dueDate,
            paid_at: paidAt,
            status,
            payment_method: paymentMethod,
            bank_id: bankId,
            notes,
            category_id: categoryId,
            cost_center_id: costCenterId,
            discount_cents: discountCents,
            interest_cents: interestCents,
            late_fee_cents: lateFee,
          });

          if (error) {
            errors.push(`Recv ${clientName} ${dueDate}: ${error.message}`);
          } else {
            inserted++;
          }
        } catch (e) {
          errors.push(`Recv error: ${e.message}`);
        }
      }
    } else if (type === "payables") {
      for (const row of data) {
        try {
          const supplierName = row.supplier_name || "Sem fornecedor";
          const description = row.description || "Sem descrição";
          const amount = parseAmount(row.amount);
          const paidAmount = parseAmount(row.paid_amount);
          const dueDate = parseDate(row.due_date);
          const paidDate = parseDate(row.paid_date);
          const status = mapStatus(row.status);
          const paymentMethod = row.payment_method || null;
          const bankId = resolveBankId(row.bank_name);
          const notes = row.notes || null;
          const categoryId = resolveCategoryId(row.category_name);
          const costCenterId = resolveCostCenterId(row.cost_center_name);
          const costCenter = row.cost_center_name || null;

          if (!dueDate || amount === 0) {
            skipped++;
            continue;
          }

          const { error } = await supabase.from("financial_payables").insert({
            supplier_name: supplierName,
            description,
            amount,
            paid_amount: paidAmount > 0 ? paidAmount : null,
            due_date: dueDate,
            paid_date: paidDate,
            status,
            payment_method: paymentMethod,
            bank_id: bankId,
            notes,
            category_id: categoryId,
            cost_center_id: costCenterId,
            cost_center: costCenter,
          });

          if (error) {
            errors.push(`Pay ${supplierName} ${dueDate}: ${error.message}`);
          } else {
            inserted++;
          }
        } catch (e) {
          errors.push(`Pay error: ${e.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        type,
        inserted,
        skipped,
        errors: errors.slice(0, 20),
        total_errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
