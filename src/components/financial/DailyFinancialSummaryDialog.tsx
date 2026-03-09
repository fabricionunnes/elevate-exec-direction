import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  invoices: any[];
  payables: any[];
  companies: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STORAGE_KEY = "fin_daily_summary_last_shown";

export function shouldShowDailySummary(): boolean {
  const today = new Date().toISOString().split("T")[0];
  const lastShown = localStorage.getItem(STORAGE_KEY);
  return lastShown !== today;
}

export function markDailySummaryShown() {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(STORAGE_KEY, today);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function DailyFinancialSummaryDialog({ invoices, payables, companies, open, onOpenChange }: Props) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const companiesMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

  const todayReceivables = useMemo(() => {
    return invoices.filter(inv => {
      const dueDate = inv.due_date?.split("T")[0];
      return dueDate === today && inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "cancelado" && inv.status !== "pago";
    });
  }, [invoices, today]);

  const todayPayables = useMemo(() => {
    return payables.filter(p => {
      const dueDate = p.due_date?.split("T")[0];
      return dueDate === today && p.status !== "pago" && p.status !== "cancelado" && p.status !== "paid" && p.status !== "cancelled";
    });
  }, [payables, today]);

  const totalReceivables = useMemo(() => {
    return todayReceivables.reduce((sum, inv) => {
      const amount = inv.amount_cents ? inv.amount_cents / 100 : inv.amount || 0;
      return sum + amount;
    }, 0);
  }, [todayReceivables]);

  const totalPayables = useMemo(() => {
    return todayPayables.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [todayPayables]);

  const formattedDate = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const hasItems = todayReceivables.length > 0 || todayPayables.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Resumo Financeiro do Dia
          </DialogTitle>
          <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
        </DialogHeader>

        {!hasItems ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-base font-medium">Nenhum vencimento para hoje!</p>
            <p className="text-sm text-muted-foreground mt-1">Você não possui contas a receber ou a pagar vencendo hoje.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-2">
            <div className="space-y-5">
              {/* Contas a Receber */}
              {todayReceivables.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h3 className="font-semibold text-sm">Contas a Receber</h3>
                      <Badge variant="secondary" className="text-xs">{todayReceivables.length}</Badge>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(totalReceivables)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {todayReceivables.map(inv => {
                      const amount = inv.amount_cents ? inv.amount_cents / 100 : inv.amount || 0;
                      const companyName = inv.company_name || companiesMap.get(inv.company_id) || "—";
                      const isOverdue = inv.status === "overdue" || inv.status === "vencido";
                      return (
                        <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{inv.description || "Fatura"}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(amount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contas a Pagar */}
              {todayPayables.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-500/10">
                        <ArrowUpCircle className="h-4 w-4 text-rose-600" />
                      </div>
                      <h3 className="font-semibold text-sm">Contas a Pagar</h3>
                      <Badge variant="secondary" className="text-xs">{todayPayables.length}</Badge>
                    </div>
                    <span className="text-sm font-bold text-rose-600">{formatCurrency(totalPayables)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {todayPayables.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.supplier_name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.description || "Despesa"}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {(p.status === "vencido" || p.status === "overdue") && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                          <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(p.amount || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-sm font-medium">Saldo do dia</span>
                <span className={`text-sm font-bold ${totalReceivables - totalPayables >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrency(totalReceivables - totalPayables)}
                </span>
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
