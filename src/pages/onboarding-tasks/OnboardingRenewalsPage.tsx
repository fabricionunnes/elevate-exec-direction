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

// Per-project renewal entry (project + company join)
interface ProjectRenewal {
  // Project fields
  id: string;
  product_name: string;
  contract_value: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  renewal_status: string | null;
  renewal_notes: string | null;
  renewal_meeting_date: string | null;
  project_status: string;
  // Company fields (from join)
  company_id: string;
  company_name: string;
  company_status: string;
  segment: string | null;
  renewal_plan_type: string | null;
  payment_method: string | null;
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
  project_id: string | null;
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
  const [projects, setProjects] = useState<ProjectRenewal[]>([]);
  // Keep companies list only for the "Empresas Encerradas" section
  const [inactiveCompanies, setInactiveCompanies] = useState<{id:string;name:string;segment:string|null;contract_value:number|null;contract_end_date:string|null;renewal_notes:string|null}[]>([]);
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
  const [selectedProjectRenewal, setSelectedProjectRenewal] = useState<ProjectRenewal | null>(null);
  const [projectRenewalHistory, setProjectRenewalHistory] = useState<Renewal[]>([]);

  // Meeting date dialog
  const [meetingDateDialogOpen, setMeetingDateDialogOpen] = useState(false);
  const [meetingDateProjectId, setMeetingDateProjectId] = useState<string | null>(null);
  const [meetingDateValue, setMeetingDateValue] = useState<string>("");

