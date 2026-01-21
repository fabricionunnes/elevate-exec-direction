import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
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
import {
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  DollarSign,
  Target,
  Receipt,
  BarChart3,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projectId: string;
}

interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
  sale: {
    id: string;
    sale_date: string;
    status: string;
    salesperson_id: string | null;
  };
  product: {
    id: string;
    name: string;
    category_id: string | null;
  };
}

interface Sale {
  id: string;
  sale_date: string;
  total_amount: number;
  total_cost: number;
  status: string;
  salesperson_id: string | null;
  salesperson?: { id: string; name: string } | null;
}

interface Receivable {
  id: string;
  amount: number;
  status: string;
  due_date: string;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function ClientSalesAnalyticsPanel({ projectId }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [periodMonths, setPeriodMonths] = useState("3");

  useEffect(() => {
    loadData();
  }, [projectId, periodMonths]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const months = parseInt(periodMonths);
      const startDate = format(startOfMonth(subMonths(new Date(), months - 1)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const [salesRes, itemsRes, receivablesRes] = await Promise.all([
        supabase
          .from("client_financial_sales")
          .select(`
            id, sale_date, total_amount, total_cost, status, salesperson_id,
            salesperson:company_salespeople(id, name)
          `)
          .eq("project_id", projectId)
          .gte("sale_date", startDate)
          .lte("sale_date", endDate),
        supabase
          .from("client_financial_sale_items")
          .select(`
            id, product_id, quantity, unit_price, cost_price, total,
            sale:client_financial_sales!inner(id, sale_date, status, salesperson_id),
            product:client_financial_products!inner(id, name, category_id)
          `)
          .gte("sale.sale_date", startDate)
          .lte("sale.sale_date", endDate),
        supabase
          .from("client_financial_receivables")
          .select("id, amount, status, due_date")
          .eq("project_id", projectId),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (receivablesRes.error) throw receivablesRes.error;

      setSales(salesRes.data || []);
      setSaleItems((itemsRes.data as any) || []);
      setReceivables(receivablesRes.data || []);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Completed sales only
  const completedSales = useMemo(() => sales.filter((s) => s.status === "completed"), [sales]);
  const completedItems = useMemo(
    () => saleItems.filter((i) => i.sale.status === "completed"),
    [saleItems]
  );

  // Key metrics
  const metrics = useMemo(() => {
    const totalRevenue = completedSales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalCost = completedSales.reduce((sum, s) => sum + s.total_cost, 0);
    const grossProfit = totalRevenue - totalCost;
    const operatingMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgTicketSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;

    // Calculate avg ticket per product
    const totalQuantity = completedItems.reduce((sum, i) => sum + i.quantity, 0);
    const avgTicketProduct = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;

    // Delinquency rate
    const overdueReceivables = receivables.filter(
      (r) => r.status === "overdue" || (r.status === "open" && new Date(r.due_date) < new Date())
    );
    const totalOverdue = overdueReceivables.reduce((sum, r) => sum + r.amount, 0);
    const totalReceivables = receivables.reduce((sum, r) => sum + r.amount, 0);
    const delinquencyRate = totalReceivables > 0 ? (totalOverdue / totalReceivables) * 100 : 0;

    return {
      totalRevenue,
      grossProfit,
      operatingMargin,
      avgTicketSale,
      avgTicketProduct,
      delinquencyRate,
      totalOverdue,
      salesCount: completedSales.length,
    };
  }, [completedSales, completedItems, receivables]);

  // ABC Curve - Products
  const abcProducts = useMemo(() => {
    const productTotals = new Map<string, { name: string; revenue: number; quantity: number }>();

    completedItems.forEach((item) => {
      const current = productTotals.get(item.product_id) || {
        name: item.product.name,
        revenue: 0,
        quantity: 0,
      };
      productTotals.set(item.product_id, {
        name: current.name,
        revenue: current.revenue + item.total,
        quantity: current.quantity + item.quantity,
      });
    });

    const sortedProducts = Array.from(productTotals.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
    let cumulative = 0;

    return sortedProducts.map((product) => {
      cumulative += product.revenue;
      const cumulativePercent = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0;
      let curve: "A" | "B" | "C";
      if (cumulativePercent <= 80) curve = "A";
      else if (cumulativePercent <= 95) curve = "B";
      else curve = "C";

      return {
        ...product,
        percent: totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0,
        cumulativePercent,
        curve,
      };
    });
  }, [completedItems]);

  // Sales by salesperson
  const salesBySalesperson = useMemo(() => {
    const spTotals = new Map<string, { name: string; revenue: number; count: number }>();

    completedSales.forEach((sale) => {
      const spId = sale.salesperson_id || "none";
      const spName = sale.salesperson?.name || "Sem vendedor";
      const current = spTotals.get(spId) || { name: spName, revenue: 0, count: 0 };
      spTotals.set(spId, {
        name: current.name,
        revenue: current.revenue + sale.total_amount,
        count: current.count + 1,
      });
    });

    return Array.from(spTotals.entries())
      .map(([id, data]) => ({
        id,
        ...data,
        avgTicket: data.count > 0 ? data.revenue / data.count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [completedSales]);

  // Monthly revenue chart
  const monthlyData = useMemo(() => {
    const months = parseInt(periodMonths);
    const data: { month: string; revenue: number; profit: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, "yyyy-MM");
      const monthLabel = format(date, "MMM/yy", { locale: ptBR });

      const monthSales = completedSales.filter((s) => s.sale_date.startsWith(monthKey));
      const revenue = monthSales.reduce((sum, s) => sum + s.total_amount, 0);
      const cost = monthSales.reduce((sum, s) => sum + s.total_cost, 0);

      data.push({
        month: monthLabel,
        revenue,
        profit: revenue - cost,
      });
    }

    return data;
  }, [completedSales, periodMonths]);

  // ABC curve chart data
  const abcChartData = useMemo(() => {
    const curveA = abcProducts.filter((p) => p.curve === "A");
    const curveB = abcProducts.filter((p) => p.curve === "B");
    const curveC = abcProducts.filter((p) => p.curve === "C");

    return [
      { name: "Curva A", value: curveA.reduce((sum, p) => sum + p.revenue, 0), count: curveA.length },
      { name: "Curva B", value: curveB.reduce((sum, p) => sum + p.revenue, 0), count: curveB.length },
      { name: "Curva C", value: curveC.reduce((sum, p) => sum + p.revenue, 0), count: curveC.length },
    ];
  }, [abcProducts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Análise de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores e métricas financeiras
          </p>
        </div>
        <Select value={periodMonths} onValueChange={setPeriodMonths}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Último mês</SelectItem>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faturamento</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem Operacional</p>
                <p className="text-xl font-bold">{metrics.operatingMargin.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio / Venda</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.avgTicketSale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio / Produto</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.avgTicketProduct)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row of KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <TrendingUp className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Bruto</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.grossProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Inadimplência</p>
                <p className="text-xl font-bold">{metrics.delinquencyRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(metrics.totalOverdue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <BarChart3 className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Vendas</p>
                <p className="text-xl font-bold">{metrics.salesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Users className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendedores Ativos</p>
                <p className="text-xl font-bold">{salesBySalesperson.filter((s) => s.id !== "none").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faturamento x Lucro</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis 
                    className="text-xs" 
                    tickFormatter={(value) => 
                      new Intl.NumberFormat("pt-BR", { 
                        notation: "compact", 
                        compactDisplay: "short" 
                      }).format(value)
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* ABC Curve Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curva ABC de Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {abcChartData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={abcChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {abcChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ABC Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos - Curva ABC</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Curva</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abcProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Sem dados
                    </TableCell>
                  </TableRow>
                ) : (
                  abcProducts.slice(0, 10).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                      <TableCell className="text-right">{product.percent.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.curve === "A" ? "default" : product.curve === "B" ? "secondary" : "outline"
                          }
                        >
                          {product.curve}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sales by Salesperson */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendas por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesBySalesperson.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Sem dados
                    </TableCell>
                  </TableRow>
                ) : (
                  salesBySalesperson.map((sp) => (
                    <TableRow key={sp.id}>
                      <TableCell className="font-medium">{sp.name}</TableCell>
                      <TableCell className="text-right">{sp.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sp.revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sp.avgTicket)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
