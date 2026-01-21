import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  BarChart3,
  Bell,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StockAlertsCard } from "./StockAlertsCard";

interface Props {
  projectId: string;
}

interface DashboardData {
  totalProducts: number;
  totalStockValue: number;
  lowStockProducts: number;
  monthlyPurchases: number;
  monthlySales: number;
  monthlyCMV: number;
  monthlyGrossProfit: number;
  monthlyMargin: number;
}

export function ClientInventoryDashboard({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    totalProducts: 0,
    totalStockValue: 0,
    lowStockProducts: 0,
    monthlyPurchases: 0,
    monthlySales: 0,
    monthlyCMV: 0,
    monthlyGrossProfit: 0,
    monthlyMargin: 0,
  });
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [topSelling, setTopSelling] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // Fetch products
      const { data: products } = await supabase
        .from("client_inventory_products")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);

      // Fetch purchases this month
      const { data: purchases } = await supabase
        .from("client_inventory_purchases")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "confirmed")
        .gte("purchase_date", format(monthStart, "yyyy-MM-dd"))
        .lte("purchase_date", format(monthEnd, "yyyy-MM-dd"));

      // Fetch sales this month
      const { data: sales } = await supabase
        .from("client_inventory_sales")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .gte("sale_date", format(monthStart, "yyyy-MM-dd"))
        .lte("sale_date", format(monthEnd, "yyyy-MM-dd"));

      // Fetch sale items for top selling
      const { data: saleItems } = await supabase
        .from("client_inventory_sale_items")
        .select("*, product:client_inventory_products(*), sale:client_inventory_sales(*)")
        .eq("sale.project_id", projectId);

      const productsArr = products || [];
      const purchasesArr = purchases || [];
      const salesArr = sales || [];

      // Calculate metrics
      const totalProducts = productsArr.length;
      const totalStockValue = productsArr.reduce(
        (sum, p) => sum + Number(p.current_stock) * Number(p.average_cost),
        0
      );
      const lowStockProducts = productsArr.filter(
        (p) => Number(p.current_stock) <= Number(p.min_stock)
      );
      const monthlyPurchases = purchasesArr.reduce(
        (sum, p) => sum + Number(p.total_amount),
        0
      );
      const monthlySales = salesArr.reduce(
        (sum, s) => sum + Number(s.final_amount),
        0
      );
      const monthlyCMV = salesArr.reduce(
        (sum, s) => sum + Number(s.total_cost || 0),
        0
      );
      const monthlyGrossProfit = monthlySales - monthlyCMV;
      const monthlyMargin = monthlySales > 0 ? (monthlyGrossProfit / monthlySales) * 100 : 0;

      setData({
        totalProducts,
        totalStockValue,
        lowStockProducts: lowStockProducts.length,
        monthlyPurchases,
        monthlySales,
        monthlyCMV,
        monthlyGrossProfit,
        monthlyMargin,
      });

      setLowStockList(lowStockProducts.slice(0, 5));

      // Calculate top selling
      const productSales: Record<string, { product: any; quantity: number; revenue: number }> = {};
      (saleItems || []).forEach((item: any) => {
        if (item.product && item.sale?.status === "completed") {
          const pid = item.product_id;
          if (!productSales[pid]) {
            productSales[pid] = { product: item.product, quantity: 0, revenue: 0 };
          }
          productSales[pid].quantity += Number(item.quantity_base);
          productSales[pid].revenue += Number(item.total_price);
        }
      });
      const topSellingArr = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopSelling(topSellingArr);

    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Erro ao carregar dashboard");
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
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
        <div>
          <h2 className="text-xl font-semibold">Estoque & Compras</h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Produtos</span>
            </div>
            <p className="text-2xl font-bold">{data.totalProducts}</p>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Valor em Estoque</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(data.totalStockValue)}
            </p>
            <p className="text-xs text-muted-foreground">custo total</p>
          </CardContent>
        </Card>

        <Card className={data.lowStockProducts > 0 ? "border-amber-500/50" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`h-4 w-4 ${data.lowStockProducts > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground">Estoque Baixo</span>
            </div>
            <p className={`text-2xl font-bold ${data.lowStockProducts > 0 ? "text-amber-500" : ""}`}>
              {data.lowStockProducts}
            </p>
            <p className="text-xs text-muted-foreground">produtos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Compras do Mês</span>
            </div>
            <p className="text-lg font-bold text-purple-600">
              {formatCurrency(data.monthlyPurchases)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Vendas do Mês</span>
            </div>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(data.monthlySales)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">CMV do Mês</span>
            </div>
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(data.monthlyCMV)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Lucro Bruto</span>
            </div>
            <p className={`text-lg font-bold ${data.monthlyGrossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(data.monthlyGrossProfit)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              <span className="text-xs text-muted-foreground">Margem Bruta</span>
            </div>
            <p className={`text-lg font-bold ${data.monthlyMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
              {data.monthlyMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Alerts */}
      <StockAlertsCard projectId={projectId} />

      {/* Lists */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Low Stock Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Produtos com Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum produto com estoque baixo
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockList.map((product) => (
                  <div key={product.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Mín: {product.min_stock} {product.base_unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-500">
                        {product.current_stock} {product.base_unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Produtos Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSelling.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma venda registrada
              </p>
            ) : (
              <div className="space-y-3">
                {topSelling.map((item, index) => (
                  <div key={item.product.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      <p className="font-medium">{item.product.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {formatCurrency(item.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} {item.product.base_unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
