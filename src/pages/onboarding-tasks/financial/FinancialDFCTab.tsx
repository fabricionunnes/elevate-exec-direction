import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

export default function FinancialDFCTab({ invoices, payables, banks, formatCurrency, formatCurrencyCents }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [view, setView] = useState<"realizado" | "projetado">("realizado");
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  useEffect(() => {
    Promise.all([
      supabase.from("staff_financial_categories").select("*").eq("is_active", true),
      supabase.from("staff_financial_entries").select("*"),
    ]).then(([catRes, entRes]) => {
      if (catRes.data) setCategories(catRes.data as any);
      if (entRes.data) setEntries(entRes.data as any);
    });
  }, []);

  const monthOptions = useMemo(() => {
    const months: { value: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      months.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return months;
  }, []);

  const dfcData = useMemo(() => {
    const isPaid = view === "realizado";

    // Inflows
    const monthInvoices = invoices.filter(i => {
      if (!i.due_date?.startsWith(selectedMonth)) return false;
      return isPaid ? i.status === "paid" : true;
    });
    const recebimentos = monthInvoices.reduce((s: number, i: any) => 
      s + (isPaid ? (i.paid_amount_cents || i.amount_cents) : i.amount_cents), 0) / 100;

    // Manual revenue entries
    const monthRevenueEntries = entries.filter(e => 
      e.due_date?.startsWith(selectedMonth) && e.type === "receita" && (isPaid ? e.status === "paid" : true)
    );
    const receitaManual = monthRevenueEntries.reduce((s: number, e: any) => 
      s + (isPaid ? (e.paid_amount_cents || e.amount_cents) : e.amount_cents), 0) / 100;

    // Outflows by section
    const monthPayablesFiltered = payables.filter((p: any) => {
      const matches = p.due_date?.startsWith(selectedMonth) || p.reference_month === selectedMonth;
      return matches && (isPaid ? p.status === "paid" : true);
    });
    const pagamentos = monthPayablesFiltered.reduce((s: number, p: any) => 
      s + (isPaid ? (p.paid_amount || p.amount || 0) : (p.amount || 0)), 0);

    // Manual expense entries by DFC section
    const monthExpenseEntries = entries.filter(e => 
      e.due_date?.startsWith(selectedMonth) && e.type === "despesa" && (isPaid ? e.status === "paid" : true)
    );

    let operacionalOut = 0, investimentoOut = 0, financiamentoOut = 0;
    monthExpenseEntries.forEach((e: any) => {
      const cat = categories.find(c => c.id === e.category_id);
      const val = (isPaid ? (e.paid_amount_cents || e.amount_cents) : e.amount_cents) / 100;
      if (cat?.dfc_section === "investimento") investimentoOut += val;
      else if (cat?.dfc_section === "financiamento") financiamentoOut += val;
      else operacionalOut += val;
    });

    const totalEntradas = recebimentos + receitaManual;
    const totalSaidasOp = pagamentos + operacionalOut;
    const fluxoOperacional = totalEntradas - totalSaidasOp;
    const fluxoInvestimento = -investimentoOut;
    const fluxoFinanciamento = -financiamentoOut;
    const variacaoLiquida = fluxoOperacional + fluxoInvestimento + fluxoFinanciamento;
    const saldoInicial = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0) / 100;

    return {
      sections: [
        { label: "ATIVIDADES OPERACIONAIS", isHeader: true },
        { label: "  (+) Recebimentos de Clientes (Faturas)", value: recebimentos },
        { label: "  (+) Receitas Manuais", value: receitaManual },
        { label: "  (-) Pagamentos Operacionais", value: -totalSaidasOp },
        { label: "", isSeparator: true },
        { label: "= Fluxo de Caixa Operacional", value: fluxoOperacional, isTotal: true },
        { label: "", isSeparator: true },
        { label: "ATIVIDADES DE INVESTIMENTO", isHeader: true },
        { label: "  (-) Aquisição de Ativos / Equipamentos", value: fluxoInvestimento },
        { label: "", isSeparator: true },
        { label: "= Fluxo de Caixa de Investimento", value: fluxoInvestimento, isTotal: true },
        { label: "", isSeparator: true },
        { label: "ATIVIDADES DE FINANCIAMENTO", isHeader: true },
        { label: "  (-) Pagamento de Juros / Empréstimos", value: fluxoFinanciamento },
        { label: "", isSeparator: true },
        { label: "= Fluxo de Caixa de Financiamento", value: fluxoFinanciamento, isTotal: true },
        { label: "", isSeparator: true },
        { label: "= VARIAÇÃO LÍQUIDA DE CAIXA", value: variacaoLiquida, isTotal: true, highlight: true },
        { label: "", isSeparator: true },
        { label: "Saldo Bancário Atual", value: saldoInicial, isFinal: true },
      ],
      chartData: { operacional: fluxoOperacional, investimento: fluxoInvestimento, financiamento: fluxoFinanciamento, liquida: variacaoLiquida },
    };
  }, [invoices, payables, entries, categories, banks, selectedMonth, view]);

  const chartBars = [
    { name: "Operacional", valor: dfcData.chartData.operacional },
    { name: "Investimento", valor: dfcData.chartData.investimento },
    { name: "Financiamento", valor: dfcData.chartData.financiamento },
    { name: "Variação Líquida", valor: dfcData.chartData.liquida },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            DFC - Demonstração do Fluxo de Caixa
          </h2>
          <p className="text-sm text-muted-foreground">Entradas e saídas por atividade</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="realizado">Realizado</TabsTrigger>
              <TabsTrigger value="projetado">Projetado</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="divide-y">
              {dfcData.sections.map((line: any, i) => {
                if (line.isSeparator) return <div key={i} className="h-px" />;

                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-6 py-3 ${
                      line.isHeader ? "bg-muted/50 font-semibold" : ""
                    } ${line.isTotal ? "font-bold" : ""} ${
                      line.highlight ? "bg-primary/5 text-base" : ""
                    } ${line.isFinal ? "bg-muted/30" : ""} ${
                      !line.isHeader && !line.isTotal && !line.highlight && !line.isFinal ? "text-sm pl-4" : ""
                    }`}
                  >
                    <span>{line.label}</span>
                    {line.value !== undefined && (
                      <span className={`tabular-nums ${
                        line.value >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}>
                        {formatCurrency(line.value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fluxo por Atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartBars} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <YAxis type="category" dataKey="name" width={100} className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <ReferenceLine x={0} className="stroke-muted-foreground" />
                <Bar 
                  dataKey="valor" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        * {view === "realizado" ? "Mostrando apenas movimentações efetivamente pagas/recebidas." : "Mostrando todas as movimentações previstas, independente do pagamento."}
      </p>
    </div>
  );
}
