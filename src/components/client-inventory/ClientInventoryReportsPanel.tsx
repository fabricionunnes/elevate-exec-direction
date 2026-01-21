import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Package, Truck, ShoppingCart, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projectId: string;
}

export function ClientInventoryReportsPanel({ projectId }: Props) {
  const [period, setPeriod] = useState("current");
  const [reportTab, setReportTab] = useState("inventory");

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "last":
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "last3":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const { start, end } = getDateRange();

  const { data: products = [] } = useQuery({
    queryKey: ["inventory-report-products", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inventory_products")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["inventory-report-purchases", projectId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inventory_purchases")
        .select(`
          *,
          supplier:client_inventory_suppliers(name),
          items:client_inventory_purchase_items(
            quantity,
            unit_cost,
            total_cost,
            product:client_inventory_products(name)
          )
        `)
        .eq("project_id", projectId)
        .gte("purchase_date", start.toISOString())
        .lte("purchase_date", end.toISOString())
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["inventory-report-sales", projectId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_inventory_sales")
        .select(`
          *,
          items:client_inventory_sale_items(
            quantity,
            unit_price,
            total_price,
            total_cost,
            product:client_inventory_products(name)
          )
        `)
        .eq("project_id", projectId)
        .gte("sale_date", start.toISOString())
        .lte("sale_date", end.toISOString())
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalStockValue = products.reduce((acc, p) => acc + (p.current_stock * p.average_cost), 0);
  const totalPurchases = purchases.reduce((acc, p) => acc + Number(p.total_amount), 0);
  const totalSales = sales.reduce((acc, s) => acc + Number(s.final_amount), 0);
  const totalCMV = sales.reduce((acc, s) => acc + Number(s.total_cost), 0);
  const grossProfit = totalSales - totalCMV;
  const marginPercent = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="last">Mês anterior</SelectItem>
            <SelectItem value="last3">Últimos 3 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Valor em Estoque</div>
            <div className="text-xl font-bold">{formatCurrency(totalStockValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Compras</div>
            <div className="text-xl font-bold">{formatCurrency(totalPurchases)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Vendas</div>
            <div className="text-xl font-bold">{formatCurrency(totalSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Margem Bruta</div>
            <div className="text-xl font-bold text-green-600">{marginPercent.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="inventory" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventário</span>
          </TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-1">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Compras</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-1">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="cmv" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">CMV</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Inventário Completo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead className="text-right">Custo Médio</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                        <TableCell className="text-right">
                          {product.current_stock.toLocaleString("pt-BR")} {product.base_unit}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(product.average_cost)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(product.current_stock * product.average_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle>Compras por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase: any) => (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          {format(new Date(purchase.purchase_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{purchase.supplier?.name || "-"}</TableCell>
                        <TableCell>{purchase.invoice_number || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(purchase.total_amount)}</TableCell>
                        <TableCell>{purchase.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.sale_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{sale.customer_name || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(sale.final_amount)}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(sale.gross_profit)}
                        </TableCell>
                        <TableCell className="text-right">{sale.profit_margin?.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cmv">
          <Card>
            <CardHeader>
              <CardTitle>Análise de CMV e Margem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Vendas</div>
                  <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">CMV</div>
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(totalCMV)}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Lucro Bruto</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(grossProfit)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
