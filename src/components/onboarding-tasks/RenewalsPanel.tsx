import { useState, useEffect, useMemo } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format, parseISO, addMonths, addDays, differenceInMonths, startOfMonth, endOfMonth, isWithinInterval, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import {
  X,
  Calendar,
  DollarSign,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  History,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Staff {
  id: string;
  name: string;
}

interface ProjectForRenewal {
  // Project-level fields
  project_id: string;
  project_name: string;
  project_status: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  billing_day: number | null;
  renewal_status: string | null;
  renewal_notes: string | null;
  renewal_meeting_date: string | null;
  renewed_at: string | null;
  // Company-level fields
  company_id: string;
  company_name: string;
  consultant_id: string | null;
  consultant_name: string | null;
  payment_method: string | null;
  company_status: string;
  // Calculated
  contract_months: number;
  monthly_value: number;
}

interface RenewalHistory {
  id: string;
  company_id: string;
  project_id: string | null;
  previous_start_date: string | null;
  previous_end_date: string | null;
  new_start_date: string | null;
  new_end_date: string;
  previous_value: number | null;
  new_value: number;
  previous_term_months: number | null;
  new_term_months: number | null;
  renewal_date: string;
  notes: string | null;
  status: string | null;
  created_by: string | null;
  staff_name?: string;
}

const RENEWAL_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500", textColor: "text-yellow-400", bgColor: "bg-yellow-500/20", borderColor: "border-yellow-500/30" },
  { value: "em_negociacao", label: "Em negociação", color: "bg-blue-500", textColor: "text-blue-400", bgColor: "bg-blue-500/20", borderColor: "border-blue-500/30" },
  { value: "reuniao_agendada", label: "Reunião Agendada", color: "bg-purple-500", textColor: "text-purple-400", bgColor: "bg-purple-500/20", borderColor: "border-purple-500/30" },
  { value: "renovado", label: "Renovado", color: "bg-green-500", textColor: "text-green-400", bgColor: "bg-green-500/20", borderColor: "border-green-500/30" },
  { value: "nao_renovado", label: "Não renovado", color: "bg-red-500", textColor: "text-red-400", bgColor: "bg-red-500/20", borderColor: "border-red-500/30" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-600", textColor: "text-red-400", bgColor: "bg-red-500/20", borderColor: "border-red-500/30" },
];

interface RenewalsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  staff: Staff[];
}

