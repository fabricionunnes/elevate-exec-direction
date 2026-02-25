import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, CreditCard, QrCode, FileText, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface Props {
  companyId: string;
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  amount_cents: number;
  payment_method: string;
  installments: number | null;
  status: string;
  pagarme_order_id: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "outline" },
  canceled: { label: "Cancelado", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
};

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  credit_card: CreditCard,
  pix: QrCode,
  boleto: FileText,
};

export function CompanyPaymentHistory({ companyId }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [companyId]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("pagarme_orders")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error) setOrders((data as any) || []);
    setLoading(false);
  };

  const totalPaid = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const totalPending = orders
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Recebido</p>
                <p className="text-xl font-bold text-green-600">
                  R$ {(totalPaid / 100).toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <History className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold text-amber-600">
                  R$ {(totalPending / 100).toFixed(2).replace(".", ",")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Cobranças</p>
                <p className="text-xl font-bold">{orders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Pagamentos
          </CardTitle>
          <CardDescription>Todas as cobranças realizadas para esta empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma cobrança realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const MethodIcon = METHOD_ICONS[order.payment_method] || CreditCard;
                const statusInfo = STATUS_MAP[order.status] || { label: order.status, variant: "outline" as const };

                return (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <MethodIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="font-medium">{order.product_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{order.customer_name}</span>
                          <span>•</span>
                          <span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</span>
                          {order.installments && order.installments > 1 && (
                            <>
                              <span>•</span>
                              <span>{order.installments}x</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        R$ {(order.amount_cents / 100).toFixed(2).replace(".", ",")}
                      </span>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
