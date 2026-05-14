import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Pencil, Trash2, Save, X } from "lucide-react";

interface PaymentTransaction {
  id: string;
  amount_cents: number;
  bank_id: string;
  bank_name?: string;
  created_at: string;
  discount_cents: number;
  interest_cents: number;
  fee_cents: number;
}

type EntryType = "receivable" | "payable";

interface EditPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: EntryType;
  receivable: {
    id: string;
    description: string;
    amount: number;
    paid_amount?: number | null;
    status: string;
  } | null;
  onSuccess: () => void;
}

export function EditPaymentsDialog({
  open,
  onOpenChange,
  type = "receivable",
  receivable,
  onSuccess,
}: EditPaymentsDialogProps) {
  const isPayable = type === "payable";
  const txType = isPayable ? "debit" : "credit";
  const referenceType = isPayable ? "payable" : "receivable";
  const targetTable = isPayable ? "financial_payables" : "financial_receivables";
  const titleLabel = isPayable ? "Pagamentos" : "Recebimentos";
  const valueLabel = isPayable ? "Valor Pago" : "Valor Recebido";
  // For receivable: credit increases bank, so positive diff = +diff to bank.
  // For payable: debit decreases bank, so positive diff = -diff to bank.
  const balanceSign = isPayable ? -1 : 1;

  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editInterest, setEditInterest] = useState(0);
  const [editFees, setEditFees] = useState(0);
  const [saving, setSaving] = useState(false);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  useEffect(() => {
    if (open && receivable) {
      loadTransactions();
      supabase
        .from("financial_banks")
        .select("id, name")
        .eq("is_active", true)
        .then(({ data }) => setBanks((data as any) || []));
    }
  }, [open, receivable?.id]);

  const loadTransactions = async () => {
    if (!receivable) return;
    setLoading(true);
    const { data } = await supabase
      .from("financial_bank_transactions")
      .select("id, amount_cents, bank_id, created_at, discount_cents, interest_cents, fee_cents")
      .eq("reference_type", referenceType)
      .eq("reference_id", receivable.id)
      .eq("type", txType)
      .order("created_at", { ascending: true });
    setTransactions((data as any) || []);
    setLoading(false);
  };

  const getBankName = (bankId: string) =>
    banks.find((b) => b.id === bankId)?.name || "Banco";

  const startEdit = (tx: PaymentTransaction) => {
    setEditingId(tx.id);
    setEditAmount(tx.amount_cents / 100);
    setEditDiscount((tx.discount_cents || 0) / 100);
    setEditInterest((tx.interest_cents || 0) / 100);
    setEditFees((tx.fee_cents || 0) / 100);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (tx: PaymentTransaction) => {
    if (!receivable) return;
    setSaving(true);
    try {
      const newAmountCents = Math.round(editAmount * 100);
      const oldAmountCents = tx.amount_cents;
      const diff = newAmountCents - oldAmountCents;

      const txUpdate: any = { amount_cents: newAmountCents };
      if (!isPayable) {
        txUpdate.discount_cents = Math.round(editDiscount * 100);
        txUpdate.interest_cents = Math.round(editInterest * 100);
        txUpdate.fee_cents = Math.round(editFees * 100);
      }

      const { error: txError } = await supabase
        .from("financial_bank_transactions")
        .update(txUpdate)
        .eq("id", tx.id);

      if (txError) throw txError;

      // Adjust bank balance (sign depends on entry type)
      if (diff !== 0) {
        await supabase.rpc("increment_bank_balance" as any, {
          p_bank_id: tx.bank_id,
          p_amount: diff * balanceSign,
        });
      }

      // Recalculate total paid from all transactions
      const { data: allTx } = await supabase
        .from("financial_bank_transactions")
        .select("amount_cents")
        .eq("reference_type", referenceType)
        .eq("reference_id", receivable.id)
        .eq("type", txType);

      const totalPaid = ((allTx as any) || []).reduce(
        (s: number, t: any) => s + (t.id === tx.id ? newAmountCents : t.amount_cents),
        0
      ) / 100;

      const isFullyPaid = totalPaid >= receivable.amount;
      const updateData: any = {
        paid_amount: totalPaid,
        status: totalPaid <= 0 ? "pending" : isFullyPaid ? "paid" : "partial",
      };
      if (!isPayable) {
        updateData.interest_amount = editInterest;
        updateData.discount_amount = editDiscount;
        updateData.fee_amount = editFees;
      }

      await supabase.from(targetTable as any).update(updateData).eq("id", receivable.id);

      toast.success(`${isPayable ? "Pagamento" : "Recebimento"} atualizado!`);
      setEditingId(null);
      loadTransactions();
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (tx: PaymentTransaction) => {
    if (!receivable) return;
    if (
      !confirm(
        `Deseja realmente excluir este ${
          isPayable ? "pagamento" : "recebimento"
        }? O saldo bancário será ajustado.`
      )
    )
      return;

    setSaving(true);
    try {
      // Delete transaction
      await supabase.from("financial_bank_transactions").delete().eq("id", tx.id);

      // Reverse bank balance: receivable→subtract, payable→add back
      await supabase.rpc("increment_bank_balance" as any, {
        p_bank_id: tx.bank_id,
        p_amount: -tx.amount_cents * balanceSign,
      });

      // Recalculate total paid
      const { data: remainingTx } = await supabase
        .from("financial_bank_transactions")
        .select("amount_cents")
        .eq("reference_type", referenceType)
        .eq("reference_id", receivable.id)
        .eq("type", txType);

      const totalPaid =
        ((remainingTx as any) || []).reduce(
          (s: number, t: any) => s + t.amount_cents,
          0
        ) / 100;

      const isFullyPaid = totalPaid >= receivable.amount;
      await supabase
        .from(targetTable as any)
        .update({
          paid_amount: totalPaid > 0 ? totalPaid : null,
          paid_date: totalPaid > 0 ? undefined : null,
          status: totalPaid <= 0 ? "pending" : isFullyPaid ? "paid" : "partial",
        } as any)
        .eq("id", receivable.id);

      toast.success(
        `${isPayable ? "Pagamento" : "Recebimento"} removido e saldo ajustado!`
      );
      loadTransactions();
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  if (!receivable) return null;

  const totalPaidFromTx = transactions.reduce((s, t) => s + t.amount_cents, 0) / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {titleLabel}</DialogTitle>
          <DialogDescription>
            {receivable.description} — Total: {fmt(receivable.amount)}
            <span className="block mt-1">
              {isPayable ? "Pago" : "Recebido"}: {fmt(totalPaidFromTx)} • Restante:{" "}
              {fmt(Math.max(0, receivable.amount - totalPaidFromTx))}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum {isPayable ? "pagamento" : "recebimento"} registrado
            </p>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                {editingId === tx.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {format(new Date(tx.created_at), "dd/MM/yyyy")} • {getBankName(tx.bank_id)}
                      </span>
                    </div>
                    <div>
                      <Label className="text-xs">{valueLabel}</Label>
                      <CurrencyInput value={editAmount} onChange={setEditAmount} />
                    </div>
                    {!isPayable && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Desconto</Label>
                          <CurrencyInput value={editDiscount} onChange={setEditDiscount} />
                        </div>
                        <div>
                          <Label className="text-xs">Juros</Label>
                          <CurrencyInput value={editInterest} onChange={setEditInterest} />
                        </div>
                        <div>
                          <Label className="text-xs">Taxas</Label>
                          <CurrencyInput value={editFees} onChange={setEditFees} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(tx)}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        <Save className="h-3 w-3 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {fmt(tx.amount_cents / 100)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getBankName(tx.bank_id)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                      {((tx.discount_cents || 0) > 0 ||
                        (tx.interest_cents || 0) > 0 ||
                        (tx.fee_cents || 0) > 0) && (
                        <div className="flex gap-2 text-[10px]">
                          {(tx.discount_cents || 0) > 0 && (
                            <span className="text-emerald-600">
                              Desc: {fmt(tx.discount_cents / 100)}
                            </span>
                          )}
                          {(tx.interest_cents || 0) > 0 && (
                            <span className="text-orange-600">
                              Juros: {fmt(tx.interest_cents / 100)}
                            </span>
                          )}
                          {(tx.fee_cents || 0) > 0 && (
                            <span className="text-orange-600">
                              Taxa: {fmt(tx.fee_cents / 100)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(tx)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deletePayment(tx)}
                        disabled={saving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
