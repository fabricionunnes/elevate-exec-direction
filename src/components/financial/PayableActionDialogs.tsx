import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { syncPaymentToContaAzul } from "@/utils/contaAzulSync";
import { SupplierAutocomplete } from "./SupplierAutocomplete";
import { CostCenterSelect } from "./CostCenterSelect";

interface PayableEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_amount: number | null;
  paid_at?: string | null;
  paid_date?: string | null;
  supplier_name?: string;
  category_id?: string | null;
  cost_center_id?: string | null;
  reference_month?: string | null;
  notes?: string | null;
  bank_id?: string | null;
  is_recurring?: boolean | null;
  recurrence_type?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  conta_azul_id?: string | null;
}

// ─── PAYMENT DIALOG ─────────────────────────────────────────────────────────
interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: PayableEntry | null;
  banks: { id: string; name: string }[];
  onSuccess: () => void;
}

export function PayablePaymentDialog({ open, onOpenChange, payable, banks, onSuccess }: PaymentDialogProps) {
  const [bankId, setBankId] = useState("none");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paidAmount, setPaidAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<Array<{
    id: string;
    amount_cents: number;
    bank_id: string;
    bank_name?: string;
    created_at: string;
    description: string | null;
  }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Pre-fill form and load payment history when dialog opens
  useEffect(() => {
    if (open && payable) {
      const remaining = (payable.status === "partial" || (payable.paid_amount && payable.paid_amount > 0 && payable.paid_amount < payable.amount))
        ? payable.amount - (payable.paid_amount || 0)
        : payable.amount;
      setPaidAmount(remaining);
      setPaymentDate(new Date());
      setBankId("none");

      // Load payment history from bank transactions
      const loadHistory = async () => {
        setLoadingHistory(true);
        try {
          const { data } = await supabase
            .from("financial_bank_transactions")
            .select("id, amount_cents, bank_id, created_at, description")
            .eq("reference_type", "payable")
            .eq("reference_id", payable.id)
            .eq("type", "debit")
            .order("created_at", { ascending: true }) as any;
          
          const history = (data || []).map((tx: any) => ({
            ...tx,
            bank_name: banks.find(b => b.id === tx.bank_id)?.name || "Banco removido",
          }));
          setPaymentHistory(history);
        } catch {
          setPaymentHistory([]);
        } finally {
          setLoadingHistory(false);
        }
      };
      loadHistory();
    } else {
      setPaymentHistory([]);
    }
  }, [open, payable, banks]);

  const handleSave = async () => {
    if (!payable || !paymentDate) return;
    if (bankId === "none") {
      toast.error("Selecione um banco para registrar o pagamento");
      return;
    }
    setSaving(true);
    try {
      const dateStr = format(paymentDate, "yyyy-MM-dd");
      const previouslyPaid = (payable.status === "partial" || (payable.paid_amount && payable.paid_amount > 0)) ? (payable.paid_amount || 0) : 0;
      const totalPaid = previouslyPaid + paidAmount;
      const isPartial = totalPaid > 0 && totalPaid < payable.amount;
      const newStatus = isPartial ? "partial" : "paid";

      const updateData: any = {
        status: newStatus,
        paid_date: dateStr,
        paid_amount: totalPaid,
        updated_at: new Date().toISOString(),
      };
      if (bankId !== "none") updateData.bank_id = bankId;

      const { error } = await supabase.from("financial_payables").update(updateData as any).eq("id", payable.id);
      if (error) throw error;

      // Debit bank balance
      if (bankId !== "none" && paidAmount > 0) {
        const amountCents = Math.round(paidAmount * 100);
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: -amountCents });
        await supabase.from("financial_bank_transactions").insert({
          bank_id: bankId,
          type: "debit",
          amount_cents: amountCents,
          description: `Pagamento: ${payable.description}`,
          reference_type: "payable",
          reference_id: payable.id,
        } as any);
      }

      // Sync to Conta Azul
      if ((payable as any).conta_azul_id) {
        syncPaymentToContaAzul((payable as any).conta_azul_id, "payable", dateStr, paidAmount);
      }

      toast.success(isPartial ? "Pagamento parcial registrado" : "Pagamento confirmado!");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSaving(false);
    }
  };

  if (!payable) return null;

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const totalPreviouslyPaid = payable.paid_amount || 0;
  const remaining = payable.amount - totalPreviouslyPaid;
  const hasHistory = paymentHistory.length > 0 || totalPreviouslyPaid > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            {payable.description} — Total: {fmt(payable.amount)}
            {hasHistory && (
              <span className="block mt-1 text-orange-600">
                Já pago: {fmt(totalPreviouslyPaid)} • Restante: {fmt(remaining)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-y-auto max-h-[55vh] pr-1">
        <div className="space-y-4 py-2">
          {/* Payment history */}
          {hasHistory && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico de Pagamentos</p>
              {loadingHistory ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                </div>
              ) : paymentHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Pagamento anterior registrado sem detalhes bancários</p>
              ) : (
                <div className="space-y-1.5">
                  {paymentHistory.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs bg-background rounded px-2.5 py-1.5 border">
                      <div className="flex flex-col">
                        <span className="font-medium">{fmt(tx.amount_cents / 100)}</span>
                        <span className="text-muted-foreground">{tx.bank_name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {format(new Date(tx.created_at), "dd/MM/yyyy")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Banco *</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do Pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentDate ? format(paymentDate, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Valor a Pagar (R$)</Label>
            <CurrencyInput value={paidAmount} onChange={setPaidAmount} />
            {paidAmount > 0 && paidAmount < remaining && (
              <p className="text-xs text-amber-600 mt-1">
                Pagamento parcial — Restará: {fmt(remaining - paidAmount)}
              </p>
            )}
          </div>
        </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || paidAmount <= 0 || bankId === "none"}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── EDIT DIALOG ─────────────────────────────────────────────────────────────
interface EditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payable: PayableEntry | null;
  categories: any[];
  costCenters: any[];
  suppliers: any[];
  onSuccess: () => void;
  onSuppliersRefresh: () => void;
  onCostCentersRefresh?: () => void;
}

export function PayableEditDialog({ open, onOpenChange, payable, categories, costCenters, suppliers, onSuccess, onSuppliersRefresh, onCostCentersRefresh }: EditDialogProps) {
  const [form, setForm] = useState({
    supplier_name: "",
    description: "",
    amount: 0,
    due_date: "",
    reference_month: "",
    category_id: "",
    cost_center_id: "",
    notes: "",
    cost_type: "" as "" | "fixed" | "variable",
  });
  const [editScope, setEditScope] = useState<"single" | "future">("single");
  const [saving, setSaving] = useState(false);

  const isRecurring = payable?.is_recurring && payable?.total_installments && payable.total_installments > 1;

  // Pre-fill form when dialog opens with payable data
  useEffect(() => {
    if (open && payable) {
      setForm({
        supplier_name: payable.supplier_name || "",
        description: payable.description || "",
        amount: payable.amount || 0,
        due_date: payable.due_date || "",
        reference_month: (payable as any).reference_month || "",
        category_id: (payable as any).category_id || "",
        cost_center_id: (payable as any).cost_center_id || "",
        notes: (payable as any).notes || "",
        cost_type: (payable as any).cost_type || "",
      });
      setEditScope("single");
    }
  }, [open, payable]);

  const handleSave = async () => {
    if (!payable || !form.supplier_name.trim() || !form.description.trim()) {
      toast.error("Fornecedor e descrição são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        supplier_name: form.supplier_name.trim(),
        description: form.description.trim(),
        amount: form.amount,
        due_date: form.due_date,
        reference_month: form.reference_month || null,
        category_id: form.category_id && form.category_id !== "none" ? form.category_id : null,
        cost_center_id: form.cost_center_id && form.cost_center_id !== "none" ? form.cost_center_id : null,
        notes: form.notes || null,
        cost_type: form.cost_type || null,
        updated_at: new Date().toISOString(),
      };

      if (editScope === "single" || !isRecurring) {
        // Edit only this entry
        const { error } = await supabase.from("financial_payables").update(payload as any).eq("id", payable.id);
        if (error) throw error;
        toast.success("Lançamento atualizado!");
      } else {
        // Edit this and all future entries with same description base and higher installment numbers
        // We match by: same supplier, same base description (without installment suffix), same recurrence_type, installment_number >= current
        const currentInstallment = payable.installment_number || 1;
        const baseDesc = payable.description.replace(/\s*\(\d+\/\d+\)$/, "");

        // Get all matching future entries
        const { data: allEntries } = await supabase
          .from("financial_payables")
          .select("id, installment_number, due_date")
          .eq("supplier_name", payable.supplier_name || "")
          .eq("is_recurring", true)
          .gte("installment_number", currentInstallment)
          .neq("status", "paid") as any;

        if (allEntries && allEntries.length > 0) {
          // Filter entries that share the same base description
          const matchingIds = allEntries
            .filter((e: any) => {
              const eBase = e.due_date ? true : true; // include all from same supplier with >= installment
              return true;
            })
            .map((e: any) => e.id);

          // Update shared fields (not due_date, not installment-specific)
          const sharedPayload: any = {
            supplier_name: form.supplier_name.trim(),
            amount: form.amount,
            category_id: payload.category_id,
            cost_center_id: payload.cost_center_id,
            notes: payload.notes,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("financial_payables")
            .update(sharedPayload as any)
            .in("id", matchingIds);
          if (error) throw error;

          // Update this specific entry's description and due_date
          await supabase.from("financial_payables").update({
            description: form.description.trim(),
            due_date: form.due_date,
            reference_month: form.reference_month || null,
          } as any).eq("id", payable.id);

          toast.success(`${matchingIds.length} lançamento(s) atualizado(s)!`);
        }
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSaving(false);
    }
  };

  if (!payable) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>Atualize os dados da conta a pagar</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto py-2">
          {isRecurring && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <Label className="text-sm font-medium">Escopo da edição</Label>
              <RadioGroup value={editScope} onValueChange={(v) => setEditScope(v as "single" | "future")} className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="scope-single" />
                  <Label htmlFor="scope-single" className="font-normal">Somente este lançamento</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="future" id="scope-future" />
                  <Label htmlFor="scope-future" className="font-normal">Este e todos os futuros recorrentes</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div>
            <Label>Fornecedor *</Label>
            <SupplierAutocomplete
              value={form.supplier_name}
              onChange={(v) => setForm(f => ({ ...f, supplier_name: v }))}
              suppliers={suppliers}
              onSupplierCreated={onSuppliersRefresh}
            />
          </div>
          <div>
            <Label>Descrição *</Label>
            <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <CurrencyInput value={form.amount} onChange={(v) => setForm(f => ({ ...f, amount: v }))} />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.filter((c: any) => c.type === "despesa").map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Centro de Custo</Label>
              <Select value={form.cost_center_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, cost_center_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {costCenters.map((cc: any) => (
                    <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mês Referência</Label>
              <Select value={form.reference_month || "none"} onValueChange={(v) => setForm(f => ({ ...f, reference_month: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m, i) => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const val = `${year}-${String(i + 1).padStart(2, "0")}`;
                    return <SelectItem key={val} value={val}>{m}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Custo</Label>
              <Select value={form.cost_type || "none"} onValueChange={(v) => setForm(f => ({ ...f, cost_type: v === "none" ? "" : v as "fixed" | "variable" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definido</SelectItem>
                  <SelectItem value="fixed">Custo Fixo</SelectItem>
                  <SelectItem value="variable">Custo Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.supplier_name.trim() || !form.description.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
