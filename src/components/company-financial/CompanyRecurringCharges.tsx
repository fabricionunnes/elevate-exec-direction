import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, RefreshCw, Loader2, Trash2, Calendar, ExternalLink, Copy, FileText } from "lucide-react";
import { format } from "date-fns";

interface Props {
  companyId: string;
  companyName: string;
  contractValue?: number;
  billingDay?: number;
  customerEmail?: string;
  customerPhone?: string;
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
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  notes: string | null;
  pagarme_plan_id: string | null;
  pagarme_link_id: string | null;
  pagarme_link_url: string | null;
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
}: Props) {
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const getDefaultNextDate = () => {
    const now = new Date();
    const day = billingDay || now.getDate();
    let nextDate = new Date(now.getFullYear(), now.getMonth(), day);
    if (nextDate <= now) {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
  };

  const [form, setForm] = useState({
    description: `Mensalidade - ${companyName}`,
    amount: contractValue || 0,
    paymentMethod: "pix",
    recurrence: "monthly",
    nextChargeDate: getDefaultNextDate(),
    customerName: companyName,
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    customerDocument: "",
    notes: "",
  });

  useEffect(() => {
    fetchCharges();
  }, [companyId]);

  const fetchCharges = async () => {
    const { data, error } = await supabase
      .from("company_recurring_charges")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error) setCharges((data as any) || []);
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
        next_charge_date: form.nextChargeDate,
        customer_name: form.customerName,
        customer_email: form.customerEmail,
        customer_phone: form.customerPhone || null,
        customer_document: form.customerDocument || null,
        notes: form.notes || null,
        created_by: user?.id,
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
          company_id: companyId,
          recurring_charge_id: chargeId,
          next_charge_date: form.nextChargeDate,
        },
      });

      if (subError) {
        console.error("Asaas subscription error:", subError);
        toast.warning("Recorrência salva, mas houve erro ao criar no Asaas: " + (subError.message || "erro desconhecido"));
      } else if (subData?.error) {
        toast.warning("Recorrência salva, mas houve erro no Asaas: " + subData.error);
      } else {
        toast.success("Recorrência criada com sucesso no Asaas!");
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
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar recorrência");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (charge: RecurringCharge) => {
    const newActive = !charge.is_active;

    // If deactivating and has an Asaas subscription, cancel it
    if (!newActive && charge.pagarme_plan_id) {
      toast.info("Cancelando assinatura no Asaas...");
      try {
        const { data, error } = await supabase.functions.invoke("asaas-cancel-subscription", {
          body: { subscription_id: charge.pagarme_plan_id },
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
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Cobrança Recorrente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                    <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Método de Pagamento</Label>
                    <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="credit_card">Cartão</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
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
                <Button type="button" onClick={handleCreate} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Recorrência no Asaas
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
                    {charge.pagarme_link_url && (
                      <Badge variant="outline" className="text-xs">Asaas ✓</Badge>
                    )}
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
                  {charge.pagarme_link_url && (
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
    </Card>
  );
}
