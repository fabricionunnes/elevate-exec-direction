import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function DashboardDetailDialog({
  open,
  onOpenChange,
  title,
  items,
  type,
  formatCurrencyCents,
  formatCurrency,
}: Props) {
  const totalValue = items.reduce((s, item) => {
    if (type === "receivable") {
      if (item.status === "partial" && item.paid_amount_cents) {
        return s + Math.max(0, (item.amount_cents || 0) - item.paid_amount_cents);
      }
      return s + (item.amount_cents || 0);
    }
    return s + ((item.amount || 0) * 100);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
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

        <ScrollArea className="flex-1 px-6 pb-6 max-h-[60vh]">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum item encontrado.
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {items.map((item, idx) => {
                const isReceivable = type === "receivable";
                const name = isReceivable
                  ? (item.company?.name || item.custom_receiver_name || "Sem nome")
                  : (item.description || item.supplier_name || "Sem descrição");
                const dueDate = item.due_date;
                const status = item.status || "pending";
                const sl = statusLabels[status] || { label: status, variant: "secondary" as const };
                const amount = isReceivable ? (item.amount_cents || 0) : ((item.amount || 0) * 100);
                const remaining = isReceivable && status === "partial" && item.paid_amount_cents
                  ? Math.max(0, amount - item.paid_amount_cents)
                  : amount;

                return (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Venc: {format(parseISO(dueDate), "dd/MM/yyyy")}
                          </span>
                        )}
                        <Badge variant={sl.variant} className="text-[10px] h-5">
                          {sl.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrencyCents(remaining)}</p>
                      {status === "partial" && isReceivable && item.paid_amount_cents > 0 && (
                        <p className="text-[10px] text-emerald-600">
                          Pago: {formatCurrencyCents(item.paid_amount_cents)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
