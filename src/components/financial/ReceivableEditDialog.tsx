import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Edita um lançamento de financial_receivables (fatura avulsa ou ajuste
// automático do Asaas). Carrega a linha fresca pelo id ao abrir, pra não
// depender do formato resumido que a listagem usa.
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: { id: string } | null;
  companies: { id: string; name: string }[];
  categories: { id: string; name: string; color?: string }[];
  costCenters?: { id: string; name: string }[];
  onSuccess: () => void;
}

const AJUSTE_PREFIX = "Ajuste automático Asaas";

export function ReceivableEditDialog({ open, onOpenChange, receivable, companies, categories, costCenters = [], onSuccess }: Props) {
  const [form, setForm] = useState({
    company_id: "",
    custom_receiver_name: "",
    category_id: "",
    cost_center_id: "",
    description: "",
    amount: 0,
    discount_amount: 0,
    fee_amount: 0,
    interest_amount: 0,
    paid_amount: 0,
    paid_date: "",
    due_date: "",
    payment_method: "pix",
    reference_month: "",
    notes: "",
    status: "pending",
  });
  const [original, setOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ehAjuste = !!original?.description?.startsWith(AJUSTE_PREFIX) || !!original?._era_ajuste;

  useEffect(() => {
    if (!open || !receivable?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("financial_receivables").select("*").eq("id", receivable.id).maybeSingle();
      if (data) {
        setOriginal(data);
        setForm({
          company_id: data.company_id || "",
          custom_receiver_name: data.custom_receiver_name || "",
          category_id: data.category_id || "",
          cost_center_id: (data as any).cost_center_id || "",
          description: data.description || "",
          amount: Number(data.amount) || 0,
          discount_amount: Number(data.discount_amount) || 0,
          fee_amount: Number(data.fee_amount) || 0,
          interest_amount: Number(data.interest_amount) || 0,
          paid_amount: Number(data.paid_amount) || 0,
          paid_date: data.paid_date || "",
          due_date: data.due_date || "",
          payment_method: data.payment_method || "pix",
          reference_month: data.reference_month || "",
          notes: data.notes || "",
          status: data.status || "pending",
        });
      }
      setLoading(false);
    })();
  }, [open, receivable?.id]);

  // líquido sugerido = bruto − desconto − taxa + juros (o usuário pode sobrescrever)
  const liquidoSugerido = Math.round((form.amount - form.discount_amount - form.fee_amount + form.interest_amount) * 100) / 100;

  const handleSave = async () => {
    if (!receivable || !form.description.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (!form.company_id && !form.custom_receiver_name.trim()) { toast.error("Informe a empresa ou o nome do recebedor"); return; }
    setSaving(true);
    try {
      const pago = form.status === "paid";
      const payload: any = {
        company_id: form.company_id || null,
        custom_receiver_name: !form.company_id && form.custom_receiver_name ? form.custom_receiver_name.trim() : null,
        category_id: form.category_id || null,
        cost_center_id: form.cost_center_id || null,
        description: form.description.trim(),
        amount: form.amount,
        discount_amount: form.discount_amount || 0,
        fee_amount: form.fee_amount || 0,
        interest_amount: form.interest_amount || 0,
        paid_amount: pago ? (form.paid_amount || liquidoSugerido) : null,
        paid_date: pago ? (form.paid_date || null) : null,
        due_date: form.due_date || null,
        payment_method: form.payment_method || null,
        reference_month: form.reference_month || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("financial_receivables").update(payload).eq("id", receivable.id);
      if (error) throw error;

      // Ajuste do Asaas tem um lançamento gêmeo no extrato bancário (criado pela
      // conciliação, sem reference_id). Mantém os dois iguais: descrição, empresa,
      // taxa/desconto e o líquido que entrou no banco — senão extrato e conta
      // contam histórias diferentes.
      if (ehAjuste && original) {
        const empresaNome = form.company_id
          ? companies.find((c) => c.id === form.company_id)?.name
          : form.custom_receiver_name.trim();
        const novaDesc = empresaNome && !form.description.includes(empresaNome)
          ? `${empresaNome} — ${form.description.trim()}`
          : form.description.trim();
        const liquidoCents = Math.round((payload.paid_amount ?? liquidoSugerido) * 100);
        // 1º pelo vínculo (se já editado antes); senão pelo valor + janela de
        // criação — a conciliação cria conta e lançamento no mesmo instante.
        let tx: { id: string } | null = (await supabase
          .from("financial_bank_transactions").select("id")
          .eq("reference_type", "asaas_balance_reconciliation")
          .eq("reference_id", receivable.id).limit(1).maybeSingle()).data as any;
        if (!tx) {
          const criadoEm = new Date(original.created_at).getTime();
          tx = (await supabase
            .from("financial_bank_transactions").select("id")
            .eq("reference_type", "asaas_balance_reconciliation")
            .is("reference_id", null)
            .eq("amount_cents", Math.round(Number(original.paid_amount || original.amount) * 100))
            .gte("created_at", new Date(criadoEm - 5 * 60_000).toISOString())
            .lte("created_at", new Date(criadoEm + 5 * 60_000).toISOString())
            .order("created_at", { ascending: false }).limit(1).maybeSingle()).data as any;
        }
        if (tx?.id) {
          await supabase.from("financial_bank_transactions").update({
            description: novaDesc,
            amount_cents: liquidoCents,
            fee_cents: Math.round((form.fee_amount || 0) * 100),
            discount_cents: Math.round((form.discount_amount || 0) * 100),
            interest_cents: Math.round((form.interest_amount || 0) * 100),
            reference_id: receivable.id,
          }).eq("id", tx.id);
        }
      }

      toast.success(ehAjuste ? "Ajuste atualizado (conta + extrato)" : "Recebível atualizado");
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
          <DialogTitle>{ehAjuste ? "Editar ajuste do Asaas" : "Editar recebível"}</DialogTitle>
          {ehAjuste && (
            <DialogDescription className="flex items-start gap-2 text-xs">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Este lançamento nasceu da conciliação bancária. Ao salvar, o lançamento gêmeo no extrato
                é atualizado junto. O <b>líquido</b> é o que entrou de fato no Asaas — se você mudar esse valor,
                a conciliação de amanhã vai criar outro ajuste pela diferença.
              </span>
            </DialogDescription>
          )}
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto py-2">
            <div>
              <Label>Empresa</Label>
              <SearchableSelect
                value={form.company_id || "none"}
                onValueChange={(v) => setForm(f => ({ ...f, company_id: v === "none" ? "" : v }))}
                options={companies.map(c => ({ value: c.id, label: c.name }))}
                allowNone
                noneLabel="Nenhuma (nome manual)"
                placeholder="Digite pra buscar a empresa"
                emptyMessage="Nenhuma empresa encontrada"
              />
            </div>
            {!form.company_id && (
              <div>
                <Label>Nome do recebedor</Label>
                <Input value={form.custom_receiver_name} onChange={(e) => setForm(f => ({ ...f, custom_receiver_name: e.target.value }))} placeholder="Ex: Asaas, cliente avulso…" />
              </div>
            )}
            <div>
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor bruto (R$) *</Label>
                <CurrencyInput value={form.amount} onChange={(v) => setForm(f => ({ ...f, amount: v }))} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Desconto (R$)</Label>
                <CurrencyInput value={form.discount_amount} onChange={(v) => setForm(f => ({ ...f, discount_amount: v }))} />
              </div>
              <div>
                <Label>Taxa (R$)</Label>
                <CurrencyInput value={form.fee_amount} onChange={(v) => setForm(f => ({ ...f, fee_amount: v }))} />
              </div>
              <div>
                <Label>Juros (R$)</Label>
                <CurrencyInput value={form.interest_amount} onChange={(v) => setForm(f => ({ ...f, interest_amount: v }))} />
              </div>
            </div>

            {form.status === "paid" && (
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
                <div>
                  <Label>Líquido recebido (R$)</Label>
                  <CurrencyInput value={form.paid_amount} onChange={(v) => setForm(f => ({ ...f, paid_amount: v }))} />
                  {Math.abs(form.paid_amount - liquidoSugerido) > 0.009 && (
                    <button type="button" className="text-[11px] text-primary mt-1 underline"
                      onClick={() => setForm(f => ({ ...f, paid_amount: liquidoSugerido }))}>
                      usar bruto − desconto − taxa + juros = {liquidoSugerido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </button>
                  )}
                </div>
                <div>
                  <Label>Pago em</Label>
                  <Input type="date" value={form.paid_date} onChange={(e) => setForm(f => ({ ...f, paid_date: e.target.value }))} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <SearchableSelect
                  value={form.category_id || "none"}
                  onValueChange={(v) => setForm(f => ({ ...f, category_id: v === "none" ? "" : v }))}
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  allowNone noneLabel="Nenhuma" placeholder="Digite pra buscar…" emptyMessage="Nenhuma categoria encontrada"
                />
              </div>
              <div>
                <Label>Centro de custo</Label>
                <SearchableSelect
                  value={form.cost_center_id || "none"}
                  onValueChange={(v) => setForm(f => ({ ...f, cost_center_id: v === "none" ? "" : v }))}
                  options={costCenters.map(c => ({ value: c.id, label: c.name }))}
                  allowNone noneLabel="Nenhum" placeholder="Digite pra buscar…" emptyMessage="Nenhum centro de custo encontrado"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de pagamento</Label>
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
              <div>
                <Label>Mês referência</Label>
                <Input type="month" value={form.reference_month} onChange={(e) => setForm(f => ({ ...f, reference_month: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" rows={2} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading || !form.description.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
