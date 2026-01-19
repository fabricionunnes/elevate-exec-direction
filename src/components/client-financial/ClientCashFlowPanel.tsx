import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  Legend,
} from "recharts";

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface CashFlowEntry {
  date: string;
  income: number;
  expense: number;
  balance: number;
}

export function ClientCashFlowPanel({ projectId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"realized" | "projected">("realized");
  const [period, setPeriod] = useState<"30" | "60" | "90">("30");
  const [realizedData, setRealizedData] = useState<CashFlowEntry[]>([]);
  const [projectedData, setProjectedData] = useState<CashFlowEntry[]>([]);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    openingBalance: 0,
    closingBalance: 0,
  });

  useEffect(() => {
    loadData();
  }, [projectId, period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const daysToProject = parseInt(period);

      // Fetch receivables
      const { data: receivables } = await supabase
        .from("client_financial_receivables")
        .select("*")
        .eq("project_id", projectId);

      // Fetch payables
      const { data: payables } = await supabase
        .from("client_financial_payables")
        .select("*")
        .eq("project_id", projectId);

      const recArr = receivables || [];
      const payArr = payables || [];

      // Calculate opening balance (all historical paid)
      const totalPaidIn = recArr
        .filter(r => r.status === "paid")
        .reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);

      const totalPaidOut = payArr
        .filter(p => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);

      const openingBalance = totalPaidIn - totalPaidOut;

      // Realized data (current month)
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const realizedEntries: CashFlowEntry[] = [];
      let runningBalance = openingBalance;

      // Only show realized up to today
      const realizedDays = monthDays.filter(d => d <= today);

      realizedDays.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        
        const dayIncome = recArr
          .filter(r => r.status === "paid" && r.paid_at && r.paid_at.startsWith(dateStr))
          .reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);

        const dayExpense = payArr
          .filter(p => p.status === "paid" && p.paid_at && p.paid_at.startsWith(dateStr))
          .reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);

        realizedEntries.push({
          date: format(day, "dd/MM"),
          income: dayIncome,
          expense: dayExpense,
          balance: runningBalance + dayIncome - dayExpense,
        });

        runningBalance += dayIncome - dayExpense;
      });

      setRealizedData(realizedEntries);

      // Projected data
      const projectedEntries: CashFlowEntry[] = [];
      let projectedBalance = openingBalance;

      for (let i = 0; i < daysToProject; i += 7) {
        const weekStart = addDays(today, i);
        const weekEnd = addDays(today, i + 6);
        const weekLabel = format(weekStart, "dd/MM");

        const weekIncome = recArr
          .filter(r => 
            (r.status === "open" || r.status === "overdue") &&
            new Date(r.due_date) >= weekStart &&
            new Date(r.due_date) <= weekEnd
          )
          .reduce((sum, r) => sum + Number(r.amount), 0);

        const weekExpense = payArr
          .filter(p => 
            (p.status === "open" || p.status === "overdue") &&
            new Date(p.due_date) >= weekStart &&
            new Date(p.due_date) <= weekEnd
          )
          .reduce((sum, p) => sum + Number(p.amount), 0);

        projectedBalance += weekIncome - weekExpense;

        projectedEntries.push({
          date: weekLabel,
          income: weekIncome,
          expense: weekExpense,
          balance: projectedBalance,
        });
      }

      setProjectedData(projectedEntries);

      // Summary for realized
      const monthIncome = recArr
        .filter(r => r.status === "paid" && r.paid_at && new Date(r.paid_at) >= monthStart && new Date(r.paid_at) <= today)
        .reduce((sum, r) => sum + Number(r.paid_amount || r.amount), 0);

      const monthExpense = payArr
        .filter(p => p.status === "paid" && p.paid_at && new Date(p.paid_at) >= monthStart && new Date(p.paid_at) <= today)
        .reduce((sum, p) => sum + Number(p.paid_amount || p.amount), 0);

      setSummary({
        totalIncome: monthIncome,
        totalExpense: monthExpense,
        netBalance: monthIncome - monthExpense,
        openingBalance,
        closingBalance: openingBalance + monthIncome - monthExpense,
      });

    } catch (error) {
      console.error("Error loading cash flow:", error);
      toast.error("Erro ao carregar fluxo de caixa");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const data = viewMode === "realized" ? realizedData : projectedData;
    const headers = ["Data", "Entradas", "Saídas", "Saldo"];
    const rows = data.map(d => [d.date, d.income.toFixed(2), d.expense.toFixed(2), d.balance.toFixed(2)]);
    
    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fluxo-caixa-${viewMode}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
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
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const currentData = viewMode === "realized" ? realizedData : projectedData;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Fluxo de Caixa</h2>
          <p className="text-sm text-muted-foreground">Acompanhe entradas e saídas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Saldo Inicial</span>
            </div>
            <p className={`text-lg font-bold ${summary.openingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.openingBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Entradas (Mês)</span>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCurrency(summary.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Saídas (Mês)</span>
            </div>
            <p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Resultado</span>
            </div>
            <p className={`text-lg font-bold ${summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.netBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saldo Atual</span>
            </div>
            <p className={`text-lg font-bold ${summary.closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.closingBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "realized" | "projected")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="realized">Realizado</TabsTrigger>
            <TabsTrigger value="projected">Projetado</TabsTrigger>
          </TabsList>
          {viewMode === "projected" && (
            <Select value={period} onValueChange={(v) => setPeriod(v as "30" | "60" | "90")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="realized" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Fluxo Realizado - {format(new Date(), "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realizedData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Sem movimentações no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={realizedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Entradas" fill="#10b981" />
                    <Bar dataKey="expense" name="Saídas" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projected" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Projeção - Próximos {period} dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={projectedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Entradas"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Saídas"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Saldo Projetado"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
