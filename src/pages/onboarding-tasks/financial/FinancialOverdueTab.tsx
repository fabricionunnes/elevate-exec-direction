import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, Search, Copy, Send, CheckCircle2, Loader2,
  Clock, Building2, DollarSign, TrendingDown, Flame, ArrowUpDown, ArrowUp, ArrowDown,
  FileSpreadsheet,
} from "lucide-react";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultWhatsAppInstance } from "@/utils/whatsapp-defaults";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FINANCIAL_PERMISSION_KEYS } from "@/types/staffPermissions";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

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
  consultants?: { id: string; name: string; role: string }[];
  companyConsultantMap?: Map<string, Set<string>>;
  formatCurrencyCents: (cents: number) => string;
  hasPerm: (key: string) => boolean;
  onConfirmPayment: (invoiceId: string, feeCents: number, bankId: string | null) => Promise<void>;
  processingInvoiceId: string | null;
  setConfirmDialog: (val: { open: boolean; invoiceId: string; action: "confirm" | "revert"; description: string }) => void;
  banks: any[];
  loadData: () => Promise<void>;
}

const urgencyLevel = (days: number) => {
  if (days >= 60) return { label: "Crítico", color: "from-red-600 to-rose-700", bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", icon: Flame };
  if (days >= 30) return { label: "Alto", color: "from-orange-500 to-red-600", bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30", icon: AlertTriangle };
  if (days >= 15) return { label: "Médio", color: "from-amber-500 to-orange-500", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", icon: Clock };
  return { label: "Baixo", color: "from-yellow-400 to-amber-500", bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30", icon: Clock };
};

export default function FinancialOverdueTab({
  invoices,
  companies,
  consultants = [],
  companyConsultantMap,
  formatCurrencyCents,
  hasPerm,
  processingInvoiceId,
  setConfirmDialog,
  loadData,
}: FinancialOverdueTabProps) {
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedConsultant, setSelectedConsultant] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<"all" | { start: Date; end: Date }>("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const ITEMS_PER_PAGE = 10;

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const overdueInvoices = useMemo(() => {
    const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const todayStr = `${nowBR.getFullYear()}-${String(nowBR.getMonth() + 1).padStart(2, "0")}-${String(nowBR.getDate()).padStart(2, "0")}`;
    return invoices.filter(inv => {
      if (inv.status === "paid") return false;
      const isPastDue = inv.due_date < todayStr;
      if (!isPastDue) return false;
      if (selectedMonthFilter !== "all") {
        const dueDate = new Date(inv.due_date + "T12:00:00");
        if (dueDate < selectedMonthFilter.start || dueDate > selectedMonthFilter.end) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!inv.description?.toLowerCase().includes(q) && !inv.company_name?.toLowerCase().includes(q)) return false;
      }
      if (selectedCompany !== "all" && inv.company_id !== selectedCompany) return false;
      if (selectedConsultant !== "all" && companyConsultantMap) {
        const consultantIds = companyConsultantMap.get(inv.company_id);
        if (!consultantIds || !consultantIds.has(selectedConsultant)) return false;
      }
      return true;
    });
  }, [invoices, search, selectedCompany, selectedConsultant, companyConsultantMap, selectedMonthFilter]);

  const sortedInvoices = useMemo(() => {
    if (!sortColumn) return overdueInvoices;
    return [...overdueInvoices].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "company": cmp = (a.company_name || "").localeCompare(b.company_name || ""); break;
        case "description": cmp = (a.description || "").localeCompare(b.description || ""); break;
        case "installment": cmp = a.installment_number - b.installment_number; break;
        case "value": cmp = a.total_with_fees_cents - b.total_with_fees_cents; break;
        case "due_date": cmp = a.due_date.localeCompare(b.due_date); break;
        case "urgency": cmp = daysOverdue(a.due_date) - daysOverdue(b.due_date); break;
        default: cmp = 0;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [overdueInvoices, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedInvoices.length / ITEMS_PER_PAGE);
  const paginated = sortedInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.total_with_fees_cents, 0);
  const uniqueCompanies = new Set(overdueInvoices.map(i => i.company_id)).size;
  const avgDays = overdueInvoices.length > 0
    ? Math.round(overdueInvoices.reduce((s, i) => s + daysOverdue(i.due_date), 0) / overdueInvoices.length)
    : 0;

  function daysOverdue(dueDate: string) {
    const due = new Date(dueDate + "T12:00:00");
    const today = new Date();
    return Math.floor((today.getTime() - due.getTime()) / 86400000);
  }

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
      const defaultInstName = await getDefaultWhatsAppInstance();
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("status", "connected")
        .eq("instance_name", defaultInstName)
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
      const defaultInstName2 = await getDefaultWhatsAppInstance();
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name")
        .eq("status", "connected")
        .eq("instance_name", defaultInstName2)
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
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/25">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            {overdueInvoices.length > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background animate-pulse">
                {overdueInvoices.length > 99 ? "99+" : overdueInvoices.length}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-red-500 to-rose-600 bg-clip-text text-transparent">
              Faturas em Atraso
            </h2>
            <p className="text-sm text-muted-foreground">Gestão de inadimplência e cobranças</p>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Total em Atraso",
            value: formatCurrencyCents(totalOverdue),
            subtitle: `${overdueInvoices.length} parcela(s)`,
            icon: DollarSign,
            gradient: "from-red-500 to-rose-600",
            glow: "shadow-red-500/20",
          },
          {
            title: "Empresas Inadimplentes",
            value: String(uniqueCompanies),
            subtitle: "empresas distintas",
            icon: Building2,
            gradient: "from-orange-500 to-amber-600",
            glow: "shadow-orange-500/20",
          },
          {
            title: "Média de Atraso",
            value: `${avgDays} dias`,
            subtitle: "tempo médio",
            icon: Clock,
            gradient: "from-amber-500 to-yellow-600",
            glow: "shadow-amber-500/20",
          },
          {
            title: "Ticket Médio Atraso",
            value: overdueInvoices.length > 0 ? formatCurrencyCents(Math.round(totalOverdue / overdueInvoices.length)) : "R$ 0,00",
            subtitle: "por fatura",
            icon: TrendingDown,
            gradient: "from-rose-500 to-pink-600",
            glow: "shadow-rose-500/20",
          },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <Card className={cn(
              "relative overflow-hidden border-0 shadow-lg",
              kpi.glow
            )}>
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.07]", kpi.gradient)} />
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.title}</p>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  </div>
                  <div className={cn("h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center", kpi.gradient)}>
                    <kpi.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
              {consultants.length > 0 && (
                <Select value={selectedConsultant} onValueChange={(v) => { setSelectedConsultant(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Consultor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Consultores</SelectItem>
                    {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                {selectedMonthFilter === "all" ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal gap-2"
                    onClick={() => {
                      const now = new Date();
                      setSelectedMonthFilter({ start: startOfMonth(now), end: endOfMonth(now) });
                      setCurrentPage(1);
                    }}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Todo período
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 w-full">
                    <MonthYearPicker
                      value={selectedMonthFilter.start}
                      onChange={(range) => { setSelectedMonthFilter(range); setCurrentPage(1); }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground whitespace-nowrap"
                      onClick={() => { setSelectedMonthFilter("all"); setCurrentPage(1); }}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-red-500/30 bg-gradient-to-r from-red-500/5 to-rose-500/5 backdrop-blur-sm">
              <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-red-500" />
                  </div>
                  <span className="text-sm font-semibold">{selectedIds.size} fatura(s) selecionada(s)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground">
                    Limpar
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/25 border-0" disabled={isBulkSending} onClick={handleBulkSend}>
                    {isBulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    WhatsApp
                  </Button>
                  {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_confirm) && (
                    <Button size="sm" className="gap-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 border-0" disabled={isBulkSending} onClick={handleBulkConfirm}>
                      <CheckCircle2 className="h-4 w-4" />
                      Dar Baixa
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
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
                    <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("company")}>
                      <div className="flex items-center">Empresa<SortIcon column="company" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("description")}>
                      <div className="flex items-center">Descrição<SortIcon column="description" /></div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("installment")}>
                      <div className="flex items-center justify-center">Parcela<SortIcon column="installment" /></div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("value")}>
                      <div className="flex items-center justify-end">Valor<SortIcon column="value" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("due_date")}>
                      <div className="flex items-center">Vencimento<SortIcon column="due_date" /></div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("urgency")}>
                      <div className="flex items-center justify-center">Urgência<SortIcon column="urgency" /></div>
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex flex-col items-center gap-3"
                        >
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                            <CheckCircle2 className="h-8 w-8 text-white" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold">Nenhuma fatura em atraso!</p>
                            <p className="text-sm text-muted-foreground">Todas as cobranças estão em dia 🎉</p>
                          </div>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  ) : paginated.map((inv, idx) => {
                    const isProcessing = processingInvoiceId === inv.id;
                    const days = daysOverdue(inv.due_date);
                    const urgency = urgencyLevel(days);
                    const UrgencyIcon = urgency.icon;
                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          "border-b transition-colors hover:bg-muted/50",
                          selectedIds.has(inv.id) && "bg-red-500/5"
                        )}
                      >
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
                        <TableCell>
                          <span className="font-medium text-sm">{inv.company_name}</span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{inv.description}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs font-mono">
                            {inv.installment_number}/{inv.total_installments}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-500">{formatCurrencyCents(inv.total_with_fees_cents)}</TableCell>
                        <TableCell className="text-sm">
                          <div>
                            <span>{inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</span>
                            <p className="text-xs text-red-400 font-medium">{days}d atraso</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn("gap-1 text-xs border", urgency.bg, urgency.text, urgency.border)}>
                            <UrgencyIcon className="h-3 w-3" />
                            {urgency.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {inv.payment_link_url && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500" title="Copiar link" onClick={() => copyLink(inv.payment_link_url)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-500" title="Enviar via WhatsApp" onClick={() => sendWhatsApp(inv)}>
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_confirm) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 hover:bg-emerald-500/10 hover:text-emerald-500"
                                disabled={isProcessing}
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  invoiceId: inv.id,
                                  action: "confirm",
                                  description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments}) - ${formatCurrencyCents(inv.total_with_fees_cents)}`
                                })}
                              >
                                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Baixa
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-2"
        >
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedInvoices.length)} de {sortedInvoices.length}
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
        </motion.div>
      )}
    </div>
  );
}
