import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReceivableEntry {
  id: string;
  company_id: string | null;
  custom_receiver_name?: string | null;
  category_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  payment_method: string | null;
  is_recurring: boolean;
  reference_month: string | null;
  notes: string | null;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: ReceivableEntry | null;
  companies: { id: string; name: string }[];
  categories: { id: string; name: string; color: string }[];
  onSuccess: () => void;
}

export function ReceivableEditDialog({ open, onOpenChange, receivable, companies, categories, onSuccess }: Props) {
  const [form, setForm] = useState({
    company_id: "",
    custom_receiver_name: "",
    category_id: "",
    description: "",
    amount: 0,
    due_date: "",
    payment_method: "pix",
    reference_month: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && receivable) {
      setForm({
        company_id: receivable.company_id || "",
        custom_receiver_name: receivable.custom_receiver_name || "",
        category_id: receivable.category_id || "",
        description: receivable.description || "",
        amount: receivable.amount || 0,
        due_date: receivable.due_date || "",
        payment_method: receivable.payment_method || "pix",
        reference_month: receivable.reference_month || "",
        notes: receivable.notes || "",
      });
    }
  }, [open, receivable]);

  const handleSave = async () => {
    if (!receivable || !form.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        company_id: form.company_id || null,
        custom_receiver_name: !form.company_id && form.custom_receiver_name ? form.custom_receiver_name : null,
        category_id: form.category_id || null,
        description: form.description.trim(),
        amount: form.amount,
        due_date: form.due_date,
        payment_method: form.payment_method || null,
        reference_month: form.reference_month || null,
        notes: form.notes || null,
      };

      const { error } = await supabase
        .from("financial_receivables")
        .update(payload)
        .eq("id", receivable.id);

      if (error) throw error;

      toast.success("Recebível atualizado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  if (!receivable) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Recebível</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto py-2">
          <div>
            <Label>Empresa</Label>
            <Select value={form.company_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, company_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (nome manual)</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!form.company_id && (
            <div>
              <Label>Nome do Recebedor</Label>
              <Input
                value={form.custom_receiver_name}
                onChange={(e) => setForm(f => ({ ...f, custom_receiver_name: e.target.value }))}
                placeholder="Nome manual"
              />
            </div>
          )}
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
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm(f => ({ ...f, category_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method || "pix"} onValueChange={(v) => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Mês Referência</Label>
            <Input
              type="month"
              value={form.reference_month}
              onChange={(e) => setForm(f => ({ ...f, reference_month: e.target.value }))}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.description.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
