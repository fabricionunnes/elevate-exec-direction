import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, CreditCard, QrCode, FileText, DollarSign, RefreshCw, ChevronDown, CheckCircle2, Clock, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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

interface RecurringCharge {
  id: string;
  description: string;
  amount_cents: number;
  recurrence: string;
  is_active: boolean;
  next_charge_date: string;
  pagarme_link_url: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  paid: { label: "Pago", variant: "default", icon: CheckCircle2 },
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  canceled: { label: "Cancelado", variant: "secondary", icon: XCircle },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  processing: { label: "Processando", variant: "outline", icon: RefreshCw },
};

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  credit_card: CreditCard,
  pix: QrCode,
  boleto: FileText,
};

const RECURRENCE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

export function CompanyPaymentHistory({ companyId }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    const [ordersRes, recurringRes] = await Promise.all([
      supabase
        .from("pagarme_orders")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("company_recurring_charges")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

    if (!ordersRes.error) setOrders((ordersRes.data as any) || []);
    if (!recurringRes.error) setRecurringCharges((recurringRes.data as any) || []);
    setLoading(false);
  };

  const checkOrderStatus = async (pagarmeOrderId: string, localOrderId: string) => {
    setCheckingStatus(localOrderId);
    try {
      const { data, error } = await supabase.functions.invoke("pagarme-order-status", {
        body: { order_id: pagarmeOrderId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setOrderDetails((prev) => ({ ...prev, [localOrderId]: data }));

      // Update local status if changed
      if (data.status) {
        await supabase
          .from("pagarme_orders")
          .update({ status: data.status } as any)
          .eq("id", localOrderId);
        
        setOrders((prev) =>
          prev.map((o) => (o.id === localOrderId ? { ...o, status: data.status } : o))
        );
      }

      toast.success("Status atualizado!");
    } catch (err: any) {
      toast.error("Erro ao verificar status: " + (err.message || "erro"));
    } finally {
      setCheckingStatus(null);
    }
  };

  const totalPaid = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const totalPending = orders
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + o.amount_cents, 0);

  const formatCurrency = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

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
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
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

      {/* Recurring Charges Status */}
      {recurringCharges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-5 w-5 text-primary" />
              Acompanhamento de Recorrências
            </CardTitle>
            <CardDescription>Veja o status de cada ciclo de cobrança recorrente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recurringCharges.map((rc) => {
              const rcOrders = orders.filter(
                (o) => o.product_name?.includes(rc.description) || o.product_name?.includes("Mensalidade")
              );
              const paidCount = rcOrders.filter((o) => o.status === "paid").length;
              const pendingCount = rcOrders.filter((o) => o.status === "pending").length;

              return (
                <Collapsible key={rc.id}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{rc.description}</p>
                          <Badge variant={rc.is_active ? "default" : "secondary"}>
                            {rc.is_active ? "Ativo" : "Pausado"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatCurrency(rc.amount_cents)}</span>
                          <span>•</span>
                          <span>{RECURRENCE_LABELS[rc.recurrence] || rc.recurrence}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {paidCount} pago{paidCount !== 1 ? "s" : ""}
                          </span>
                          {pendingCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-amber-500" />
                                {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-2 space-y-2 border-l-2 border-muted pl-4">
                      {rcOrders.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Nenhum pagamento registrado ainda</p>
                      ) : (
                        rcOrders.map((order) => (
                          <OrderRow
                            key={order.id}
                            order={order}
                            checkingStatus={checkingStatus}
                            orderDetails={orderDetails[order.id]}
                            onCheckStatus={checkOrderStatus}
                            formatCurrency={formatCurrency}
                          />
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Orders List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Todas as Cobranças
              </CardTitle>
              <CardDescription>Histórico completo de pagamentos desta empresa</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma cobrança realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  checkingStatus={checkingStatus}
                  orderDetails={orderDetails[order.id]}
                  onCheckStatus={checkOrderStatus}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface OrderRowProps {
  order: Order;
  checkingStatus: string | null;
  orderDetails: any;
  onCheckStatus: (pagarmeId: string, localId: string) => void;
  formatCurrency: (cents: number) => string;
}

function OrderRow({ order, checkingStatus, orderDetails, onCheckStatus, formatCurrency }: OrderRowProps) {
  const MethodIcon = METHOD_ICONS[order.payment_method] || CreditCard;
  const statusInfo = STATUS_MAP[order.status] || { label: order.status, variant: "outline" as const, icon: Clock };
  const StatusIcon = statusInfo.icon;
  const isChecking = checkingStatus === order.id;

  return (
    <Collapsible>
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
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
                  <span>{order.installments}x de {formatCurrency(Math.round(order.amount_cents / order.installments))}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{formatCurrency(order.amount_cents)}</span>
          <Badge variant={statusInfo.variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusInfo.label}
          </Badge>
          {order.pagarme_order_id && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (!orderDetails) {
                    onCheckStatus(order.pagarme_order_id!, order.id);
                  }
                }}
                title="Ver detalhes do pagamento"
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      </div>
      {orderDetails && (
        <CollapsibleContent>
          <div className="mx-4 mt-1 mb-2 p-3 rounded-md bg-muted/50 border text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status Pagar.me:</span>
              <Badge variant={orderDetails.status === "paid" ? "default" : "outline"}>
                {STATUS_MAP[orderDetails.status]?.label || orderDetails.status}
              </Badge>
            </div>
            {orderDetails.charges?.map((charge: any, i: number) => (
              <div key={charge.id || i} className="space-y-1 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cobrança #{i + 1}</span>
                  <Badge variant={charge.status === "paid" ? "default" : "outline"} className="text-xs">
                    {STATUS_MAP[charge.status]?.label || charge.status}
                  </Badge>
                </div>
                {charge.paid_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pago em:</span>
                    <span>{format(new Date(charge.paid_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                )}
                {charge.last_transaction && (
                  <>
                    {charge.last_transaction.installments > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Parcelas:</span>
                        <span>{charge.last_transaction.installments}x</span>
                      </div>
                    )}
                    {charge.last_transaction.acquirer_message && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Mensagem:</span>
                        <span className="text-xs">{charge.last_transaction.acquirer_message}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => onCheckStatus(order.pagarme_order_id!, order.id)}
              disabled={isChecking}
            >
              {isChecking ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Atualizar Status
            </Button>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
