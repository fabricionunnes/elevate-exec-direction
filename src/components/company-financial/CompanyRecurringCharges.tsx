import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PixAutomaticoQrDialog, BadgePixAutomatico, linkPixAutomatico, type PixAutomaticoInfo } from "@/components/financial/PixAutomaticoQrDialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, RefreshCw, Loader2, Trash2, Calendar, ExternalLink, Copy, FileText, AlertTriangle, QrCode } from "lucide-react";
import { format } from "date-fns";

interface Props {
  companyId: string;
  companyName: string;
  contractValue?: number;
  billingDay?: number;
  customerEmail?: string;
  customerPhone?: string;
  customerDocument?: string;
}

// Valida CPF (11) ou CNPJ (14) pelos dígitos verificadores
function documentoValido(doc: string): boolean {
  const d = String(doc || "").replace(/\D/g, "");
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (base: number[], pesos: number[]) => { const r = base.reduce((a, n, i) => a + n * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  const n = d.split("").map(Number);
  if (d.length === 11) {
    const d1 = calc(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === n[9] && d2 === n[10];
  }
  if (d.length === 14) {
    const d1 = calc(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === n[12] && d2 === n[13];
  }
  return false;
}

interface RecurringCharge {
  id: string;
  description: string;
  amount_cents: number;
  payment_method: string;
  installments: number;
  recurrence: string;
  next_charge_date: string;
  is_active: boolean;
  send_whatsapp: boolean;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  notes: string | null;
  pagarme_plan_id: string | null;
  pagarme_link_id: string | null;
  pagarme_link_url: string | null;
  asaas_account_id: string | null;
  created_at: string;
}

const RECURRENCE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

export function CompanyRecurringCharges({
  companyId,
  companyName,
  contractValue,
  billingDay,
  customerEmail,
  customerPhone,
  customerDocument: companyDocument,
}: Props) {
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [asaasAccounts, setAsaasAccounts] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pix Automático (09/11/2026): autorização de cada recorrência e o QR aberto na tela
  const [pixAuto, setPixAuto] = useState<Record<string, any>>({});
  const [qrAberto, setQrAberto] = useState<PixAutomaticoInfo | null>(null);

  const getDefaultNextDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const [form, setForm] = useState({
    description: `Mensalidade - ${companyName}`,
    amount: contractValue || 0,
    paymentMethod: "pix",
    recurrence: "monthly",
    totalInstallments: 12,
    nextChargeDate: getDefaultNextDate(),
    customerName: companyName,
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    customerDocument: companyDocument || "",
    notes: "",
    categoryId: "",
    costCenterId: "",
    asaasAccountId: "",
    sendWhatsapp: true,
  });

  useEffect(() => {
    fetchCharges();
    fetchCategoriesAndCostCenters();
    fetchAsaasAccounts();
  }, [companyId]);

  const fetchAsaasAccounts = async () => {
    const { data } = await supabase
      .from("asaas_accounts")
      .select("id, name, is_default")
      .eq("is_active", true)
      .order("is_default", { ascending: false });
    const accounts = (data as any[]) || [];
    setAsaasAccounts(accounts);
    // Set default account in form if not set
    if (!form.asaasAccountId && accounts.length > 0) {
      const defaultAcc = accounts.find((a: any) => a.is_default) || accounts[0];
      setForm(prev => ({ ...prev, asaasAccountId: defaultAcc.id }));
    }
  };

  const fetchCategoriesAndCostCenters = async () => {
    const [catRes, ccRes] = await Promise.all([
      supabase.from("financial_categories").select("id, name").eq("type", "income").eq("is_active", true).order("sort_order"),
      supabase.from("staff_financial_cost_centers").select("id, name").eq("is_active", true).order("name"),
    ]);
    setCategories(catRes.data || []);
    setCostCenters(ccRes.data || []);
  };

  const fetchCharges = async () => {
    const { data, error } = await supabase
      .from("company_recurring_charges")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error) setCharges((data as any) || []);
    const ids = ((data as any[]) || []).filter((c) => c.payment_method === "pix_automatico").map((c) => c.id);
    if (ids.length) {
      const { data: pas } = await (supabase as any).from("asaas_pix_automatico")
        .select("id, recurring_charge_id, status, qr_payload, qr_image, primeira_cobranca, start_date, valor_cents, criado_em")
        .in("recurring_charge_id", ids).order("criado_em", { ascending: true });
      const m: Record<string, any> = {};
      for (const pa of (pas as any[]) || []) m[pa.recurring_charge_id] = pa; // fica a mais recente
      setPixAuto(m);
    } else setPixAuto({});
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.amount || form.amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!form.customerEmail?.trim()) {
      toast.error("Email do cliente é obrigatório");
      return;
    }
    if (!form.customerDocument?.trim()) {
      toast.error("CPF/CNPJ do cliente é obrigatório");
      return;
    }
    // O Asaas recusa documento com dígito verificador errado e a cobrança fica sem link de pagamento
    // (caso Light Brotherz, 21/09/2026: CNPJ terminava em 33 e o certo era 32). Barra aqui.
    if (!documentoValido(form.customerDocument)) {
      toast.error("CPF/CNPJ inválido: confira os números, o dígito verificador não bate. Sem documento válido o Asaas não gera o link de pagamento.");
      return;
    }
    // Validate date: must be YYYY-MM-DD and year >= 2024
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(form.nextChargeDate)) {
      toast.error("Data inválida. Use o seletor de data para escolher o vencimento.");
      return;
    }
    const dateYear = parseInt(form.nextChargeDate.split("-")[0], 10);
    if (dateYear < 2024 || dateYear > 2100) {
      toast.error(`Ano inválido (${dateYear}). Verifique a data de vencimento.`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Step 1: Create local record
      const { data: insertedData, error } = await supabase.from("company_recurring_charges").insert({
        company_id: companyId,
        description: form.description,
        amount_cents: Math.round(form.amount * 100),
        payment_method: form.paymentMethod,
        recurrence: form.recurrence,
        installments: form.totalInstallments,
        next_charge_date: form.nextChargeDate,
        customer_name: form.customerName,
        customer_email: form.customerEmail,
        customer_phone: form.customerPhone || null,
        customer_document: form.customerDocument || null,
        notes: form.notes || null,
        created_by: user?.id,
        category_id: form.categoryId || null,
        cost_center_id: form.costCenterId || null,
        asaas_account_id: form.asaasAccountId || null,
        send_whatsapp: form.sendWhatsapp,
      } as any).select().single();

      if (error) throw error;

      const chargeId = (insertedData as any)?.id;

      // Step 2: Create subscription on Asaas
      toast.info("Criando assinatura no Asaas...");
      const { data: subData, error: subError } = await supabase.functions.invoke("asaas-subscription", {
        body: {
          description: form.description,
          amount_cents: Math.round(form.amount * 100),
          payment_method: form.paymentMethod,
          recurrence: form.recurrence,
          customer_name: form.customerName,
          customer_email: form.customerEmail,
          customer_document: form.customerDocument || null,
          customer_phone: form.customerPhone || null,
          company_id: companyId,
          recurring_charge_id: chargeId,
          next_charge_date: form.nextChargeDate,
          asaas_account_id: form.asaasAccountId || null,
        },
      });

      const pixCriado = subData?.pix_auto || null;
      if (subError) {
        console.error("Asaas subscription error:", subError);
        toast.warning("Recorrência salva, mas houve erro ao criar no Asaas: " + (subError.message || "erro desconhecido"));
      } else if (subData?.error) {
        toast.warning("Recorrência salva, mas houve erro no Asaas: " + subData.error);
      } else {
        toast.success(pixCriado ? "Pix Automático criado no Asaas! Mande o QR Code pro cliente autorizar." : "Recorrência criada com sucesso no Asaas!");
      }

      // Step 3: Auto-generate invoices/installments
      if (chargeId) {
        toast.info("Gerando parcelas automaticamente...");
        try {
          const { data: invData, error: invError } = await supabase.functions.invoke("generate-invoices", {
            body: { action: "generate", recurring_charge_id: chargeId },
          });
          if (invError) throw invError;
          if (invData?.error) throw new Error(invData.error);
          toast.success(`${invData?.count || 0} parcelas geradas automaticamente!`);
        } catch (invErr: any) {
          console.error("Auto-generate invoices error:", invErr);
          toast.warning("Recorrência criada, mas houve erro ao gerar parcelas: " + (invErr.message || "erro"));
        }
      }

      setShowDialog(false);
      fetchCharges();
      if (pixCriado) setQrAberto(pixCriado);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar recorrência");
    } finally {
      setSaving(false);
    }
  };

  // Recorrência salva mas sem assinatura no Asaas (erro na criação): tenta de novo e refaz os links das parcelas
  const [retrying, setRetrying] = useState<string | null>(null);
  const tentarAsaasDeNovo = async (charge: RecurringCharge) => {
    if (!documentoValido(charge.customer_document || "")) {
      toast.error("O CPF/CNPJ desta recorrência é inválido. Corrija o documento no cadastro da empresa e recrie a recorrência.");
      return;
    }
    setRetrying(charge.id);
    try {
      toast.info("Criando assinatura no Asaas...");
      const { data: subData, error: subError } = await supabase.functions.invoke("asaas-subscription", {
        body: {
          description: charge.description, amount_cents: charge.amount_cents, payment_method: charge.payment_method,
          recurrence: charge.recurrence, customer_name: charge.customer_name, customer_email: charge.customer_email,
          customer_document: charge.customer_document, customer_phone: charge.customer_phone, company_id: companyId,
          recurring_charge_id: charge.id, next_charge_date: charge.next_charge_date, asaas_account_id: charge.asaas_account_id,
        },
      });
      if (subError || subData?.error) throw new Error(subData?.error || subError?.message || "erro no Asaas");
      toast.info("Gerando os links de pagamento das parcelas...");
      const { data: bf, error: bfError } = await supabase.functions.invoke("generate-invoices", {
        body: { action: "backfill_payment_links", recurring_charge_id: charge.id },
      });
      if (bfError || bf?.error) throw new Error(bf?.error || bfError?.message || "erro ao gerar links");
      toast.success(`Assinatura criada no Asaas e ${bf?.fixed ?? 0} parcela(s) com link de pagamento.`);
      fetchCharges();
    } catch (e: any) {
      toast.error("Não deu certo no Asaas: " + (e.message || "erro"));
    } finally { setRetrying(null); }
  };

  const toggleActive = async (charge: RecurringCharge) => {
    const newActive = !charge.is_active;

    // Pix Automático: pausar cancela a autorização no Asaas (o cliente para de ser debitado)
    const pa = pixAuto[charge.id];
    if (!newActive && charge.payment_method === "pix_automatico" && pa && !["CANCELLED", "REFUSED", "EXPIRED"].includes(pa.status)) {
      if (!confirm("Pausar cancela a autorização do Pix Automático no Asaas. Pra voltar a cobrar, o cliente vai precisar autorizar de novo. Continuar?")) return;
      const { data: cx, error: cxErr } = await supabase.functions.invoke("pix-automatico", { body: { action: "cancelar", id: pa.id } });
      if (cxErr || cx?.error) toast.error("Não consegui cancelar a autorização no Asaas: " + (cx?.error || cxErr?.message || "erro"));
      else toast.success("Autorização do Pix Automático cancelada");
    }

    // If deactivating and has an Asaas subscription, cancel it
    if (!newActive && charge.pagarme_plan_id) {
      toast.info("Cancelando assinatura no Asaas...");
      try {
        const { data, error } = await supabase.functions.invoke("asaas-cancel-subscription", {
          body: { subscription_id: charge.pagarme_plan_id, asaas_account_id: charge.asaas_account_id },
        });
        if (error) console.error("Cancel error:", error);
        else toast.success("Assinatura cancelada no Asaas");
      } catch (err) {
        console.error("Cancel subscription error:", err);
      }
    }

    const { error } = await supabase
      .from("company_recurring_charges")
      .update({ is_active: newActive } as any)
      .eq("id", charge.id);

    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      // If deactivating, cleanup future invoices (keep paid, overdue, and next 30 days)
      if (!newActive) {
        try {
          await supabase.functions.invoke("generate-invoices", {
            body: { action: "cleanup_future_invoices", recurring_charge_id: charge.id },
          });
        } catch (err) {
          console.error("Cleanup invoices error:", err);
        }
      }
      toast.success(newActive ? "Recorrência reativada" : "Recorrência pausada");
      fetchCharges();
    }
  };

  const deleteCharge = async (id: string) => {
    const { error } = await supabase
      .from("company_recurring_charges")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Recorrência excluída");
      fetchCharges();
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const generateInvoices = async (chargeId: string) => {
    toast.info("Gerando parcelas...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoices", {
        body: { action: "generate", recurring_charge_id: chargeId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data?.count || 0} parcelas geradas com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao gerar parcelas: " + (err.message || "erro desconhecido"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Cobranças Recorrentes
            </CardTitle>
            <CardDescription>Configure cobranças automáticas via Asaas</CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button type="button" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Recorrência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Nova Cobrança Recorrente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto pr-1">
                {asaasAccounts.length > 1 && (
                  <div className="space-y-2">
                    <Label>Conta Asaas</Label>
                    <SearchableSelect
                      value={form.asaasAccountId}
                      onValueChange={(v) => setForm({ ...form, asaasAccountId: v })}
                      placeholder="Selecione a conta..."
                      options={asaasAccounts.map((acc) => ({ value: acc.id, label: `${acc.name}${acc.is_default ? " (Padrão)" : ""}` }))}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <CurrencyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Recorrência</Label>
                    <SearchableSelect
                      value={form.recurrence}
                      onValueChange={(v) => setForm({ ...form, recurrence: v })}
                      options={[{ value: "monthly", label: "Mensal" }, { value: "quarterly", label: "Trimestral" }, { value: "yearly", label: "Anual" }]}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Qtd. de Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={form.totalInstallments}
                    onChange={(e) => setForm({ ...form, totalInstallments: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                  <p className="text-xs text-muted-foreground">Número de parcelas a serem geradas (padrão: 12)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Método de Pagamento</Label>
                    <SearchableSelect
                      value={form.paymentMethod}
                      onValueChange={(v) => setForm({ ...form, paymentMethod: v })}
                      options={[
                        { value: "pix", label: "PIX" },
                        { value: "pix_automatico", label: "Pix Automático" },
                        { value: "credit_card", label: "Cartão" },
                        { value: "boleto", label: "Boleto" },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Próxima Cobrança</Label>
                    <Input
                      type="date"
                      value={form.nextChargeDate}
                      onChange={(e) => setForm({ ...form, nextChargeDate: e.target.value })}
                    />
                  </div>
                </div>
                {form.paymentMethod === "pix_automatico" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                    <p className="font-medium text-sm">Como funciona o Pix Automático</p>
                    <p>O cliente recebe um QR Code e paga a 1ª parcela por ele. No mesmo passo, o banco dele pede pra autorizar os débitos automáticos.</p>
                    <p>A partir do vencimento seguinte, o valor sai sozinho da conta dele, sem link e sem boleto. Se o saldo faltar, o Asaas tenta de novo até 3 vezes em 7 dias.</p>
                    <p className="text-muted-foreground">"Próxima Cobrança" é o vencimento da 1ª parcela, paga pelo QR Code.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
                  </div>
                <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ do Cliente *</Label>
                  <Input
                    value={form.customerDocument}
                    onChange={(e) => setForm({ ...form, customerDocument: e.target.value })}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <SearchableSelect
                      value={form.categoryId}
                      onValueChange={(v) => setForm({ ...form, categoryId: v })}
                      placeholder="Selecione..."
                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Centro de Custo</Label>
                    <SearchableSelect
                      value={form.costCenterId}
                      onValueChange={(v) => setForm({ ...form, costCenterId: v })}
                      placeholder="Selecione..."
                      options={costCenters.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div>
                    <Label className="text-sm font-medium">{form.paymentMethod === "pix_automatico" ? "Enviar o QR Code via WhatsApp" : "Enviar boleto via WhatsApp"}</Label>
                    <p className="text-xs text-muted-foreground">{form.paymentMethod === "pix_automatico" ? "Envia ao cliente o link da página do QR Code pra ele autorizar" : "Envia automaticamente o link de pagamento ao gerar as faturas"}</p>
                  </div>
                  <Switch
                    checked={form.sendWhatsapp}
                    onCheckedChange={(v) => setForm({ ...form, sendWhatsapp: v })}
                  />
                </div>
                <Button type="button" onClick={handleCreate} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {form.paymentMethod === "pix_automatico" ? "Criar Pix Automático no Asaas" : "Criar Recorrência no Asaas"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {charges.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma cobrança recorrente configurada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {charges.map((charge) => (
              <div
                key={charge.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{charge.description}</p>
                    <Badge variant={charge.is_active ? "default" : "secondary"}>
                      {charge.is_active ? "Ativo" : "Pausado"}
                    </Badge>
                    {charge.payment_method === "pix_automatico" ? (
                      <BadgePixAutomatico status={pixAuto[charge.id]?.status || (charge.pagarme_link_url ? "CREATED" : null)} />
                    ) : charge.pagarme_link_url && (
                      <Badge variant="outline" className="text-xs">Asaas ✓</Badge>
                    )}
                    <Badge
                      variant={charge.send_whatsapp ? "default" : "secondary"}
                      className="text-xs cursor-pointer"
                      onClick={async () => {
                        const newVal = !charge.send_whatsapp;
                        await supabase
                          .from("company_recurring_charges")
                          .update({ send_whatsapp: newVal } as any)
                          .eq("id", charge.id);
                        toast.success(newVal ? "WhatsApp ativado" : "WhatsApp desativado");
                        fetchCharges();
                      }}
                    >
                      {charge.send_whatsapp ? "📲 WhatsApp ✓" : "📲 WhatsApp ✗"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>R$ {(charge.amount_cents / 100).toFixed(2).replace(".", ",")}</span>
                    <span>•</span>
                    <span>{RECURRENCE_LABELS[charge.recurrence] || charge.recurrence}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Próx: {format(new Date(charge.next_charge_date + "T12:00:00"), "dd/MM/yyyy")}
                    </span>
                  </div>
                  {charge.payment_method === "pix_automatico" && pixAuto[charge.id] && (
                    <div className="flex items-center gap-2 mt-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2"
                        onClick={() => { const pa = pixAuto[charge.id]; setQrAberto({ id: pa.id, status: pa.status, payload: pa.qr_payload, image: pa.qr_image, link: linkPixAutomatico(pa.id), primeira_cobranca: pa.primeira_cobranca, start_date: pa.start_date, valor_cents: pa.valor_cents }); }}>
                        <QrCode className="h-3 w-3 mr-1" />
                        Ver QR Code
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => copyLink(linkPixAutomatico(pixAuto[charge.id].id))}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Link
                      </Button>
                    </div>
                  )}
                  {charge.pagarme_link_url && charge.payment_method !== "pix_automatico" && (
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => copyLink(charge.pagarme_link_url!)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Link
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        asChild
                      >
                        <a href={charge.pagarme_link_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => generateInvoices(charge.id)}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Gerar Parcelas
                  </Button>
                  {charge.is_active && !charge.pagarme_plan_id && !(charge.payment_method === "pix_automatico" && pixAuto[charge.id]) && (
                    <Button type="button" variant="outline" size="sm" disabled={retrying === charge.id}
                      className="border-amber-500/50 text-amber-700 dark:text-amber-400"
                      title="Esta recorrência não foi criada no Asaas, então as parcelas estão sem link de pagamento"
                      onClick={() => tentarAsaasDeNovo(charge)}>
                      {retrying === charge.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                      Sem Asaas: tentar de novo
                    </Button>
                  )}
                  <Switch
                    checked={charge.is_active}
                    onCheckedChange={() => toggleActive(charge)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCharge(charge.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <PixAutomaticoQrDialog info={qrAberto} onOpenChange={(o) => { if (!o) setQrAberto(null); }} />
    </Card>
  );
}
