import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, differenceInDays, addMonths, parseISO, startOfMonth, endOfMonth, isBefore, isWithinInterval, addQuarters, addYears, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  DollarSign,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  History,
  Search,
  Filter,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Company {
  id: string;
  name: string;
  contract_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  status: string;
  segment: string | null;
  renewal_plan_type: string | null;
  renewal_status: string | null;
  renewal_notes: string | null;
  renewal_meeting_date?: string | null;
  payment_method?: string | null;
}

const RENEWAL_STATUS_OPTIONS = [
  { value: "renovado", label: "Renovado", color: "bg-emerald-500", bgLight: "bg-emerald-50 dark:bg-emerald-950", textColor: "text-emerald-700 dark:text-emerald-300", icon: "✅" },
  { value: "encerrado", label: "Encerrado", color: "bg-rose-500", bgLight: "bg-rose-50 dark:bg-rose-950", textColor: "text-rose-700 dark:text-rose-300", icon: "❌" },
  { value: "em_negociacao", label: "Em negociação", color: "bg-amber-500", bgLight: "bg-amber-50 dark:bg-amber-950", textColor: "text-amber-700 dark:text-amber-300", icon: "🤝" },
  { value: "reuniao_agendada", label: "Agendado", color: "bg-violet-500", bgLight: "bg-violet-50 dark:bg-violet-950", textColor: "text-violet-700 dark:text-violet-300", icon: "📅" },
  { value: "vai_renovar", label: "Vai renovar", color: "bg-sky-500", bgLight: "bg-sky-50 dark:bg-sky-950", textColor: "text-sky-700 dark:text-sky-300", icon: "👍" },
  { value: "falta_pagar", label: "Falta pagar", color: "bg-orange-500", bgLight: "bg-orange-50 dark:bg-orange-950", textColor: "text-orange-700 dark:text-orange-300", icon: "💰" },
];

const PLAN_TYPE_OPTIONS = [
  { value: "monthly", label: "Mensal", months: null },
  { value: "quarterly", label: "Trimestral", months: 3 },
  { value: "semiannual", label: "Semestral", months: 6 },
  { value: "annual", label: "Anual", months: 12 },
];

interface Renewal {
  id: string;
  company_id: string;
  previous_end_date: string | null;
  new_end_date: string;
  previous_value: number | null;
  new_value: number;
  previous_term_months: number | null;
  new_term_months: number | null;
  renewal_date: string;
  notes: string | null;
  created_by: string | null;
  staff_name?: string;
}

interface ClosedProject {
  id: string;
  product_name: string;
  status: string;
  churn_date: string | null;
  churn_reason: string | null;
  churn_notes: string | null;
  company_name: string | null;
}

