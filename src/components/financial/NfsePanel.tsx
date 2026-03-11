import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, FileText, Plus, RefreshCw, XCircle, Download, CheckCircle2, Clock, AlertTriangle, Receipt, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NfseRecord {
  id: string;
  company_id: string;
  invoice_id: string | null;
  nfeio_id: string | null;
  number: string | null;
  status: string;
  amount_cents: number;
  service_description: string | null;
  tomador_name: string | null;
  tomador_document: string | null;
  tomador_email: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  issued_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

interface NfeioCompany {
  id: string;
  name: string;
  federalTaxNumber: string;
}

interface CompanyInvoice {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  processing: { label: "Processando", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: RefreshCw },
  authorized: { label: "Autorizada", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  error: { label: "Erro", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
  cancelling: { label: "Cancelando", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: RefreshCw },
};

const INVOICE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "A vencer", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  overdue: { label: "Atrasada", color: "bg-destructive/10 text-destructive border-destructive/20" },
  paid: { label: "Paga", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  partial: { label: "Parcial", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

export function NfsePanel() {
  const [records, setRecords] = useState<NfseRecord[]>([]);
  const [companies, setCompanies] = useState<NfeioCompany[]>([]);
  const [onboardingCompanies, setOnboardingCompanies] = useState<any[]>([]);
  const [companyInvoices, setCompanyInvoices] = useState<CompanyInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [emitDialogOpen, setEmitDialogOpen] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const { currentStaff, isMaster } = useStaffPermissions();
  const isAdmin = isMaster || currentStaff?.role === "admin";
  const [companySearchOpen, setCompanySearchOpen] = useState(false);

  const DEFAULT_CITY_SERVICE_CODE = "17.06 | 1706 | Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais materiais publicitários.";

  const [form, setForm] = useState({
    companyId: "",
    nfeioCompanyId: "",
    serviceDescription: "",
    amountCents: 0,
    tomadorName: "",
    tomadorDocument: "",
    tomadorEmail: "",
    cityServiceCode: DEFAULT_CITY_SERVICE_CODE,
  });

  useEffect(() => {
    loadRecords();
    loadOnboardingCompanies();
    loadNfeioCompanies();
  }, []);

  const loadOnboardingCompanies = async () => {
    const { data } = await supabase
      .from("onboarding_companies")
      .select("id, name, cnpj, email")
      .eq("status", "active")
      .order("name");
    if (data) setOnboardingCompanies(data);
  };

  const loadCompanyInvoices = async (companyId: string) => {
    setLoadingInvoices(true);
    setCompanyInvoices([]);
    setSelectedInvoiceId("");
    try {
      const { data, error } = await supabase
        .from("company_invoices")
        .select("id, description, amount_cents, due_date, status, paid_at")
        .eq("company_id", companyId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      setCompanyInvoices(data || []);
    } catch (err) {
      console.error("Error loading invoices:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    const company = onboardingCompanies.find((c: any) => c.id === companyId);
    if (company) {
      setForm((prev) => ({
        ...prev,
        companyId,
        tomadorName: company.name || prev.tomadorName,
        tomadorDocument: company.cnpj || prev.tomadorDocument,
        tomadorEmail: company.email || prev.tomadorEmail,
      }));
      loadCompanyInvoices(companyId);
    } else {
      setForm((prev) => ({ ...prev, companyId }));
      setCompanyInvoices([]);
    }
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    if (invoiceId === "none") {
      return;
    }
    const invoice = companyInvoices.find((i) => i.id === invoiceId);
    if (invoice) {
      setForm((prev) => ({
        ...prev,
        serviceDescription: prev.serviceDescription || invoice.description,
        amountCents: invoice.amount_cents / 100,
      }));
    }
  };

  const loadNfeioCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfeio-nfse", {
        body: { action: "list-companies" },
      });
      if (error) throw error;
      const list = data?.companies || data?.data || [];
      setCompanies(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error("Error loading NFE.io companies:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("nfse_records" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRecords((data as any[]) || []);
    } catch (err: any) {
      console.error("Error loading NFS-e records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmit = async () => {
    if (!form.nfeioCompanyId || !form.serviceDescription || !form.amountCents || !form.tomadorName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setEmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfeio-nfse", {
        body: {
          action: "emit",
          ...form,
          invoiceId: selectedInvoiceId && selectedInvoiceId !== "none" ? selectedInvoiceId : null,
        },
      });
      if (error) throw error;
      toast.success("NFS-e emitida com sucesso! Aguarde o processamento.");
      setEmitDialogOpen(false);
      resetForm();
      loadRecords();
    } catch (err: any) {
      toast.error("Erro ao emitir NFS-e: " + err.message);
    } finally {
      setEmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      companyId: "",
      nfeioCompanyId: "",
      serviceDescription: "",
      amountCents: 0,
      tomadorName: "",
      tomadorDocument: "",
      tomadorEmail: "",
      cityServiceCode: DEFAULT_CITY_SERVICE_CODE,
    });
    setCompanyInvoices([]);
    setSelectedInvoiceId("");
  };

  const handleRefreshStatus = async (record: NfseRecord) => {
    if (!record.nfeio_id) return;
    try {
      const nfeioCompanyId = companies[0]?.id;
      const { error } = await supabase.functions.invoke("nfeio-nfse", {
        body: { action: "status", nfeioCompanyId, nfeioId: record.nfeio_id, recordId: record.id },
      });
      if (error) throw error;
      toast.success("Status atualizado");
      loadRecords();
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const handleCancel = async (record: NfseRecord) => {
    if (!record.nfeio_id) return;
    if (!confirm("Deseja realmente cancelar esta NFS-e?")) return;
    try {
      const nfeioCompanyId = companies[0]?.id;
      const { error } = await supabase.functions.invoke("nfeio-nfse", {
        body: { action: "cancel", nfeioCompanyId, nfeioId: record.nfeio_id, recordId: record.id },
      });
      if (error) throw error;
      toast.success("NFS-e cancelada");
      loadRecords();
    } catch (err: any) {
      toast.error("Erro ao cancelar: " + err.message);
    }
  };

  const handleDelete = async (record: NfseRecord) => {
    try {
      const { error } = await supabase
        .from("nfse_records" as any)
        .delete()
        .eq("id", record.id);
      if (error) throw error;
      toast.success("Registro de NFS-e excluído com sucesso");
      loadRecords();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };


  const handleDownloadPdf = async (record: NfseRecord) => {
    if (!record.nfeio_id) return;

    const downloadWindow = window.open("", "_blank");

    try {
      toast.info("Baixando PDF...");
      const nfeioCompanyId = companies[0]?.id;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/nfeio-nfse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ action: "download-pdf", nfeioCompanyId, nfeioId: record.nfeio_id }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const blob = await res.blob();
      const contentType = res.headers.get("content-type") || blob.type;

      if (!contentType?.includes("application/pdf") || blob.size === 0) {
        const responseText = await blob.text();
        throw new Error(responseText || "Resposta inválida ao baixar PDF");
      }

      const url = URL.createObjectURL(blob);
      const fileName = `nfse-${record.number || record.nfeio_id}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (downloadWindow) {
        downloadWindow.location.href = url;
      }

      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("PDF gerado! Se não baixar automático, ele abriu em nova aba.");
    } catch (err: any) {
      if (downloadWindow) downloadWindow.close();
      toast.error("Erro ao baixar PDF: " + err.message);
    }
  };

  const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const filteredRecords = selectedCompanyFilter === "all"
    ? records
    : records.filter((r) => r.company_id === selectedCompanyFilter);

  const getInvoiceStatusInfo = (invoice: CompanyInvoice) => {
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    if (invoice.status === "paid") return INVOICE_STATUS_MAP.paid;
    if (invoice.status === "partial") return INVOICE_STATUS_MAP.partial;
    if (dueDate < today) return INVOICE_STATUS_MAP.overdue;
    return INVOICE_STATUS_MAP.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notas Fiscais de Serviço (NFS-e)</h2>
          <p className="text-muted-foreground">Emita e gerencie NFS-e via NFE.io</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadRecords}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={emitDialogOpen} onOpenChange={(open) => { setEmitDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Emitir NFS-e
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Emitir NFS-e</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4 pb-2">
                  <div>
                    <Label>Empresa Emissora (NFE.io) *</Label>
                    <Select value={form.nfeioCompanyId} onValueChange={(v) => setForm({ ...form, nfeioCompanyId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingCompanies ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.federalTaxNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Empresa (Sistema)</Label>
                    <Select value={form.companyId} onValueChange={handleCompanySelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vincular a empresa (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {onboardingCompanies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Invoice selector */}
                  {form.companyId && (
                    <div>
                      <Label>Fatura vinculada</Label>
                      {loadingInvoices ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando faturas...
                        </div>
                      ) : companyInvoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Nenhuma fatura encontrada para esta empresa.</p>
                      ) : (
                        <Select value={selectedInvoiceId} onValueChange={handleInvoiceSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a fatura (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma (manual)</SelectItem>
                            {companyInvoices.map((inv) => {
                              const statusInfo = getInvoiceStatusInfo(inv);
                              return (
                                <SelectItem key={inv.id} value={inv.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="truncate max-w-[200px]">{inv.description}</span>
                                    <span className="text-xs font-medium">{formatCurrency(inv.amount_cents)}</span>
                                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(inv.due_date), "dd/MM/yy")}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  <div>
                    <Label>Descrição do Serviço *</Label>
                    <Textarea
                      value={form.serviceDescription}
                      onChange={(e) => setForm({ ...form, serviceDescription: e.target.value })}
                      placeholder="Descreva o serviço prestado..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Valor *</Label>
                    <CurrencyInput
                      value={form.amountCents}
                      onChange={(v) => setForm({ ...form, amountCents: v })}
                    />
                  </div>

                  <div>
                    <Label>Nome do Tomador *</Label>
                    <Input
                      value={form.tomadorName}
                      onChange={(e) => setForm({ ...form, tomadorName: e.target.value })}
                      placeholder="Nome/Razão Social"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CPF/CNPJ</Label>
                      <Input
                        value={form.tomadorDocument}
                        onChange={(e) => setForm({ ...form, tomadorDocument: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label>E-mail</Label>
                      <Input
                        value={form.tomadorEmail}
                        onChange={(e) => setForm({ ...form, tomadorEmail: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Código do Serviço Municipal</Label>
                    <Input
                      value={form.cityServiceCode}
                      onChange={(e) => setForm({ ...form, cityServiceCode: e.target.value })}
                      placeholder="1.05"
                    />
                  </div>

                  <Button onClick={handleEmit} disabled={emitting} className="w-full">
                    {emitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Emitir NFS-e
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <Label>Filtrar por empresa:</Label>
        <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {onboardingCompanies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Records list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma NFS-e encontrada</p>
            <p className="text-sm">Clique em "Emitir NFS-e" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            return (
              <Card key={record.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {record.number ? `NFS-e #${record.number}` : "NFS-e (processando)"}
                        </span>
                        <Badge className={statusCfg.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {record.tomador_name} — {record.service_description}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{formatCurrency(record.amount_cents)}</span>
                        <span>
                          {format(new Date(record.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {record.tomador_document && <span>Doc: {record.tomador_document}</span>}
                      </div>
                      {record.error_message && (
                        <p className="text-xs text-destructive">{record.error_message}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {record.nfeio_id && record.status !== "cancelled" && (
                        <Button variant="ghost" size="icon" onClick={() => handleRefreshStatus(record)} title="Atualizar status">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      {record.status === "authorized" && record.nfeio_id && (
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadPdf(record)} title="Baixar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {record.status === "authorized" && record.nfeio_id && (
                        <Button variant="ghost" size="icon" onClick={() => handleCancel(record)} title="Cancelar NFS-e">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Excluir registro">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir NFS-e</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir este registro de NFS-e{record.number ? ` #${record.number}` : ""}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(record)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
