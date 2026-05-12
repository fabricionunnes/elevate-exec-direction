import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Calendar, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  installment_number: number;
  total_installments: number;
  paid_at: string | null;
  paid_amount_cents: number | null;
  late_fee_percent: number;
  daily_interest_percent: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  paid: { label: "Pago", variant: "default" },
  overdue: { label: "Vencida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

const formatCurrency = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export default function PublicInvoicePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    const fetchInvoice = async () => {
      // Fetch invoice immediately
      const { data } = await supabase
        .from("company_invoices")
        .select("*")
        .eq("public_token", token)
        .single();

      setInvoice(data as any);
      setLoading(false);

      // Update fees in background, then refresh
      supabase.functions.invoke("generate-invoices", {
        body: { action: "update_fees" },
      }).then(async () => {
        const { data: updated } = await supabase
          .from("company_invoices")
          .select("*")
          .eq("public_token", token!)
          .single();
        if (updated) setInvoice(updated as any);
      });
    };

    fetchInvoice();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">Fatura não encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">O link pode estar expirado ou inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.pending;
  const dueDate = new Date(invoice.due_date + "T12:00:00");
  const isOverdue = invoice.status === "overdue";
  const isPaid = invoice.status === "paid";
  const daysLate = isOverdue
    ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-lg">
        <CardHeader className="text-center border-b pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Fatura</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Mensalidade
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={statusInfo.variant} className="text-sm">
              {isPaid && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {isOverdue && <AlertTriangle className="h-3 w-3 mr-1" />}
              {statusInfo.label}
            </Badge>
          </div>

          {/* Description */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Descrição</span>
            <span className="text-sm font-medium text-right max-w-[60%]">{invoice.description}</span>
          </div>

          {/* Due date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Vencimento
            </span>
            <span className="text-sm font-medium">
              {format(dueDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>

          {/* Value breakdown */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Valor original</span>
              <span className="text-sm">{formatCurrency(invoice.amount_cents)}</span>
            </div>

            {isOverdue && (
              <>
                <div className="flex items-center justify-between text-destructive">
                  <span className="text-sm">Multa moratória ({invoice.late_fee_percent}%)</span>
                  <span className="text-sm">+ {formatCurrency(invoice.late_fee_cents)}</span>
                </div>
                <div className="flex items-center justify-between text-destructive">
                  <span className="text-sm">
                    Juros de mora ({invoice.daily_interest_percent}%/dia × {daysLate} dias)
                  </span>
                  <span className="text-sm">+ {formatCurrency(invoice.interest_cents)}</span>
                </div>
              </>
            )}

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-semibold">Total a pagar</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(
                  isOverdue ? invoice.total_with_fees_cents : invoice.amount_cents
                )}
              </span>
            </div>
          </div>

          {/* Paid info */}
          {isPaid && invoice.paid_at && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Pago em {format(new Date(invoice.paid_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
              {invoice.paid_amount_cents && (
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  Valor pago: {formatCurrency(invoice.paid_amount_cents)}
                </p>
              )}
            </div>
          )}

          {/* Payment button */}
          {(invoice.status === "pending" || invoice.status === "overdue") && invoice.payment_link_url && (
            <Button asChild className="w-full" size="lg">
              <a href={invoice.payment_link_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Pagar agora — {formatCurrency(
                  isOverdue ? invoice.total_with_fees_cents : invoice.amount_cents
                )}
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