export default function RenewalsPanel({ open, onOpenChange, staffId, staff }: RenewalsPanelProps) {
  const [projects, setProjects] = useState<ProjectForRenewal[]>([]);
  const [renewals, setRenewals] = useState<RenewalHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [includePending, setIncludePending] = useState(true);

  // Renewal dialog
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectForRenewal | null>(null);
  const [renewalMode, setRenewalMode] = useState<"same" | "change">("same");
  const [newMonthlyValue, setNewMonthlyValue] = useState<number>(0);
  const [newTermMonths, setNewTermMonths] = useState<number>(12);
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [renewalNotes, setRenewalNotes] = useState<string>("");
  const [renewalStatus, setRenewalStatus] = useState<string>("pendente");
  const [renewalMeetingDate, setRenewalMeetingDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // History dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [projectHistory, setProjectHistory] = useState<RenewalHistory[]>([]);
  const [historyTitle, setHistoryTitle] = useState("");

  // Meeting date dialog (for inline status change)
  const [meetingDateDialogOpen, setMeetingDateDialogOpen] = useState(false);
  const [meetingDateProjectId, setMeetingDateProjectId] = useState<string | null>(null);
  const [meetingDateValue, setMeetingDateValue] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch projects with contract data, joined with company info
    const { data: projectsData, error: projectsError } = await supabase
      .from("onboarding_projects")
      .select(`
        id,
        product_name,
        status,
        contract_start_date,
        contract_end_date,
        contract_value,
        billing_day,
        renewal_status,
        renewal_notes,
        renewal_meeting_date,
        renewed_at,
        onboarding_company:onboarding_company_id(
          id,
          name,
          consultant_id,
          payment_method,
          status,
          consultant:consultant_id(name)
        )
      `)
      .not("contract_end_date", "is", null)
      .order("contract_end_date", { ascending: true });

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      toast.error("Erro ao carregar projetos");
    } else {
      const processedProjects: ProjectForRenewal[] = (projectsData || [])
        .filter((p: any) => {
          const company = p.onboarding_company;
          if (!company) return false;
          // Exclude inactive companies
          if (company.status === "inactive") return false;
          // Only card or null payment_method
          if (company.payment_method && company.payment_method !== "card") return false;
          return true;
        })
        .map((p: any) => {
          const company = p.onboarding_company;
          const startDate = p.contract_start_date ? parseISO(p.contract_start_date) : null;
          const endDate = p.contract_end_date ? parseISO(p.contract_end_date) : null;

          let contractMonths = 1;
          if (startDate && endDate) {
            contractMonths = Math.max(1, differenceInMonths(endDate, startDate));
          }

          const contractValue = p.contract_value || 0;
          const monthlyValue = contractMonths > 0 ? contractValue / contractMonths : contractValue;

          return {
            project_id: p.id,
            project_name: p.product_name,
            project_status: p.status || "active",
            contract_start_date: p.contract_start_date,
            contract_end_date: p.contract_end_date,
            contract_value: p.contract_value,
            billing_day: p.billing_day,
            renewal_status: p.renewal_status,
            renewal_notes: p.renewal_notes,
            renewal_meeting_date: p.renewal_meeting_date,
            renewed_at: p.renewed_at,
            company_id: company.id,
            company_name: company.name,
            consultant_id: company.consultant_id,
            consultant_name: company.consultant?.name || null,
            payment_method: company.payment_method,
            company_status: company.status || "active",
            contract_months: contractMonths,
            monthly_value: monthlyValue,
          };
        });

      setProjects(processedProjects);
    }

    // Fetch renewal history
    const { data: renewalsData, error: renewalsError } = await supabase
      .from("onboarding_contract_renewals")
      .select(`
        *,
        staff:created_by(name)
      `)
      .order("renewal_date", { ascending: false });

    if (!renewalsError && renewalsData) {
      const formattedRenewals = renewalsData.map((r: any) => ({
        ...r,
        staff_name: r.staff?.name || "Sistema",
      }));
      setRenewals(formattedRenewals);
    }

    setLoading(false);
  };

  // Filter projects based on selected month
  const filteredProjects = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return projects.filter(p => {
      if (!p.contract_end_date) return false;

      // Exclude 1-month contracts
      if (p.contract_months <= 1) return false;

      const endDate = parseISO(p.contract_end_date);

      // Check if contract ends in selected month
      const endsInMonth = isWithinInterval(endDate, { start: monthStart, end: monthEnd });

      // Check if it's a pending renewal from previous months
      const isPendingFromPast = includePending && isBefore(endDate, monthStart);

      if (!endsInMonth && !isPendingFromPast) return false;

      // Search filter — matches company name or project name
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!p.company_name.toLowerCase().includes(term) && !p.project_name.toLowerCase().includes(term)) {
          return false;
        }
      }

      // Consultant filter
      if (filterConsultant !== "all" && p.consultant_id !== filterConsultant) return false;

      // Status filter
      if (filterStatus !== "all") {
        const projectRenewalStatus = p.renewal_status || "pendente";
        if (filterStatus !== projectRenewalStatus) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.contract_end_date ? new Date(a.contract_end_date).getTime() : 0;
      const dateB = b.contract_end_date ? new Date(b.contract_end_date).getTime() : 0;
      return dateA - dateB;
    });
  }, [projects, selectedMonth, searchTerm, filterConsultant, filterStatus, includePending]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const pending = filteredProjects.filter(p => !p.renewal_status || p.renewal_status === "pendente").length;
    const negotiating = filteredProjects.filter(p => p.renewal_status === "em_negociacao").length;
    const renewed = filteredProjects.filter(p => p.renewal_status === "renovado").length;
    const notRenewed = filteredProjects.filter(p => p.renewal_status === "nao_renovado" || p.renewal_status === "cancelado").length;
    const totalValue = filteredProjects.reduce((sum, p) => sum + (p.monthly_value || 0), 0);

    return { total, pending, negotiating, renewed, notRenewed, totalValue };
  }, [filteredProjects]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const getStatusBadge = (status: string | null, meetingDate?: string | null) => {
    const statusOption = RENEWAL_STATUS_OPTIONS.find(s => s.value === (status || "pendente"));
    if (!statusOption) {
      return <Badge variant="secondary">Pendente</Badge>;
    }

    if (status === "reuniao_agendada" && meetingDate) {
      return (
        <div className="flex flex-col gap-1">
          <Badge className={`${statusOption.bgColor} ${statusOption.textColor} ${statusOption.borderColor}`}>
            {statusOption.label}
          </Badge>
          <span className="text-xs text-purple-500">{formatDate(meetingDate)}</span>
        </div>
      );
    }

    return (
      <Badge className={`${statusOption.bgColor} ${statusOption.textColor} ${statusOption.borderColor}`}>
        {statusOption.label}
      </Badge>
    );
  };

  const openRenewalDialog = (project: ProjectForRenewal) => {
    setSelectedProject(project);
    setRenewalMode("same");
    setNewMonthlyValue(project.monthly_value);
    setNewTermMonths(project.contract_months);

    if (project.contract_end_date) {
      const nextDay = addDays(parseISO(project.contract_end_date), 1);
      setNewStartDate(format(nextDay, "yyyy-MM-dd"));
    } else {
      setNewStartDate(format(new Date(), "yyyy-MM-dd"));
    }

    setRenewalNotes(project.renewal_notes || "");
    setRenewalStatus(project.renewal_status || "pendente");
    setRenewalMeetingDate(project.renewal_meeting_date || "");
    setRenewDialogOpen(true);
  };

  const openHistoryDialog = (project: ProjectForRenewal) => {
    // Filter history by project_id if available, otherwise by company_id
    const history = renewals.filter(r =>
      r.project_id ? r.project_id === project.project_id : r.company_id === project.company_id
    );
    setProjectHistory(history);
    setHistoryTitle(`${project.company_name} — ${project.project_name}`);
    setHistoryDialogOpen(true);
  };

  // Calculate new contract values
  const calculatedValues = useMemo(() => {
    if (!selectedProject) return { newEndDate: "", newTotalValue: 0, monthlyValue: 0 };

    const monthlyValue = renewalMode === "same" ? selectedProject.monthly_value : newMonthlyValue;
    const termMonths = renewalMode === "same" ? selectedProject.contract_months : newTermMonths;

    let newEndDate = "";
    if (newStartDate) {
      try {
        const startDate = parseISO(newStartDate);
        const endDate = addMonths(startDate, termMonths);
        newEndDate = format(endDate, "yyyy-MM-dd");
      } catch {}
    }

    const newTotalValue = monthlyValue * termMonths;

    return { newEndDate, newTotalValue, monthlyValue };
  }, [selectedProject, renewalMode, newMonthlyValue, newTermMonths, newStartDate]);

  // Save only status and notes (does NOT update contract values)
  const handleSaveStatusOnly = async () => {
    if (!selectedProject || !staffId) return;

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("onboarding_projects")
        .update({
          renewal_status: renewalStatus,
          renewal_notes: renewalNotes || null,
          renewal_meeting_date: renewalStatus === "reuniao_agendada" ? renewalMeetingDate || null : null,
        })
        .eq("id", selectedProject.project_id);

      if (updateError) throw updateError;

      toast.success("Status de renovação atualizado");

      setRenewDialogOpen(false);
      setSelectedProject(null);
      fetchData();
    } catch (error) {
      console.error("Error saving renewal status:", error);
      toast.error("Erro ao salvar status");
    } finally {
      setSaving(false);
    }
  };

  // Update status directly from table dropdown
  const handleInlineStatusChange = async (projectId: string, newStatus: string) => {
    try {
      if (newStatus === "reuniao_agendada") {
        setMeetingDateProjectId(projectId);
        setMeetingDateValue("");
        setMeetingDateDialogOpen(true);
        return;
      }

      const { error } = await supabase
        .from("onboarding_projects")
        .update({
          renewal_status: newStatus,
          renewal_meeting_date: null,
        })
        .eq("id", projectId);

      if (error) throw error;

      toast.success("Status atualizado");
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  // Save meeting date from the dedicated dialog
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

      toast.success("Reunião agendada com sucesso");
      setMeetingDateDialogOpen(false);
      setMeetingDateProjectId(null);
      setMeetingDateValue("");
      fetchData();
    } catch (error) {
      console.error("Error saving meeting date:", error);
      toast.error("Erro ao salvar data da reunião");
    }
  };

  // Confirm renewal - extends contract end date and sums values
  const handleConfirmRenewal = async () => {
    if (!selectedProject || !staffId || !newStartDate) return;

    setSaving(true);

    try {
      const monthlyValue = renewalMode === "same" ? selectedProject.monthly_value : newMonthlyValue;
      const termMonths = renewalMode === "same" ? selectedProject.contract_months : newTermMonths;
      const renewalValue = monthlyValue * termMonths;

      const renewalStartDate = parseISO(newStartDate);
      const newEndDate = format(addMonths(renewalStartDate, termMonths), "yyyy-MM-dd");

      const previousContractValue = selectedProject.contract_value || 0;
      const newTotalContractValue = previousContractValue + renewalValue;

      // Insert renewal history record
      const { error: renewalError } = await supabase
        .from("onboarding_contract_renewals")
        .insert({
          company_id: selectedProject.company_id,
          project_id: selectedProject.project_id,
          previous_start_date: selectedProject.contract_start_date,
          previous_end_date: selectedProject.contract_end_date,
          previous_value: selectedProject.contract_value,
          previous_term_months: selectedProject.contract_months,
          new_start_date: newStartDate,
          new_end_date: newEndDate,
          new_value: renewalValue,
          new_term_months: termMonths,
          notes: renewalNotes || null,
          status: "renovado",
          created_by: staffId,
        });

      if (renewalError) throw renewalError;

      // Update project contract
      const { error: contractError } = await supabase
        .from("onboarding_projects")
        .update({
          contract_end_date: newEndDate,
          contract_value: newTotalContractValue,
          renewal_status: null,
          renewal_notes: null,
          renewal_meeting_date: null,
          renewed_at: new Date().toISOString(),
        })
        .eq("id", selectedProject.project_id);

      if (contractError) throw contractError;

      toast.success("Contrato renovado com sucesso!");

      setRenewDialogOpen(false);
      setSelectedProject(null);
      fetchData();
    } catch (error) {
      console.error("Error confirming renewal:", error);
      toast.error("Erro ao confirmar renovação");
    } finally {
      setSaving(false);
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedMonth(prev => addMonths(prev, direction === "prev" ? -1 : 1));
  };

  // Count pending from past months
  const pendingFromPastCount = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    return projects.filter(p => {
      if (!p.contract_end_date) return false;
      const endDate = parseISO(p.contract_end_date);
      return isBefore(endDate, monthStart);
    }).length;
  }, [projects, selectedMonth]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-5xl p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Renovações de Contrato
            </SheetTitle>
            <SheetDescription>
              Gerencie as renovações de contratos por mês
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
            {/* Month Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <MonthYearPicker
                  value={selectedMonth}
                  onChange={(range) => setSelectedMonth(range.start)}
                />
                <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Pending from past alert */}
            {pendingFromPastCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div className="text-sm">
                  <span className="font-medium">{pendingFromPastCount} contrato(s) vencido(s)</span>
                  <span className="text-muted-foreground"> de meses anteriores</span>
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{stats.total}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className="text-lg font-bold text-yellow-500">{stats.pending}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Negociando</p>
                    <p className="text-lg font-bold text-blue-500">{stats.negotiating}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Renovado</p>
                    <p className="text-lg font-bold text-green-500">{stats.renewed}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Valor/mês</p>
                    <p className="text-sm font-bold text-purple-500">{formatCurrency(stats.totalValue)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa ou projeto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {RENEWAL_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <Card>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Prazo</TableHead>
                      <TableHead className="text-right">Valor/mês</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Carregando...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhum projeto para renovar neste período
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProjects.map((p) => (
                        <TableRow key={p.project_id}>
                          <TableCell className="font-medium">{p.company_name}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{p.project_name}</span>
                          </TableCell>
                          <TableCell>{p.consultant_name || "—"}</TableCell>
                          <TableCell>{formatDate(p.contract_start_date)}</TableCell>
                          <TableCell>{formatDate(p.contract_end_date)}</TableCell>
                          <TableCell className="text-right">{p.contract_months} meses</TableCell>
                          <TableCell className="text-right text-blue-500">
                            {formatCurrency(p.monthly_value)}
                          </TableCell>
                          <TableCell className="text-right text-green-500 font-medium">
                            {formatCurrency(p.contract_value || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Select
                                value={p.renewal_status || "pendente"}
                                onValueChange={(value) => handleInlineStatusChange(p.project_id, value)}
                              >
                                <SelectTrigger className="w-[160px] h-8 text-xs">
                                  <SelectValue>
                                    {(() => {
                                      const statusOption = RENEWAL_STATUS_OPTIONS.find(s => s.value === (p.renewal_status || "pendente"));
                                      return (
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${statusOption?.color || 'bg-yellow-500'}`} />
                                          <span>{statusOption?.label || "Pendente"}</span>
                                        </div>
                                      );
                                    })()}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  {RENEWAL_STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${s.color}`} />
                                        <span>{s.label}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {p.renewal_status === "reuniao_agendada" && p.renewal_meeting_date && (
                                <span className="text-xs text-purple-500 pl-1">{formatDate(p.renewal_meeting_date)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openHistoryDialog(p)}
                                title="Histórico"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openRenewalDialog(p)}
                              >
                                Renovar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      {/* Renewal Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Renovação de Contrato</DialogTitle>
            <DialogDescription>
              {selectedProject?.company_name}
              {selectedProject && <span className="text-muted-foreground"> — {selectedProject.project_name}</span>}
            </DialogDescription>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-6 py-4">
              {/* Current Contract Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Contrato Atual</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="font-medium">{formatDate(selectedProject.contract_start_date)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Término</p>
                    <p className="font-medium">{formatDate(selectedProject.contract_end_date)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-medium">{selectedProject.contract_months} meses</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Valor Mensal</p>
                    <p className="font-medium text-blue-500">{formatCurrency(selectedProject.monthly_value)}</p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Valor Total do Contrato</p>
                  <p className="font-medium text-green-500 text-lg">{formatCurrency(selectedProject.contract_value || 0)}</p>
                </div>
              </div>

              {/* Renewal Configuration */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Configuração da Renovação</h4>

                <RadioGroup value={renewalMode} onValueChange={(v) => setRenewalMode(v as "same" | "change")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="same" id="same" />
                    <Label htmlFor="same">Mesmo valor e mesmo prazo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="change" id="change" />
                    <Label htmlFor="change">Alterar valor e/ou prazo</Label>
                  </div>
                </RadioGroup>

                {renewalMode === "change" && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="newValue">Novo Valor Mensal (R$)</Label>
                      <Input
                        id="newValue"
                        type="number"
                        min={0}
                        step={0.01}
                        value={newMonthlyValue}
                        onChange={(e) => setNewMonthlyValue(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newTerm">Novo Prazo (meses)</Label>
                      <Input
                        id="newTerm"
                        type="number"
                        min={1}
                        value={newTermMonths}
                        onChange={(e) => setNewTermMonths(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* New Contract Dates */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Datas do Novo Contrato</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data de Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Término</Label>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="font-medium">{calculatedValues.newEndDate ? formatDate(calculatedValues.newEndDate) : "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-primary/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Novo Valor Total</p>
                  <p className="font-bold text-primary text-lg">{formatCurrency(calculatedValues.newTotalValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ({formatCurrency(calculatedValues.monthlyValue)}/mês × {renewalMode === "same" ? selectedProject.contract_months : newTermMonths} meses)
                  </p>
                </div>
              </div>

              {/* Observations */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações da Renovação</Label>
                <Textarea
                  id="notes"
                  placeholder="Negociação, desconto, condição especial, follow-up pendente..."
                  value={renewalNotes}
                  onChange={(e) => setRenewalNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status da Renovação</Label>
                <Select value={renewalStatus} onValueChange={setRenewalStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENEWAL_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Meeting Date - shows when status is reuniao_agendada */}
              {renewalStatus === "reuniao_agendada" && (
                <div className="space-y-2 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Label htmlFor="meetingDate" className="text-purple-600 dark:text-purple-400 font-medium">
                    Data da Reunião Agendada *
                  </Label>
                  <Input
                    id="meetingDate"
                    type="date"
                    value={renewalMeetingDate}
                    onChange={(e) => setRenewalMeetingDate(e.target.value)}
                    className="border-purple-500/30"
                  />
                  {!renewalMeetingDate && (
                    <p className="text-xs text-purple-500">Informe a data da reunião agendada</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveStatusOnly}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar Status"}
            </Button>
            <Button
              onClick={handleConfirmRenewal}
              disabled={saving || !newStartDate}
            >
              {saving ? "Confirmando..." : "Confirmar Renovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Renovações</DialogTitle>
            <DialogDescription>{historyTitle}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {projectHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma renovação registrada
              </div>
            ) : (
              <div className="space-y-3">
                {projectHistory.map((renewal) => (
                  <Card key={renewal.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(renewal.renewal_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">por {renewal.staff_name}</p>
                      </div>
                      {getStatusBadge(renewal.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Contrato anterior:</p>
                        <p>{formatDate(renewal.previous_start_date)} - {formatDate(renewal.previous_end_date)}</p>
                        <p className="text-green-500">{formatCurrency(renewal.previous_value || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Novo contrato:</p>
                        <p>{formatDate(renewal.new_start_date)} - {formatDate(renewal.new_end_date)}</p>
                        <p className="text-green-500">{formatCurrency(renewal.new_value)}</p>
                      </div>
                    </div>
                    {renewal.notes && (
                      <p className="text-sm text-muted-foreground mt-2 border-t pt-2">
                        {renewal.notes}
                      </p>
                    )}
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
              Selecione a data da reunião de renovação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-date">Data da Reunião</Label>
              <Input
                id="meeting-date"
                type="date"
                value={meetingDateValue}
                onChange={(e) => setMeetingDateValue(e.target.value)}
                className="w-full"
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
    </>
  );
}
