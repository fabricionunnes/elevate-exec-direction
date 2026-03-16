import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Building2,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  projectId: string;
  onNavigateTab?: (tab: string, filter?: string) => void;
}

interface DashboardData {
  overdueReceivables: number;
  dueTodayReceivables: number;
  remainingMonthReceivables: number;
  overduePayables: number;
  dueTodayPayables: number;
  remainingMonthPayables: number;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name?: string;
  account_type: string;
  current_balance: number;
  color: string;
  is_active: boolean;
  agency?: string;
  account_number?: string;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  transaction_date: string;
  created_at: string;
}

interface DetailItem {
  id: string;
  name: string;
  description?: string;
  amount: number;
  due_date: string;
  status: string;
}

export function ClientFinancialDashboard({ projectId, onNavigateTab }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    overdueReceivables: 0,
    dueTodayReceivables: 0,
    remainingMonthReceivables: 0,
    overduePayables: 0,
    dueTodayPayables: 0,
    remainingMonthPayables: 0,
  });
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [salesChartData, setSalesChartData] = useState<any[]>([]);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Bank statement dialog state
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementAccount, setStatementAccount] = useState<BankAccount | null>(null);
  const [statementTransactions, setStatementTransactions] = useState<BankTransaction[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [projectId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const [receivablesRes, payablesRes, banksRes, salesRes] = await Promise.all([
        supabase
          .from("client_financial_receivables")
          .select("id, client_name, description, amount, due_date, status")
          .eq("project_id", projectId)
          .in("status", ["open", "overdue"]),
        supabase
          .from("client_financial_payables")
          .select("id, supplier_name, description, amount, due_date, status")
          .eq("project_id", projectId)
          .in("status", ["open", "overdue"]),
        supabase
          .from("client_financial_bank_accounts")
          .select("id, name, bank_name, account_type, current_balance, color, is_active, agency, account_number")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("client_financial_sales")
          .select("sale_date, total_amount")
          .eq("project_id", projectId)
          .eq("status", "completed"),
      ]);

      const receivables = receivablesRes.data || [];
      const payables = payablesRes.data || [];

      const overdueReceivables = receivables
        .filter(r => r.due_date < today)
        .reduce((s, r) => s + Number(r.amount), 0);
      const dueTodayReceivables = receivables
        .filter(r => r.due_date === today)
        .reduce((s, r) => s + Number(r.amount), 0);
      const remainingMonthReceivables = receivables
        .filter(r => r.due_date > today && r.due_date <= monthEnd)
        .reduce((s, r) => s + Number(r.amount), 0);

      const overduePayables = payables
        .filter(p => p.due_date < today)
        .reduce((s, p) => s + Number(p.amount), 0);
      const dueTodayPayables = payables
        .filter(p => p.due_date === today)
        .reduce((s, p) => s + Number(p.amount), 0);
      const remainingMonthPayables = payables
        .filter(p => p.due_date > today && p.due_date <= monthEnd)
        .reduce((s, p) => s + Number(p.amount), 0);

      setData({
        overdueReceivables,
        dueTodayReceivables,
        remainingMonthReceivables,
        overduePayables,
        dueTodayPayables,
        remainingMonthPayables,
      });

      setBankAccounts(banksRes.data || []);

      // Build sales chart (last 12 months)
      const sales = salesRes.data || [];
      const monthlyMap: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = format(d, "yyyy-MM");
        monthlyMap[key] = 0;
      }
      sales.forEach(s => {
        const key = s.sale_date?.substring(0, 7);
        if (key && key in monthlyMap) {
          monthlyMap[key] += Number(s.total_amount);
        }
      });
      setSalesChartData(
        Object.entries(monthlyMap).map(([month, value]) => ({
          month: format(parseISO(month + "-01"), "MMM", { locale: ptBR }),
          faturamento: value,
        }))
      );
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const openDetail = async (type: "receivable" | "payable", filter: "overdue" | "today" | "remaining") => {
    setDetailLoading(true);
    setDetailOpen(true);

    const today = format(new Date(), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const titles: Record<string, string> = {
      "receivable-overdue": "A Receber - Vencidos",
      "receivable-today": "A Receber - Vencem Hoje",
      "receivable-remaining": "A Receber - Restante do Mês",
      "payable-overdue": "A Pagar - Vencidos",
      "payable-today": "A Pagar - Vencem Hoje",
      "payable-remaining": "A Pagar - Restante do Mês",
    };
    setDetailTitle(titles[`${type}-${filter}`] || "Detalhes");

    try {
      const table = type === "receivable" ? "client_financial_receivables" : "client_financial_payables";
      const nameCol = type === "receivable" ? "client_name" : "supplier_name";

      let query = supabase
        .from(table)
        .select(`id, ${nameCol}, description, amount, due_date, status`)
        .eq("project_id", projectId)
        .in("status", ["open", "overdue"]);

      if (filter === "overdue") {
        query = query.lt("due_date", today);
      } else if (filter === "today") {
        query = query.eq("due_date", today);
      } else {
        query = query.gt("due_date", today).lte("due_date", monthEnd);
      }

      const { data: items } = await query.order("due_date");

      setDetailItems(
        (items || []).map((item: any) => ({
          id: item.id,
          name: item[nameCol] || "-",
          description: item.description,
          amount: Number(item.amount),
          due_date: item.due_date,
          status: item.status,
        }))
      );
    } catch (err) {
      console.error("Error loading detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const openBankStatement = async (account: BankAccount) => {
    setStatementAccount(account);
    setStatementOpen(true);
    setStatementLoading(true);

    try {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data: txs } = await supabase
        .from("client_financial_bank_transactions")
        .select("*")
        .eq("bank_account_id", account.id)
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      setStatementTransactions(txs || []);
    } catch (err) {
      console.error("Error loading statement:", err);
    } finally {
      setStatementLoading(false);
    }
  };

  const totalBankBalance = bankAccounts.reduce((s, a) => s + a.current_balance, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Visão Geral Financeira</h2>
        <Button variant="outline" size="sm" onClick={loadDashboardData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* A Receber / A Pagar sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* A Receber */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
              A receber
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive"
              onClick={() => openDetail("receivable", "overdue")}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-xl font-bold ${data.overdueReceivables > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {formatCurrency(data.overdueReceivables)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Vencidos</p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail("receivable", "today")}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-xl font-bold ${data.dueTodayReceivables > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {formatCurrency(data.dueTodayReceivables)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Vencem hoje</p>
                <p className="text-[10px] text-muted-foreground">
                  Restante do mês: {formatCurrency(data.remainingMonthReceivables)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* A Pagar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-destructive" />
              A pagar
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive"
              onClick={() => openDetail("payable", "overdue")}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-xl font-bold ${data.overduePayables > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {formatCurrency(data.overduePayables)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Vencidos</p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDetail("payable", "today")}
            >
              <CardContent className="p-4 text-center">
                <p className={`text-xl font-bold ${data.dueTodayPayables > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {formatCurrency(data.dueTodayPayables)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Vencem hoje</p>
                <p className="text-[10px] text-muted-foreground">
                  Restante do mês: {formatCurrency(data.remainingMonthPayables)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom row: Banks + Sales Chart */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Bank Accounts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contas financeiras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center pb-2 border-b">
              <p className={`text-2xl font-bold ${totalBankBalance >= 0 ? "text-foreground" : "text-destructive"}`}>
                {formatCurrency(totalBankBalance)}
              </p>
              <p className="text-xs text-muted-foreground">Valor total</p>
            </div>

            {bankAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta cadastrada</p>
            ) : (
              <ScrollArea className="max-h-[280px]">
                <div className="space-y-3">
                  {bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => openBankStatement(account)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: account.color + "20" }}
                        >
                          <Building2 className="h-5 w-5" style={{ color: account.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {account.bank_name || account.account_type}
                          </p>
                          <p className={`text-sm font-semibold mt-1 ${account.current_balance >= 0 ? "text-foreground" : "text-destructive"}`}>
                            Valor {formatCurrency(account.current_balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Sales Chart */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gráfico de vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {salesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar
                    dataKey="faturamento"
                    name="Faturamento"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                Sem dados de vendas
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : detailItems.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">Nenhum item encontrado.</p>
          ) : (
            <ScrollArea className="flex-1 max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.description || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(item.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-right">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-3 text-right">
                <span className="text-sm font-bold">
                  Total: {formatCurrency(detailItems.reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Bank Statement Dialog */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Extrato - {statementAccount?.name}
            </DialogTitle>
            {statementAccount && (
              <p className="text-sm text-muted-foreground">
                {statementAccount.bank_name} • Saldo: {formatCurrency(statementAccount.current_balance)}
              </p>
            )}
          </DialogHeader>
          {statementLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : statementTransactions.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma movimentação neste mês.
            </p>
          ) : (
            <ScrollArea className="flex-1 max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right w-[130px]">Valor</TableHead>
                    <TableHead className="text-right w-[130px]">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementTransactions.map((tx) => {
                    const isPositive = tx.amount >= 0;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {format(parseISO(tx.transaction_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-sm">{tx.description || "-"}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${isPositive ? "text-emerald-600" : "text-destructive"}`}>
                          {isPositive ? "+" : ""}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(tx.balance_after)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
