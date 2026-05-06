import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ReceivablePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** For financial_receivables */
  receivable?: {
    id: string;
    description: string;
    amount: number;
    paid_amount?: number | null;
    status: string;
    company?: { name: string } | null;
  } | null;
  /** For company_invoices (cents-based) */
  invoice?: {
    id: string;
    description: string;
    amount_cents: number;
    paid_amount_cents?: number | null;
    status: string;
    total_with_fees_cents?: number;
    due_date?: string;
    recurring_charge_id?: string | null;
  } | null;
  onSuccess: () => void;
  /** Optional callback after Asaas sync for invoices */
  onAsaasSync?: (invoiceId: string) => void;
}

export function ReceivablePaymentDialog({
  open,
  onOpenChange,
  receivable,
  invoice,
  onSuccess,
  onAsaasSync,
}: ReceivablePaymentDialogProps) {
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [bankId, setBankId] = useState("none");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paidAmount, setPaidAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [interest, setInterest] = useState(0);
  const [fees, setFees] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<Array<{
    id: string;
    amount_cents: number;
    bank_name?: string;
    created_at: string;
  }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isInvoice = !!invoice;
  const item = receivable || invoice;

  // Derived values
  const originalAmount = isInvoice
    ? (invoice!.total_with_fees_cents || invoice!.amount_cents) / 100
    : receivable!?.amount || 0;
  const previouslyPaid = isInvoice
    ? (invoice!.paid_amount_cents || 0) / 100
    : receivable?.paid_amount || 0;
  const remaining = originalAmount - previouslyPaid;
  const description = isInvoice ? invoice!.description : receivable?.description || "";
  const entityId = isInvoice ? invoice!.id : receivable?.id || "";

  useEffect(() => {
    if (open) {
      // Load banks
      supabase
        .from("financial_banks")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => setBanks((data as any) || []));

      // Reset form
      setBankId("none");
      setPaymentDate(new Date());
      setDiscount(0);
      setInterest(0);
      setFees(0);
      setPaidAmount(remaining > 0 ? remaining : originalAmount);

      // Load payment history
      if (entityId) {
        setLoadingHistory(true);
        const refType = isInvoice ? "invoice" : "receivable";
        supabase
          .from("financial_bank_transactions")
          .select("id, amount_cents, bank_id, created_at")
          .eq("reference_type", refType)
          .eq("reference_id", entityId)
          .eq("type", "credit")
          .order("created_at", { ascending: true })
          .then(({ data }) => {
            setPaymentHistory((data as any) || []);
            setLoadingHistory(false);
          });
      }
    }
  }, [open, entityId]);

  // Final amount = paidAmount + interest + fees - discount
  const finalAmount = Math.max(0, paidAmount + interest + fees - discount);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleSave = async () => {
    if (!entityId || !paymentDate) return;
    if (bankId === "none") {
      toast.error("Selecione um banco para registrar o pagamento");
      return;
    }
    if (finalAmount <= 0) {
      toast.error("O valor final deve ser maior que zero");
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(paymentDate, "yyyy-MM-dd");
      const refType = isInvoice ? "invoice" : "receivable";


      // DEDUPLICATION: Compute NET balance (credits - debits) for this entity.
      // Considering debits ensures that after a revert ("estorno"), a new payment
      // credits the full amount instead of only the difference vs an already-reversed credit.
      const { data: existingTxs } = await supabase
        .from("financial_bank_transactions")
        .select("id, amount_cents, type, description")
        .eq("reference_type", refType)
        .eq("reference_id", entityId);

      const existingCredits = (existingTxs || []).filter((tx: any) => tx.type === "credit");
      const creditsTotal = existingCredits.reduce((sum: number, tx: any) => sum + (tx.amount_cents || 0), 0);
      const debitsTotal = (existingTxs || []).filter((tx: any) => tx.type === "debit").reduce((sum: number, tx: any) => sum + (tx.amount_cents || 0), 0);
      const existingTotal = Math.max(0, creditsTotal - debitsTotal);

      if (isInvoice) {
        // Update company_invoices
        const totalSettled = previouslyPaid + finalAmount + discount;
        const invoiceFullyPaid = totalSettled >= originalAmount;
        const { error } = await supabase
          .from("company_invoices")
          .update({
            status: invoiceFullyPaid ? "paid" : "partial",
            paid_at: new Date().toISOString(),
            paid_amount_cents: Math.round((previouslyPaid + finalAmount) * 100),
          } as any)
          .eq("id", entityId);
        if (error) throw error;

        // Only credit bank if no existing credit covers the full amount
        const amountCents = Math.round(finalAmount * 100);
        const alreadyCreditedEnough = existingTotal >= amountCents && existingCredits && existingCredits.length > 0;

        if (alreadyCreditedEnough) {
          console.log(`[PaymentDialog] Bank credit already exists for invoice ${entityId} (${existingTotal} cents), skipping duplicate`);
          toast.info("Crédito bancário já registrado pela integração. Apenas o status da fatura foi atualizado.");
        } else {
          // Calculate only the difference to credit (avoid duplicating what Asaas already credited)
          const amountToCredit = existingTotal > 0 ? Math.max(0, amountCents - existingTotal) : amountCents;
          
          if (amountToCredit > 0) {
            await supabase.rpc("increment_bank_balance" as any, {
              p_bank_id: bankId,
              p_amount: amountToCredit,
            });
            await supabase.from("financial_bank_transactions").insert({
              bank_id: bankId,
              type: "credit",
              amount_cents: amountToCredit,
              description: `Recebimento: ${description}${discount > 0 ? ` (desc: ${fmt(discount)})` : ""}${interest > 0 ? ` (juros: ${fmt(interest)})` : ""}${fees > 0 ? ` (taxas: ${fmt(fees)})` : ""}`,
              reference_type: "invoice",
              reference_id: entityId,
              discount_cents: Math.round(discount * 100),
              interest_cents: Math.round(interest * 100),
              fee_cents: Math.round(fees * 100),
            } as any);
          }
        }

        toast.success("Pagamento confirmado!");

        // Asaas sync
        if (onAsaasSync) {
          onAsaasSync(entityId);
        }
      } else {
        // Update financial_receivables
        const totalPaid = previouslyPaid + finalAmount;
        const totalSettled = totalPaid + discount;
        const isPartial = totalSettled > 0 && totalSettled < originalAmount;
        const newStatus = isPartial ? "partial" : "paid";

        const { error } = await supabase
          .from("financial_receivables")
          .update({
            status: newStatus,
            paid_date: dateStr,
            paid_amount: totalPaid,
            interest_amount: interest,
            late_fee_amount: 0,
            discount_amount: discount,
            fee_amount: fees,
          })
          .eq("id", entityId);
        if (error) throw error;

        // Only credit bank if no existing credit covers the full amount
        const amountCents = Math.round(finalAmount * 100);
        const alreadyCreditedEnough = existingTotal >= amountCents && existingCredits && existingCredits.length > 0;

        if (alreadyCreditedEnough) {
          console.log(`[PaymentDialog] Bank credit already exists for receivable ${entityId} (${existingTotal} cents), skipping duplicate`);
          toast.info("Crédito bancário já registrado. Apenas o status foi atualizado.");
        } else {
          const amountToCredit = existingTotal > 0 ? Math.max(0, amountCents - existingTotal) : amountCents;
          
          if (amountToCredit > 0) {
            await supabase.rpc("increment_bank_balance" as any, {
              p_bank_id: bankId,
              p_amount: amountToCredit,
            });
            await supabase.from("financial_bank_transactions").insert({
              bank_id: bankId,
              type: "credit",
              amount_cents: amountToCredit,
              description: `Recebimento: ${description}${discount > 0 ? ` (desc: ${fmt(discount)})` : ""}${interest > 0 ? ` (juros: ${fmt(interest)})` : ""}${fees > 0 ? ` (taxas: ${fmt(fees)})` : ""}`,
              reference_type: "receivable",
              reference_id: entityId,
              discount_cents: Math.round(discount * 100),
              interest_cents: Math.round(interest * 100),
              fee_cents: Math.round(fees * 100),
            } as any);
          }
        }

        toast.success(isPartial ? "Pagamento parcial registrado!" : "Pagamento confirmado!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  const hasHistory = paymentHistory.length > 0 || previouslyPaid > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            {description} — Total: {fmt(originalAmount)}
            {hasHistory && (
              <span className="block mt-1 text-orange-600">
                Já pago: {fmt(previouslyPaid)} • Restante: {fmt(remaining)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {/* Payment history */}
          {hasHistory && paymentHistory.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Histórico de Pagamentos
              </p>
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="space-y-1.5">
                  {paymentHistory.map((tx) => {
                    const bankName = banks.find((b) => b.id === (tx as any).bank_id)?.name || "Banco";
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between text-xs bg-background rounded px-2.5 py-1.5 border"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{fmt(tx.amount_cents / 100)}</span>
                          <span className="text-muted-foreground">{bankName}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {format(new Date(tx.created_at), "dd/MM/yyyy")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bank */}
          <div>
            <Label>Banco *</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Date */}
          <div>
            <Label>Data do Pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !paymentDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={paymentDate}
                  onSelect={setPaymentDate}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div>
            <Label>Valor Recebido (R$)</Label>
            <CurrencyInput value={paidAmount} onChange={setPaidAmount} />
          </div>

          {/* Discount, Interest, Fees */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Desconto (R$)</Label>
              <CurrencyInput value={discount} onChange={setDiscount} />
            </div>
            <div>
              <Label className="text-xs">Juros (R$)</Label>
              <CurrencyInput value={interest} onChange={setInterest} />
            </div>
            <div>
              <Label className="text-xs">Taxas (R$)</Label>
              <CurrencyInput value={fees} onChange={setFees} />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Valor base</span>
              <span>{fmt(paidAmount)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>– Desconto</span>
                <span>-{fmt(discount)}</span>
              </div>
            )}
            {interest > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>+ Juros</span>
                <span>+{fmt(interest)}</span>
              </div>
            )}
            {fees > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>+ Taxas</span>
                <span>+{fmt(fees)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
              <span>Valor Final</span>
              <span>{fmt(finalAmount)}</span>
            </div>
            {finalAmount > 0 && finalAmount < remaining && (
              <p className="text-xs text-amber-600 mt-1">
                Pagamento parcial — Restará: {fmt(remaining - finalAmount)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || finalAmount <= 0 || bankId === "none"}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