  const [renewForm, setRenewForm] = useState({
    newValue: "",
    termMonths: "12",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Edit churn date dialog
  const [editChurnDateDialogOpen, setEditChurnDateDialogOpen] = useState(false);
  const [selectedClosedProject, setSelectedClosedProject] = useState<ClosedProject | null>(null);
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

    if (staff.role !== "master" && staff.role !== "admin" && staff.role !== "cs") {
      toast.error("Acesso restrito");
      navigate("/onboarding-tasks");
      return;
    }

    setStaffId(staff.id);
    setUserRole(staff.role);
    setIsAdmin(staff.role === "admin" || staff.role === "master");
    setIsCS(staff.role === "cs");
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch projects with contract data joined with company info
    const { data: projectsData, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        product_name,
        status,
        contract_value,
        contract_start_date,
        contract_end_date,
        renewal_status,
        renewal_notes,
        renewal_meeting_date,
        onboarding_company:onboarding_company_id(
          id,
          name,
          status,
          segment,
          renewal_plan_type,
          payment_method
        )
      `)
      .not("contract_end_date", "is", null)
      .order("contract_end_date", { ascending: true, nullsFirst: false });

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      toast.error("Erro ao carregar projetos");
    } else {
      const formatted: ProjectRenewal[] = (projectsData || [])
        .filter((p: any) => {
          const company = p.onboarding_company;
          if (!company) return false;
          if (company.status === "inactive" || company.status === "churned") return false;
          // Excluir projetos já encerrados ou concluídos
          if (p.status === "closed" || p.status === "completed" || p.status === "inactive") return false;
          if (company.payment_method && company.payment_method !== "card") return false;
          return true;
        })
        .map((p: any) => ({
          id: p.id,
          product_name: p.product_name,
          contract_value: p.contract_value,
          contract_start_date: p.contract_start_date,
          contract_end_date: p.contract_end_date,
          renewal_status: p.renewal_status,
          renewal_notes: p.renewal_notes,
          renewal_meeting_date: p.renewal_meeting_date,
          project_status: p.status || "active",
          company_id: p.onboarding_company.id,
          company_name: p.onboarding_company.name,
          company_status: p.onboarding_company.status || "active",
          segment: p.onboarding_company.segment,
          renewal_plan_type: p.onboarding_company.renewal_plan_type,
          payment_method: p.onboarding_company.payment_method,
        }));
      setProjects(formatted);
    }

    // Fetch all renewals
    const { data: renewalsData, error: renewalsError } = await supabase
      .from("onboarding_contract_renewals")
      .select(`*, staff:created_by(name)`)
      .order("renewal_date", { ascending: false });

    if (renewalsError) {
      console.error("Error fetching renewals:", renewalsError);
    } else {
      setRenewals((renewalsData || []).map((r: any) => ({
        ...r,
        staff_name: r.staff?.name || "Sistema",
      })));
    }

    // Fetch inactive companies for "Empresas Encerradas" section
    const { data: inactiveData } = await supabase
      .from("onboarding_companies")
      .select("id, name, segment, contract_value, contract_end_date, renewal_notes")
      .eq("status", "inactive")
      .order("name");
    setInactiveCompanies(inactiveData || []);

    // Fetch closed/churned projects
    const { data: closedData, error: closedError } = await supabase
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

    if (closedError) {
      console.error("Error fetching closed projects:", closedError);
    } else {
      setClosedProjects((closedData || []).map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        status: p.status,
        churn_date: p.churn_date,
        churn_reason: p.churn_reason,
        churn_notes: p.churn_notes,
        company_name: p.onboarding_company?.name || null,
      })));
    }

    setLoading(false);
  };

  const getContractStatus = (endDate: string | null) => {
    if (!endDate) return { label: "Sem data", color: "secondary" as const, priority: 3 };
    const daysUntilEnd = differenceInDays(parseISO(endDate), new Date());
    if (daysUntilEnd < 0) return { label: "Vencido", color: "destructive" as const, priority: 0 };
    if (daysUntilEnd <= 30) return { label: "Vence em breve", color: "destructive" as const, priority: 1 };
    if (daysUntilEnd <= 60) return { label: "Atenção", color: "outline" as const, priority: 2 };
    return { label: "Ativo", color: "default" as const, priority: 4 };
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const openRenewDialog = (project: ProjectRenewal) => {
    setSelectedProjectRenewal(project);
    setRenewForm({
      newValue: project.contract_value?.toString() || "",
      termMonths: "12",
      notes: "",
    });
    setRenewDialogOpen(true);
  };

  const openHistoryDialog = (project: ProjectRenewal) => {
    setSelectedProjectRenewal(project);
    // Filter by project_id if available, fallback to company_id
    const history = renewals.filter(r =>
      r.project_id ? r.project_id === project.id : r.company_id === project.company_id
    );
    setProjectRenewalHistory(history);
    setHistoryDialogOpen(true);
  };

  const openEditChurnDateDialog = (project: ClosedProject) => {
    setSelectedClosedProject(project);
    setNewChurnDate(project.churn_date || "");
    setEditChurnDateDialogOpen(true);
  };

  const handleSaveChurnDate = async () => {
    if (!selectedClosedProject || !newChurnDate) {
      toast.error("Selecione uma data válida");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ churn_date: newChurnDate })
        .eq("id", selectedClosedProject.id);
      if (error) throw error;
      toast.success("Data de encerramento atualizada");
      setEditChurnDateDialogOpen(false);
      setSelectedClosedProject(null);
      fetchData();
    } catch (error) {
      console.error("Error updating churn date:", error);
      toast.error("Erro ao atualizar data de encerramento");
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async () => {
    if (!selectedProjectRenewal || !staffId) return;

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
      const currentEndDate = selectedProjectRenewal.contract_end_date
        ? parseISO(selectedProjectRenewal.contract_end_date)
        : new Date();
      const newEndDate = addMonths(currentEndDate > new Date() ? currentEndDate : new Date(), termMonths);

      // Insert renewal record
      const { error: renewalError } = await supabase
        .from("onboarding_contract_renewals")
        .insert({
          company_id: selectedProjectRenewal.company_id,
          project_id: selectedProjectRenewal.id,
          previous_end_date: selectedProjectRenewal.contract_end_date,
          new_end_date: format(newEndDate, "yyyy-MM-dd"),
          previous_value: selectedProjectRenewal.contract_value,
          new_value: newValue,
          new_term_months: termMonths,
          notes: renewForm.notes || null,
          created_by: staffId,
        });
      if (renewalError) throw renewalError;

      // Update project contract
      const { error: projectError } = await supabase
        .from("onboarding_projects")
        .update({
          contract_end_date: format(newEndDate, "yyyy-MM-dd"),
          contract_value: newValue,
          renewal_status: null,
          renewed_at: new Date().toISOString(),
        })
        .eq("id", selectedProjectRenewal.id);
      if (projectError) throw projectError;

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

  const handleUpdateContract = async (projectId: string, field: string, value: any) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ [field]: value })
        .eq("id", projectId);
      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, [field]: value } : p));
      toast.success("Contrato atualizado");
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Erro ao atualizar contrato");
    }
  };

  // Plan type stays on company level (shared across all projects of the company)
  const handlePlanTypeChange = async (companyId: string, planType: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ renewal_plan_type: planType })
        .eq("id", companyId);
      if (error) throw error;
      setProjects(prev => prev.map(p => p.company_id === companyId ? { ...p, renewal_plan_type: planType } : p));
      toast.success("Plano atualizado");
    } catch (error) {
      console.error("Error updating plan type:", error);
      toast.error("Erro ao atualizar plano");
    }
  };

  const handleRenewalStatusChange = async (projectId: string, status: string) => {
    if (!isAdmin) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (status === "reuniao_agendada") {
      setMeetingDateProjectId(projectId);
      setMeetingDateValue(project.renewal_meeting_date || "");
      setMeetingDateDialogOpen(true);
      return;
    }

    try {
      if (status === "renovado" && project.contract_value) {
        const plan = PLAN_TYPE_OPTIONS.find(p => p.value === (project.renewal_plan_type || "monthly"));
        if (plan && plan.months) {
          const startDate = new Date();
          const newEndDate = format(addMonths(startDate, plan.months), "yyyy-MM-dd");

          await supabase.from("onboarding_contract_renewals").insert({
            company_id: project.company_id,
            project_id: projectId,
            previous_end_date: project.contract_end_date,
            new_end_date: newEndDate,
            previous_value: project.contract_value,
            new_value: project.contract_value,
            new_term_months: plan.months,
            notes: "Renovação automática via status",
            created_by: staffId,
          });

          await supabase
            .from("onboarding_projects")
            .update({
              renewal_status: status,
              renewal_meeting_date: null,
              contract_start_date: format(startDate, "yyyy-MM-dd"),
              contract_end_date: newEndDate,
              renewed_at: new Date().toISOString(),
            })
            .eq("id", projectId);

          setProjects(prev => prev.map(p =>
            p.id === projectId ? {
              ...p,
              renewal_status: status,
              renewal_meeting_date: null,
              contract_start_date: format(startDate, "yyyy-MM-dd"),
              contract_end_date: newEndDate
            } : p
          ));
        } else {
          // Monthly plan - no end date
          await supabase
            .from("onboarding_projects")
            .update({
              renewal_status: status,
              renewal_meeting_date: null,
              contract_end_date: null,
              renewed_at: new Date().toISOString(),
            })
            .eq("id", projectId);

          setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, renewal_status: status, renewal_meeting_date: null, contract_end_date: null } : p
          ));
        }
        toast.success("Projeto renovado!");
        fetchData();
        return;
      }

      if (status === "encerrado") {
        // Close this specific project
        await supabase
          .from("onboarding_projects")
          .update({
            status: "closed",
            renewal_status: status,
            renewal_meeting_date: null,
            churn_date: format(new Date(), "yyyy-MM-dd"),
          })
          .eq("id", projectId);

        setProjects(prev => prev.filter(p => p.id !== projectId));
        toast.success("Projeto encerrado");
        fetchData();
        return;
      }

      // Normal status update
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ renewal_status: status, renewal_meeting_date: null })
        .eq("id", projectId);
      if (error) throw error;

      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, renewal_status: status, renewal_meeting_date: null } : p
      ));
      toast.success("Status atualizado");
    } catch (error) {
      console.error("Error updating renewal status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleSaveMeetingDate = async () => {
    if (!meetingDateProjectId || !meetingDateValue) {
      toast.error("Selecione a data da reunião");
      return;
    }
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({
          renewal_status: "reuniao_agendada",
          renewal_meeting_date: meetingDateValue,
        })
        .eq("id", meetingDateProjectId);
      if (error) throw error;

      setProjects(prev => prev.map(p =>
        p.id === meetingDateProjectId
          ? { ...p, renewal_status: "reuniao_agendada", renewal_meeting_date: meetingDateValue }
          : p
      ));
      toast.success("Reunião agendada");
      setMeetingDateDialogOpen(false);
      setMeetingDateProjectId(null);
      setMeetingDateValue("");
    } catch (error) {
      console.error("Error saving meeting date:", error);
      toast.error("Erro ao salvar data da reunião");
    }
  };

  const handleRenewalNotesChange = async (projectId: string, notes: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from("onboarding_projects")
        .update({ renewal_notes: notes })
        .eq("id", projectId);
      if (error) throw error;
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, renewal_notes: notes } : p));
      toast.success("Observações salvas");
    } catch (error) {
      console.error("Error updating notes:", error);
      toast.error("Erro ao salvar observações");
    }
  };

  const handleUpdateInactiveCompanyNotes = async (companyId: string, notes: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({ renewal_notes: notes })
        .eq("id", companyId);
      if (error) throw error;
      setInactiveCompanies(prev => prev.map(c => c.id === companyId ? { ...c, renewal_notes: notes } : c));
      toast.success("Observações salvas");
    } catch (error) {
      toast.error("Erro ao salvar observações");
    }
  };

  const filteredProjects = projects.filter(p => {
    if (!p.contract_end_date) return false;

    const matchesSearch = p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_name.toLowerCase().includes(searchTerm.toLowerCase());

    const endDate = parseISO(p.contract_end_date);
    const { start: periodStart, end: periodEnd } = currentPeriodRange;

    const endsInSelectedPeriod = isWithinInterval(endDate, { start: periodStart, end: periodEnd });
    const isPendingFromPast = includePending && isBefore(endDate, periodStart);
    const matchesPeriod = endsInSelectedPeriod || isPendingFromPast;

    if (!matchesPeriod) return false;

    if (filterStatus === "all") return matchesSearch;
    const status = getContractStatus(p.contract_end_date);
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

  const pendingFromPastCount = projects.filter(p => {
    if (!p.contract_end_date) return false;
    const endDate = parseISO(p.contract_end_date);
    return isBefore(endDate, currentPeriodRange.start);
  }).length;

  const stats = {
    total: filteredProjects.length,
    expired: filteredProjects.filter(p => getContractStatus(p.contract_end_date).label === "Vencido").length,
    soon: filteredProjects.filter(p => ["Vence em breve", "Atenção"].includes(getContractStatus(p.contract_end_date).label)).length,
    active: filteredProjects.filter(p => getContractStatus(p.contract_end_date).label === "Ativo").length,
    totalValue: filteredProjects.reduce((sum, p) => sum + (p.contract_value || 0), 0),
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

                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa ou projeto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

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

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contratos ({filteredProjects.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="min-w-[1000px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b-2 border-primary/20">
                      <TableHead className="w-[200px] font-bold text-slate-700 dark:text-slate-200">🏢 Empresa</TableHead>
                      <TableHead className="w-[160px] font-bold text-slate-700 dark:text-slate-200">📦 Projeto</TableHead>
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
                    {filteredProjects.map((project, index) => {
                      const status = getContractStatus(project.contract_end_date);
                      const renewalStatusOption = RENEWAL_STATUS_OPTIONS.find(s => s.value === project.renewal_status);
                      const planOption = PLAN_TYPE_OPTIONS.find(p => p.value === project.renewal_plan_type);

                      const getRowBg = () => {
                        if (status.label === "Vencido") return "bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/50";
                        if (status.label === "Vence em breve") return "bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100/70 dark:hover:bg-amber-950/50";
                        if (status.label === "Atenção") return "bg-orange-50/50 dark:bg-orange-950/30 hover:bg-orange-100/70 dark:hover:bg-orange-950/50";
                        return index % 2 === 0 ? "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800" : "bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700";
                      };

                      return (
                        <TableRow key={project.id} className={`${getRowBg()} transition-colors border-b border-slate-200 dark:border-slate-700`}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                              </div>
                              <button
                                className="font-semibold text-sm text-slate-800 dark:text-slate-100 hover:text-primary hover:underline text-left transition-colors"
                                title={`Abrir detalhes de ${project.company_name}`}
                                onClick={() => navigate(`/onboarding-tasks/companies/${project.company_id}?tab=contract`)}
                              >
                                {project.company_name}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm text-muted-foreground font-medium">{project.product_name}</span>
                          </TableCell>
                          {!isCS && (
                            <TableCell className="py-3">
                              {isAdmin ? (
                                <Input
                                  type="number"
                                  value={project.contract_value || ""}
                                  onChange={(e) => handleUpdateContract(
                                    project.id,
                                    "contract_value",
                                    e.target.value ? parseFloat(e.target.value) : null
                                  )}
                                  className="w-full h-8 text-sm font-medium border-emerald-200 focus:border-emerald-500"
                                  placeholder="Valor"
                                />
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                                  {formatCurrency(project.contract_value)}
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="py-3">
                            {isAdmin ? (
                              <Select
                                value={project.renewal_plan_type || "monthly"}
                                onValueChange={(v) => handlePlanTypeChange(project.company_id, v)}
                              >
                                <SelectTrigger className="w-full h-8 text-sm bg-white dark:bg-slate-800">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  {PLAN_TYPE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className="font-medium">{planOption?.label || "Mensal"}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {project.renewal_plan_type === "monthly" ? (
                              <Badge variant="outline" className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-300">🔁 Recorrente</Badge>
                            ) : project.contract_end_date ? (
                              <span className="text-sm font-medium">{format(parseISO(project.contract_end_date), "dd/MM/yyyy")}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {status.label === "Vencido" && (
                              <Badge className="bg-gradient-to-r from-rose-500 to-red-600 text-white border-0 shadow-sm">🚨 {status.label}</Badge>
                            )}
                            {status.label === "Vence em breve" && (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm">⚠️ {status.label}</Badge>
                            )}
                            {status.label === "Atenção" && (
                              <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 shadow-sm">👀 {status.label}</Badge>
                            )}
                            {status.label === "Ativo" && (
                              <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-sm">✅ {status.label}</Badge>
                            )}
                            {status.label === "Sem data" && (
                              <Badge variant="secondary" className="text-slate-500">❓ {status.label}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {isAdmin ? (
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={project.renewal_status || "em_negociacao"}
                                  onValueChange={(v) => handleRenewalStatusChange(project.id, v)}
                                >
                                  <SelectTrigger className={`w-full h-9 text-sm font-medium border-2 ${
                                    RENEWAL_STATUS_OPTIONS.find(s => s.value === (project.renewal_status || "em_negociacao"))?.bgLight || "bg-slate-50"
                                  } ${
                                    RENEWAL_STATUS_OPTIONS.find(s => s.value === (project.renewal_status || "em_negociacao"))?.textColor || "text-slate-700"
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">
                                        {RENEWAL_STATUS_OPTIONS.find(s => s.value === (project.renewal_status || "em_negociacao"))?.icon || "🔄"}
                                      </span>
                                      <span className="truncate text-sm font-semibold">
                                        {RENEWAL_STATUS_OPTIONS.find(s => s.value === (project.renewal_status || "em_negociacao"))?.label || "Em negociação"}
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
                                {project.renewal_status === "reuniao_agendada" && project.renewal_meeting_date && (
                                  <Badge variant="outline" className="text-xs text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-950 w-fit">
                                    📅 {format(parseISO(project.renewal_meeting_date), "dd/MM/yyyy")}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <Badge className={`${renewalStatusOption?.bgLight || "bg-slate-100"} ${renewalStatusOption?.textColor || "text-slate-700"} border-0 font-medium`}>
                                  <span className="mr-1">{renewalStatusOption?.icon || "🔄"}</span>
                                  {renewalStatusOption?.label || "Em negociação"}
                                </Badge>
                                {project.renewal_status === "reuniao_agendada" && project.renewal_meeting_date && (
                                  <Badge variant="outline" className="text-xs text-violet-600 dark:text-violet-400 border-violet-300 w-fit">
                                    📅 {format(parseISO(project.renewal_meeting_date), "dd/MM/yyyy")}
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
                                  className={project.renewal_notes ? "text-primary" : "text-muted-foreground"}
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <div className="space-y-2">
                                  <Label>Observações da negociação</Label>
                                  <Textarea
                                    value={project.renewal_notes || ""}
                                    onChange={(e) => {
                                      setProjects(prev => prev.map(p =>
                                        p.id === project.id ? { ...p, renewal_notes: e.target.value } : p
                                      ));
                                    }}
                                    onBlur={(e) => handleRenewalNotesChange(project.id, e.target.value)}
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
                                onClick={() => openHistoryDialog(project)}
                                title="Histórico"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => openRenewDialog(project)}
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
                    {filteredProjects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isCS ? 8 : 9} className="text-center py-8 text-muted-foreground">
                          Nenhum projeto encontrado
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
                    {!isCS && <TableHead>Último Valor</TableHead>}
                    <TableHead>Data de Encerramento</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium max-w-[150px] truncate" title={company.name}>
                        {company.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {company.segment || "-"}
                      </TableCell>
                      {!isCS && (
                        <TableCell>{formatCurrency(company.contract_value)}</TableCell>
                      )}
                      <TableCell>
                        {company.contract_end_date
                          ? format(parseISO(company.contract_end_date), "dd/MM/yyyy")
                          : "-"}
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
                                  setInactiveCompanies(prev => prev.map(c =>
                                    c.id === company.id ? { ...c, renewal_notes: e.target.value } : c
                                  ));
                                }}
                                onBlur={(e) => handleUpdateInactiveCompanyNotes(company.id, e.target.value)}
                                placeholder="Adicione observações..."
                                rows={4}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inactiveCompanies.length === 0 && (
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
                        {project.churn_date ? format(parseISO(project.churn_date), "dd/MM/yyyy") : "-"}
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
              {selectedProjectRenewal?.company_name}
              {selectedProjectRenewal && <span className="text-muted-foreground"> — {selectedProjectRenewal.product_name}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Valor atual</p>
                <p className="font-medium">{formatCurrency(selectedProjectRenewal?.contract_value || null)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Término atual</p>
                <p className="font-medium">
                  {selectedProjectRenewal?.contract_end_date
                    ? format(parseISO(selectedProjectRenewal.contract_end_date), "dd/MM/yyyy")
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

            {selectedProjectRenewal && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Nova data de término:</p>
                <p className="font-medium">
                  {format(
                    addMonths(
                      selectedProjectRenewal.contract_end_date && parseISO(selectedProjectRenewal.contract_end_date) > new Date()
                        ? parseISO(selectedProjectRenewal.contract_end_date)
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
              {selectedProjectRenewal?.company_name}
              {selectedProjectRenewal && <span className="text-muted-foreground"> — {selectedProjectRenewal.product_name}</span>}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            {projectRenewalHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma renovação registrada
              </div>
            ) : (
              <div className="space-y-4">
                {projectRenewalHistory.map((renewal) => (
                  <Card key={renewal.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            Renovação em {format(parseISO(renewal.renewal_date), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                          <p className="text-sm text-muted-foreground">por {renewal.staff_name}</p>
                        </div>
                        <Badge variant="secondary">+{renewal.new_term_months || "?"} meses</Badge>
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
                          <p>{renewal.previous_end_date ? format(parseISO(renewal.previous_end_date), "dd/MM/yyyy") : "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Novo término</p>
                          <p className="font-medium">{format(parseISO(renewal.new_end_date), "dd/MM/yyyy")}</p>
                        </div>
                      </div>
                      {renewal.notes && (
                        <div className="mt-3 p-2 bg-muted rounded text-sm">{renewal.notes}</div>
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
            <DialogDescription>Selecione a data da reunião para este contrato.</DialogDescription>
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
                setMeetingDateProjectId(null);
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
              {selectedClosedProject?.company_name} - {selectedClosedProject?.product_name}
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
            {selectedClosedProject?.churn_reason && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Motivo do encerramento:</p>
                <p className="font-medium">{selectedClosedProject.churn_reason}</p>
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
