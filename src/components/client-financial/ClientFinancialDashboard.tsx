import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Props {
  projectId: string;
}

interface DashboardData {
  currentBalance: number;
  totalReceivables30Days: number;
  totalPayables30Days: number;
  monthlyResult: number;
  overdueReceivables: number;
  overduePayables: number;
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

export function ClientFinancialDashboard({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    currentBalance: 0,
    totalReceivables30Days: 0,
    totalPayables30Days: 0,
    monthlyResult: 0,
    overdueReceivables: 0,
    overduePayables: 0,
  });
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<{ income: any[]; expense: any[] }>({ income: [], expense: [] });

  useEffect(() => {
    loadDashboardData();
  }, [projectId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const thirtyDaysFromNow = addDays(today, 30);
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // Fetch receivables
      const { data: receivables } = await supabase
        .from("client_financial_receivables")
        .select("*, category:client_financial_categories(*)")
        .eq("project_id", projectId);

      // Fetch payables
      const { data: payables } = await supabase
        .from("client_financial_payables")
        .select("*, category:client_financial_categories(*)")
        .eq("project_id", projectId);

      // Calculate metrics
      const receivablesArr = receivables || [];
      const payablesArr = payables || [];

      // 30-day receivables (open + overdue)
      const totalReceivables30Days = receivablesArr
        .filter(r => 
          (r.status === 'open' || r.status === 'overdue') && 
          new Date(r.due_date) <= thirtyDaysFromNow
        )
        .reduce((sum, r) => sum + Number(r.amount), 0);

      // 30-day payables (open + overdue)
      const totalPayables30Days = payablesArr
        .filter(p => 
          (p.status === 'open' || p.status === 'overdue') && 
          new Date(p.due_date) <= thirtyDaysFromNow
        )
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Monthly result (paid this month)
      const monthlyIncome = receivablesArr
        .filter(r => 
          r.status === 'paid' && 
          r.paid_at && 
          new Date(r.paid_at) >= monthStart && 
          new Date(r.paid_at) <= monthEnd
        )
        .reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);

      const monthlyExpense = payablesArr
        .filter(p => 
          p.status === 'paid' && 
          p.paid_at && 
          new Date(p.paid_at) >= monthStart && 
          new Date(p.paid_at) <= monthEnd
        )
        .reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);

      const monthlyResult = monthlyIncome - monthlyExpense;

      // Overdue amounts
      const overdueReceivables = receivablesArr
        .filter(r => r.status === 'overdue')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const overduePayables = payablesArr
        .filter(p => p.status === 'overdue')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Calculate current balance (simplified: sum of all paid - all paid out)
      const totalPaidIn = receivablesArr
        .filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);

      const totalPaidOut = payablesArr
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);

      const currentBalance = totalPaidIn - totalPaidOut;

      setData({
        currentBalance,
        totalReceivables30Days,
        totalPayables30Days,
        monthlyResult,
        overdueReceivables,
        overduePayables,
      });

      // Generate cash flow projection data (next 90 days)
      const cashFlowProjection = [];
      let runningBalance = currentBalance;
      
      for (let i = 0; i < 90; i += 7) {
        const weekStart = addDays(today, i);
        const weekEnd = addDays(today, i + 7);
        
        const weekIncome = receivablesArr
          .filter(r => 
            (r.status === 'open' || r.status === 'overdue') &&
            new Date(r.due_date) >= weekStart &&
            new Date(r.due_date) < weekEnd
          )
          .reduce((sum, r) => sum + Number(r.amount), 0);

        const weekExpense = payablesArr
          .filter(p => 
            (p.status === 'open' || p.status === 'overdue') &&
            new Date(p.due_date) >= weekStart &&
            new Date(p.due_date) < weekEnd
          )
          .reduce((sum, p) => sum + Number(p.amount), 0);

        runningBalance += weekIncome - weekExpense;

        cashFlowProjection.push({
          week: format(weekStart, "dd/MM", { locale: ptBR }),
          entrada: weekIncome,
          saida: weekExpense,
          saldo: runningBalance,
        });
      }

      setCashFlowData(cashFlowProjection);

      // Category distribution
      const incomeByCategory: Record<string, number> = {};
      const expenseByCategory: Record<string, number> = {};

      receivablesArr
        .filter(r => r.status === 'paid')
        .forEach(r => {
          const catName = r.category?.name || 'Sem categoria';
          incomeByCategory[catName] = (incomeByCategory[catName] || 0) + Number(r.paid_amount || r.amount);
        });

      payablesArr
        .filter(p => p.status === 'paid')
        .forEach(p => {
          const catName = p.category?.name || 'Sem categoria';
          expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Number(p.paid_amount || p.amount);
        });

      setCategoryData({
        income: Object.entries(incomeByCategory).map(([name, value]) => ({ name, value })),
        expense: Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })),
      });

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Visão Geral Financeira</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboardData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saldo Atual</span>
            </div>
            <p className={`text-lg font-bold ${data.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.currentBalance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">A Receber (30d)</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(data.totalReceivables30Days)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">A Pagar (30d)</span>
            </div>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(data.totalPayables30Days)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Resultado Mês</span>
            </div>
            <p className={`text-lg font-bold ${data.monthlyResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.monthlyResult)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Inadimplência</span>
            </div>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(data.overdueReceivables)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Vencidos a Pagar</span>
            </div>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(data.overduePayables)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Cash Flow Projection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fluxo de Caixa Projetado (90 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={12} />
                <YAxis 
                  fontSize={12} 
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Semana ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="entrada"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  name="Entradas"
                />
                <Area
                  type="monotone"
                  dataKey="saida"
                  stackId="2"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.3}
                  name="Saídas"
                />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  name="Saldo"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-center mb-2 text-green-600">Receitas</p>
                {categoryData.income.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={categoryData.income}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={2}
                      >
                        {categoryData.income.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-center mb-2 text-red-600">Despesas</p>
                {categoryData.expense.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={categoryData.expense}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={2}
                      >
                        {categoryData.expense.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
