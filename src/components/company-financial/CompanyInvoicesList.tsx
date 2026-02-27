import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Receipt, Calendar, CheckCircle2, AlertTriangle, Clock, XCircle, RefreshCw, Copy, ExternalLink, Plus, Undo2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Invoice {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  late_fee_cents: number;
  interest_cents: number;
  total_with_fees_cents: number;
  payment_link_url: string | null;
  public_token: string;
  installment_number: number;
  total_installments: number;
  paid_at: string | null;
  paid_amount_cents: number | null;
  late_fee_percent: number;
  daily_interest_percent: number;
  created_at: string;
  recurring_charge_id: string | null;
}

interface Props {
  companyId: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  paid: { label: "Pago", variant: "default", icon: CheckCircle2 },
  overdue: { label: "Vencida", variant: "destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelada", variant: "secondary", icon: XCircle },
};

const formatCurrency = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

export function CompanyInvoicesList({ companyId }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: 0,
    dueDate: "",
  });

  useEffect(() => {
    if (companyId) fetchInvoices();
  }, [companyId]);

  const fetchInvoices = async () => {
    setLoading(true);
    await supabase.functions.invoke("generate-invoices", {
      body: { action: "update_fees" },
    });

    const { data, error } = await supabase
      .from("company_invoices")
      .select("*")
      .eq("company_id", companyId)
      .order("due_date", { ascending: true });

    if (!error) setInvoices((data as any) || []);
    setLoading(false);
  };

  const copyLink = (inv: Invoice) => {
    // Prefer Asaas URL if available, fallback to internal link
    const url = inv.payment_link_url || `${window.location.origin}/#/fatura?token=${inv.public_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const syncAsaasLinks = async () => {
    toast.info("Sincronizando links com Asaas...");
    try {
      const { data, error } = await supabase.functions.invoke("generate-invoices", {
        body: { action: "backfill_payment_links" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data?.fixed || 0} links atualizados!`);
      fetchInvoices();
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + (err.message || "erro"));
    }
  };

  const markAsPaid = async (invoiceId: string) => {
    const { error } = await supabase
      .from("company_invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      } as any)
      .eq("id", invoiceId);

    if (error) {
      toast.error("Erro ao marcar como pago");
      return;
    }

    toast.success("Fatura marcada como paga!");

    // Sync with Asaas (non-blocking)
    supabase.functions.invoke("asaas-confirm-payment", {
      body: { invoice_id: invoiceId, action: "confirm" },
    }).then(({ data, error: asaasErr }) => {
      if (asaasErr) {
        console.error("Asaas sync error:", asaasErr);
        toast.warning("Baixa local feita, mas houve erro ao sincronizar com Asaas");
      } else if (data?.skipped) {
        console.log("Asaas sync skipped:", data.reason);
      } else {
        toast.success("Baixa sincronizada com Asaas ✓");
      }
    });

    fetchInvoices();
  };

  const revertPaid = async (invoiceId: string, dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate + "T12:00:00");
    const newStatus = due < today ? "overdue" : "pending";

    const { error } = await supabase
      .from("company_invoices")
      .update({
        status: newStatus,
        paid_at: null,
        paid_amount_cents: null,
      } as any)
      .eq("id", invoiceId);

    if (error) {
      toast.error("Erro ao estornar fatura");
      return;
    }

    toast.success("Baixa estornada com sucesso!");

    // Revert in Asaas (non-blocking)
    supabase.functions.invoke("asaas-confirm-payment", {
      body: { invoice_id: invoiceId, action: "revert" },
    }).then(({ data, error: asaasErr }) => {
      if (asaasErr) {
        console.error("Asaas revert error:", asaasErr);
        toast.warning("Estorno local feito, mas houve erro ao sincronizar com Asaas");
      } else if (!data?.skipped) {
        toast.success("Estorno sincronizado com Asaas ✓");
      }
    });

    fetchInvoices();
  };

  const deleteInvoice = async (invoiceId: string) => {
    const { error } = await supabase
      .from("company_invoices")
      .delete()
      .eq("id", invoiceId);

    if (error) {
      toast.error("Erro ao excluir fatura");
    } else {
      toast.success("Fatura excluída!");
      fetchInvoices();
    }
  };

  const deleteBulk = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const { error } = await supabase
      .from("company_invoices")
      .delete()
      .in("id", Array.from(selectedIds));

    if (error) {
      toast.error("Erro ao excluir faturas");
    } else {
      toast.success(`${selectedIds.size} fatura(s) excluída(s)!`);
      setSelectedIds(new Set());
      fetchInvoices();
    }
    setDeleting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableInvoices = invoices.filter(i => !i.recurring_charge_id);
  const allSelectableSelected = selectableInvoices.length > 0 && selectableInvoices.every(i => selectedIds.has(i.id));

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableInvoices.map(i => i.id)));
    }
  };

  const handleCreateManual = async () => {
    if (!form.description || !form.amount || !form.dueDate) {
      toast.error("Preencha todos os campos");
      return;
    }

    setCreating(true);
    try {
      const amountCents = Math.round(form.amount * 100);

      // 1. Create the invoice
      const { data: invoiceData, error } = await supabase.from("company_invoices").insert({
        company_id: companyId,
        description: form.description,
        amount_cents: amountCents,
        due_date: form.dueDate,
        installment_number: 1,
        total_installments: 1,
        status: "pending",
      } as any).select("id").single();

      if (error) throw error;

      // 2. Create a real payment_links record
      const encodedDesc = encodeURIComponent(form.description);
      const baseUrl = "https://elevate-exec-direction.lovable.app";
      
      const { data: linkData } = await supabase.from("payment_links").insert({
        description: form.description,
        amount_cents: amountCents,
        payment_method: "pix",
        installments: 1,
        url: "pending",
        company_id: companyId,
      } as any).select("id").single();

      if (linkData) {
        const fullUrl = `${baseUrl}/#/checkout?link_id=${linkData.id}&amount=${amountCents}&product=${encodedDesc}`;
        await supabase.from("payment_links").update({ url: fullUrl } as any).eq("id", linkData.id);
        await supabase.from("company_invoices").update({
          payment_link_id: linkData.id,
          payment_link_url: fullUrl,
        } as any).eq("id", (invoiceData as any).id);
      }

      toast.success("Fatura criada com sucesso!");
      setShowCreateDialog(false);
      setForm({ description: "", amount: 0, dueDate: "" });
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar fatura");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingInvoices = invoices.filter(i => i.status === "pending" || i.status === "overdue");
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalPending = pendingInvoices.reduce((sum, i) =>
    sum + (i.status === "overdue" ? i.total_with_fees_cents : i.amount_cents), 0
  );
  const totalPaid = paidInvoices.reduce((sum, i) => sum + (i.paid_amount_cents || i.amount_cents), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Em Aberto</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalPending)}</p>
            <p className="text-xs text-muted-foreground">{pendingInvoices.length} fatura(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">{paidInvoices.length} fatura(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total de Faturas</p>
            <p className="text-xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Faturas Geradas
              </CardTitle>
              <CardDescription>Parcelas e cobranças geradas para esta empresa</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Fatura
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Fatura Manual</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Ex: Consultoria mensal"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <CurrencyInput
                          value={form.amount}
                          onChange={(v) => setForm({ ...form, amount: v })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vencimento</Label>
                        <Input
                          type="date"
                          value={form.dueDate}
                          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleCreateManual} disabled={creating} className="w-full">
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Fatura
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={syncAsaasLinks} title="Sincronizar links de pagamento com Asaas">
                <ExternalLink className="h-4 w-4 mr-2" />
                Sync Asaas
              </Button>
              <Button variant="outline" size="sm" onClick={fetchInvoices}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhuma fatura gerada ainda</p>
              <p className="text-xs mt-1">Crie uma recorrência ou adicione manualmente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk actions bar */}
              {selectableInvoices.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Checkbox
                    checked={allSelectableSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selecionada(s)`
                      : "Selecionar todas (manuais)"}
                  </span>
                  {selectedIds.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="ml-auto h-7 text-xs" disabled={deleting}>
                          {deleting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                          Excluir {selectedIds.size}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir {selectedIds.size} fatura(s)?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. As faturas selecionadas serão removidas permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={deleteBulk} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
              {invoices.map((inv) => {
                const statusInfo = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusInfo.icon;
                const isOverdue = inv.status === "overdue";
                const isPaid = inv.status === "paid";
                const dueDate = new Date(inv.due_date + "T12:00:00");
                const displayAmount = isOverdue ? inv.total_with_fees_cents : inv.amount_cents;

                return (
                  <div
                    key={inv.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isOverdue ? "border-destructive/30 bg-destructive/5" :
                      isPaid ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10" :
                      "bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {!inv.recurring_charge_id && (
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedIds.has(inv.id)}
                            onCheckedChange={() => toggleSelect(inv.id)}
                          />
                        </div>
                      )}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{inv.description}</p>
                          <Badge variant={statusInfo.variant} className="text-xs gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                          {inv.installment_number && inv.total_installments && (
                            <span className="text-xs text-muted-foreground">
                              {inv.installment_number}/{inv.total_installments}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Vence: {format(dueDate, "dd/MM/yyyy")}
                          </span>
                          <span>Valor: {formatCurrency(inv.amount_cents)}</span>
                          {isOverdue && (
                            <>
                              <span className="text-destructive">
                                Multa: {formatCurrency(inv.late_fee_cents)}
                              </span>
                              <span className="text-destructive">
                                Juros: {formatCurrency(inv.interest_cents)}
                              </span>
                            </>
                          )}
                        </div>
                        {isPaid && inv.paid_at && (
                          <p className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Pago em {format(new Date(inv.paid_at), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className={`font-bold text-sm ${isOverdue ? "text-destructive" : isPaid ? "text-green-600" : ""}`}>
                          {formatCurrency(displayAmount)}
                        </p>
                        {!isPaid && inv.status !== "cancelled" && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => copyLink(inv)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => markAsPaid(inv.id)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Dar Baixa
                            </Button>
                            {inv.payment_link_url && (
                              <Button asChild variant="default" size="sm" className="h-7 text-xs px-3">
                                <a href={inv.payment_link_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Pagar
                                </a>
                              </Button>
                             )}
                            {!inv.recurring_charge_id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. A fatura será removida permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteInvoice(inv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        )}
                        {isPaid && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive">
                                <Undo2 className="h-3 w-3 mr-1" />
                                Estornar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Estornar baixa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A fatura voltará ao status pendente/vencida. Esta ação pode ser refeita depois.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => revertPaid(inv.id, inv.due_date)}>
                                  Estornar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
