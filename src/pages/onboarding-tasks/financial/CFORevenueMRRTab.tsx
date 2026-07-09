import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell, Area, AreaChart
} from "recharts";

import { type CFOFilters } from "@/components/financial/CFOFilterBar";

interface Props {
  invoices: any[];
  companies: any[];
  filters: CFOFilters;
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

const cardStyles = [
  { bg: "from-blue-500/20 via-blue-500/5 to-transparent", border: "border-blue-500/20", text: "text-blue-400", icon: "text-blue-500", glow: "shadow-blue-500/10" },
  { bg: "from-emerald-500/20 via-emerald-500/5 to-transparent", border: "border-emerald-500/20", text: "text-emerald-400", icon: "text-emerald-500", glow: "shadow-emerald-500/10" },
  { bg: "from-green-500/20 via-green-500/5 to-transparent", border: "border-green-500/20", text: "text-green-400", icon: "text-green-500", glow: "shadow-green-500/10" },
  { bg: "from-amber-500/20 via-amber-500/5 to-transparent", border: "border-amber-500/20", text: "text-amber-400", icon: "text-amber-500", glow: "shadow-amber-500/10" },
  { bg: "from-rose-500/20 via-rose-500/5 to-transparent", border: "border-rose-500/20", text: "text-rose-400", icon: "text-rose-500", glow: "shadow-rose-500/10" },
  { bg: "from-violet-500/20 via-violet-500/5 to-transparent", border: "border-violet-500/20", text: "text-violet-400", icon: "text-violet-500", glow: "shadow-violet-500/10" },
];

export default function CFORevenueMRRTab({ invoices, companies, filters, formatCurrency, formatCurrencyCents }: Props) {
  const now = new Date();
  const refDate = filters.month !== "all"
    ? new Date(parseInt(filters.month.split("-")[0]), parseInt(filters.month.split("-")[1]) - 1, 1)
    : now;
  const monthStr = filters.month !== "all" ? filters.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthStr = (() => {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  // ── MRR conta SOMENTE clientes MENSAIS ──
  // Mensal = empresa sem data de término OU com contrato de ~1 mês (ciclo mensal).
  // Cartão (anual/semestral, à vista) tem contrato de 6/12 meses e NÃO entra no MRR.
  // Valor mensal de cada cliente = contract_value (já é o valor mensal nos mensais).
  const daysBetween = (a?: string | null, b?: string | null): number | null => {
    if (!a || !b) return null;
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  };
  const isMonthly = (c: any) => {
    if (!c.contract_end_date) return true;
    const d = daysBetween(c.contract_start_date, c.contract_end_date);
    return d !== null && d <= 35;
  };
  const valueCents = (c: any) => Math.round(Number(c.contract_value || 0) * 100);

  // Churn por empresa: projeto encerrado guarda a churn_date (quando o cliente saiu)
  const [churnByCompany, setChurnByCompany] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("onboarding_projects")
        .select("onboarding_company_id, churn_date, status")
        .in("status", ["closed", "completed"])
        .not("churn_date", "is", null);
      if (!active) return;
      const m = new Map<string, string>();
      (data || []).forEach((p: any) => {
        const cid = p.onboarding_company_id;
        if (!cid || !p.churn_date) return;
        const ex = m.get(cid);
        if (!ex || p.churn_date > ex) m.set(cid, p.churn_date);
      });
      setChurnByCompany(m);
    })();
    return () => { active = false; };
  }, []);

  const monthlyCompanies = useMemo(
    () => (companies || []).filter((c: any) => isMonthly(c)),
    [companies]
  );

  // MRR no fim de um mês (YYYY-MM): clientes mensais que já começaram e ainda não saíram
  const mrrAtMonthEnd = (ym: string): number => {
    const end = `${ym}-31`;
    return monthlyCompanies.reduce((s: number, c: any) => {
      const start = (c.contract_start_date || "0000-00-00").slice(0, 10);
      if (start > end) return s; // ainda não tinha começado
      const churn = churnByCompany.get(c.id);
      if (churn) {
        if (churn.slice(0, 10) <= end) return s; // já tinha saído nessa data
      } else if (c.status !== "active") {
        return s; // inativa sem churn_date conhecida → não conta como MRR ativo
      }
      return s + valueCents(c);
    }, 0);
  };

  const mrrBreakdown = useMemo(() => {
    const mrrAtual = mrrAtMonthEnd(monthStr);
    const mrrAnterior = mrrAtMonthEnd(prevMonthStr);

    // Novo MRR: clientes mensais que começaram neste mês
    const novoMrr = monthlyCompanies
      .filter((c: any) => (c.contract_start_date || "").startsWith(monthStr))
      .reduce((s: number, c: any) => s + valueCents(c), 0);

    // Churn de MRR: clientes mensais cujo projeto foi encerrado neste mês
    const mrrChurn = monthlyCompanies
      .filter((c: any) => {
        const churn = churnByCompany.get(c.id);
        return !!churn && churn.startsWith(monthStr);
      })
      .reduce((s: number, c: any) => s + valueCents(c), 0);

    // Sem histórico de valor mensal por cliente não dá pra apurar expansão/contração
    const expansion = 0;
    const contraction = 0;
    const netNewMrr = novoMrr + expansion - contraction - mrrChurn;

    return { mrrAtual, mrrAnterior, novoMrr, expansion, contraction, mrrChurn, netNewMrr };
  }, [monthlyCompanies, churnByCompany, monthStr, prevMonthStr]);

  // Ticket Médio (receita média por cliente pagante no mês — todas as pagas)
  const ticketMedio = useMemo(() => {
    const paidInvoices = invoices.filter(i => i.due_date?.startsWith(monthStr) && i.status === "paid");
    const companiesWithPayment = new Set(paidInvoices.map(i => i.company_id));
    const totalRevenue = paidInvoices.reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0);
    const geral = companiesWithPayment.size > 0 ? totalRevenue / companiesWithPayment.size : 0;
    return { geral, clientCount: companiesWithPayment.size };
  }, [invoices, monthStr]);

  // Evolução do MRR (6 meses) — reconstruída por data de início/churn (em reais)
  const mrrTrend = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const mrr = mrrAtMonthEnd(key) / 100;
      months.push({ label, mrr, naoRecorrente: 0, total: mrr });
    }
    return months;
  }, [monthlyCompanies, churnByCompany, refDate]);

  const breakdownCards = [
    { label: "MRR Atual", value: mrrBreakdown.mrrAtual, icon: DollarSign },
    { label: "Novo MRR", value: mrrBreakdown.novoMrr, icon: ArrowUpRight },
    { label: "MRR Expansão", value: mrrBreakdown.expansion, icon: TrendingUp },
    { label: "MRR Contração", value: mrrBreakdown.contraction, icon: TrendingDown, negative: true },
    { label: "MRR Churn", value: mrrBreakdown.mrrChurn, icon: ArrowDownRight, negative: true },
    { label: "Net New MRR", value: mrrBreakdown.netNewMrr, icon: TrendingUp },
  ];

  const breakdownPie = [
    { name: "Novo MRR", value: mrrBreakdown.novoMrr / 100, color: "hsl(160, 84%, 39%)" },
    { name: "Expansão", value: mrrBreakdown.expansion / 100, color: "hsl(173, 80%, 40%)" },
    { name: "Contração", value: mrrBreakdown.contraction / 100, color: "hsl(38, 92%, 50%)" },
    { name: "Churn", value: mrrBreakdown.mrrChurn / 100, color: "hsl(350, 89%, 60%)" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          Receita & MRR
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Análise detalhada da receita recorrente e movimentação</p>
      </div>

      {/* MRR Breakdown Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {breakdownCards.map((card, idx) => {
          const Icon = card.icon;
          const s = cardStyles[idx];
          return (
            <Card key={idx} className={`relative overflow-hidden border ${s.border} bg-gradient-to-br ${s.bg} backdrop-blur-xl shadow-lg ${s.glow} hover:scale-[1.02] transition-all duration-300`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
              <CardContent className="pt-4 pb-3 relative">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded-lg bg-white/5 ${s.icon}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
                </div>
                <p className={`text-lg font-bold ${s.text}`}>
                  {card.negative ? "-" : ""}{formatCurrencyCents(card.value)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ticket Médio */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-indigo-500/10 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-indigo-500/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <Users className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Ticket Médio Geral</p>
            </div>
            <p className="text-3xl font-bold text-indigo-400">{formatCurrencyCents(ticketMedio.geral)}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{ticketMedio.clientCount} clientes pagantes no mês</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/10 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-emerald-500/5">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground font-medium mb-2">MRR vs Mês Anterior</p>
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-emerald-400">{formatCurrencyCents(mrrBreakdown.mrrAtual)}</p>
              {mrrBreakdown.mrrAnterior > 0 && (
                <Badge className={`${mrrBreakdown.mrrAtual >= mrrBreakdown.mrrAnterior ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                  {mrrBreakdown.mrrAtual >= mrrBreakdown.mrrAnterior ? "+" : ""}
                  {(((mrrBreakdown.mrrAtual - mrrBreakdown.mrrAnterior) / mrrBreakdown.mrrAnterior) * 100).toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Anterior: {formatCurrencyCents(mrrBreakdown.mrrAnterior)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              Evolução MRR (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mrrTrend}>
                <defs>
                  <linearGradient id="mrrRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="nrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(270, 80%, 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(270, 80%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted) / 0.3)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(221, 83%, 53%)" fill="url(#mrrRevGrad)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="naoRecorrente" name="Não Recorrente" stroke="hsl(270, 80%, 60%)" fill="url(#nrGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-violet-500/10 bg-gradient-to-br from-violet-500/5 to-transparent backdrop-blur-xl shadow-lg shadow-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              MRR Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={breakdownPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {breakdownPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "hsl(var(--card) / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de movimentação MRR</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
