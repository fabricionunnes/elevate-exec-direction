import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, Search, Copy, Send, CheckCircle2, Loader2, Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FINANCIAL_PERMISSION_KEYS } from "@/types/staffPermissions";

interface Invoice {
  id: string;
  company_id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount_cents: number | null;
  installment_number: number;
  total_installments: number;
  late_fee_cents: number;
  interest_cents: number;
  total_with_fees_cents: number;
  recurring_charge_id: string | null;
  pagarme_charge_id: string | null;
  payment_link_url: string | null;
  created_at: string;
  company_name?: string;
  company_phone?: string;
}

interface FinancialOverdueTabProps {
  invoices: Invoice[];
  companies: { id: string; name: string }[];
  formatCurrencyCents: (cents: number) => string;
  hasPerm: (key: string) => boolean;
  onConfirmPayment: (invoiceId: string, feeCents: number, bankId: string | null) => Promise<void>;
  processingInvoiceId: string | null;
  setConfirmDialog: (val: { open: boolean; invoiceId: string; action: "confirm" | "revert"; description: string }) => void;
  banks: any[];
  loadData: () => Promise<void>;
}

export default function FinancialOverdueTab({
  invoices,
  companies,
  formatCurrencyCents,
  hasPerm,
  processingInvoiceId,
  setConfirmDialog,
  loadData,
}: FinancialOverdueTabProps) {
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const overdueInvoices = useMemo(() => {
    // Use Brazil timezone to determine "today"
    const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayStr = `${nowBR.getFullYear()}-${String(nowBR.getMonth() + 1).padStart(2, "0")}-${String(nowBR.getDate()).padStart(2, "0")}`;
    return invoices.filter(inv => {
      if (inv.status === "paid") return false;
      // Strictly past due: due_date must be before today (not today itself)
      const isPastDue = inv.due_date < todayStr;
      if (!isPastDue) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!inv.description?.toLowerCase().includes(q) && !inv.company_name?.toLowerCase().includes(q)) return false;
      }
      if (selectedCompany !== "all" && inv.company_id !== selectedCompany) return false;
      return true;
    });
  }, [invoices, search, selectedCompany]);

  const totalPages = Math.ceil(overdueInvoices.length / ITEMS_PER_PAGE);
  const paginated = overdueInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total_with_fees_cents, 0);

  const daysOverdue = (dueDate: string) => {
    const due = new Date(dueDate + "T12:00:00");
    const today = new Date();
    return Math.floor((today.getTime() - due.getTime()) / 86400000);
  };

  const copyLink = (url: string | null) => {
    if (!url) { toast.error("Sem link de pagamento"); return; }
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const sendWhatsApp = async (inv: Invoice) => {
    const phoneRaw = inv.company_phone?.replace(/\D/g, "") || "";
    if (!phoneRaw) { toast.error("Telefone da empresa não cadastrado"); return; }
    const phone = phoneRaw.startsWith("55") ? phoneRaw : `55${phoneRaw}`;
    const amountFormatted = formatCurrencyCents(inv.total_with_fees_cents);
    const dueDateFormatted = inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-";
    const days = daysOverdue(inv.due_date);
    const customerName = inv.company_name || "";
    const msg = `Olá ${customerName}!\n\nIdentificamos uma fatura em atraso:\n\n📄 *${inv.description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Vencimento:* ${dueDateFormatted}\n⚠️ *${days} dia(s) em atraso*\n\n🔗 ${inv.payment_link_url || "Link não disponível"}`;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("status", "connected")
        .eq("instance_name", "fabricionunnes")
        .single();
      if (!instance) throw new Error("Nenhuma instância WhatsApp conectada");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ instanceName: instance.instance_name, number: phone, text: msg }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `HTTP ${response.status}`); }
      toast.success("Mensagem enviada via WhatsApp!");
    } catch (err: any) {
      console.error("WhatsApp send error:", err);
      toast.error(err.message || "Erro ao enviar WhatsApp");
    }
  };

  const handleBulkSend = async () => {
    const selected = overdueInvoices.filter(inv => selectedIds.has(inv.id) && inv.payment_link_url);
    if (selected.length === 0) { toast.error("Nenhuma fatura selecionada com link de pagamento"); return; }
    setIsBulkSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("status", "connected")
        .eq("instance_name", "fabricionunnes")
        .single();
      if (!instance) throw new Error("Nenhuma instância WhatsApp conectada");

      let sent = 0, failed = 0;
      for (const inv of selected) {
        const phoneRaw = inv.company_phone?.replace(/\D/g, "") || "";
        if (!phoneRaw) { failed++; continue; }
        const phone = phoneRaw.startsWith("55") ? phoneRaw : `55${phoneRaw}`;
        const amountFormatted = formatCurrencyCents(inv.total_with_fees_cents);
        const dueDateFormatted = inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-";
        const days = daysOverdue(inv.due_date);
        const customerName = inv.company_name || "";
        const msg = `Olá ${customerName}!\n\nIdentificamos uma fatura em atraso:\n\n📄 *${inv.description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Vencimento:* ${dueDateFormatted}\n⚠️ *${days} dia(s) em atraso*\n\n🔗 ${inv.payment_link_url}`;
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ instanceName: instance.instance_name, number: phone, text: msg }),
          });
          if (!response.ok) throw new Error();
          sent++;
          await new Promise(r => setTimeout(r, 1500));
        } catch { failed++; }
      }
      toast.success(`${sent} mensagem(ns) enviada(s)${failed > 0 ? `, ${failed} falha(s)` : ""}`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar em massa");
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleBulkConfirm = async () => {
    const selected = overdueInvoices.filter(inv => selectedIds.has(inv.id));
    if (selected.length === 0) { toast.error("Nenhuma fatura selecionada"); return; }
    if (!confirm(`Dar baixa em ${selected.length} fatura(s) em atraso?`)) return;
    setIsBulkSending(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      for (const inv of selected) {
        await supabase.from("company_invoices").update({
          status: "paid", paid_at: today, paid_amount_cents: inv.total_with_fees_cents, payment_fee_cents: 199,
        } as any).eq("id", inv.id);
      }
      toast.success(`${selected.length} fatura(s) confirmada(s)`);
      setSelectedIds(new Set());
      await loadData();
    } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
    finally { setIsBulkSending(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Atrasados
        </h2>
        <Badge variant="destructive" className="text-sm px-3 py-1">
          {overdueInvoices.length} fatura(s) em atraso
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar empresa ou descrição..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
            </div>
            <Select value={selectedCompany} onValueChange={(v) => { setSelectedCompany(v); setCurrentPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total em Atraso</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrencyCents(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">{overdueInvoices.length} parcelas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Empresas Inadimplentes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{new Set(overdueInvoices.map(i => i.company_id)).size}</div>
            <p className="text-xs text-muted-foreground">empresas distintas</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-sm font-medium">{selectedIds.size} fatura(s) selecionada(s)</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={isBulkSending} onClick={handleBulkSend}>
                {isBulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar via WhatsApp
              </Button>
              {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_confirm) && (
                <Button size="sm" variant="default" className="gap-1.5" disabled={isBulkSending} onClick={handleBulkConfirm}>
                  <CheckCircle2 className="h-4 w-4" />
                  Dar Baixa
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginated.length > 0 && paginated.every(inv => selectedIds.has(inv.id))}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        paginated.forEach(inv => checked ? next.add(inv.id) : next.delete(inv.id));
                        setSelectedIds(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Parcela</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      🎉 Nenhuma fatura em atraso!
                    </TableCell>
                  </TableRow>
                ) : paginated.map(inv => {
                  const isProcessing = processingInvoiceId === inv.id;
                  const days = daysOverdue(inv.due_date);
                  return (
                    <TableRow key={inv.id} className={cn(selectedIds.has(inv.id) && "bg-red-50/50")}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds);
                            checked ? next.add(inv.id) : next.delete(inv.id);
                            setSelectedIds(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{inv.company_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{inv.description}</TableCell>
                      <TableCell className="text-center text-sm">{inv.installment_number}/{inv.total_installments}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{formatCurrencyCents(inv.total_with_fees_cents)}</TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <span>{inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</span>
                          <p className="text-xs text-destructive font-medium">{days} dia(s) atraso</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="gap-1 text-xs bg-red-500/10 text-red-600 border-red-500/20">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Vencido
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {inv.payment_link_url && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar link" onClick={() => copyLink(inv.payment_link_url)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" title="Enviar via WhatsApp" onClick={() => sendWhatsApp(inv)}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_confirm) && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" disabled={isProcessing}
                              onClick={() => setConfirmDialog({
                                open: true,
                                invoiceId: inv.id,
                                action: "confirm",
                                description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments}) - ${formatCurrencyCents(inv.total_with_fees_cents)}`
                              })}>
                              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Baixa
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, overdueInvoices.length)} de {overdueInvoices.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                typeof p === "string" ? (
                  <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
