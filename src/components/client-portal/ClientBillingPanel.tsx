import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Calendar, AlertTriangle, CheckCircle2, ExternalLink, Copy, Receipt } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Invoice {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  late_fee_cents: number;
  interest_cents: number;
  total_with_fees_cents: number;
  payment_link_url: string | null;
  public_token: string;
  installment_number: number;
  total_installments: number;
  paid_at: string | null;
  paid_amount_cents: number | null;
  late_fee_percent: number;
  daily_interest_percent: number;
  created_at: string;
}

interface Props {
  companyId: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  paid: { label: "Pago", variant: "default" },
  overdue: { label: "Vencida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

const formatCurrency = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function ClientBillingPanel({ companyId }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetchInvoices();
  }, [companyId]);

  const fetchInvoices = async () => {
    if (!companyId) return;
    // Update fees before fetching
    await supabase.functions.invoke("generate-invoices", {
      body: { action: "update_fees" },
    });

    const { data, error } = await supabase
      .from("company_invoices")
      .select("*")
      .eq("company_id", companyId)
      .order("due_date", { ascending: true });

    if (!error) setInvoices((data as any) || []);
    setLoading(false);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/#/fatura?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link da fatura copiado!");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingInvoices = invoices.filter(i => i.status === "pending" || i.status === "overdue");
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalPending = pendingInvoices.reduce((sum, i) =>
    sum + (i.status === "overdue" ? i.total_with_fees_cents : i.amount_cents), 0
  );
  const totalPaid = paidInvoices.reduce((sum, i) => sum + (i.paid_amount_cents || i.amount_cents), 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total em Aberto</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-muted-foreground">{pendingInvoices.length} parcela(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Pago</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">{paidInvoices.length} parcela(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Parcelas</p>
            <p className="text-xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Minhas Faturas
          </CardTitle>
          <CardDescription>Parcelas e cobranças do seu contrato</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma fatura encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => {
                const statusInfo = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                const isOverdue = inv.status === "overdue";
                const isPaid = inv.status === "paid";
                const dueDate = new Date(inv.due_date + "T12:00:00");
                const displayAmount = isOverdue ? inv.total_with_fees_cents : inv.amount_cents;

                return (
                  <div
                    key={inv.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isOverdue ? "border-destructive/30 bg-destructive/5" :
                      isPaid ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10" :
                      "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{inv.description}</p>
                          <Badge variant={statusInfo.variant} className="text-xs">
                            {statusInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {inv.installment_number}/{inv.total_installments}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Vence: {format(dueDate, "dd/MM/yyyy")}
                          </span>
                          <span>Valor: {formatCurrency(inv.amount_cents)}</span>
                          {isOverdue && (
                            <>
                              <span className="text-destructive">
                                Multa: {formatCurrency(inv.late_fee_cents)}
                              </span>
                              <span className="text-destructive">
                                Juros: {formatCurrency(inv.interest_cents)}
                              </span>
                            </>
                          )}
                        </div>
                        {isPaid && inv.paid_at && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Pago em {format(new Date(inv.paid_at), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className={`font-bold text-sm ${isOverdue ? "text-destructive" : isPaid ? "text-green-600" : ""}`}>
                          {formatCurrency(displayAmount)}
                        </p>
                        {!isPaid && inv.status !== "cancelled" && (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => copyLink(inv.public_token)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Link
                            </Button>
                            {inv.payment_link_url && (
                              <Button asChild variant="default" size="sm" className="h-7 text-xs px-3">
                                <a href={inv.payment_link_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Pagar
                                </a>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
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
