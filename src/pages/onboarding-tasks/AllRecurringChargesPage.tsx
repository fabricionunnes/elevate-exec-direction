import { useState, useEffect, useMemo, useCallback, useRef } from "react";

function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
import { syncEntryToContaAzul, syncPaymentToContaAzul } from "@/utils/contaAzulSync";
import { PeriodNavigator, getDateRangeForPeriod, type PeriodType } from "@/components/financial/PeriodNavigator";
import { sendPaymentNotification } from "@/utils/paymentNotification";
import { getDefaultWhatsAppInstance } from "@/utils/whatsapp-defaults";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, Loader2, ShieldAlert, Search, RefreshCw, Filter, Download, Upload,
  ArrowUpCircle, Calculator, CheckCircle2, Undo2, Clock, AlertTriangle,
  XCircle, CalendarIcon, Landmark, Plus, Trash2, Edit2, LayoutDashboard,
  ArrowDownCircle, FolderTree, FileText, ArrowRightLeft, BarChart3,
  TrendingUp, TrendingDown, Target, Wallet, Copy, Send, Menu, Brain, CalendarDays, Bell, Truck, MessageSquare, ChevronDown, ChevronRight, Headphones,
  ArrowUpDown, ArrowUp, ArrowDown, FileCheck, Link2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import FinancialDashboardTab from "./financial/FinancialDashboardTab";
import FinancialCategoriesTab from "./financial/FinancialCategoriesTab";
import FinancialDRETab from "./financial/FinancialDRETab";
import FinancialDFCTab from "./financial/FinancialDFCTab";
import CFOExecutiveBoardTab from "./financial/CFOExecutiveBoardTab";
import CFORevenueMRRTab from "./financial/CFORevenueMRRTab";
import CFOChurnRetentionTab from "./financial/CFOChurnRetentionTab";
import CFOUnitEconomicsTab from "./financial/CFOUnitEconomicsTab";
import CFOCostsStructureTab from "./financial/CFOCostsStructureTab";
import CFOCashProjectionTab from "./financial/CFOCashProjectionTab";
import CFODelinquencyTab from "./financial/CFODelinquencyTab";
import { CFOAIPanel } from "@/components/financial/CFOAIPanel";
import FinancialOverdueTab from "./financial/FinancialOverdueTab";
import { useFinancialPermissions } from "@/hooks/useFinancialPermissions";
import { FINANCIAL_PERMISSION_KEYS } from "@/types/staffPermissions";
import { FinancialImportDialog } from "@/components/financial/FinancialImportDialog";
import { CFOFilterBar, type CFOFilters } from "@/components/financial/CFOFilterBar";
import { BillingRulesPanel } from "@/components/financial/BillingRulesPanel";
import { SuppliersPanel } from "@/components/financial/SuppliersPanel";
import { WhatsAppInstancePanel } from "@/components/financial/WhatsAppInstancePanel";
import { FinancialInboxPanel } from "@/components/financial/FinancialInboxPanel";
import { BankStatementFullPanel } from "@/components/financial/BankStatementFullPanel";
import { NfsePanel } from "@/components/financial/NfsePanel";
import { SupplierAutocomplete } from "@/components/financial/SupplierAutocomplete";
import { PayablePaymentDialog, PayableEditDialog } from "@/components/financial/PayableActionDialogs";
import { BankTransactionsDialog } from "@/components/financial/BankTransactionsDialog";
import { getNthBusinessDayOfMonth, ensureBusinessDay } from "@/lib/businessDays";
import { DailyFinancialSummaryDialog, shouldShowDailySummary, markDailySummaryShown } from "@/components/financial/DailyFinancialSummaryDialog";

interface RecurringCharge {
  id: string;
  company_id: string;
  description: string;
  amount_cents: number;
  recurrence: string;
  next_billing_date: string | null;
  is_active: boolean;
  created_at: string;
  asaas_subscription_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  company_name?: string;
}

interface FinancialEntry {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  category: string | null;
  category_id?: string | null;
  cost_center_id?: string | null;
  reference_month: string;
  paid_amount: number | null;
  paid_at: string | null;
  paid_date?: string | null;
  created_at: string;
  supplier_name?: string;
  notes?: string | null;
  bank_id?: string | null;
  is_recurring?: boolean | null;
  recurrence_type?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  conta_azul_id?: string | null;
}

interface Invoice {
  id: string;
  company_id: string | null;
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
  source_table: "company_invoices" | "financial_receivables";
  company_name?: string;
  company_phone?: string;
  custom_receiver_name?: string | null;
  category_id?: string | null;
  cost_center_id?: string | null;
  notes?: string | null;
  bank_id?: string | null;
  conta_azul_id?: string | null;
  payment_fee_cents?: number | null;
  discount_cents?: number | null;
}

const DASHBOARD_CHILDREN = [
  { key: "cfo-executive", label: "Executive Board", icon: BarChart3, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_executive },
  { key: "cfo-mrr", label: "Receita & MRR", icon: TrendingUp, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_mrr },
  { key: "cfo-churn", label: "Churn & Retenção", icon: TrendingDown, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_churn },
  { key: "cfo-unit-economics", label: "Unit Economics", icon: Target, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_unit_economics },
  { key: "cfo-costs", label: "Custos & Estrutura", icon: Calculator, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_costs },
  { key: "cfo-cash", label: "Caixa & Projeção", icon: Wallet, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_cash },
  { key: "cfo-delinquency", label: "Inadimplência", icon: AlertTriangle, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_delinquency },
] as const;

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, permKey: FINANCIAL_PERMISSION_KEYS.fin_dashboard, children: DASHBOARD_CHILDREN },
  { key: "recurring", label: "Contas a Receber", icon: ArrowDownCircle, permKey: FINANCIAL_PERMISSION_KEYS.fin_receivables_view },
  { key: "overdue", label: "Atrasados", icon: AlertTriangle, permKey: FINANCIAL_PERMISSION_KEYS.fin_overdue },
  { key: "payables", label: "Contas a Pagar", icon: ArrowUpCircle, permKey: FINANCIAL_PERMISSION_KEYS.fin_payables_view },
  { key: "categories", label: "Categorias", icon: FolderTree, permKey: FINANCIAL_PERMISSION_KEYS.fin_categories },
  { key: "dre", label: "DRE", icon: FileText, permKey: FINANCIAL_PERMISSION_KEYS.fin_dre },
  { key: "dfc", label: "DFC", icon: ArrowRightLeft, permKey: FINANCIAL_PERMISSION_KEYS.fin_dfc },
  { key: "banks", label: "Bancos", icon: Landmark, permKey: FINANCIAL_PERMISSION_KEYS.fin_banks },
  { key: "separator-cfo-ai", label: "── CFO IA ──", icon: Brain, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_ai, isSeparator: true },
  { key: "cfo-ai", label: "CFO IA", icon: Brain, permKey: FINANCIAL_PERMISSION_KEYS.fin_cfo_ai },
  { key: "separator-billing-rules", label: "── OPERACIONAL ──", icon: Bell, permKey: FINANCIAL_PERMISSION_KEYS.fin_billing_rules, isSeparator: true },
  { key: "billing-rules", label: "Régua de Cobranças", icon: Bell, permKey: FINANCIAL_PERMISSION_KEYS.fin_billing_rules },
  { key: "suppliers", label: "Fornecedores", icon: Truck, permKey: FINANCIAL_PERMISSION_KEYS.fin_payables_view },
  { key: "inbox", label: "Atendimentos", icon: Headphones, permKey: FINANCIAL_PERMISSION_KEYS.fin_inbox },
  { key: "whatsapp-instance", label: "Instância", icon: MessageSquare, permKey: FINANCIAL_PERMISSION_KEYS.fin_whatsapp_instance },
  { key: "bank-statement", label: "Extrato Bancário", icon: FileText, permKey: FINANCIAL_PERMISSION_KEYS.fin_bank_statement },
  { key: "nfse", label: "NFS-e", icon: FileCheck, permKey: FINANCIAL_PERMISSION_KEYS.fin_nfse },
] as const;

const applyPeriodPreset = (
  period: string,
  setFrom: (d: Date | undefined) => void,
  setTo: (d: Date | undefined) => void
) => {
  const now = new Date();
  switch (period) {
    case "today":
      setFrom(startOfDay(now));
      setTo(endOfDay(now));
      break;
    case "this_week":
      setFrom(startOfWeek(now, { weekStartsOn: 0 }));
      setTo(endOfWeek(now, { weekStartsOn: 0 }));
      break;
    case "this_month":
      setFrom(startOfMonth(now));
      setTo(endOfMonth(now));
      break;
    case "this_year":
      setFrom(startOfYear(now));
      setTo(endOfYear(now));
      break;
    case "last_30":
      setFrom(subDays(now, 30));
      setTo(now);
      break;
    case "last_12_months":
      setFrom(subMonths(now, 12));
      setTo(now);
      break;
    case "all":
      setFrom(undefined);
      setTo(undefined);
      break;
  }
};