export default function OnboardingRenewalsPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [closedProjects, setClosedProjects] = useState<ClosedProject[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCS, setIsCS] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [periodType, setPeriodType] = useState<"monthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const [selectedPeriodStart, setSelectedPeriodStart] = useState(() => startOfMonth(new Date()));
  const [includePending, setIncludePending] = useState(true);

  // Calculate period end based on period type
  const getPeriodRange = (start: Date, type: typeof periodType) => {
    switch (type) {
      case "monthly":
        return { start: startOfMonth(start), end: endOfMonth(start) };
      case "quarterly":
        return { start: startOfQuarter(start), end: endOfQuarter(start) };
      case "semiannual":
        const semiStart = start.getMonth() < 6 
          ? new Date(start.getFullYear(), 0, 1) 
          : new Date(start.getFullYear(), 6, 1);
        const semiEnd = start.getMonth() < 6 
          ? new Date(start.getFullYear(), 5, 30) 
          : new Date(start.getFullYear(), 11, 31);
        return { start: semiStart, end: semiEnd };
      case "annual":
        return { start: startOfYear(start), end: endOfYear(start) };
      default:
        return { start: startOfMonth(start), end: endOfMonth(start) };
    }
  };

  const currentPeriodRange = getPeriodRange(selectedPeriodStart, periodType);

  const handlePeriodTypeChange = (newType: typeof periodType) => {
    setPeriodType(newType);
    // Recalculate start based on new period type
    const now = new Date();
    switch (newType) {
      case "monthly":
        setSelectedPeriodStart(startOfMonth(now));
        break;
      case "quarterly":
        setSelectedPeriodStart(startOfQuarter(now));
        break;
      case "semiannual":
        setSelectedPeriodStart(now.getMonth() < 6 ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), 6, 1));
        break;
      case "annual":
        setSelectedPeriodStart(startOfYear(now));
        break;
    }
  };

  const navigatePeriod = (direction: "prev" | "next") => {
    const multiplier = direction === "prev" ? -1 : 1;
    switch (periodType) {
      case "monthly":
        setSelectedPeriodStart(prev => addMonths(prev, multiplier));
        break;
      case "quarterly":
        setSelectedPeriodStart(prev => addQuarters(prev, multiplier));
        break;
      case "semiannual":
        setSelectedPeriodStart(prev => addMonths(prev, 6 * multiplier));
        break;
      case "annual":
        setSelectedPeriodStart(prev => addYears(prev, multiplier));
        break;
    }
  };

  const formatPeriodLabel = () => {
    const { start, end } = currentPeriodRange;
    switch (periodType) {
      case "monthly":
        return format(start, "MMMM yyyy", { locale: ptBR });
      case "quarterly":
        const quarter = Math.ceil((start.getMonth() + 1) / 3);
        return `${quarter}º Trimestre ${format(start, "yyyy")}`;
      case "semiannual":
        const semester = start.getMonth() < 6 ? "1º" : "2º";
        return `${semester} Semestre ${format(start, "yyyy")}`;
      case "annual":
        return format(start, "yyyy");
      default:
        return "";
    }
  };
  
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyRenewals, setCompanyRenewals] = useState<Renewal[]>([]);

  // Meeting date dialog (for renewal status: reuniao_agendada)
  const [meetingDateDialogOpen, setMeetingDateDialogOpen] = useState(false);
  const [meetingDateCompanyId, setMeetingDateCompanyId] = useState<string | null>(null);
  const [meetingDateValue, setMeetingDateValue] = useState<string>("");

  const [renewForm, setRenewForm] = useState({
    newValue: "",
    termMonths: "12",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Edit churn date dialog
  const [editChurnDateDialogOpen, setEditChurnDateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ClosedProject | null>(null);
  const [newChurnDate, setNewChurnDate] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/onboarding-login");
      return;
    }

    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staff) {
      navigate("/onboarding-login");
      return;
    }

    // Allow admin and cs to access this page
    if (staff.role !== "admin" && staff.role !== "cs") {
      toast.error("Acesso restrito");
      navigate("/onboarding-tasks");
      return;
    }

    setStaffId(staff.id);
    setUserRole(staff.role);
    setIsAdmin(staff.role === "admin");
    setIsCS(staff.role === "cs");
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch companies with contract info
    const { data: companiesData, error: companiesError } = await supabase
      .from("onboarding_companies")
      .select("id, name, contract_value, contract_start_date, contract_end_date, status, segment, renewal_plan_type, renewal_status, renewal_notes, renewal_meeting_date, payment_method")
      .order("contract_end_date", { ascending: true, nullsFirst: false });

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      toast.error("Erro ao carregar empresas");
    } else {
      setCompanies(companiesData || []);
    }

    // Fetch all renewals with staff names
    const { data: renewalsData, error: renewalsError } = await supabase
      .from("onboarding_contract_renewals")
      .select(`
        *,
        staff:created_by(name)
      `)
      .order("renewal_date", { ascending: false });

    if (renewalsError) {
      console.error("Error fetching renewals:", renewalsError);
    } else {
      const formattedRenewals = (renewalsData || []).map((r: any) => ({
        ...r,
        staff_name: r.staff?.name || "Sistema",
      }));
      setRenewals(formattedRenewals);
    }

    // Fetch closed/churned projects
    const { data: projectsData, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        product_name,
        status,
        churn_date,
        churn_reason,
        churn_notes,
        onboarding_company:onboarding_company_id(name)
      `)
      .in("status", ["closed", "completed"])
      .order("churn_date", { ascending: false, nullsFirst: false });

    if (projectsError) {
      console.error("Error fetching closed projects:", projectsError);
    } else {
      const formattedProjects = (projectsData || []).map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        status: p.status,
        churn_date: p.churn_date,
        churn_reason: p.churn_reason,
        churn_notes: p.churn_notes,
        company_name: p.onboarding_company?.name || null,
      }));
      setClosedProjects(formattedProjects);
    }

    setLoading(false);
  };

  const getContractStatus = (endDate: string | null) => {
    if (!endDate) return { label: "Sem data", color: "secondary" as const, priority: 3 };
    
    const daysUntilEnd = differenceInDays(parseISO(endDate), new Date());
    
    if (daysUntilEnd < 0) {
      return { label: "Vencido", color: "destructive" as const, priority: 0 };
    } else if (daysUntilEnd <= 30) {
      return { label: "Vence em breve", color: "destructive" as const, priority: 1 };
    } else if (daysUntilEnd <= 60) {
      return { label: "Atenção", color: "outline" as const, priority: 2 };
    }
    return { label: "Ativo", color: "default" as const, priority: 4 };
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openRenewDialog = (company: Company) => {
    setSelectedCompany(company);
    setRenewForm({
      newValue: company.contract_value?.toString() || "",
      termMonths: "12",
      notes: "",
    });
    setRenewDialogOpen(true);
  };

  const openHistoryDialog = async (company: Company) => {
    setSelectedCompany(company);
    const companyHistory = renewals.filter(r => r.company_id === company.id);
    setCompanyRenewals(companyHistory);
    setHistoryDialogOpen(true);
  };

  const openEditChurnDateDialog = (project: ClosedProject) => {
    setSelectedProject(project);
    setNewChurnDate(project.churn_date || "");
    setEditChurnDateDialogOpen(true);
  };

  const handleSaveChurnDate = async () => {
    if (!selectedProject || !newChurnDate) {
      toast.error("Selecione uma data válida");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ churn_date: newChurnDate })
        .eq("id", selectedProject.id);

      if (error) throw error;

      toast.success("Data de encerramento atualizada");
      setEditChurnDateDialogOpen(false);
      setSelectedProject(null);
      fetchData();
    } catch (error) {
      console.error("Error updating churn date:", error);
      toast.error("Erro ao atualizar data de encerramento");
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async () => {
    if (!selectedCompany || !staffId) return;
    
    const newValue = parseFloat(renewForm.newValue);
    if (isNaN(newValue) || newValue <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const termMonths = parseInt(renewForm.termMonths);
    if (isNaN(termMonths) || termMonths <= 0) {
      toast.error("Informe um prazo válido");
      return;
    }

    setSaving(true);

    try {
      // Calculate new end date
      const currentEndDate = selectedCompany.contract_end_date 
        ? parseISO(selectedCompany.contract_end_date)
        : new Date();
      const newEndDate = addMonths(currentEndDate > new Date() ? currentEndDate : new Date(), termMonths);

      // Insert renewal record
      const { error: renewalError } = await supabase
        .from("onboarding_contract_renewals")
        .insert({
          company_id: selectedCompany.id,
          previous_end_date: selectedCompany.contract_end_date,
          new_end_date: format(newEndDate, "yyyy-MM-dd"),
          previous_value: selectedCompany.contract_value,
          new_value: newValue,
          new_term_months: termMonths,
          notes: renewForm.notes || null,
          created_by: staffId,
        });

      if (renewalError) throw renewalError;

      // Update company contract info
      const { error: companyError } = await supabase
        .from("onboarding_companies")
        .update({
          contract_end_date: format(newEndDate, "yyyy-MM-dd"),
          contract_value: newValue,
        })
        .eq("id", selectedCompany.id);

      if (companyError) throw companyError;

      toast.success("Contrato renovado com sucesso!");
      setRenewDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error renewing contract:", error);
      toast.error("Erro ao renovar contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateContract = async (companyId: string, field: string, value: any) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ [field]: value })
        .eq("id", companyId);

      if (error) throw error;
      
      setCompanies(prev => prev.map(c => 
        c.id === companyId ? { ...c, [field]: value } : c
      ));
      toast.success("Contrato atualizado");
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Erro ao atualizar contrato");
    }
  };

  // Only update local state - plan type will only be saved when clicking "Renovar"
  const handlePlanTypeChange = (companyId: string, planType: string) => {
    if (!isAdmin) return;
    
    // Only update local state, do NOT save to database automatically
    setCompanies(prev => prev.map(c => 
      c.id === companyId ? { ...c, renewal_plan_type: planType } : c
    ));
  };

  const handleRenewalStatusChange = async (companyId: string, status: string) => {
    if (!isAdmin) return;

    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    // If status is "reuniao_agendada", ask for meeting date first
    if (status === "reuniao_agendada") {
      setMeetingDateCompanyId(companyId);
      setMeetingDateValue(company.renewal_meeting_date || "");
      setMeetingDateDialogOpen(true);
      return;
    }

    try {
      // If status is "renovado" and there's a value and plan, auto-update
      if (status === "renovado" && company.contract_value) {
        const plan = PLAN_TYPE_OPTIONS.find(p => p.value === (company.renewal_plan_type || "monthly"));
        if (plan && plan.months) {
          const startDate = new Date();
          const newEndDate = format(addMonths(startDate, plan.months), "yyyy-MM-dd");

          // Insert renewal record
          await supabase.from("onboarding_contract_renewals").insert({
            company_id: companyId,
            previous_end_date: company.contract_end_date,
            new_end_date: newEndDate,
            previous_value: company.contract_value,
            new_value: company.contract_value,
            new_term_months: plan.months,
            notes: "Renovação automática via status",
            created_by: staffId,
          });

          await supabase
            .from("onboarding_companies")
            .update({
              renewal_status: status,
              renewal_meeting_date: null,
              contract_start_date: format(startDate, "yyyy-MM-dd"),
              contract_end_date: newEndDate
            })
            .eq("id", companyId);

          setCompanies(prev => prev.map(c =>
            c.id === companyId ? {
              ...c,
              renewal_status: status,
              renewal_meeting_date: null,
              contract_start_date: format(startDate, "yyyy-MM-dd"),
              contract_end_date: newEndDate
            } : c
          ));
        } else {
          // Monthly plan - no end date
          await supabase
            .from("onboarding_companies")
            .update({ renewal_status: status, renewal_meeting_date: null, contract_end_date: null })
            .eq("id", companyId);

          setCompanies(prev => prev.map(c =>
            c.id === companyId ? { ...c, renewal_status: status, renewal_meeting_date: null, contract_end_date: null } : c
          ));
        }
        toast.success("Contrato renovado!");
        fetchData();
        return;
      }

      // If status is "encerrado", close project and inactivate company
      if (status === "encerrado") {
        // Update company status to inactive
        await supabase
          .from("onboarding_companies")
          .update({ status: "inactive", renewal_status: status, renewal_meeting_date: null })
          .eq("id", companyId);

        // Close all active projects for this company
        await supabase
          .from("onboarding_projects")
          .update({ status: "closed", churn_date: format(new Date(), "yyyy-MM-dd") })
          .eq("onboarding_company_id", companyId)
          .eq("status", "active");

        setCompanies(prev => prev.map(c =>
          c.id === companyId ? { ...c, renewal_status: status, renewal_meeting_date: null, status: "inactive" } : c
        ));
        toast.success("Empresa encerrada e projetos fechados");
        fetchData();
        return;
      }

      // Normal status update
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ renewal_status: status, renewal_meeting_date: null })
        .eq("id", companyId);

      if (error) throw error;

      setCompanies(prev => prev.map(c =>
        c.id === companyId ? { ...c, renewal_status: status, renewal_meeting_date: null } : c
      ));
      toast.success("Status atualizado");
    } catch (error) {
      console.error("Error updating renewal status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleSaveMeetingDate = async () => {
    if (!meetingDateCompanyId || !meetingDateValue) {
      toast.error("Selecione a data da reunião");
      return;
    }

    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({
          renewal_status: "reuniao_agendada",
          renewal_meeting_date: meetingDateValue,
        })
        .eq("id", meetingDateCompanyId);

      if (error) throw error;

      setCompanies(prev => prev.map(c =>
        c.id === meetingDateCompanyId
          ? { ...c, renewal_status: "reuniao_agendada", renewal_meeting_date: meetingDateValue }
          : c
      ));

      toast.success("Reunião agendada");
      setMeetingDateDialogOpen(false);
      setMeetingDateCompanyId(null);
      setMeetingDateValue("");
    } catch (error) {
      console.error("Error saving meeting date:", error);
      toast.error("Erro ao salvar data da reunião");
    }
  };

  const handleRenewalNotesChange = async (companyId: string, notes: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ renewal_notes: notes })
        .eq("id", companyId);

      if (error) throw error;
      
      setCompanies(prev => prev.map(c => 
        c.id === companyId ? { ...c, renewal_notes: notes } : c
      ));
      toast.success("Observações salvas");
    } catch (error) {
      console.error("Error updating notes:", error);
      toast.error("Erro ao salvar observações");
    }
  };

  const filteredCompanies = companies.filter(company => {
    // Exclude inactive companies
    if (company.status === "inactive") return false;

    // Only show contracts paid by card (same source of truth as Relatório de Empresas)
    if (company.payment_method !== "card") return false;

    // Only companies with a defined contract end date require renewal
    if (!company.contract_end_date) return false;

    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase());

    // Period filter logic
    const endDate = parseISO(company.contract_end_date);
    const { start: periodStart, end: periodEnd } = currentPeriodRange;

    // Check if contract ends in selected period
    const endsInSelectedPeriod = isWithinInterval(endDate, { start: periodStart, end: periodEnd });

    // Check if it's a pending renewal from previous periods (expired before selected period)
    const isPendingFromPast = includePending && isBefore(endDate, periodStart);

    const matchesPeriod = endsInSelectedPeriod || isPendingFromPast;

    if (!matchesPeriod) return false;

    // Status filter
    if (filterStatus === "all") return matchesSearch;

    const status = getContractStatus(company.contract_end_date);
    if (filterStatus === "expired") return matchesSearch && status.label === "Vencido";
    if (filterStatus === "soon") return matchesSearch && (status.label === "Vence em breve" || status.label === "Atenção");
    if (filterStatus === "active") return matchesSearch && status.label === "Ativo";
    if (filterStatus === "no_date") return matchesSearch && status.label === "Sem data";

    return matchesSearch;
  }).sort((a, b) => {
    const statusA = getContractStatus(a.contract_end_date);
    const statusB = getContractStatus(b.contract_end_date);
    return statusA.priority - statusB.priority;
  });

  // Count pending from previous periods
  const pendingFromPastCount = companies.filter(c => {
    if (c.status === "inactive") return false;
    if (c.payment_method !== "card") return false;
    if (!c.contract_end_date) return false;
    const endDate = parseISO(c.contract_end_date);
    return isBefore(endDate, currentPeriodRange.start);
  }).length;

  // Stats based on filtered companies
  const stats = {
    total: filteredCompanies.length,
    expired: filteredCompanies.filter(c => getContractStatus(c.contract_end_date).label === "Vencido").length,
    soon: filteredCompanies.filter(c => ["Vence em breve", "Atenção"].includes(getContractStatus(c.contract_end_date).label)).length,
    active: filteredCompanies.filter(c => getContractStatus(c.contract_end_date).label === "Ativo").length,
    totalValue: filteredCompanies.reduce((sum, c) => sum + (c.contract_value || 0), 0),
    pendingFromPast: pendingFromPastCount,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader title="Renovações" />
            </div>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className={`grid gap-4 ${isCS ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"}`}>
          <Card className="border-l-4 border-l-slate-500 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <Building2 className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
                  <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-rose-200 dark:bg-rose-800">
                  <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-rose-500 uppercase tracking-wide">Vencidos</p>
                  <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{stats.expired}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-200 dark:bg-amber-800">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">Vencendo</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.soon}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-200 dark:bg-emerald-800">
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-500 uppercase tracking-wide">Ativos</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Hide value card for CS */}
          {!isCS && (
            <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-cyan-200 dark:bg-cyan-800">
                    <DollarSign className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-cyan-500 uppercase tracking-wide">Valor Total</p>
                    <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(stats.totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Period Type Selector */}
                <Select value={periodType} onValueChange={(v) => handlePeriodTypeChange(v as typeof periodType)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>

                {/* Period Navigator */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigatePeriod("prev")}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[160px] text-center font-medium capitalize">
                    {formatPeriodLabel()}
                  </div>
                  <Button variant="outline" size="icon" onClick={() => navigatePeriod("next")}>
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </Button>
                </div>
                
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="expired">Vencidos</SelectItem>
                      <SelectItem value="soon">Vencendo em breve</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="no_date">Sem data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Include pending toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includePending"
                  checked={includePending}
                  onChange={(e) => setIncludePending(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="includePending" className="text-sm text-muted-foreground cursor-pointer">
                  Incluir pendências de períodos anteriores
                  {stats.pendingFromPast > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {stats.pendingFromPast} pendentes
                    </Badge>
                  )}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos ({filteredCompanies.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b-2 border-primary/20">
                      <TableHead className="w-[220px] font-bold text-slate-700 dark:text-slate-200">🏢 Empresa</TableHead>
                      {/* Hide value column for CS */}
                      {!isCS && <TableHead className="w-[120px] font-bold text-slate-700 dark:text-slate-200">💵 Valor</TableHead>}
                      <TableHead className="w-[110px] font-bold text-slate-700 dark:text-slate-200">📋 Plano</TableHead>
                      <TableHead className="w-[100px] font-bold text-slate-700 dark:text-slate-200">📆 Término</TableHead>
                      <TableHead className="w-[120px] font-bold text-slate-700 dark:text-slate-200">📊 Contrato</TableHead>
                      <TableHead className="w-[180px] font-bold text-slate-700 dark:text-slate-200">🔄 Status</TableHead>
                      <TableHead className="w-[50px] font-bold text-slate-700 dark:text-slate-200">💬</TableHead>
                      <TableHead className="w-[100px] text-right font-bold text-slate-700 dark:text-slate-200">⚡ Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company, index) => {
                      const status = getContractStatus(company.contract_end_date);
                      const renewalStatusOption = RENEWAL_STATUS_OPTIONS.find(s => s.value === company.renewal_status);
                      const planOption = PLAN_TYPE_OPTIONS.find(p => p.value === company.renewal_plan_type);

                      // Row background based on status
                      const getRowBg = () => {
                        if (status.label === "Vencido") return "bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/50";
                        if (status.label === "Vence em breve") return "bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-950/50";
                        if (status.label === "Atenção") return "bg-orange-50/50 dark:bg-orange-950/30 hover:bg-orange-100/70 dark:hover:bg-orange-950/50";
                        return index % 2 === 0 ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700";
                      };

                      return (
                        <TableRow key={company.id} className={`${getRowBg()} transition-colors border-b border-slate-200 dark:border-slate-700`}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                              </div>
                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100" title={company.name}>
                                {company.name}
                              </span>
                            </div>
                          </TableCell>
                          {/* Hide value cell for CS */}
                          {!isCS && (
                            <TableCell className="py-3">
                              {isAdmin ? (
                                <Input
                                  type="number"
                                  value={company.contract_value || ""}
                                  onChange={(e) => handleUpdateContract(
                                    company.id,
                                    "contract_value",
                                    e.target.value ? parseFloat(e.target.value) : null
                                  )}
                                  className="w-full h-8 text-sm font-medium border-emerald-200 focus:border-emerald-500"
                                  placeholder="Valor"
                                />
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                  {formatCurrency(company.contract_value)}
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="py-3">
                            {isAdmin ? (
                              <Select
                                value={company.renewal_plan_type || "monthly"}
                                onValueChange={(v) => handlePlanTypeChange(company.id, v)}
                              >
                                <SelectTrigger className="w-full h-8 text-sm bg-white dark:bg-slate-800">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  {PLAN_TYPE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className="font-medium">{planOption?.label || "Mensal"}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {company.renewal_plan_type === "monthly" ? (
                              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-300">🔁 Recorrente</Badge>
                            ) : company.contract_end_date ? (
                              <span className="text-sm font-medium">{format(parseISO(company.contract_end_date), "dd/MM/yyyy")}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {status.label === "Vencido" && (
                              <Badge className="bg-gradient-to-r from-rose-500 to-red-600 text-white border-0 shadow-sm">
                                🚨 {status.label}
                              </Badge>
                            )}
                            {status.label === "Vence em breve" && (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm">
                                ⚠️ {status.label}
                              </Badge>
                            )}
                            {status.label === "Atenção" && (
                              <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 shadow-sm">
                                👀 {status.label}
                              </Badge>
                            )}
                            {status.label === "Ativo" && (
                              <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-sm">
                                ✅ {status.label}
                              </Badge>
                            )}
                            {status.label === "Sem data" && (
                              <Badge variant="secondary" className="text-slate-500">
                                ❓ {status.label}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {isAdmin ? (
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={company.renewal_status || "em_negociacao"}
                                  onValueChange={(v) => handleRenewalStatusChange(company.id, v)}
                                >
                                  <SelectTrigger className={`w-full h-9 text-sm font-medium border-2 ${
                                    RENEWAL_STATUS_OPTIONS.find(s => s.value === (company.renewal_status || "em_negociacao"))?.bgLight || "bg-slate-50"
                                  } ${
                                    RENEWAL_STATUS_OPTIONS.find(s => s.value === (company.renewal_status || "em_negociacao"))?.textColor || "text-slate-700"
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">
                                        {RENEWAL_STATUS_OPTIONS.find(s => s.value === (company.renewal_status || "em_negociacao"))?.icon || "🔄"}
                                      </span>
                                      <span className="truncate text-sm font-semibold">
                                        {RENEWAL_STATUS_OPTIONS.find(s => s.value === (company.renewal_status || "em_negociacao"))?.label || "Em negociação"}
                                      </span>
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover z-50 min-w-[200px] border-2">
                                    {RENEWAL_STATUS_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value} className={`${opt.bgLight} ${opt.textColor} font-medium my-0.5 rounded-md`}>
                                        <div className="flex items-center gap-2">
                                          <span className="text-base">{opt.icon}</span>
                                          <span className="font-semibold">{opt.label}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {company.renewal_status === "reuniao_agendada" && company.renewal_meeting_date && (
                                  <Badge variant="outline" className="text-xs text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-950 w-fit">
                                    📅 {format(parseISO(company.renewal_meeting_date), "dd/MM/yyyy")}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <Badge className={`${renewalStatusOption?.bgLight || "bg-slate-100"} ${renewalStatusOption?.textColor || "text-slate-700"} border-0 font-medium`}>
                                  <span className="mr-1">{renewalStatusOption?.icon || "🔄"}</span>
                                  {renewalStatusOption?.label || "Em negociação"}
                                </Badge>
                                {company.renewal_status === "reuniao_agendada" && company.renewal_meeting_date && (
                                  <Badge variant="outline" className="text-xs text-violet-600 dark:text-violet-400 border-violet-300 w-fit">
                                    📅 {format(parseISO(company.renewal_meeting_date), "dd/MM/yyyy")}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className={company.renewal_notes ? "text-primary" : "text-muted-foreground"}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <Label>Observações da negociação</Label>
                                <Textarea
                                  value={company.renewal_notes || ""}
                                  onChange={(e) => {
                                    setCompanies(prev => prev.map(c => 
                                      c.id === company.id ? { ...c, renewal_notes: e.target.value } : c
                                    ));
                                  }}
                                  onBlur={(e) => handleRenewalNotesChange(company.id, e.target.value)}
                                  placeholder="Adicione observações sobre a negociação..."
                                  rows={4}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openHistoryDialog(company)}
                              title="Histórico"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openRenewDialog(company)}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Renovar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCompanies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isCS ? 7 : 8} className="text-center py-8 text-muted-foreground">
                        Nenhuma empresa encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Closed Companies Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              Empresas Encerradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Segmento</TableHead>
                    {/* Hide value column for CS */}
                    {!isCS && <TableHead>Último Valor</TableHead>}
                    <TableHead>Data de Encerramento</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies
                    .filter(c => c.status === "inactive")
                    .map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium max-w-[150px] truncate" title={company.name}>
                          {company.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {company.segment || "-"}
                        </TableCell>
                        {/* Hide value cell for CS */}
                        {!isCS && (
                          <TableCell>
                            {formatCurrency(company.contract_value)}
                          </TableCell>
                        )}
                        <TableCell>
                          {isAdmin ? (
                            <Input
                              type="date"
                              value={company.contract_end_date || ""}
                              onChange={(e) => handleUpdateContract(
                                company.id,
                                "contract_end_date",
                                e.target.value || null
                              )}
                              className="w-40 h-8"
                            />
                          ) : (
                            company.contract_end_date
                              ? format(parseISO(company.contract_end_date), "dd/MM/yyyy")
                              : "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className={company.renewal_notes ? "text-primary" : "text-muted-foreground"}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <Label>Observações</Label>
                                <Textarea
                                  value={company.renewal_notes || ""}
                                  onChange={(e) => {
                                    setCompanies(prev => prev.map(c => 
                                      c.id === company.id ? { ...c, renewal_notes: e.target.value } : c
                                    ));
                                  }}
                                  onBlur={(e) => handleRenewalNotesChange(company.id, e.target.value)}
                                  placeholder="Adicione observações..."
                                  rows={4}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                      </TableRow>
                    ))}
                  {companies.filter(c => c.status === "inactive").length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isCS ? 4 : 5} className="text-center py-8 text-muted-foreground">
                        Nenhuma empresa encerrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Closed Projects Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              Projetos Encerrados ({closedProjects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Produto/Serviço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Encerramento</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium max-w-[150px] truncate" title={project.company_name || "-"}>
                        {project.company_name || "-"}
                      </TableCell>
                      <TableCell>{project.product_name}</TableCell>
                      <TableCell>
                        <Badge variant={project.status === "completed" ? "default" : "destructive"}>
                          {project.status === "completed" ? "Concluído" : "Encerrado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {project.churn_date
                          ? format(parseISO(project.churn_date), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={project.churn_reason || "-"}>
                        {project.churn_reason || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={project.churn_notes || "-"}>
                        {project.churn_notes || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditChurnDateDialog(project)}
                          title="Editar data de encerramento"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {closedProjects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum projeto encerrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Renew Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar Contrato</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Valor atual</p>
                <p className="font-medium">{formatCurrency(selectedCompany?.contract_value || null)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Término atual</p>
                <p className="font-medium">
                  {selectedCompany?.contract_end_date
                    ? format(parseISO(selectedCompany.contract_end_date), "dd/MM/yyyy")
                    : "Não definido"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Novo Valor do Contrato (R$)</Label>
              <Input
                type="number"
                value={renewForm.newValue}
                onChange={(e) => setRenewForm({ ...renewForm, newValue: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Prazo da Renovação</Label>
              <Select
                value={renewForm.termMonths}
                onValueChange={(v) => setRenewForm({ ...renewForm, termMonths: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mês</SelectItem>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={renewForm.notes}
                onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
                placeholder="Anotações sobre a renovação..."
              />
            </div>

            {selectedCompany && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Nova data de término:</p>
                <p className="font-medium">
                  {format(
                    addMonths(
                      selectedCompany.contract_end_date && parseISO(selectedCompany.contract_end_date) > new Date()
                        ? parseISO(selectedCompany.contract_end_date)
                        : new Date(),
                      parseInt(renewForm.termMonths) || 12
                    ),
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRenew} disabled={saving}>
              {saving ? "Salvando..." : "Confirmar Renovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Renovações</DialogTitle>
            <DialogDescription>
              {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px]">
            {companyRenewals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma renovação registrada
              </div>
            ) : (
              <div className="space-y-4">
                {companyRenewals.map((renewal) => (
                  <Card key={renewal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            Renovação em {format(parseISO(renewal.renewal_date), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                          <p className="text-sm text-muted-foreground">por {renewal.staff_name}</p>
                        </div>
                        <Badge variant="secondary">
                          +{renewal.new_term_months || "?"} meses
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Valor anterior</p>
                          <p>{formatCurrency(renewal.previous_value)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Novo valor</p>
                          <p className="font-medium">{formatCurrency(renewal.new_value)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Término anterior</p>
                          <p>
                            {renewal.previous_end_date
                              ? format(parseISO(renewal.previous_end_date), "dd/MM/yyyy")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Novo término</p>
                          <p className="font-medium">
                            {format(parseISO(renewal.new_end_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      {renewal.notes && (
                        <div className="mt-3 p-2 bg-muted rounded text-sm">
                          {renewal.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Meeting Date Dialog */}
      <Dialog open={meetingDateDialogOpen} onOpenChange={setMeetingDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Reunião</DialogTitle>
            <DialogDescription>
              Selecione a data da reunião para este contrato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="renewal-meeting-date">Data da reunião</Label>
              <Input
                id="renewal-meeting-date"
                type="date"
                value={meetingDateValue}
                onChange={(e) => setMeetingDateValue(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMeetingDateDialogOpen(false);
                setMeetingDateCompanyId(null);
                setMeetingDateValue("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveMeetingDate} disabled={!meetingDateValue}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Churn Date Dialog */}
      <Dialog open={editChurnDateDialogOpen} onOpenChange={setEditChurnDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Data de Encerramento</DialogTitle>
            <DialogDescription>
              {selectedProject?.company_name} - {selectedProject?.product_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data de Encerramento</Label>
              <Input
                type="date"
                value={newChurnDate}
                onChange={(e) => setNewChurnDate(e.target.value)}
              />
            </div>

            {selectedProject?.churn_reason && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Motivo do encerramento:</p>
                <p className="font-medium">{selectedProject.churn_reason}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditChurnDateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveChurnDate} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
