import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages, context } = await req.json();

    // Gather financial data for context
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];

    const [invoicesRes, payablesRes, banksRes, companiesRes, recurringRes] = await Promise.all([
      supabase.from("company_invoices").select("id, amount_cents, due_date, status, paid_at, paid_amount_cents, late_fee_cents, interest_cents, total_with_fees_cents, company_id, recurring_charge_id").order("due_date", { ascending: false }).limit(500),
      supabase.from("financial_payables").select("id, description, amount, due_date, status, category, paid_at, paid_amount").order("due_date", { ascending: false }).limit(500),
      supabase.from("financial_banks").select("id, name, current_balance").eq("is_active", true),
      supabase.from("onboarding_companies").select("id, name, status, contract_value, segment").eq("is_simulator", false),
      supabase.from("company_recurring_charges").select("id, amount_cents, recurrence, is_active, company_id").eq("is_active", true),
    ]);

    const invoices = invoicesRes.data || [];
    const payables = payablesRes.data || [];
    const banks = banksRes.data || [];
    const companies = companiesRes.data || [];
    const recurring = recurringRes.data || [];

    // Calculate key metrics
    const totalReceivable = invoices.filter(i => i.status === "pending").reduce((s, i) => s + (i.amount_cents || 0), 0) / 100;
    const totalOverdue = invoices.filter(i => i.status === "pending" && i.due_date < now.toISOString().split("T")[0]).reduce((s, i) => s + (i.amount_cents || 0), 0) / 100;
    const totalPaidMonth = invoices.filter(i => i.status === "paid" && i.paid_at && i.paid_at >= startOfMonth).reduce((s, i) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100;
    const totalPayables = payables.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalPayablesOverdue = payables.filter(p => p.status === "pending" && p.due_date < now.toISOString().split("T")[0]).reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalBankBalance = banks.reduce((s, b) => s + Number(b.current_balance || 0), 0);
    const activeCompanies = companies.filter(c => c.status === "active").length;
    const churnedCompanies = companies.filter(c => c.status === "churned").length;

    // MRR calculation
    const monthlyRecurring = recurring.reduce((s, r) => {
      let monthly = (r.amount_cents || 0) / 100;
      if (r.recurrence === "quarterly") monthly /= 3;
      if (r.recurrence === "semiannual") monthly /= 6;
      if (r.recurrence === "annual") monthly /= 12;
      return s + monthly;
    }, 0);

    // Inadimplência rate
    const dueInvoicesCount = invoices.filter(i => i.due_date <= now.toISOString().split("T")[0]).length;
    const overdueCount = invoices.filter(i => i.status === "pending" && i.due_date < now.toISOString().split("T")[0]).length;
    const delinquencyRate = dueInvoicesCount > 0 ? ((overdueCount / dueInvoicesCount) * 100).toFixed(1) : "0";

    // Payables by category
    const payablesByCategory: Record<string, number> = {};
    payables.filter(p => p.status === "pending").forEach(p => {
      const cat = p.category || "Sem categoria";
      payablesByCategory[cat] = (payablesByCategory[cat] || 0) + Number(p.amount || 0);
    });

    const financialContext = `
## DADOS FINANCEIROS ATUAIS (${now.toLocaleDateString("pt-BR")})

### Resumo Executivo
- Saldo Bancário Total: R$ ${totalBankBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- MRR Estimado: R$ ${monthlyRecurring.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Empresas Ativas: ${activeCompanies} | Churn: ${churnedCompanies}

### Contas a Receber
- Total Pendente: R$ ${totalReceivable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total em Atraso: R$ ${totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Recebido no Mês: R$ ${totalPaidMonth.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Taxa de Inadimplência: ${delinquencyRate}%
- Faturas Pendentes: ${invoices.filter(i => i.status === "pending").length}
- Faturas em Atraso: ${overdueCount}

### Contas a Pagar
- Total Pendente: R$ ${totalPayables.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Total em Atraso: R$ ${totalPayablesOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- Distribuição por Categoria: ${Object.entries(payablesByCategory).map(([k, v]) => `${k}: R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("; ")}

### Indicadores
- Razão Recebíveis/Payables: ${totalPayables > 0 ? (totalReceivable / totalPayables).toFixed(2) : "N/A"}
- Cobertura de Caixa (meses): ${totalPayables > 0 ? (totalBankBalance / (totalPayables || 1)).toFixed(1) : "N/A"}
- Total de Recorrências Ativas: ${recurring.length}

${context ? `### Contexto Adicional do Usuário\n${context}` : ""}
`;

    const systemPrompt = `Você é um CFO (Chief Financial Officer) profissional e experiente, atuando como consultor financeiro estratégico. Você tem acesso completo aos dados financeiros da empresa e deve analisar com rigor profissional.

SUAS RESPONSABILIDADES:
1. Analisar métricas financeiras com profundidade (MRR, Churn, Inadimplência, Fluxo de Caixa, DRE, etc.)
2. Identificar riscos financeiros e oportunidades de melhoria
3. Recomendar ações práticas e priorizadas
4. Alertar sobre tendências preocupantes
5. Sugerir otimizações de custos e receitas
6. Avaliar a saúde financeira geral da empresa

FORMATO DAS RESPOSTAS:
- Use linguagem profissional mas acessível
- Estruture em tópicos claros com prioridades
- Inclua números e percentuais sempre que possível
- Classifique insights como: 🔴 CRÍTICO | 🟡 ATENÇÃO | 🟢 POSITIVO | 💡 OPORTUNIDADE
- Sempre termine com recomendações acionáveis

DADOS FINANCEIROS ATUAIS:
${financialContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cfo-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
