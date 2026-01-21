import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Package, ShoppingCart, Bell, BellOff } from "lucide-react";
import type { InventoryProduct } from "./types";

interface Props {
  projectId: string;
  onCreatePurchaseBudget?: (products: InventoryProduct[]) => void;
}

interface LowStockProduct extends InventoryProduct {
  deficit: number;
  urgency: 'critical' | 'warning' | 'low';
}

export function StockAlertsCard({ projectId, onCreatePurchaseBudget }: Props) {
  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [projectId]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_inventory_products")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (error) throw error;

      // Filter products with low stock and calculate urgency
      const lowStock = (data || [])
        .filter((p) => p.current_stock <= p.min_stock)
        .map((p) => {
          const deficit = p.min_stock - p.current_stock;
          const percentageBelow = p.min_stock > 0 ? (deficit / p.min_stock) * 100 : 0;
          
          let urgency: 'critical' | 'warning' | 'low';
          if (p.current_stock <= 0) {
            urgency = 'critical';
          } else if (percentageBelow >= 50) {
            urgency = 'warning';
          } else {
            urgency = 'low';
          }

          return { ...p, deficit, urgency } as LowStockProduct;
        })
        .sort((a, b) => {
          // Sort by urgency first, then by deficit
          const urgencyOrder = { critical: 0, warning: 1, low: 2 };
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
          }
          return b.deficit - a.deficit;
        });

      setLowStockProducts(lowStock);
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500">Alerta</Badge>;
      default:
        return <Badge variant="secondary">Baixo</Badge>;
    }
  };

  const criticalCount = lowStockProducts.filter((p) => p.urgency === 'critical').length;
  const warningCount = lowStockProducts.filter((p) => p.urgency === 'warning').length;
  const displayProducts = showAll ? lowStockProducts : lowStockProducts.slice(0, 5);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lowStockProducts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            Alertas de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Todos os produtos estão com estoque adequado
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            Alertas de Estoque
            <Badge variant="secondary" className="ml-2">
              {lowStockProducts.length}
            </Badge>
          </CardTitle>
          {onCreatePurchaseBudget && lowStockProducts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreatePurchaseBudget(lowStockProducts)}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Repor
            </Button>
          )}
        </div>
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex gap-2 mt-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-amber-500 text-xs">
                {warningCount} em alerta
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayProducts.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 flex-shrink-0 ${
                      product.urgency === 'critical'
                        ? 'text-red-500'
                        : product.urgency === 'warning'
                        ? 'text-amber-500'
                        : 'text-yellow-500'
                    }`}
                  />
                  <p className="font-medium truncate">{product.name}</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Mínimo: {product.min_stock} {product.base_unit}
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p
                  className={`font-bold ${
                    product.urgency === 'critical'
                      ? 'text-red-500'
                      : product.urgency === 'warning'
                      ? 'text-amber-500'
                      : 'text-yellow-600'
                  }`}
                >
                  {product.current_stock} {product.base_unit}
                </p>
                {getUrgencyBadge(product.urgency)}
              </div>
            </div>
          ))}

          {lowStockProducts.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Mostrar menos"
                : `Ver mais ${lowStockProducts.length - 5} produtos`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