export default function AllRecurringChargesPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const finPerms = useFinancialPermissions();
  const [isLoading, setIsLoading] = useState(!false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(true);

  // Data state
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [fullCompanies, setFullCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [payables, setPayables] = useState<FinancialEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; invoiceId: string; action: "confirm" | "revert" | "revert_payable"; description: string }>({
    open: false, invoiceId: "", action: "confirm", description: "",
  });
  const [manualFee, setManualFee] = useState(0);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [manualInterest, setManualInterest] = useState(0);
  const [manualPaidAmount, setManualPaidAmount] = useState<number | undefined>(undefined);
  const [selectedBankId, setSelectedBankId] = useState("none");
  const [banks, setBanks] = useState<any[]>([]);
  const [bankDialog, setBankDialog] = useState<{ open: boolean; bank: any | null }>({ open: false, bank: null });
  const [bankForm, setBankForm] = useState({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });
  const [statementBank, setStatementBank] = useState<any>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferData, setTransferData] = useState({ from_account_id: "", to_account_id: "", amount: 0, description: "", transfer_date: format(new Date(), "yyyy-MM-dd") });

  // Categories & Cost Centers for forms
  const [staffCategories, setStaffCategories] = useState<any[]>([]);
  const [staffCostCenters, setStaffCostCenters] = useState<any[]>([]);

  // CFO Filters
  const [cfoFilters, setCfoFilters] = useState<CFOFilters>({ month: "all", consultantId: "all", companyId: "all" });

  // New receivable dialog
  const [receivableDialog, setReceivableDialog] = useState(false);
  const [receivableForm, setReceivableForm] = useState({
    company_id: "", custom_receiver_name: "", description: "", amount: 0, due_date: "", notes: "", category_id: "", cost_center_id: "",
  });
  const [showCustomReceiverRecv, setShowCustomReceiverRecv] = useState(false);
  const [savingReceivable, setSavingReceivable] = useState(false);

  // New payable dialog
  const [payableDialog, setPayableDialog] = useState(false);
  const [payableForm, setPayableForm] = useState({
    supplier_name: "", description: "", amount: 0, due_date: "", reference_month: "", category_id: "", cost_center_id: "", notes: "",
    is_recurring: false, recurrence_type: "monthly", recurring_count: "12", due_date_mode: "calendar" as "calendar" | "business_day", business_day_number: "5",
    cost_type: "" as "" | "fixed" | "variable",
  });
  const [financialSuppliers, setFinancialSuppliers] = useState<any[]>([]);
  const [savingPayable, setSavingPayable] = useState(false);

  // Payable action dialogs
  const [payablePaymentDialog, setPayablePaymentDialog] = useState<{ open: boolean; payable: FinancialEntry | null }>({ open: false, payable: null });
  const [payableEditDialog, setPayableEditDialog] = useState<{ open: boolean; payable: FinancialEntry | null }>({ open: false, payable: null });

  // Import dialogs
  const [importReceivableOpen, setImportReceivableOpen] = useState(false);
  const [importPayableOpen, setImportPayableOpen] = useState(false);

  // Daily summary dialog
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const dailySummaryTriggered = useRef(false);

  // Bulk selection - Invoices
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);

  // Bulk selection - Payables
  const [selectedPayableIds, setSelectedPayableIds] = useState<Set<string>>(new Set());
  const [isBulkPayableAction, setIsBulkPayableAction] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Sorting - Receivables
  const [recSortCol, setRecSortCol] = useState<string | null>(null);
  const [recSortDir, setRecSortDir] = useState<"asc" | "desc">("asc");
  // Sorting - Payables
  const [paySortCol, setPaySortCol] = useState<string | null>(null);
  const [paySortDir, setPaySortDir] = useState<"asc" | "desc">("asc");

  const toggleRecSort = (col: string) => {
    if (recSortCol === col) setRecSortDir(d => d === "asc" ? "desc" : "asc");
    else { setRecSortCol(col); setRecSortDir("asc"); }
    setCurrentPage(1);
  };
  const togglePaySort = (col: string) => {
    if (paySortCol === col) setPaySortDir(d => d === "asc" ? "desc" : "asc");
    else { setPaySortCol(col); setPaySortDir("asc"); }
  };
  const SortIcon = ({ column, activeCol }: { column: string; activeCol: string | null }) => {
    if (activeCol !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return activeCol === column ? (
      (column === recSortCol ? recSortDir : paySortDir) === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
    ) : null;
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedRecurrence, setSelectedRecurrence] = useState("all");
  const [selectedConsultant, setSelectedConsultant] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [selectedPayableCategories, setSelectedPayableCategories] = useState<string[]>([]);
  const [selectedPayableCostCenters, setSelectedPayableCostCenters] = useState<string[]>([]);
  const [selectedPayableConsultant, setSelectedPayableConsultant] = useState("all");
  const [receivablePeriod, setReceivablePeriod] = useState<PeriodType>("this_month");
  const [payablePeriod, setPayablePeriod] = useState<PeriodType>("this_month");
  const [receivableOffset, setReceivableOffset] = useState(0);
  const [payableOffset, setPayableOffset] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [payableDateFrom, setPayableDateFrom] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [payableDateTo, setPayableDateTo] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });

  // Sync receivable dates from period+offset
  useEffect(() => {
    const { start, end } = getDateRangeForPeriod(receivablePeriod, receivableOffset);
    setDateFrom(start ?? undefined);
    setDateTo(end ?? undefined);
  }, [receivablePeriod, receivableOffset]);

  // Sync payable dates from period+offset
  useEffect(() => {
    const { start, end } = getDateRangeForPeriod(payablePeriod, payableOffset);
    setPayableDateFrom(start ?? undefined);
    setPayableDateTo(end ?? undefined);
  }, [payablePeriod, payableOffset]);

  useEffect(() => {
    if (!finPerms.loading) {
      if (finPerms.hasFinancialAccess) {
        setUserRole(finPerms.userRole);
        // Auto-select first permitted tab instead of hardcoding "dashboard"
        const firstPermitted = NAV_ITEMS.find(
          item => !('isSeparator' in item && item.isSeparator) && finPerms.hasFinancialPermission(item.permKey)
        );
        setActiveTab(firstPermitted ? firstPermitted.key : "dashboard");
        loadData().finally(() => setIsLoading(false));
      } else {
        setUserRole(null);
        setIsLoading(false);
        if (!finPerms.loading) toast.error("Acesso negado. Você não tem permissão para o módulo financeiro.");
      }
    }
  }, [finPerms.loading, finPerms.hasFinancialAccess]);

  // Show daily financial summary on first access of the day (only for users with payables permission)
  useEffect(() => {
    if (
      !isLoading &&
      !dailySummaryTriggered.current &&
      userRole &&
      (finPerms.isMaster || finPerms.hasFinancialPermission(FINANCIAL_PERMISSION_KEYS.fin_payables_view)) &&
      shouldShowDailySummary()
    ) {
      dailySummaryTriggered.current = true;
      setDailySummaryOpen(true);
      markDailySummaryShown();
    }
  }, [isLoading, userRole, finPerms.isMaster]);

  // Refresh categories/cost centers when switching tabs (e.g. after creating new ones in categories tab)
  useEffect(() => {
    if (activeTab !== "categories" && userRole) {
      Promise.all([
        supabase.from("staff_financial_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("staff_financial_cost_centers").select("*").eq("is_active", true).order("sort_order"),
      ]).then(([catRes, ccRes]) => {
        if (!catRes.error) setStaffCategories((catRes.data as any) || []);
        if (!ccRes.error) setStaffCostCenters((ccRes.data as any) || []);
      });
    }
  }, [activeTab]);

  const fetchAllRows = async (table: string, orderCol: string) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .order(orderCol, { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { data: null, error };
      allData = allData.concat(data || []);
      hasMore = (data?.length || 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }
    return { data: allData, error: null };
  };

  const loadData = async () => {
    try {
      const [chargesRes, companiesRes, payablesRes, invoicesRes, financialReceivablesRes, banksRes, catRes, ccRes, staffRes, projectsRes] = await Promise.all([
        supabase.from("company_recurring_charges").select("*").order("created_at", { ascending: false }),
        supabase.from("onboarding_companies").select("id, name, status, consultant_id, cs_id, contract_start_date, contract_end_date, contract_value, segment, is_simulator, phone").order("name"),
        fetchAllRows("financial_payables", "due_date"),
        fetchAllRows("company_invoices", "due_date"),
        fetchAllRows("financial_receivables", "due_date"),
        supabase.from("financial_banks").select("*").eq("is_active", true).order("name"),
        supabase.from("staff_financial_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("staff_financial_cost_centers").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        supabase.from("onboarding_projects").select("id, onboarding_company_id, consultant_id, cs_id, status"),
      ]);
      if (chargesRes.error) throw chargesRes.error;
      if (companiesRes.error) throw companiesRes.error;
      const allCompaniesRaw = companiesRes.data || [];
      const allCompanies = allCompaniesRaw.filter((c: any) => !c.is_simulator);
      // Use ALL companies (including simulators) for name/phone maps so invoices always resolve
      const companiesMap = new Map(allCompaniesRaw.map((c: any) => [c.id, c.name]));
      const companiesPhoneMap = new Map(allCompaniesRaw.map((c: any) => [c.id, c.phone]));
      setCharges((chargesRes.data || []).map((ch: any) => ({ ...ch, company_name: companiesMap.get(ch.company_id) || ch.custom_receiver_name || "Empresa desconhecida" })));
      setCompanies(allCompanies.map((c: any) => ({ id: c.id, name: c.name })));
      setFullCompanies(allCompanies);
      setStaffList(staffRes.data || []);
      setPayables((payablesRes.data as any) || []);
      const legacyInvoices: Invoice[] = ((invoicesRes.data as any[]) || []).map((inv: any) => ({
        ...inv,
        source_table: "company_invoices",
        company_name: companiesMap.get(inv.company_id) || inv.custom_receiver_name || "Empresa desconhecida",
        company_phone: companiesPhoneMap.get(inv.company_id) || null,
      }));
      const centralReceivables: Invoice[] = ((financialReceivablesRes.data as any[]) || []).map((rec: any) => {
        const amountCents = Math.round(Number(rec.amount || 0) * 100);
        const interestCents = Math.round(Number(rec.interest_amount || 0) * 100);
        const lateFeeCents = Math.round(Number(rec.late_fee_amount || 0) * 100);
        const discountCents = Math.round(Number(rec.discount_amount || 0) * 100);
        const feeCents = Math.round(Number(rec.fee_amount || 0) * 100);

        return {
          id: rec.id,
          company_id: rec.company_id || null,
          description: rec.description,
          amount_cents: amountCents,
          due_date: rec.due_date,
          status: rec.status,
          paid_at: rec.paid_date || null,
          paid_amount_cents: rec.paid_amount != null ? Math.round(Number(rec.paid_amount) * 100) : null,
          installment_number: 1,
          total_installments: 1,
          late_fee_cents: lateFeeCents,
          interest_cents: interestCents,
          total_with_fees_cents: Math.max(amountCents + interestCents + lateFeeCents - discountCents - feeCents, 0),
          recurring_charge_id: null,
          pagarme_charge_id: null,
          payment_link_url: rec.payment_link || null,
          created_at: rec.created_at,
          source_table: "financial_receivables",
          company_name: companiesMap.get(rec.company_id) || rec.custom_receiver_name || "Empresa desconhecida",
          company_phone: companiesPhoneMap.get(rec.company_id) || null,
          custom_receiver_name: rec.custom_receiver_name || null,
          category_id: rec.category_id || null,
          cost_center_id: null,
          notes: rec.notes || null,
          bank_id: rec.bank_account_id || null,
          conta_azul_id: rec.conta_azul_id || null,
          payment_fee_cents: feeCents,
          discount_cents: discountCents,
        };
      });
      setInvoices([...legacyInvoices, ...centralReceivables]);
      setBanks((banksRes.data as any) || []);
      setStaffCategories((catRes.data as any) || []);
      setStaffCostCenters((ccRes.data as any) || []);
      setProjects((projectsRes.data as any) || []);
      // Load financial suppliers
      try {
        const { data: suppData } = await (supabase as any).from("financial_suppliers").select("id, name").eq("is_active", true).order("name");
        setFinancialSuppliers(suppData || []);
      } catch { setFinancialSuppliers([]); }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    }
  };

  const isMaster = finPerms.isMaster;
  const isAdmin = isMaster || userRole === "admin";
  // CFO filtered data based on cfoFilters
  const cfoFilteredCompanyIds = useMemo(() => {
    let filtered = fullCompanies;
    if (cfoFilters.consultantId !== "all") {
      filtered = filtered.filter(c => c.consultant_id === cfoFilters.consultantId || c.cs_id === cfoFilters.consultantId);
    }
    if (cfoFilters.companyId !== "all") {
      filtered = filtered.filter(c => c.id === cfoFilters.companyId);
    }
    return new Set(filtered.map(c => c.id));
  }, [fullCompanies, cfoFilters.consultantId, cfoFilters.companyId]);

  const cfoInvoices = useMemo(() => {
    return invoices.filter(inv => cfoFilteredCompanyIds.has(inv.company_id));
  }, [invoices, cfoFilteredCompanyIds]);

  const cfoPayables = useMemo(() => {
    // Payables don't have company_id filter unless consultant filters by company
    if (cfoFilters.consultantId === "all" && cfoFilters.companyId === "all") return payables;
    return payables; // payables are internal costs, not company-specific
  }, [payables, cfoFilters]);

  const cfoCompanies = useMemo(() => {
    if (cfoFilters.consultantId === "all" && cfoFilters.companyId === "all") return fullCompanies;
    return fullCompanies.filter(c => cfoFilteredCompanyIds.has(c.id));
  }, [fullCompanies, cfoFilteredCompanyIds, cfoFilters]);

  const isCfoTab = activeTab.startsWith("cfo-");

  const hasPerm = finPerms.hasFinancialPermission;

  // Build consultant list for filters
  const consultants = useMemo(() => {
    return staffList.filter(s => ["consultant", "cs", "admin", "master"].includes(s.role));
  }, [staffList]);

  // Build company-to-consultants map (company → Set of consultant IDs from company + project level)
  const companyConsultantMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    // Company-level assignments
    fullCompanies.forEach((c: any) => {
      const set = new Set<string>();
      if (c.consultant_id) set.add(c.consultant_id);
      if (c.cs_id) set.add(c.cs_id);
      map.set(c.id, set);
    });
    // Project-level assignments (exclude only closed/completed projects)
    projects.forEach((p: any) => {
      if (p.onboarding_company_id && p.status !== 'closed' && p.status !== 'completed') {
        const set = map.get(p.onboarding_company_id) || new Set<string>();
        if (p.consultant_id) set.add(p.consultant_id);
        if (p.cs_id) set.add(p.cs_id);
        map.set(p.onboarding_company_id, set);
      }
    });
    return map;
  }, [fullCompanies, projects]);

  const todayStr = getLocalDateString(); // YYYY-MM-DD

  const isEffectivelyOverdue = (status: string, dueDate?: string) => {
    if (status === "overdue") return true;
    if (status === "pending" && dueDate && dueDate < todayStr) return true;
    return false;
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const match = inv.description?.toLowerCase().includes(s) || inv.company_name?.toLowerCase().includes(s);
        if (!match) return false;
      }
      if (selectedCompany !== "all" && inv.company_id !== selectedCompany) return false;
      if (selectedStatuses.length > 0) {
        const effectiveStatus = isEffectivelyOverdue(inv.status, inv.due_date) ? "overdue" : inv.status;
        if (!selectedStatuses.includes(effectiveStatus)) return false;
      }
      if (dateFrom) { if (inv.due_date < format(dateFrom, "yyyy-MM-dd")) return false; }
      if (dateTo) { if (inv.due_date > format(dateTo, "yyyy-MM-dd")) return false; }
      if (selectedConsultant !== "all") {
        const consultantIds = companyConsultantMap.get(inv.company_id);
        if (!consultantIds || !consultantIds.has(selectedConsultant)) return false;
      }
      const invAny = inv as any;
      if (selectedCategories.length > 0 && !selectedCategories.includes(invAny.category_id)) return false;
      if (selectedCostCenters.length > 0 && !selectedCostCenters.includes(invAny.cost_center_id)) return false;
      return true;
    });
  }, [invoices, searchTerm, selectedCompany, selectedStatuses, dateFrom, dateTo, selectedConsultant, selectedCategories, selectedCostCenters, companyConsultantMap]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCompany, selectedStatuses, dateFrom, dateTo, selectedConsultant, selectedCategories, selectedCostCenters]);

  const sortedInvoices = useMemo(() => {
    if (!recSortCol) return filteredInvoices;
    return [...filteredInvoices].sort((a, b) => {
      let cmp = 0;
      switch (recSortCol) {
        case "company": cmp = (a.company_name || "").localeCompare(b.company_name || ""); break;
        case "description": cmp = (a.description || "").localeCompare(b.description || ""); break;
        case "installment": cmp = a.installment_number - b.installment_number; break;
        case "value": cmp = a.amount_cents - b.amount_cents; break;
        case "due_date": cmp = (a.due_date || "").localeCompare(b.due_date || ""); break;
        case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
        case "paid_at": cmp = (a.paid_at || "").localeCompare(b.paid_at || ""); break;
      }
      return recSortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredInvoices, recSortCol, recSortDir]);


  const totalPages = Math.ceil(sortedInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = sortedInvoices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const selectablePaginatedInvoices = paginatedInvoices;

  const filteredPayables = useMemo(() => {
    return payables.filter(p => {
      if (searchTerm && !p.description?.toLowerCase().includes(searchTerm.toLowerCase()) && !p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      const today = format(new Date(), "yyyy-MM-dd");
      const isOverdue = (p.status === "pending" || p.status === "partial") && p.due_date && p.due_date < today;
      if (selectedStatuses.length > 0) {
        const effectiveStatus = isOverdue ? "overdue" : p.status;
        if (!selectedStatuses.includes(effectiveStatus)) return false;
      }
      if (payableDateFrom && p.due_date) { if (p.due_date < format(payableDateFrom, "yyyy-MM-dd")) return false; }
      if (payableDateTo && p.due_date) { if (p.due_date > format(payableDateTo, "yyyy-MM-dd")) return false; }
      const pAny = p as any;
      if (selectedPayableCategories.length > 0 && !selectedPayableCategories.includes(pAny.category_id)) return false;
      if (selectedPayableCostCenters.length > 0 && !selectedPayableCostCenters.includes(pAny.cost_center_id)) return false;
      return true;
    });
  }, [payables, searchTerm, selectedStatuses, payableDateFrom, payableDateTo, selectedPayableCategories, selectedPayableCostCenters]);

  const sortedPayables = useMemo(() => {
    if (!paySortCol) return filteredPayables;
    return [...filteredPayables].sort((a, b) => {
      let cmp = 0;
      switch (paySortCol) {
        case "supplier": cmp = (a.supplier_name || "").localeCompare(b.supplier_name || ""); break;
        case "description": cmp = (a.description || "").localeCompare(b.description || ""); break;
        case "value": cmp = a.amount - b.amount; break;
        case "due_date": cmp = (a.due_date || "").localeCompare(b.due_date || ""); break;
        case "ref_month": cmp = (a.reference_month || "").localeCompare(b.reference_month || ""); break;
        case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
        case "paid_at": cmp = (a.paid_at || "").localeCompare(b.paid_at || ""); break;
      }
      return paySortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredPayables, paySortCol, paySortDir]);


  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatCurrencyCents = (cents: number) => formatCurrency(cents / 100);

  const getStatusDisplay = (s: string, dueDate?: string) => {
    const isDueToday = s === "pending" && dueDate === todayStr;
    if (s === "paid") return { label: "Pago", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
    if (s === "partial") return { label: "Pago Parcial", className: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <Clock className="h-3.5 w-3.5" /> };
    if (isEffectivelyOverdue(s, dueDate)) return { label: "Vencido", className: "bg-red-500/10 text-red-600 border-red-500/20", icon: <AlertTriangle className="h-3.5 w-3.5" /> };
    if (isDueToday) return { label: "Vence Hoje", className: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <Clock className="h-3.5 w-3.5" /> };
    if (s === "cancelled") return { label: "Cancelado", className: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: <XCircle className="h-3.5 w-3.5" /> };
    return { label: "Pendente", className: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Clock className="h-3.5 w-3.5" /> };
  };

  const statusLabel = (s: string, dueDate?: string) => getStatusDisplay(s, dueDate).label;

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "paid") return "default";
    if (s === "overdue") return "destructive";
    if (s === "cancelled") return "secondary";
    return "outline";
  };

  const resetFilters = () => {
    const now = new Date();
    setSearchTerm("");
    setSelectedCompany("all");
    setSelectedStatuses([]);
    setSelectedMonth("all");
    setSelectedRecurrence("all");
    setSelectedConsultant("all");
    setSelectedCategories([]);
    setSelectedCostCenters([]);
    setSelectedPayableCategories([]);
    setSelectedPayableCostCenters([]);
    setSelectedPayableConsultant("all");
    setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
    setDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    setPayableDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
    setPayableDateTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  };

  // Manual payment (baixa)
  const handleManualPayment = async (invoiceId: string, feeCents: number, bankId: string | null, discountCents: number = 0, interestCents: number = 0, customPaidCents?: number) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const today = getLocalDateString();
      const inv = invoices.find(i => i.id === invoiceId);
      const baseAmount = inv?.status === "overdue" ? inv.total_with_fees_cents : inv?.amount_cents;
      const totalDue = (baseAmount || 0) - discountCents + interestCents;
      const previouslyPaid = inv?.paid_amount_cents || 0;
      const paidNow = customPaidCents !== undefined ? customPaidCents : totalDue;
      const accumulatedPaid = previouslyPaid + paidNow;
      const isPartial = (accumulatedPaid + discountCents) < (baseAmount || 0);
      const newStatus = isPartial ? "partial" : "paid";
      const updateData: any = { status: newStatus, paid_at: today, paid_amount_cents: accumulatedPaid, payment_fee_cents: feeCents };
      if (bankId) updateData.bank_id = bankId;
      const { error } = await supabase.from("company_invoices").update(updateData).eq("id", invoiceId);
      if (error) throw error;
      if (bankId && paidNow > 0) {
        const netAmount = paidNow - feeCents;
        if (netAmount > 0) {
          const { data: existingCredits } = await supabase
            .from("financial_bank_transactions")
            .select("id, amount_cents")
            .eq("reference_type", "invoice")
            .eq("reference_id", invoiceId)
            .eq("type", "credit");

          const existingTotal = (existingCredits || []).reduce((sum: number, tx: any) => sum + (tx.amount_cents || 0), 0);
          const amountToCredit = Math.max(0, netAmount - existingTotal);

          if (amountToCredit > 0) {
            await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: amountToCredit });
            await supabase.from("financial_bank_transactions").insert({ bank_id: bankId, type: "credit", amount_cents: amountToCredit, description: `Recebimento${isPartial ? " parcial" : ""}: ${inv?.description} (${inv?.installment_number}/${inv?.total_installments})`, reference_type: "invoice", reference_id: invoiceId, discount_cents: discountCents, interest_cents: interestCents, fee_cents: feeCents } as any);
          }
        }
      }
      const shouldSyncAsaas = !!inv?.due_date && inv.due_date <= today;
      const { data, error: fnError } = shouldSyncAsaas
        ? await supabase.functions.invoke("asaas-confirm-payment", { body: { invoice_id: invoiceId, action: "confirm" } })
        : { data: { skipped: true, reason: "future_due_date_manual_payment" }, error: null as any };
      if (fnError) { toast.success(isPartial ? "Baixa parcial realizada (erro ao sincronizar com Asaas)" : "Baixa local realizada (erro ao sincronizar com Asaas)"); }
      else if (data?.skipped) { toast.success(isPartial ? "Baixa parcial realizada localmente" : "Baixa realizada localmente"); }
      else { toast.success(isPartial ? "Baixa parcial realizada e sincronizada ✓" : "Baixa realizada e sincronizada com Asaas ✓"); }
      // Sync payment to Conta Azul
      const invAny = inv as any;
      if (invAny?.conta_azul_id) {
        syncPaymentToContaAzul(invAny.conta_azul_id, "receivable", today, paidNow ? paidNow / 100 : undefined);
      }
      // Send payment notification to subscribers
      const companyName = inv?.company_name || "Empresa";
      sendPaymentNotification(companyName, paidNow / 100, inv?.description);
      await loadData();
    } catch (err: any) {
      toast.error("Erro ao dar baixa: " + (err.message || "erro"));
    } finally {
      setProcessingInvoiceId(null);
      setConfirmDialog({ open: false, invoiceId: "", action: "confirm", description: "" });
      setManualFee(0);
      setManualDiscount(0);
      setManualInterest(0);
      setManualPaidAmount(undefined);
      setSelectedBankId("none");
    }
  };

  // Revert payment (estorno)
  const handleRevertPayment = async (invoiceId: string) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const inv = invoices.find(i => i.id === invoiceId);
      const invAny = inv as any;
      const bankId = invAny?.bank_id;
      const paidAmount = invAny?.paid_amount_cents || invAny?.amount_cents || 0;
      const feeCents = invAny?.payment_fee_cents || 0;
      const { error } = await supabase.from("company_invoices").update({ status: "pending", paid_at: null, paid_amount_cents: null, bank_id: null } as any).eq("id", invoiceId);
      if (error) throw error;
      if (bankId) {
        const netAmount = paidAmount - feeCents;
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: -netAmount });
        await supabase.from("financial_bank_transactions").insert({ bank_id: bankId, type: "debit", amount_cents: netAmount, description: `Estorno: ${inv?.description} (${inv?.installment_number}/${inv?.total_installments})`, reference_type: "invoice", reference_id: invoiceId } as any);
      }
      const { data, error: fnError } = await supabase.functions.invoke("asaas-confirm-payment", { body: { invoice_id: invoiceId, action: "revert" } });
      if (fnError) { toast.success("Estorno local realizado (erro ao sincronizar com Asaas)"); }
      else if (data?.skipped) { toast.success("Estorno realizado localmente"); }
      else { toast.success("Estorno realizado e sincronizado com Asaas ✓"); }
      await loadData();
    } catch (err: any) {
      toast.error("Erro ao estornar: " + (err.message || "erro"));
    } finally {
      setProcessingInvoiceId(null);
      setConfirmDialog({ open: false, invoiceId: "", action: "revert", description: "" });
    }
  };

  // Revert payable payment (estorno contas a pagar)
  const handleRevertPayable = async (payableId: string) => {
    setProcessingInvoiceId(payableId);
    try {
      const p = payables.find(p => p.id === payableId);
      const pAny = p as any;
      const bankId = pAny?.bank_id;
      const paidAmount = pAny?.paid_amount || pAny?.amount || 0;

      // Revert status to pending
      const todayStr = new Date().toLocaleDateString("en-CA");
      const newStatus = p?.due_date && p.due_date < todayStr ? "overdue" : "pending";
      const { error } = await supabase.from("financial_payables")
        .update({ status: newStatus, paid_amount: null, bank_id: null } as any)
        .eq("id", payableId);
      if (error) throw error;

      // Revert bank balance if paid via bank
      if (bankId && paidAmount > 0) {
        const amountCents = Math.round(paidAmount * 100);
        await supabase.rpc("increment_bank_balance" as any, { p_bank_id: bankId, p_amount: amountCents });
        await supabase.from("financial_bank_transactions").insert({
          bank_id: bankId, type: "credit", amount_cents: amountCents,
          description: `Estorno Pagável: ${p?.description}`,
          reference_type: "payable", reference_id: payableId,
        } as any);
      }

      toast.success("Estorno de pagável realizado com sucesso!");
      await loadData();
    } catch (err: any) {
      toast.error("Erro ao estornar: " + (err.message || "erro"));
    } finally {
      setProcessingInvoiceId(null);
      setConfirmDialog({ open: false, invoiceId: "", action: "revert_payable", description: "" });
    }
  };

  // Bank CRUD
  const handleSaveBank = async () => {
    try {
      const balanceCents = Math.round(parseFloat(bankForm.initial_balance || "0") * 100);
      if (!bankForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
      if (bankDialog.bank) {
        const oldInitialCents = bankDialog.bank.initial_balance_cents || 0;
        const diff = balanceCents - oldInitialCents;
        const newCurrentCents = (bankDialog.bank.current_balance_cents || 0) + diff;
        const { error } = await supabase.from("financial_banks").update({ name: bankForm.name, bank_code: bankForm.bank_code || null, agency: bankForm.agency || null, account_number: bankForm.account_number || null, initial_balance_cents: balanceCents, current_balance_cents: newCurrentCents } as any).eq("id", bankDialog.bank.id);
        if (error) throw error;
        toast.success("Banco atualizado");
      } else {
        const { error } = await supabase.from("financial_banks").insert({ name: bankForm.name, bank_code: bankForm.bank_code || null, agency: bankForm.agency || null, account_number: bankForm.account_number || null, initial_balance_cents: balanceCents, current_balance_cents: balanceCents } as any);
        if (error) throw error;
        toast.success("Banco cadastrado");
      }
      setBankDialog({ open: false, bank: null });
      setBankForm({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });
      await loadData();
    } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm("Excluir este banco?")) return;
    try {
      const { error } = await supabase.from("financial_banks").update({ is_active: false } as any).eq("id", bankId);
      if (error) throw error;
      toast.success("Banco removido");
      await loadData();
    } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
  };

  const handleBankTransfer = async () => {
    try {
      const amountNum = transferData.amount;
      if (!amountNum || amountNum <= 0) { toast.error("Informe um valor válido"); return; }
      const amountCents = Math.round(amountNum * 100);
      const fromBank = banks.find((b: any) => b.id === transferData.from_account_id);
      const toBank = banks.find((b: any) => b.id === transferData.to_account_id);
      if (!fromBank || !toBank) return;
      if (fromBank.id === toBank.id) { toast.error("Selecione bancos diferentes"); return; }

      const descOut = transferData.description || `Transferência para ${toBank.name}`;
      const descIn = transferData.description || `Transferência de ${fromBank.name}`;

      // Debit from source
      await supabase.rpc("increment_bank_balance" as any, { p_bank_id: fromBank.id, p_amount: -amountCents });
      await supabase.from("financial_bank_transactions").insert({
        bank_id: fromBank.id, type: "debit", amount_cents: amountCents,
        description: descOut, reference_type: "transfer",
      } as any);

      // Credit to destination
      await supabase.rpc("increment_bank_balance" as any, { p_bank_id: toBank.id, p_amount: amountCents });
      await supabase.from("financial_bank_transactions").insert({
        bank_id: toBank.id, type: "credit", amount_cents: amountCents,
        description: descIn, reference_type: "transfer",
      } as any);

      toast.success("Transferência realizada com sucesso!");
      setIsTransferDialogOpen(false);
      setTransferData({ from_account_id: "", to_account_id: "", amount: 0, description: "", transfer_date: format(new Date(), "yyyy-MM-dd") });
      await loadData();
    } catch (err: any) {
      console.error("Transfer error:", err);
      toast.error("Erro ao realizar transferência");
    }
  };

  // Bulk delete payables
  const handleBulkDeletePayables = async () => {
    const selected = payables.filter(p => selectedPayableIds.has(p.id));
    if (selected.length === 0) return;
    if (!confirm(`Excluir ${selected.length} lançamento(s) selecionado(s)?`)) return;
    setIsBulkPayableAction(true);
    try {
      const { error } = await supabase.from("financial_payables").delete().in("id", Array.from(selectedPayableIds));
      if (error) throw error;
      toast.success(`${selected.length} lançamento(s) excluído(s)`);
      setSelectedPayableIds(new Set());
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setIsBulkPayableAction(false);
    }
  };

  // Bulk confirm payment payables
  const handleBulkConfirmPayables = async () => {
    const selected = payables.filter(p => selectedPayableIds.has(p.id) && p.status !== "paid");
    if (selected.length === 0) { toast.error("Nenhum lançamento pendente selecionado"); return; }
    if (!confirm(`Dar baixa em ${selected.length} lançamento(s)?`)) return;
    setIsBulkPayableAction(true);
    try {
      const today = getLocalDateString();
      const { error } = await supabase.from("financial_payables")
        .update({ status: "paid", paid_at: today } as any)
        .in("id", selected.map(p => p.id));
      if (error) throw error;

      // Sync payments to Conta Azul (non-blocking)
      for (const item of selected) {
        const itemAny = item as any;
        if (itemAny.conta_azul_id) {
          syncPaymentToContaAzul(itemAny.conta_azul_id, "payable", today, item.amount);
        }
      }

      toast.success(`${selected.length} lançamento(s) confirmado(s) como pago(s)`);
      setSelectedPayableIds(new Set());
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setIsBulkPayableAction(false);
    }
  };

  // Save manual receivable
  const handleSaveReceivable = async () => {
    if ((!receivableForm.company_id && !receivableForm.custom_receiver_name) || !receivableForm.description || !receivableForm.amount || !receivableForm.due_date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSavingReceivable(true);
    try {
      const amountCents = Math.round(receivableForm.amount * 100);
      const { data: inserted, error } = await supabase.from("company_invoices").insert({
        company_id: receivableForm.company_id || null,
        custom_receiver_name: !receivableForm.company_id && receivableForm.custom_receiver_name ? receivableForm.custom_receiver_name : null,
        description: receivableForm.description,
        amount_cents: amountCents,
        due_date: receivableForm.due_date,
        notes: receivableForm.notes || null,
        category_id: receivableForm.category_id && receivableForm.category_id !== "none" ? receivableForm.category_id : null,
        cost_center_id: receivableForm.cost_center_id && receivableForm.cost_center_id !== "none" ? receivableForm.cost_center_id : null,
        status: "pending",
        installment_number: 1,
        total_installments: 1,
      } as any).select("id").single();
      if (error) throw error;

      // Sync to Conta Azul (non-blocking)
      const companyName = companies.find(c => c.id === receivableForm.company_id)?.name || receivableForm.custom_receiver_name || "";
      syncEntryToContaAzul("receivable", {
        description: receivableForm.description,
        amount: receivableForm.amount,
        due_date: receivableForm.due_date,
        client_name: companyName,
      }).then(contaAzulId => {
        if (contaAzulId && inserted?.id) {
          supabase.from("company_invoices")
            .update({ conta_azul_id: contaAzulId } as any)
            .eq("id", inserted.id).then(() => {});
        }
      });

      toast.success("Conta a receber lançada com sucesso");
      setReceivableDialog(false);
      setReceivableForm({ company_id: "", custom_receiver_name: "", description: "", amount: 0, due_date: "", notes: "", category_id: "", cost_center_id: "" });
      setShowCustomReceiverRecv(false);
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSavingReceivable(false);
    }
  };

  // Save manual payable
  const handleSavePayable = async () => {
    if (!payableForm.supplier_name || !payableForm.description || !payableForm.amount || !payableForm.due_date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSavingPayable(true);
    try {
      const now = new Date();
      const isWeekly = payableForm.recurrence_type === "weekly";
      const useBusinessDay = payableForm.due_date_mode === "business_day";
      const nthBusinessDay = parseInt(payableForm.business_day_number) || 5;
      const getMonthOffset = (t: string) => ({ monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[t] || 1);
      const totalEntries = payableForm.is_recurring ? (parseInt(payableForm.recurring_count) || 12) : 1;
      const monthOffset = payableForm.is_recurring && !isWeekly ? getMonthOffset(payableForm.recurrence_type) : 1;
      const payablesToInsert: any[] = [];
      const currentDueDate = new Date(payableForm.due_date + "T12:00:00");

      for (let i = 1; i <= totalEntries; i++) {
        let adjustedDate: Date;
        if (useBusinessDay && !isWeekly) {
          // Use Nth business day of the current month
          adjustedDate = getNthBusinessDayOfMonth(currentDueDate.getFullYear(), currentDueDate.getMonth(), nthBusinessDay);
        } else if (useBusinessDay && isWeekly) {
          adjustedDate = ensureBusinessDay(new Date(currentDueDate));
        } else {
          adjustedDate = new Date(currentDueDate);
        }
        const dueStr = `${adjustedDate.getFullYear()}-${String(adjustedDate.getMonth() + 1).padStart(2, "0")}-${String(adjustedDate.getDate()).padStart(2, "0")}`;
        const refMonth = payableForm.reference_month || `${currentDueDate.getFullYear()}-${String(currentDueDate.getMonth() + 1).padStart(2, "0")}`;
        payablesToInsert.push({
          supplier_name: payableForm.supplier_name,
          description: totalEntries > 1 ? `${payableForm.description} (${i}/${totalEntries})` : payableForm.description,
          amount: payableForm.amount,
          due_date: dueStr,
          reference_month: refMonth,
          notes: payableForm.notes || null,
          category_id: payableForm.category_id && payableForm.category_id !== "none" ? payableForm.category_id : null,
          cost_center_id: payableForm.cost_center_id && payableForm.cost_center_id !== "none" ? payableForm.cost_center_id : null,
          cost_type: payableForm.cost_type || null,
          is_recurring: payableForm.is_recurring,
          recurrence_type: payableForm.is_recurring ? payableForm.recurrence_type : null,
          installment_number: totalEntries > 1 ? i : null,
          total_installments: totalEntries > 1 ? totalEntries : null,
          status: "pending",
        });
        if (isWeekly) {
          currentDueDate.setDate(currentDueDate.getDate() + 7);
        } else {
          currentDueDate.setMonth(currentDueDate.getMonth() + monthOffset);
        }
      }

      const { data: inserted, error } = await supabase.from("financial_payables").insert(payablesToInsert as any).select("id");
      if (error) throw error;

      // Sync to Conta Azul (non-blocking)
      const firstInserted = inserted?.[0];
      syncEntryToContaAzul("payable", {
        description: payableForm.description,
        amount: payableForm.amount,
        due_date: payableForm.due_date,
        supplier_name: payableForm.supplier_name,
      }).then(contaAzulId => {
        if (contaAzulId && firstInserted?.id) {
          supabase.from("financial_payables")
            .update({ conta_azul_id: contaAzulId } as any)
            .eq("id", firstInserted.id).then(() => {});
        }
      });

      toast.success(totalEntries > 1 ? `${totalEntries} lançamentos criados com sucesso` : "Conta a pagar lançada com sucesso");
      setPayableDialog(false);
      setPayableForm({ supplier_name: "", description: "", amount: 0, due_date: "", reference_month: "", category_id: "", cost_center_id: "", notes: "", is_recurring: false, recurrence_type: "monthly", recurring_count: "12", due_date_mode: "calendar" as "calendar" | "business_day", business_day_number: "5", cost_type: "" as "" | "fixed" | "variable" });
      await loadData();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "erro"));
    } finally {
      setSavingPayable(false);
    }
  };


  const exportCSV = () => {
    let rows: string[][] = [];
    if (activeTab === "payables") {
      rows = [["Descrição", "Valor", "Vencimento", "Status", "Mês Ref", "Pago em"]];
      filteredPayables.forEach(p => {
        rows.push([p.description, formatCurrency(p.amount), p.due_date ? format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy") : "", statusLabel(p.status), p.reference_month, p.paid_at ? format(new Date(p.paid_at.substring(0, 10) + "T12:00:00"), "dd/MM/yyyy") : ""]);
      });
    } else if (activeTab === "recurring") {
      rows = [["Empresa", "Descrição", "Parcela", "Valor", "Vencimento", "Status", "Pago em", "Recebido"]];
      filteredInvoices.forEach(inv => {
        const base = inv.paid_amount_cents || (inv.status === "paid" ? inv.amount_cents : 0);
        const fee = (inv as any).payment_fee_cents || 0;
        const hasPaid = inv.status === "paid" || inv.status === "partial";
        const net = hasPaid ? (base - fee) : 0;
        rows.push([inv.company_name || "", inv.description, `${inv.installment_number}/${inv.total_installments}`, formatCurrencyCents(inv.amount_cents), inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "", statusLabel(inv.status, inv.due_date), inv.paid_at ? format(new Date(inv.paid_at.substring(0, 10) + "T12:00:00"), "dd/MM/yyyy") : "", hasPaid ? formatCurrencyCents(net) : ""]);
      });
    }
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: send WhatsApp message via Evolution or Official API
  const fetchWithRetry = async (url: string, options: RequestInit, retries = 2): Promise<Response> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw new Error("Falha na conexão após tentativas");
  };

  const sendWhatsAppMessage = async (phone: string, message: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    // Use configured default instance directly - skip status check
    const defaultInstanceName = await getDefaultWhatsAppInstance();
    
    try {
      const response = await fetchWithRetry(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ instanceName: defaultInstanceName, number: phone, text: message }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `HTTP ${response.status}`); }
      return;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message === 'Load failed') {
        throw new Error("Falha na conexão com o servidor WhatsApp. Tente novamente em alguns segundos.");
      }
      throw err;
    }
  };

  const financialMonths = useMemo(() => {
    const set = new Set<string>();
    payables.forEach(p => { if (p.reference_month) set.add(p.reference_month); });
    return Array.from(set).sort().reverse();
  }, [payables]);

  const invoiceSummary = useMemo(() => {
    const effectivelyOverdue = filteredInvoices.filter(i => isEffectivelyOverdue(i.status, i.due_date));
    const effectivelyPending = filteredInvoices.filter(i => (i.status === "pending" || i.status === "overdue") && !isEffectivelyOverdue(i.status, i.due_date));
    const pending = filteredInvoices.filter(i => i.status === "pending" || i.status === "overdue");
    const paid = filteredInvoices.filter(i => i.status === "paid" || i.status === "partial");
    const totalAll = filteredInvoices.reduce((s, i) => s + i.amount_cents, 0);
    return {
      totalAll,
      totalCount: filteredInvoices.length,
      totalPending: pending.reduce((s, i) => s + (isEffectivelyOverdue(i.status, i.due_date) ? i.total_with_fees_cents : i.amount_cents), 0),
      pendingCount: pending.length,
      totalPaid: paid.reduce((s, i) => {
        const base = i.paid_amount_cents || (i.status === "paid" ? i.amount_cents : 0);
        const fee = (i as any).payment_fee_cents || 0;
        return s + base - fee;
      }, 0),
      paidCount: paid.length,
      totalOverdue: effectivelyOverdue.reduce((s, i) => s + i.total_with_fees_cents, 0),
      overdueCount: effectivelyOverdue.length,
    };
  }, [filteredInvoices, todayStr]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter(item => !('isSeparator' in item && item.isSeparator) && hasPerm(item.permKey));
  const hasCfoAccess = DASHBOARD_CHILDREN.some(item => hasPerm(item.permKey));

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="flex min-w-0 items-center gap-2 text-base font-bold leading-tight">
              <Calculator className="h-4 w-4 shrink-0 text-primary" />
              Financeiro
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>
      )}

      {/* Mobile Sidebar Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Financeiro
            </SheetTitle>
          </SheetHeader>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 mb-2" onClick={() => { setSidebarOpen(false); navigate("/onboarding-tasks"); }}>
              <ArrowLeft className="h-4 w-4" />
              Nexus
            </Button>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              const hasChildren = 'children' in item && item.children;
              const isChildActive = hasChildren && (item as any).children.some((c: any) => activeTab === c.key);

              if (hasChildren) {
                return (
                  <div key={item.key}>
                    <button
                      onClick={() => {
                        setDashboardMenuOpen(!dashboardMenuOpen);
                        if (!isChildActive && !isActive) {
                          setActiveTab(item.key);
                          resetFilters();
                          setSidebarOpen(false);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                        (isActive || isChildActive)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{item.label}</span>
                      {dashboardMenuOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                    {dashboardMenuOpen && (
                      <div className="ml-3 pl-3 border-l border-border/50 mt-1 space-y-0.5">
                        {(item as any).children.filter((c: any) => hasPerm(c.permKey)).map((child: any) => {
                          const ChildIcon = child.icon;
                          const isChildItemActive = activeTab === child.key;
                          return (
                            <button
                              key={child.key}
                              onClick={() => { setActiveTab(child.key); resetFilters(); setSidebarOpen(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-colors text-left",
                                isChildItemActive
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.key}>
                  <button
                    onClick={() => { setActiveTab(item.key); resetFilters(); setSidebarOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 border-r bg-card flex-col sticky top-0 h-screen">
        <div className="p-4 border-b">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 -ml-2" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-4 w-4" />
            Nexus
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2 mt-3 px-1">
            <Calculator className="h-5 w-5 text-primary" />
            Financeiro
          </h1>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            const hasChildren = 'children' in item && item.children;
            const isChildActive = hasChildren && (item as any).children.some((c: any) => activeTab === c.key);

            if (hasChildren) {
              return (
                <div key={item.key}>
                  <button
                    onClick={() => {
                      setDashboardMenuOpen(!dashboardMenuOpen);
                      if (!isChildActive && !isActive) {
                        setActiveTab(item.key);
                        resetFilters();
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                      (isActive || isChildActive)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                    {dashboardMenuOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                  {dashboardMenuOpen && (
                    <div className="ml-3 pl-3 border-l border-border/50 mt-1 space-y-0.5">
                      {(item as any).children.filter((c: any) => hasPerm(c.permKey)).map((child: any) => {
                        const ChildIcon = child.icon;
                        const isChildItemActive = activeTab === child.key;
                        return (
                          <button
                            key={child.key}
                            onClick={() => { setActiveTab(child.key); resetFilters(); }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-colors text-left",
                              isChildItemActive
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={item.key}>
                <button
                  onClick={() => { setActiveTab(item.key); resetFilters(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-[1920px] mx-auto space-y-4 md:space-y-6">
          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <FinancialDashboardTab
              invoices={invoices}
              payables={payables}
              banks={banks}
              charges={charges}
              formatCurrency={formatCurrency}
              formatCurrencyCents={formatCurrencyCents}
              hasPerm={hasPerm}
            />
          )}

          {/* Contas a Receber */}
          {activeTab === "recurring" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowDownCircle className="h-5 w-5 text-primary" />
                  Contas a Receber
                </h2>
                {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_create) && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setImportReceivableOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar
                    </Button>
                    <Button size="sm" className="flex-1 sm:flex-none" onClick={() => {
                      setReceivableForm({ company_id: "", custom_receiver_name: "", description: "", amount: 0, due_date: "", notes: "", category_id: "", cost_center_id: "" });
                      setShowCustomReceiverRecv(false);
                      setReceivableDialog(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo
                    </Button>
                  </div>
                )}
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
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <SearchableSelect
                      value={selectedCompany}
                      onValueChange={setSelectedCompany}
                      options={[
                        { value: "all", label: "Todas as Empresas" },
                        ...companies.map(c => ({ value: c.id, label: c.name })),
                      ]}
                      placeholder="Empresa"
                    />
                    <MultiSelectFilter
                      options={[
                        { value: "pending", label: "Pendente" },
                        { value: "paid", label: "Pago" },
                        { value: "partial", label: "Pago Parcial" },
                        { value: "overdue", label: "Vencido" },
                        { value: "cancelled", label: "Cancelado" },
                      ]}
                      selected={selectedStatuses}
                      onChange={setSelectedStatuses}
                      placeholder="Status"
                      allLabel="Todos"
                    />
                    <SearchableSelect
                      value={selectedConsultant}
                      onValueChange={setSelectedConsultant}
                      options={[
                        { value: "all", label: "Todos os Consultores" },
                        ...consultants.map(s => ({ value: s.id, label: s.name })),
                      ]}
                      placeholder="Consultor"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 mt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground font-medium">Vencimento</span>
                      <PeriodNavigator
                        period={receivablePeriod}
                        offset={receivableOffset}
                        onPeriodChange={(p) => { setReceivablePeriod(p); setReceivableOffset(0); }}
                        onOffsetChange={setReceivableOffset}
                      />
                    </div>
                    <MultiSelectFilter
                      selected={selectedCategories}
                      onChange={setSelectedCategories}
                      placeholder="Categoria"
                      allLabel="Todas as Categorias"
                      options={staffCategories.filter((c: any) => c.type === "receita").map((c: any) => ({ value: c.id, label: c.name }))}
                    />
                    <MultiSelectFilter
                      selected={selectedCostCenters}
                      onChange={setSelectedCostCenters}
                      placeholder="Centro de Custo"
                      allLabel="Todos os Centros de Custo"
                      options={staffCostCenters.map((cc: any) => ({ value: cc.id, label: cc.name }))}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
                        </Button>
                      </PopoverTrigger>
                       <PopoverContent className="w-auto p-0" align="start">
                         <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} captionLayout="dropdown-buttons" fromYear={2024} toYear={2030} className={cn("p-3 pointer-events-auto")} />
                       </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
                        </Button>
                      </PopoverTrigger>
                       <PopoverContent className="w-auto p-0" align="start">
                         <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} captionLayout="dropdown-buttons" fromYear={2024} toYear={2030} className={cn("p-3 pointer-events-auto")} />
                       </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrencyCents(invoiceSummary.totalAll)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.totalCount} parcelas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A Receber</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrencyCents(invoiceSummary.totalPending)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.pendingCount} parcelas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recebido</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{formatCurrencyCents(invoiceSummary.totalPaid)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.paidCount} parcelas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencido</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrencyCents(invoiceSummary.totalOverdue)}</div>
                    <p className="text-xs text-muted-foreground">{invoiceSummary.overdueCount} parcelas</p>
                  </CardContent>
                </Card>
              </div>

              {/* Bulk action bar */}
              {selectedInvoiceIds.size > 0 && (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium">{selectedInvoiceIds.size} fatura(s) selecionada(s)</span>
                      <span className="text-sm">Total: <strong className="text-primary">{formatCurrencyCents(filteredInvoices.filter(inv => selectedInvoiceIds.has(inv.id)).reduce((sum, inv) => sum + (inv.status === "overdue" ? inv.total_with_fees_cents : inv.amount_cents), 0))}</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceIds(new Set())}>
                        Limpar seleção
                      </Button>
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={isBulkSending}
                        onClick={async () => {
                          setIsBulkSending(true);
                          try {
                            const selected = filteredInvoices.filter(inv => selectedInvoiceIds.has(inv.id) && inv.payment_link_url && inv.status !== "paid" && inv.status !== "cancelled");
                            if (selected.length === 0) { toast.error("Nenhuma fatura válida selecionada (precisam ter link e não estar pagas/canceladas)"); return; }

                            let sent = 0, failed = 0;
                            for (const inv of selected) {
                              const phoneRaw = inv.company_phone?.replace(/\D/g, "") || "";
                              if (!phoneRaw) { failed++; continue; }
                              const phone = phoneRaw.startsWith("55") ? phoneRaw : `55${phoneRaw}`;
                              const displayAmount = inv.status === "overdue" ? inv.total_with_fees_cents : inv.amount_cents;
                              const amountFormatted = formatCurrencyCents(displayAmount);
                              const dueDateFormatted = inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-";
                              const discountedAmount = (displayAmount * 0.95 / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                              const discountDateObj = inv.due_date ? new Date(new Date(inv.due_date + "T12:00:00").getTime() - 86400000) : null;
                              const discountDate = discountDateObj ? format(discountDateObj, "dd/MM/yyyy") : "";
                              const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                              const showDiscount = discountDateObj ? discountDateObj.getTime() >= todayStart.getTime() : false;
                              const installmentInfo = `\n📦 *Parcela:* ${inv.installment_number}/${inv.total_installments}`;
                              const customerName = inv.company_name || "";
                              const discountLine = showDiscount ? `\n\n🏷️ *Desconto de 5%* pagando até *${discountDate}*! Valor com desconto: *${discountedAmount}*` : "";
                              const msg = `Olá ${customerName}!\n\nSegue sua fatura:\n\n📄 *${inv.description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Vencimento:* ${dueDateFormatted}${installmentInfo}${discountLine}\n\n🔗 ${inv.payment_link_url}`;
                              try {
                                await sendWhatsAppMessage(phone, msg);
                                sent++;
                                await new Promise(r => setTimeout(r, 1500));
                              } catch { failed++; }
                            }
                            toast.success(`${sent} mensagem(ns) enviada(s)${failed > 0 ? `, ${failed} falha(s)` : ""}`);
                            setSelectedInvoiceIds(new Set());
                          } catch (err: any) {
                            toast.error(err.message || "Erro ao enviar em massa");
                          } finally {
                            setIsBulkSending(false);
                          }
                        }}>
                        {isBulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Enviar via WhatsApp
                      </Button>
                      <Button size="sm" variant="default" className="gap-1.5" disabled={isBulkSending}
                        onClick={async () => {
                          const selected = filteredInvoices.filter(inv => selectedInvoiceIds.has(inv.id) && inv.status !== "paid" && inv.status !== "cancelled");
                          if (selected.length === 0) { toast.error("Nenhuma fatura pendente selecionada"); return; }
                          if (!confirm(`Dar baixa em ${selected.length} fatura(s)?`)) return;
                          setIsBulkSending(true);
                          try {
                            const today = getLocalDateString();
                            for (const inv of selected) {
                              const paidAmount = inv.status === "overdue" ? inv.total_with_fees_cents : inv.amount_cents;
                              await supabase.from("company_invoices").update({
                                status: "paid", paid_at: today, paid_amount_cents: paidAmount, payment_fee_cents: 199,
                              } as any).eq("id", inv.id);
                              // Sync to Conta Azul
                              const invAny = inv as any;
                              if (invAny?.conta_azul_id) {
                                syncPaymentToContaAzul(invAny.conta_azul_id, "receivable", today, paidAmount ? paidAmount / 100 : undefined);
                              }
                            }
                            toast.success(`${selected.length} fatura(s) confirmada(s) como paga(s)`);
                            setSelectedInvoiceIds(new Set());
                            await loadData();
                          } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
                          finally { setIsBulkSending(false); }
                        }}>
                        <CheckCircle2 className="h-4 w-4" />
                        Dar Baixa
                      </Button>
                      {isMaster && (
                        <Button size="sm" variant="destructive" className="gap-1.5" disabled={isBulkSending}
                          onClick={async () => {
                            const ids = Array.from(selectedInvoiceIds);
                            if (!confirm(`Excluir ${ids.length} fatura(s)?`)) return;
                            setIsBulkSending(true);
                            try {
                              const legacyIds = invoices.filter(inv => ids.includes(inv.id) && inv.source_table === "company_invoices").map(inv => inv.id);
                              const centralIds = invoices.filter(inv => ids.includes(inv.id) && inv.source_table === "financial_receivables").map(inv => inv.id);
                              if (legacyIds.length > 0) {
                                const { error } = await supabase.from("company_invoices").delete().in("id", legacyIds);
                                if (error) throw error;
                              }
                              if (centralIds.length > 0) {
                                const { error } = await supabase.from("financial_receivables").delete().in("id", centralIds);
                                if (error) throw error;
                              }
                              toast.success(`${ids.length} fatura(s) excluída(s)`);
                              setSelectedInvoiceIds(new Set());
                              await loadData();
                            } catch (err: any) { toast.error("Erro: " + (err.message || "erro")); }
                            finally { setIsBulkSending(false); }
                          }}>
                          <Trash2 className="h-4 w-4" />
                          Excluir
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
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectablePaginatedInvoices.length > 0 && selectablePaginatedInvoices.every(inv => selectedInvoiceIds.has(inv.id))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedInvoiceIds(prev => {
                                    const next = new Set(prev);
                                    selectablePaginatedInvoices.forEach(inv => next.add(inv.id));
                                    return next;
                                  });
                                } else {
                                  setSelectedInvoiceIds(prev => {
                                    const next = new Set(prev);
                                    selectablePaginatedInvoices.forEach(inv => next.delete(inv.id));
                                    return next;
                                  });
                                }
                              }}
                              disabled={selectablePaginatedInvoices.length === 0}
                            />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("company")}><div className="flex items-center">Empresa<SortIcon column="company" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("description")}><div className="flex items-center">Descrição<SortIcon column="description" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="text-center cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("installment")}><div className="flex items-center justify-center">Parcela<SortIcon column="installment" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="text-right cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("value")}><div className="flex items-center justify-end">Valor<SortIcon column="value" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("due_date")}><div className="flex items-center">Vencimento<SortIcon column="due_date" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("status")}><div className="flex items-center">Status<SortIcon column="status" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleRecSort("paid_at")}><div className="flex items-center">Pago em<SortIcon column="paid_at" activeCol={recSortCol} /></div></TableHead>
                          <TableHead className="text-right">Recebido</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedInvoices.length === 0 ? (
                          <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhuma fatura encontrada</TableCell></TableRow>
                        ) : paginatedInvoices.map(inv => {
                          const isProcessing = processingInvoiceId === inv.id;
                          const displayAmount = inv.status === "overdue" ? inv.total_with_fees_cents : inv.amount_cents;
                          return (
                            <TableRow key={inv.id} className={cn(selectedInvoiceIds.has(inv.id) && "bg-emerald-50/50")}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedInvoiceIds.has(inv.id)}
                                  onCheckedChange={(checked) => {
                                    const next = new Set(selectedInvoiceIds);
                                    if (checked) { next.add(inv.id); } else { next.delete(inv.id); }
                                    setSelectedInvoiceIds(next);
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                <button
                                  type="button"
                                  className="text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                                  onClick={() => inv.company_id && navigate(`/onboarding-tasks/companies/${inv.company_id}?tab=financial`)}
                                  title="Ver financeiro da empresa"
                                >
                                  {inv.company_name}
                                </button>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-sm">{inv.description}</TableCell>
                              <TableCell className="text-center text-sm">{inv.installment_number}/{inv.total_installments}</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrencyCents(displayAmount)}</TableCell>
                              <TableCell className="text-sm">{inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                              <TableCell>
                                {(() => {
                                  const sd = getStatusDisplay(inv.status, inv.due_date);
                                  return (
                                    <Badge className={`gap-1 text-xs ${sd.className}`}>
                                      {sd.icon}
                                      {sd.label}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{inv.paid_at ? format(new Date(inv.paid_at.substring(0, 10) + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                              <TableCell className="text-right font-medium text-sm">
                                {(inv.status === "paid" || inv.status === "partial") ? (() => {
                                  const base = inv.paid_amount_cents || (inv.status === "paid" ? inv.amount_cents : 0);
                                  const fee = (inv as any).payment_fee_cents || 0;
                                  const net = base - fee;
                                  return <span className={inv.status === "partial" ? "text-amber-600" : "text-emerald-600"}>{formatCurrencyCents(net)}</span>;
                                })() : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  {inv.payment_link_url && inv.status !== "paid" && inv.status !== "cancelled" && (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar link de pagamento"
                                        onClick={() => { navigator.clipboard.writeText(inv.payment_link_url!); toast.success("Link copiado!"); }}>
                                        <Link2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" title="Enviar via WhatsApp"
                                        onClick={async () => {
                                          console.log("[WhatsApp Send] Button clicked for invoice:", inv.id, "company_phone:", inv.company_phone);
                                          const phoneRaw = inv.company_phone?.replace(/\D/g, "") || "";
                                          if (!phoneRaw) { toast.error("Telefone da empresa não cadastrado"); return; }
                                          const phone = phoneRaw.startsWith("55") ? phoneRaw : `55${phoneRaw}`;
                                          const amountFormatted = formatCurrencyCents(displayAmount);
                                          const dueDateFormatted = inv.due_date ? format(new Date(inv.due_date + "T12:00:00"), "dd/MM/yyyy") : "-";
                                          const discountedAmount = (displayAmount * 0.95 / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                                          const discountDateObj2 = inv.due_date ? new Date(new Date(inv.due_date + "T12:00:00").getTime() - 86400000) : null;
                                          const discountDate = discountDateObj2 ? format(discountDateObj2, "dd/MM/yyyy") : "";
                                          const todayStart2 = new Date(); todayStart2.setHours(0, 0, 0, 0);
                                          const showDiscount2 = discountDateObj2 ? discountDateObj2.getTime() >= todayStart2.getTime() : false;
                                          const installmentInfo = `\n📦 *Parcela:* ${inv.installment_number}/${inv.total_installments}`;
                                          const customerName = inv.company_name || "";
                                          const discountLine2 = showDiscount2 ? `\n\n🏷️ *Desconto de 5%* pagando até *${discountDate}*! Valor com desconto: *${discountedAmount}*` : "";
                                          const msg = `Olá ${customerName}!\n\nSegue sua fatura:\n\n📄 *${inv.description}*\n💰 *Valor:* ${amountFormatted}\n📅 *Vencimento:* ${dueDateFormatted}${installmentInfo}${discountLine2}\n\n🔗 ${inv.payment_link_url}`;
                                          console.log("[WhatsApp Send] Sending to:", phone, "msg length:", msg.length);
                                          toast.info("Enviando mensagem...");
                                          try {
                                            await sendWhatsAppMessage(phone, msg);
                                            toast.success("Link enviado via WhatsApp!");
                                          } catch (err: any) {
                                            console.error("[WhatsApp Send] Error:", err);
                                            toast.error(err.message || "Erro ao enviar WhatsApp");
                                          }
                                        }}>
                                        <Send className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}
                                  {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_confirm) && (
                                    <>
                                      {inv.source_table === "company_invoices" && inv.status !== "paid" && inv.status !== "cancelled" ? (
                                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" disabled={isProcessing}
                                          onClick={() => setConfirmDialog({ open: true, invoiceId: inv.id, action: "confirm", description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments}) - ${formatCurrencyCents(displayAmount)}` })}>
                                          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                          Baixa
                                        </Button>
                                      ) : inv.source_table === "company_invoices" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_receivables_revert) && inv.status === "paid" ? (
                                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isProcessing}
                                          onClick={() => setConfirmDialog({ open: true, invoiceId: inv.id, action: "revert", description: `${inv.company_name} - ${inv.description} (${inv.installment_number}/${inv.total_installments})` })}>
                                          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                                          Estornar
                                        </Button>
                                      ) : null}
                                    </>
                                  )}
                                  {!inv.recurring_charge_id && inv.status !== "paid" && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isProcessing}
                                      onClick={async () => {
                                        if (!confirm(`Excluir fatura avulsa "${inv.description}"?`)) return;
                                        try {
                                          const table = inv.source_table === "financial_receivables" ? "financial_receivables" : "company_invoices";
                                          const { error } = await supabase.from(table).delete().eq("id", inv.id);
                                          if (error) throw error;
                                          toast.success("Fatura excluída!");
                                          await loadData();
                                        } catch (err: any) { toast.error(err.message || "Erro ao excluir"); }
                                      }}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicar"
                                    onClick={() => {
                                      setReceivableForm({
                                        company_id: inv.company_id || "",
                                        custom_receiver_name: (inv as any).custom_receiver_name || "",
                                        description: inv.description,
                                        amount: inv.amount_cents / 100,
                                        due_date: inv.due_date || "",
                                        notes: (inv as any).notes || "",
                                        category_id: (inv as any).category_id || "",
                                        cost_center_id: (inv as any).cost_center_id || "",
                                      });
                                      setShowCustomReceiverRecv(!!(inv as any).custom_receiver_name);
                                      setReceivableDialog(true);
                                    }}>
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
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
                          <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p)}>
                            {p}
                          </Button>
                        )
                      )}
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Atrasados */}
          {activeTab === "overdue" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_overdue) && (
            <FinancialOverdueTab
              invoices={invoices}
              companies={companies}
              consultants={consultants}
              companyConsultantMap={companyConsultantMap}
              formatCurrencyCents={formatCurrencyCents}
              hasPerm={hasPerm}
              onConfirmPayment={handleManualPayment}
              processingInvoiceId={processingInvoiceId}
              setConfirmDialog={setConfirmDialog}
              banks={banks}
              loadData={loadData}
            />
          )}

          {/* Contas a Pagar */}
          {activeTab === "payables" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_payables_view) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-primary" />
                  Contas a Pagar
                </h2>
                {hasPerm(FINANCIAL_PERMISSION_KEYS.fin_payables_create) && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setImportPayableOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar
                    </Button>
                    <Button size="sm" className="flex-1 sm:flex-none" onClick={() => {
                      setPayableForm({ supplier_name: "", description: "", amount: 0, due_date: "", reference_month: "", category_id: "", cost_center_id: "", notes: "", is_recurring: false, recurrence_type: "monthly", recurring_count: "12", due_date_mode: "calendar" as "calendar" | "business_day", business_day_number: "5", cost_type: "" as "" | "fixed" | "variable" });
                      setPayableDialog(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo
                    </Button>
                  </div>
                )}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                    </div>
                    <MultiSelectFilter
                      options={[
                        { value: "pending", label: "Pendente" },
                        { value: "paid", label: "Pago" },
                        { value: "partial", label: "Pago Parcial" },
                        { value: "overdue", label: "Vencido" },
                        { value: "cancelled", label: "Cancelado" },
                      ]}
                      selected={selectedStatuses}
                      onChange={setSelectedStatuses}
                      placeholder="Status"
                      allLabel="Todos"
                    />
                    <MultiSelectFilter
                      selected={selectedPayableCategories}
                      onChange={setSelectedPayableCategories}
                      placeholder="Categoria"
                      allLabel="Todas as Categorias"
                      options={staffCategories.filter((c: any) => c.type === "despesa").map((c: any) => ({ value: c.id, label: c.name }))}
                    />
                    <MultiSelectFilter
                      selected={selectedPayableCostCenters}
                      onChange={setSelectedPayableCostCenters}
                      placeholder="Centro de Custo"
                      allLabel="Todos os Centros de Custo"
                      options={staffCostCenters.map((cc: any) => ({ value: cc.id, label: cc.name }))}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground font-medium">Vencimento</span>
                      <PeriodNavigator
                        period={payablePeriod}
                        offset={payableOffset}
                        onPeriodChange={(p) => { setPayablePeriod(p); setPayableOffset(0); }}
                        onOffsetChange={setPayableOffset}
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !payableDateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {payableDateFrom ? format(payableDateFrom, "dd/MM/yyyy") : "De"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={payableDateFrom} onSelect={setPayableDateFrom} locale={ptBR} captionLayout="dropdown-buttons" fromYear={2024} toYear={2030} className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !payableDateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {payableDateTo ? format(payableDateTo, "dd/MM/yyyy") : "Até"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={payableDateTo} onSelect={setPayableDateTo} locale={ptBR} captionLayout="dropdown-buttons" fromYear={2024} toYear={2030} className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(filteredPayables.reduce((s, p) => s + p.amount, 0))}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total a Pagar</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrency(filteredPayables.filter(p => p.status !== "paid").reduce((s, p) => s + p.amount, 0))}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pago</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{formatCurrency(filteredPayables.filter(p => p.status === "paid").reduce((s, p) => s + (p.paid_amount || p.amount), 0))}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencidos</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{formatCurrency(filteredPayables.filter(p => p.status !== "paid" && p.status !== "cancelled" && p.due_date && p.due_date < new Date().toISOString().split("T")[0]).reduce((s, p) => s + p.amount, 0))}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Bulk action bar - Payables */}
              {selectedPayableIds.size > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium">{selectedPayableIds.size} lançamento(s) selecionado(s)</span>
                      <span className="text-sm">Total: <strong className="text-primary">{formatCurrency(payables.filter(p => selectedPayableIds.has(p.id)).reduce((sum, p) => sum + p.amount, 0))}</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedPayableIds(new Set())}>
                        Limpar seleção
                      </Button>
                      <Button size="sm" variant="default" className="gap-1.5" disabled={isBulkPayableAction} onClick={handleBulkConfirmPayables}>
                        {isBulkPayableAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Dar Baixa
                      </Button>
                      {isMaster && (
                        <Button size="sm" variant="destructive" className="gap-1.5" disabled={isBulkPayableAction} onClick={handleBulkDeletePayables}>
                          {isBulkPayableAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Excluir
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={sortedPayables.length > 0 && sortedPayables.every(p => selectedPayableIds.has(p.id))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPayableIds(new Set(sortedPayables.map(p => p.id)));
                                } else {
                                  setSelectedPayableIds(new Set());
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("supplier")}><div className="flex items-center">Fornecedor<SortIcon column="supplier" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("description")}><div className="flex items-center">Descrição<SortIcon column="description" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="text-right cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("value")}><div className="flex items-center justify-end">Valor<SortIcon column="value" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("due_date")}><div className="flex items-center">Vencimento<SortIcon column="due_date" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("ref_month")}><div className="flex items-center">Mês Ref<SortIcon column="ref_month" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("status")}><div className="flex items-center">Status<SortIcon column="status" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="cursor-pointer select-none hover:bg-muted/80" onClick={() => togglePaySort("paid_at")}><div className="flex items-center">Pago em<SortIcon column="paid_at" activeCol={paySortCol} /></div></TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPayables.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                        ) : sortedPayables.map(p => (
                          <TableRow key={p.id} className={cn(selectedPayableIds.has(p.id) && "bg-primary/5")}>
                            <TableCell>
                              <Checkbox
                                checked={selectedPayableIds.has(p.id)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selectedPayableIds);
                                  if (checked) { next.add(p.id); } else { next.delete(p.id); }
                                  setSelectedPayableIds(next);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium max-w-[180px] truncate">{p.supplier_name || "-"}</TableCell>
                            <TableCell className="max-w-[250px] truncate">{p.description}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{p.due_date ? format(new Date(p.due_date + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                            <TableCell>{p.reference_month}</TableCell>
                            <TableCell>{(() => { const sd = getStatusDisplay(p.status, p.due_date); return <Badge className={`gap-1 text-xs ${sd.className}`}>{sd.icon}{sd.label}</Badge>; })()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(p.paid_at || (p as any).paid_date) ? format(new Date(((p.paid_at || (p as any).paid_date)! as string).substring(0, 10) + "T12:00:00"), "dd/MM/yyyy") : "-"}
                              {p.paid_amount && p.paid_amount < p.amount && (
                                <span className="block text-xs text-amber-600">{formatCurrency(p.paid_amount)} de {formatCurrency(p.amount)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {(p.status !== "paid" || (p.status === "paid" && p.paid_amount && p.paid_amount < p.amount)) && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Pagar"
                                    onClick={() => setPayablePaymentDialog({ open: true, payable: p })}>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                )}
                                {(p.status === "paid" || p.status === "partial") && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Estornar"
                                    onClick={() => setConfirmDialog({ open: true, invoiceId: p.id, action: "revert_payable", description: `${p.supplier_name || "Sem fornecedor"} - ${p.description} - ${formatCurrency(p.amount)}` })}>
                                    <Undo2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                                  onClick={() => setPayableEditDialog({ open: true, payable: p })}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {isMaster && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Excluir"
                                    onClick={async () => {
                                      if (!confirm(`Excluir "${p.description}"?`)) return;
                                      try {
                                        const { error } = await supabase.from("financial_payables").delete().eq("id", p.id);
                                        if (error) throw error;
                                        toast.success("Lançamento excluído");
                                        await loadData();
                                      } catch (err: any) {
                                        toast.error("Erro ao excluir: " + (err.message || "erro"));
                                      }
                                    }}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar"
                                  onClick={() => {
                                    setPayableForm(prev => ({
                                      ...prev,
                                      supplier_name: p.supplier_name || "",
                                      description: p.description,
                                      amount: p.amount,
                                      due_date: p.due_date || "",
                                      reference_month: p.reference_month || "",
                                      category_id: (p as any).category_id || "",
                                      cost_center_id: (p as any).cost_center_id || "",
                                      notes: (p as any).notes || "",
                                      is_recurring: false,
                                      recurring_count: "12",
                                    }));
                                    setPayableDialog(true);
                                  }}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Payment & Edit Dialogs */}
              <PayablePaymentDialog
                open={payablePaymentDialog.open}
                onOpenChange={(open) => setPayablePaymentDialog(s => ({ ...s, open }))}
                payable={payablePaymentDialog.payable}
                banks={banks}
                onSuccess={loadData}
              />
              <PayableEditDialog
                open={payableEditDialog.open}
                onOpenChange={(open) => setPayableEditDialog(s => ({ ...s, open }))}
                payable={payableEditDialog.payable}
                categories={staffCategories}
                costCenters={staffCostCenters}
                suppliers={financialSuppliers}
                onSuccess={loadData}
                onSuppliersRefresh={loadData}
              />
            </div>
          )}

          {/* Categories */}
          {activeTab === "categories" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_categories) && <FinancialCategoriesTab />}

          {/* DRE */}
          {activeTab === "dre" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_dre) && (
            <FinancialDRETab invoices={invoices} payables={payables} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}

          {/* DFC */}
          {activeTab === "dfc" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_dfc) && (
            <FinancialDFCTab invoices={invoices} payables={payables} banks={banks} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}

          {/* Bancos */}
          {activeTab === "banks" && hasPerm(FINANCIAL_PERMISSION_KEYS.fin_banks) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  Contas Bancárias
                </h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsTransferDialogOpen(true)} disabled={banks.length < 2}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferir
                  </Button>
                  <Button size="sm" onClick={() => {
                    setBankForm({ name: "", bank_code: "", agency: "", account_number: "", initial_balance: "" });
                    setBankDialog({ open: true, bank: null });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Banco
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {banks.map((bank: any) => (
                  <Card key={bank.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => { setStatementBank(bank); setIsStatementOpen(true); }}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Landmark className="h-4 w-4 text-primary" />
                          {bank.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                            e.stopPropagation();
                            setBankForm({ name: bank.name, bank_code: bank.bank_code || "", agency: bank.agency || "", account_number: bank.account_number || "", initial_balance: (bank.initial_balance_cents / 100).toString() });
                            setBankDialog({ open: true, bank });
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteBank(bank.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrencyCents(bank.current_balance_cents)}</div>
                      {bank.bank_code && <p className="text-xs text-muted-foreground mt-1">Banco: {bank.bank_code} | Ag: {bank.agency || "-"} | Conta: {bank.account_number || "-"}</p>}
                      <p className="text-xs text-muted-foreground">Saldo inicial: {formatCurrencyCents(bank.initial_balance_cents)}</p>
                    </CardContent>
                  </Card>
                ))}
                {banks.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Nenhum banco cadastrado. Clique em "Novo Banco" para começar.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* CFO Filter Bar */}
          {isCfoTab && (
            <CFOFilterBar filters={cfoFilters} onChange={setCfoFilters} staff={staffList} companies={companies} />
          )}

          {/* CFO Tabs */}
          {activeTab === "cfo-executive" && (
            <CFOExecutiveBoardTab invoices={cfoInvoices} payables={cfoPayables} banks={banks} companies={cfoCompanies} fullCompanies={fullCompanies} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-mrr" && (
            <CFORevenueMRRTab invoices={cfoInvoices} companies={cfoCompanies} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-churn" && (
            <CFOChurnRetentionTab invoices={cfoInvoices} companies={cfoCompanies} fullCompanies={fullCompanies} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-unit-economics" && (
            <CFOUnitEconomicsTab invoices={cfoInvoices} payables={cfoPayables} companies={cfoCompanies} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-costs" && (
            <CFOCostsStructureTab invoices={cfoInvoices} payables={cfoPayables} categories={staffCategories} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-cash" && (
            <CFOCashProjectionTab invoices={cfoInvoices} payables={cfoPayables} banks={banks} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-delinquency" && (
            <CFODelinquencyTab invoices={cfoInvoices} companies={cfoCompanies} filters={cfoFilters} formatCurrency={formatCurrency} formatCurrencyCents={formatCurrencyCents} />
          )}
          {activeTab === "cfo-ai" && (
            <CFOAIPanel />
          )}
          {activeTab === "billing-rules" && (
            <BillingRulesPanel />
          )}
          {activeTab === "suppliers" && (
            <SuppliersPanel />
          )}
          {activeTab === "inbox" && (
            <FinancialInboxPanel />
          )}
          {activeTab === "whatsapp-instance" && (
            <WhatsAppInstancePanel />
          )}
          {activeTab === "bank-statement" && (
            <BankStatementFullPanel />
          )}
          {activeTab === "nfse" && (
            <NfsePanel />
          )}
        </div>
      </main>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) { setConfirmDialog(prev => ({ ...prev, open: false })); setManualFee(0); setManualDiscount(0); setManualInterest(0); setManualPaidAmount(undefined); } }}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.action === "confirm" ? "Confirmar Baixa Manual" : "Confirmar Estorno"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "confirm"
                ? "Tem certeza que deseja dar baixa nesta parcela? A ação será sincronizada com o Asaas."
                : confirmDialog.action === "revert_payable"
                ? "Tem certeza que deseja estornar este pagamento? O lançamento voltará ao status pendente e o saldo bancário será revertido."
                : "Tem certeza que deseja estornar esta parcela? A ação será sincronizada com o Asaas."
              }
              <br />
              <strong className="block mt-2">{confirmDialog.description}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDialog.action === "confirm" && (() => {
            const inv = invoices.find(i => i.id === confirmDialog.invoiceId);
            const baseAmount = inv?.status === "overdue" ? inv?.total_with_fees_cents : inv?.amount_cents;
            const previouslyPaid = inv?.paid_amount_cents || 0;
            const remaining = (baseAmount || 0) - previouslyPaid;
            const discountCents = Math.round((manualDiscount || 0) * 100);
            const interestCents = Math.round((manualInterest || 0) * 100);
            const adjustedTotal = remaining - discountCents + interestCents;
            return (
              <div className="px-6 pb-2 space-y-3">
                {previouslyPaid > 0 && (
                  <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                    Já pago anteriormente: <strong>{formatCurrencyCents(previouslyPaid)}</strong> — Saldo restante: <strong>{formatCurrencyCents(remaining)}</strong>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Banco *</label>
                  <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({formatCurrencyCents(b.current_balance_cents)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Taxa (R$)</label>
                    <CurrencyInput value={manualFee} onChange={setManualFee} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground mt-0.5">Padrão: R$ 1,99</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Desconto (R$)</label>
                    <CurrencyInput value={manualDiscount} onChange={setManualDiscount} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground mt-0.5">Subtrai do valor</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Juros (R$)</label>
                    <CurrencyInput value={manualInterest} onChange={setManualInterest} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground mt-0.5">Soma ao valor</p>
                  </div>
                </div>
                <div className="pt-1 border-t">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Total ajustado:</span>
                    <span className="font-bold">{formatCurrencyCents(Math.max(0, adjustedTotal))}</span>
                  </div>
                  <label className="text-sm font-medium mb-1.5 block">Valor pago (R$)</label>
                  <CurrencyInput value={manualPaidAmount} onChange={setManualPaidAmount} placeholder={`${(Math.max(0, adjustedTotal) / 100).toFixed(2).replace('.', ',')} (total)`} />
                  <p className="text-xs text-muted-foreground mt-0.5">Deixe vazio para baixar o total. Informe um valor menor para baixa parcial.</p>
                </div>
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!processingInvoiceId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!processingInvoiceId}
              className={confirmDialog.action !== "confirm" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (confirmDialog.action === "confirm") {
                  const feeCents = Math.round((manualFee || 0) * 100);
                  const discountCents = Math.round((manualDiscount || 0) * 100);
                  const interestCents = Math.round((manualInterest || 0) * 100);
                  const customPaid = manualPaidAmount !== undefined && manualPaidAmount > 0 ? Math.round(manualPaidAmount * 100) : undefined;
                  if (selectedBankId === "none") {
                    toast.error("Selecione um banco para dar baixa");
                    return;
                  }
                  handleManualPayment(confirmDialog.invoiceId, feeCents, selectedBankId, discountCents, interestCents, customPaid);
                } else if (confirmDialog.action === "revert_payable") {
                  handleRevertPayable(confirmDialog.invoiceId);
                } else {
                  handleRevertPayment(confirmDialog.invoiceId);
                }
              }}>
              {processingInvoiceId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {confirmDialog.action === "confirm" ? "Confirmar Baixa" : "Confirmar Estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bank Dialog */}
      <AlertDialog open={bankDialog.open} onOpenChange={(open) => { if (!open) setBankDialog({ open: false, bank: null }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bankDialog.bank ? "Editar Banco" : "Novo Banco"}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome *</label>
              <Input value={bankForm.name} onChange={(e) => setBankForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Banco do Brasil" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Código</label>
                <Input value={bankForm.bank_code} onChange={(e) => setBankForm(p => ({ ...p, bank_code: e.target.value }))} placeholder="001" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Agência</label>
                <Input value={bankForm.agency} onChange={(e) => setBankForm(p => ({ ...p, agency: e.target.value }))} placeholder="1234" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Conta</label>
                <Input value={bankForm.account_number} onChange={(e) => setBankForm(p => ({ ...p, account_number: e.target.value }))} placeholder="12345-6" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Saldo Inicial (R$)</label>
              <Input type="number" step="0.01" value={bankForm.initial_balance} onChange={(e) => setBankForm(p => ({ ...p, initial_balance: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveBank}>{bankDialog.bank ? "Salvar" : "Cadastrar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receivable Dialog */}
      <Dialog open={receivableDialog} onOpenChange={setReceivableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Recebedor / Empresa *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0.5 px-2 text-xs"
                  onClick={() => {
                    setShowCustomReceiverRecv(!showCustomReceiverRecv);
                    if (!showCustomReceiverRecv) {
                      setReceivableForm(p => ({ ...p, company_id: "", custom_receiver_name: "" }));
                    } else {
                      setReceivableForm(p => ({ ...p, custom_receiver_name: "" }));
                    }
                  }}
                >
                  {showCustomReceiverRecv ? "Selecionar empresa" : "+ Novo recebedor"}
                </Button>
              </div>
              {showCustomReceiverRecv ? (
                <Input
                  value={receivableForm.custom_receiver_name}
                  onChange={(e) => setReceivableForm(p => ({ ...p, custom_receiver_name: e.target.value, company_id: "" }))}
                  placeholder="Digite o nome do recebedor"
                />
              ) : (
                <SearchableSelect
                  value={receivableForm.company_id}
                  onValueChange={(v) => setReceivableForm(p => ({ ...p, company_id: v }))}
                  options={companies.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="Pesquisar empresa..."
                  emptyMessage="Nenhuma empresa encontrada."
                />
              )}
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={receivableForm.description} onChange={(e) => setReceivableForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Consultoria mensal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <CurrencyInput value={receivableForm.amount} onChange={(v) => setReceivableForm(p => ({ ...p, amount: v }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input type="date" value={receivableForm.due_date} onChange={(e) => setReceivableForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={receivableForm.category_id} onValueChange={(v) => setReceivableForm(p => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {staffCategories.filter(c => c.type === "receita").map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select value={receivableForm.cost_center_id} onValueChange={(v) => setReceivableForm(p => ({ ...p, cost_center_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {staffCostCenters.map((cc: any) => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={receivableForm.notes} onChange={(e) => setReceivableForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivableDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveReceivable} disabled={savingReceivable}>
              {savingReceivable && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payable Dialog */}
      <Dialog open={payableDialog} onOpenChange={setPayableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Fornecedor *</Label>
              <SupplierAutocomplete
                value={payableForm.supplier_name}
                onChange={(v) => setPayableForm(p => ({ ...p, supplier_name: v }))}
                suppliers={financialSuppliers}
                onSupplierCreated={loadData}
              />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={payableForm.description} onChange={(e) => setPayableForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Aluguel do escritório" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <CurrencyInput value={payableForm.amount} onChange={(v) => setPayableForm(p => ({ ...p, amount: v }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input type="date" value={payableForm.due_date} onChange={(e) => setPayableForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <SearchableSelect
                  value={payableForm.category_id || "none"}
                  onValueChange={(v) => setPayableForm(p => ({ ...p, category_id: v }))}
                  options={staffCategories.filter((c: any) => c.type === "despesa").map((c: any) => ({ value: c.id, label: c.name }))}
                  placeholder="Pesquisar categoria..."
                  allowNone
                  noneLabel="Nenhuma"
                  emptyMessage="Nenhuma categoria encontrada."
                />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <SearchableSelect
                  value={payableForm.cost_center_id || "none"}
                  onValueChange={(v) => setPayableForm(p => ({ ...p, cost_center_id: v }))}
                  options={staffCostCenters.map((cc: any) => ({ value: cc.id, label: cc.name }))}
                  placeholder="Pesquisar centro de custo..."
                  allowNone
                  noneLabel="Nenhum"
                  emptyMessage="Nenhum centro de custo encontrado."
                />
              </div>
            </div>
            <div>
              <Label>Tipo de Custo</Label>
              <Select value={payableForm.cost_type} onValueChange={(v) => setPayableForm(p => ({ ...p, cost_type: v as "" | "fixed" | "variable" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Custo Fixo</SelectItem>
                  <SelectItem value="variable">Custo Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês Referência</Label>
                <Input type="month" value={payableForm.reference_month} onChange={(e) => setPayableForm(p => ({ ...p, reference_month: e.target.value }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={payableForm.notes} onChange={(e) => setPayableForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="payable_recurring"
                checked={payableForm.is_recurring}
                onCheckedChange={(checked) => setPayableForm(p => ({ ...p, is_recurring: checked as boolean }))}
              />
              <Label htmlFor="payable_recurring">Conta Recorrente</Label>
            </div>
            {payableForm.is_recurring && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                <div>
                  <Label>Frequência</Label>
                  <Select value={payableForm.recurrence_type} onValueChange={(v) => setPayableForm(p => ({ ...p, recurrence_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semiannual">Semestral</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Modo de vencimento</Label>
                  <Select value={payableForm.due_date_mode} onValueChange={(v: "calendar" | "business_day") => setPayableForm(p => ({ ...p, due_date_mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">Dia do calendário</SelectItem>
                      <SelectItem value="business_day">Dia útil (considera feriados)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {payableForm.due_date_mode === "business_day" && payableForm.recurrence_type !== "weekly" && (
                  <div>
                    <Label>Vencimento no Xº dia útil do mês</Label>
                    <Select value={payableForm.business_day_number} onValueChange={(v) => setPayableForm(p => ({ ...p, business_day_number: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 25 }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>{n}º dia útil</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Quantidade de lançamentos</Label>
                  <Input type="number" min="2" max="60" value={payableForm.recurring_count} onChange={(e) => setPayableForm(p => ({ ...p, recurring_count: e.target.value }))} />
                  {payableForm.amount > 0 && payableForm.recurring_count && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {payableForm.recurring_count}x de R$ {payableForm.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({payableForm.recurrence_type === "weekly" ? "semanal" : payableForm.recurrence_type === "monthly" ? "mensal" : payableForm.recurrence_type === "quarterly" ? "trimestral" : payableForm.recurrence_type === "semiannual" ? "semestral" : "anual"})
                      {payableForm.due_date_mode === "business_day" && ` • ${payableForm.business_day_number}º dia útil`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayableDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePayable} disabled={savingPayable}>
              {savingPayable && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Import Dialogs */}
      <FinancialImportDialog
        open={importReceivableOpen}
        onOpenChange={setImportReceivableOpen}
        type="receivable"
        companies={companies}
        categories={staffCategories}
        costCenters={staffCostCenters}
        onSuccess={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}
      />
      <FinancialImportDialog
        open={importPayableOpen}
        onOpenChange={setImportPayableOpen}
        type="payable"
        companies={companies}
        categories={staffCategories}
        costCenters={staffCostCenters}
        onSuccess={() => { setIsLoading(true); loadData().finally(() => setIsLoading(false)); }}
      />
      <BankTransactionsDialog
        bank={statementBank}
        open={isStatementOpen}
        onOpenChange={setIsStatementOpen}
        formatCurrencyCents={formatCurrencyCents}
      />
      {/* Transfer Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferência entre Contas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Conta de Origem</Label>
              <Select value={transferData.from_account_id} onValueChange={(v) => setTransferData(d => ({ ...d, from_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {banks.filter((b: any) => b.id !== transferData.to_account_id).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({formatCurrencyCents(b.current_balance_cents)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de Destino</Label>
              <Select value={transferData.to_account_id} onValueChange={(v) => setTransferData(d => ({ ...d, to_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {banks.filter((b: any) => b.id !== transferData.from_account_id).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({formatCurrencyCents(b.current_balance_cents)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <CurrencyInput value={transferData.amount} onChange={(v) => setTransferData(d => ({ ...d, amount: v }))} placeholder="0,00" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={transferData.transfer_date} onChange={(e) => setTransferData(d => ({ ...d, transfer_date: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input placeholder="Ex: Transferência operacional" value={transferData.description} onChange={(e) => setTransferData(d => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleBankTransfer} disabled={!transferData.from_account_id || !transferData.to_account_id || !transferData.amount}>
                Transferir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Daily Financial Summary Dialog */}
      <DailyFinancialSummaryDialog
        invoices={invoices}
        payables={payables}
        companies={companies}
        open={dailySummaryOpen}
        onOpenChange={setDailySummaryOpen}
      />
    </div>
  );
}
