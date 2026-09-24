import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: any[];
  type: "receivable" | "payable";
  formatCurrencyCents: (v: number) => string;
  formatCurrency: (v: number) => string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  overdue: { label: "Vencido", variant: "destructive" },
  partial: { label: "Parcial", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

const cents = (v: any) => Math.round((Number(v) || 0) * 100);

// Recebível guarda centavos; pagável guarda reais. Em item já pago (inteiro ou parcial)
// o número que vale é o que entrou/saiu de fato; no que está em aberto, o saldo.
function valores(item: any, isReceivable: boolean) {
  const status = item.status || "pending";
  const total = isReceivable ? (item.amount_cents || 0) : cents(item.amount);
  const pago = isReceivable ? (item.paid_amount_cents || 0) : cents(item.paid_amount);
  const quitado = status === "paid";
  const parcial = status === "partial";
  const principal = quitado || parcial ? (pago || total) : Math.max(0, total - pago);
  return { status, total, pago, principal, quitado, parcial };
}

export function DashboardDetailDialog({
  open,
  onOpenChange,
  title,
  items,
  type,
  formatCurrencyCents,
}: Props) {
  const isReceivable = type === "receivable";
  const totalValue = items.reduce((s, item) => s + valores(item, isReceivable).principal, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="secondary" className="text-xs">
              {items.length} item(ns)
            </Badge>
            <span className="text-sm font-semibold text-primary">
              Total: {formatCurrencyCents(totalValue)}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 px-6 pb-6 min-h-0 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum item encontrado.
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {items.map((item, idx) => {
                const titulo = isReceivable
                  ? (item.company_name || item.company?.name || item.custom_receiver_name || item.description || "Sem nome")
                  : (item.supplier_name || item.description || "Sem fornecedor");
                const sub = isReceivable
                  ? (item.description || "")
                  : (item.supplier_name ? (item.description || "") : "");
                const { status, total, pago, principal, quitado, parcial } = valores(item, isReceivable);
                const sl = statusLabels[status] || { label: status, variant: "secondary" as const };
                const pagoEm = item.paid_date || item.paid_at;
                const dataTexto = (quitado || parcial) && pagoEm
                  ? `Pago em ${format(parseISO(String(pagoEm).slice(0, 10)), "dd/MM/yyyy")}`
                  : item.due_date
                    ? `Venc: ${format(parseISO(item.due_date), "dd/MM/yyyy")}`
                    : "";

                return (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{titulo}</p>
                      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {dataTexto && (
                          <span className="text-xs text-muted-foreground">{dataTexto}</span>
                        )}
                        <Badge variant={sl.variant} className="text-[10px] h-5">
                          {sl.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrencyCents(principal)}</p>
                      {parcial && pago > 0 && total > pago && (
                        <p className="text-[10px] text-muted-foreground">
                          de {formatCurrencyCents(total)}, falta {formatCurrencyCents(total - pago)}
                        </p>
                      )}
                      {quitado && pago > 0 && total > pago && (
                        <p className="text-[10px] text-muted-foreground">
                          valor original {formatCurrencyCents(total)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
