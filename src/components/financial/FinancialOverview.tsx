import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Building2,
  Users,
  FileText,
  Loader2
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { toast } from "sonner";

interface FinancialSummary {
  totalReceivables: number;
  totalReceived: number;
  totalPayables: number;
  totalPaid: number;
  overdueReceivables: number;
  overduePayables: number;
  mrr: number;
  nexusMrr: number;
  totalCash: number;
  activeContracts: number;
  activeNexusClients: number;
  projectedCash30: number;
  projectedCash90: number;
}

export function FinancialOverview() {
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalReceivables: 0,
    totalReceived: 0,
    totalPayables: 0,
    totalPaid: 0,
    overdueReceivables: 0,
    overduePayables: 0,
    mrr: 0,
    nexusMrr: 0,
    totalCash: 0,
    activeContracts: 0,
    activeNexusClients: 0,
    projectedCash30: 0,
    projectedCash90: 0
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    setIsLoading(true);
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      const today = format(new Date(), "yyyy-MM-dd");

      // Load receivables summary
      const { data: receivables } = await supabase
        .from("financial_receivables")
        .select("amount, paid_amount, status, due_date")
        .gte("reference_month", format(subMonths(new Date(), 6), "yyyy-MM"));

      // Load payables summary
      const { data: payables } = await supabase
        .from("financial_payables")
        .select("amount, paid_amount, status, due_date")
        .gte("reference_month", format(subMonths(new Date(), 6), "yyyy-MM"));

      // Load bank accounts
      const { data: banks } = await supabase
        .from("financial_bank_accounts")
        .select("current_balance")
        .eq("is_active", true);

      // Load active contracts from financial_contracts
      const { data: contracts } = await supabase
        .from("financial_contracts")
        .select("contract_value, billing_cycle")
        .eq("status", "active");

      // Load active clients from Nexus (onboarding_companies)
      const { data: nexusClients } = await supabase
        .from("onboarding_companies")
        .select("id, name, contract_value, status")
        .eq("status", "active");

      // Calculate summary
      let totalReceivables = 0;
      let totalReceived = 0;
      let overdueReceivables = 0;

      receivables?.forEach((r) => {
        if (r.status === "pending" || r.status === "overdue") {
          totalReceivables += Number(r.amount) || 0;
        }
        if (r.status === "paid") {
          totalReceived += Number(r.paid_amount || r.amount) || 0;
        }
        if (r.status === "overdue" || (r.status === "pending" && r.due_date < today)) {
          overdueReceivables += Number(r.amount) || 0;
        }
      });

      let totalPayables = 0;
      let totalPaid = 0;
      let overduePayables = 0;

      payables?.forEach((p) => {
        if (p.status === "pending" || p.status === "overdue") {
          totalPayables += Number(p.amount) || 0;
        }
        if (p.status === "paid") {
          totalPaid += Number(p.paid_amount || p.amount) || 0;
        }
        if (p.status === "overdue" || (p.status === "pending" && p.due_date < today)) {
          overduePayables += Number(p.amount) || 0;
        }
      });

      const totalCash = banks?.reduce((sum, b) => sum + (Number(b.current_balance) || 0), 0) || 0;
      const activeContracts = contracts?.length || 0;
      const activeNexusClients = nexusClients?.length || 0;

      // Calculate MRR from Nexus clients
      const nexusMrr = nexusClients?.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0) || 0;

      // Calculate MRR
      let mrr = 0;
      contracts?.forEach((c) => {
        const value = Number(c.contract_value) || 0;
        switch (c.billing_cycle) {
          case "monthly":
            mrr += value;
            break;
          case "quarterly":
            mrr += value / 3;
            break;
          case "semiannual":
            mrr += value / 6;
            break;
          case "annual":
            mrr += value / 12;
            break;
        }
      });

      // Use the higher MRR (financial contracts or Nexus clients)
      const effectiveMrr = Math.max(mrr, nexusMrr);

      // Projected cash
      const monthlyNet = effectiveMrr - (totalPayables / 6); // Simplified projection
      const projectedCash30 = totalCash + monthlyNet;
      const projectedCash90 = totalCash + monthlyNet * 3;

      setSummary({
        totalReceivables,
        totalReceived,
        totalPayables,
        totalPaid,
        overdueReceivables,
        overduePayables,
        mrr,
        nexusMrr,
        totalCash,
        activeContracts,
        activeNexusClients,
        projectedCash30,
        projectedCash90
      });

      // Generate chart data (mock for now, will use snapshots)
      const chartData = [];
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(new Date(), i);
        chartData.push({
          month: format(month, "MMM", { locale: ptBR }),
          receitas: Math.random() * 50000 + 30000,
          despesas: Math.random() * 30000 + 15000
        });
      }
      setRevenueData(chartData);

      // Category distribution
      setCategoryData([
        { name: "Mensalidades", value: 65, color: "#10b981" },
        { name: "Consultorias", value: 20, color: "#3b82f6" },
        { name: "Projetos", value: 15, color: "#8b5cf6" }
      ]);

    } catch (error) {
      console.error("Error loading financial data:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Visão Geral Financeira</h2>
          <p className="text-muted-foreground">
            {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button variant="outline" onClick={loadFinancialData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards - Top Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(Math.max(summary.mrr, summary.nexusMrr))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ARR: {formatCurrency(Math.max(summary.mrr, summary.nexusMrr) * 12)}
            </p>
            {summary.nexusMrr > summary.mrr && (
              <p className="text-xs text-blue-500 mt-1">
                {summary.activeNexusClients} clientes Nexus
              </p>
            )}
          </CardContent>
        </Card>

        {/* Saldo Total */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo em Caixa
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalCash)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.activeContracts} contratos | {summary.activeNexusClients} clientes Nexus
            </p>
          </CardContent>
        </Card>

        {/* A Receber */}
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Receber
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(summary.totalReceivables)}
            </div>
            {summary.overdueReceivables > 0 && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {formatCurrency(summary.overdueReceivables)} em atraso
              </p>
            )}
          </CardContent>
        </Card>

        {/* A Pagar */}
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Pagar
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalPayables)}
            </div>
            {summary.overduePayables > 0 && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {formatCurrency(summary.overduePayables)} em atraso
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projection Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Caixa Projetado (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${summary.projectedCash30 >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(summary.projectedCash30)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Caixa Projetado (90 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${summary.projectedCash90 >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(summary.projectedCash90)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Resultado do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${(summary.totalReceived - summary.totalPaid) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(summary.totalReceived - summary.totalPaid)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue vs Expenses Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Receitas vs Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    name="Receitas"
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    stackId="2"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                    name="Despesas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receitas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `${value}%`}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {categoryData.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Nova Conta a Receber
            </Button>
            <Button variant="outline" size="sm">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Nova Conta a Pagar
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Importar do Nexus
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
