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

interface CompanyForRenewal {
  id: string;
  name: string;
  consultant_id: string | null;
  consultant_name: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  payment_method: string | null;
  status: string;
  renewal_status: string | null;
  renewal_notes: string | null;
  renewal_meeting_date: string | null;
  // Calculated
  contract_months: number;
  monthly_value: number;
}

interface RenewalHistory {
  id: string;
  company_id: string;
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
  const [companies, setCompanies] = useState<CompanyForRenewal[]>([]);
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
  const [selectedCompany, setSelectedCompany] = useState<CompanyForRenewal | null>(null);
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
  const [companyHistory, setCompanyHistory] = useState<RenewalHistory[]>([]);
  const [historyCompanyName, setHistoryCompanyName] = useState("");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch companies with card payment method
    const { data: companiesData, error: companiesError } = await supabase
      .from("onboarding_companies")
      .select(`
        id,
        name,
        consultant_id,
        contract_start_date,
        contract_end_date,
        contract_value,
        payment_method,
        status,
        renewal_status,
        renewal_notes,
        renewal_meeting_date,
        consultant:consultant_id(name)
      `)
      .eq("payment_method", "card")
      .neq("status", "inactive")
      .not("contract_end_date", "is", null)
      .order("contract_end_date", { ascending: true });

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      toast.error("Erro ao carregar empresas");
    } else {
      const processedCompanies: CompanyForRenewal[] = (companiesData || []).map((company: any) => {
        const startDate = company.contract_start_date ? parseISO(company.contract_start_date) : null;
        const endDate = company.contract_end_date ? parseISO(company.contract_end_date) : null;
        
        let contractMonths = 1;
        if (startDate && endDate) {
          contractMonths = Math.max(1, differenceInMonths(endDate, startDate));
        }
        
        const contractValue = company.contract_value || 0;
        const monthlyValue = contractMonths > 0 ? contractValue / contractMonths : contractValue;
        
        return {
          id: company.id,
          name: company.name,
          consultant_id: company.consultant_id,
          consultant_name: company.consultant?.name || null,
          contract_start_date: company.contract_start_date,
          contract_end_date: company.contract_end_date,
          contract_value: company.contract_value,
          payment_method: company.payment_method,
          status: company.status || "active",
          renewal_status: company.renewal_status,
          renewal_notes: company.renewal_notes,
          renewal_meeting_date: company.renewal_meeting_date,
          contract_months: contractMonths,
          monthly_value: monthlyValue,
        };
      });
      
      setCompanies(processedCompanies);
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

  // Filter companies based on selected month
  const filteredCompanies = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return companies.filter(company => {
      if (!company.contract_end_date) return false;
      
      // Exclude 1-month contracts - they stay active until manually closed
      if (company.contract_months <= 1) return false;
      
      const endDate = parseISO(company.contract_end_date);
      
      // Check if contract ends in selected month
      const endsInMonth = isWithinInterval(endDate, { start: monthStart, end: monthEnd });
      
      // Check if it's a pending renewal from previous months
      const isPendingFromPast = includePending && isBefore(endDate, monthStart);
      
      if (!endsInMonth && !isPendingFromPast) return false;
      
      // Search filter
      if (searchTerm && !company.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Consultant filter
      if (filterConsultant !== "all" && company.consultant_id !== filterConsultant) {
        return false;
      }
      
      // Status filter
      if (filterStatus !== "all") {
        const companyRenewalStatus = company.renewal_status || "pendente";
        if (filterStatus !== companyRenewalStatus) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by end date ascending (most urgent first)
      const dateA = a.contract_end_date ? new Date(a.contract_end_date).getTime() : 0;
      const dateB = b.contract_end_date ? new Date(b.contract_end_date).getTime() : 0;
      return dateA - dateB;
    });
  }, [companies, selectedMonth, searchTerm, filterConsultant, filterStatus, includePending]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredCompanies.length;
    const pending = filteredCompanies.filter(c => !c.renewal_status || c.renewal_status === "pendente").length;
    const negotiating = filteredCompanies.filter(c => c.renewal_status === "em_negociacao").length;
    const renewed = filteredCompanies.filter(c => c.renewal_status === "renovado").length;
    const notRenewed = filteredCompanies.filter(c => c.renewal_status === "nao_renovado" || c.renewal_status === "cancelado").length;
    const totalValue = filteredCompanies.reduce((sum, c) => sum + (c.monthly_value || 0), 0);
    
    return { total, pending, negotiating, renewed, notRenewed, totalValue };
  }, [filteredCompanies]);

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
    
    // Show meeting date for scheduled meetings
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

  const openRenewalDialog = (company: CompanyForRenewal) => {
    setSelectedCompany(company);
    setRenewalMode("same");
    setNewMonthlyValue(company.monthly_value);
    setNewTermMonths(company.contract_months);
    
    // Default new start date: day after current end date
    if (company.contract_end_date) {
      const nextDay = addDays(parseISO(company.contract_end_date), 1);
      setNewStartDate(format(nextDay, "yyyy-MM-dd"));
    } else {
      setNewStartDate(format(new Date(), "yyyy-MM-dd"));
    }
    
    setRenewalNotes(company.renewal_notes || "");
    setRenewalStatus(company.renewal_status || "pendente");
    setRenewalMeetingDate(company.renewal_meeting_date || "");
    setRenewDialogOpen(true);
  };

  const openHistoryDialog = (company: CompanyForRenewal) => {
    const history = renewals.filter(r => r.company_id === company.id);
    setCompanyHistory(history);
    setHistoryCompanyName(company.name);
    setHistoryDialogOpen(true);
  };

  // Calculate new contract values
  const calculatedValues = useMemo(() => {
    if (!selectedCompany) return { newEndDate: "", newTotalValue: 0, monthlyValue: 0 };
    
    const monthlyValue = renewalMode === "same" ? selectedCompany.monthly_value : newMonthlyValue;
    const termMonths = renewalMode === "same" ? selectedCompany.contract_months : newTermMonths;
    
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
  }, [selectedCompany, renewalMode, newMonthlyValue, newTermMonths, newStartDate]);

  // Save only status and notes (does NOT update contract values)
  const handleSaveStatusOnly = async () => {
    if (!selectedCompany || !staffId) return;
    
    setSaving(true);
    
    try {
      // Only update renewal status, notes and meeting date - no contract changes
      const { error: updateError } = await supabase
        .from("onboarding_companies")
        .update({
          renewal_status: renewalStatus,
          renewal_notes: renewalNotes || null,
          renewal_meeting_date: renewalStatus === "reuniao_agendada" ? renewalMeetingDate || null : null,
        })
        .eq("id", selectedCompany.id);
        
      if (updateError) throw updateError;

      toast.success("Status de renovação atualizado");
      
      setRenewDialogOpen(false);
      setSelectedCompany(null);
      fetchData();
    } catch (error) {
      console.error("Error saving renewal status:", error);
      toast.error("Erro ao salvar status");
    } finally {
      setSaving(false);
    }
  };

  // Update status directly from table dropdown
  const handleInlineStatusChange = async (companyId: string, newStatus: string) => {
    try {
      // If status is "reuniao_agendada", we need to open a date picker dialog
      if (newStatus === "reuniao_agendada") {
        const company = companies.find(c => c.id === companyId);
        if (company) {
          openRenewalDialog(company);
          setRenewalStatus("reuniao_agendada");
        }
        return;
      }

      const { error } = await supabase
        .from("onboarding_companies")
        .update({
          renewal_status: newStatus,
          renewal_meeting_date: null, // Clear meeting date when changing to non-meeting status
        })
        .eq("id", companyId);
        
      if (error) throw error;

      toast.success("Status atualizado");
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  // Confirm renewal - updates contract with new values
  const handleConfirmRenewal = async () => {
    if (!selectedCompany || !staffId || !newStartDate) return;
    
    setSaving(true);
    
    try {
      const monthlyValue = renewalMode === "same" ? selectedCompany.monthly_value : newMonthlyValue;
      const termMonths = renewalMode === "same" ? selectedCompany.contract_months : newTermMonths;
      const newTotalValue = monthlyValue * termMonths;
      
      // Insert renewal history record
      const { error: renewalError } = await supabase
        .from("onboarding_contract_renewals")
        .insert({
          company_id: selectedCompany.id,
          previous_start_date: selectedCompany.contract_start_date,
          previous_end_date: selectedCompany.contract_end_date,
          previous_value: selectedCompany.contract_value,
          previous_term_months: selectedCompany.contract_months,
          new_start_date: newStartDate,
          new_end_date: calculatedValues.newEndDate,
          new_value: newTotalValue,
          new_term_months: termMonths,
          notes: renewalNotes || null,
          status: "renovado",
          created_by: staffId,
        });
        
      if (renewalError) throw renewalError;
      
      // Update company contract with new values and reset renewal status
      const { error: contractError } = await supabase
        .from("onboarding_companies")
        .update({
          contract_start_date: newStartDate,
          contract_end_date: calculatedValues.newEndDate,
          contract_value: newTotalValue,
          renewal_status: null, // Reset for next renewal cycle
          renewal_notes: null,
        })
        .eq("id", selectedCompany.id);
        
      if (contractError) throw contractError;
      
      toast.success("Contrato renovado com sucesso!");
      
      setRenewDialogOpen(false);
      setSelectedCompany(null);
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
    return companies.filter(c => {
      if (!c.contract_end_date) return false;
      const endDate = parseISO(c.contract_end_date);
      return isBefore(endDate, monthStart);
    }).length;
  }, [companies, selectedMonth]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl p-0">
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
                  placeholder="Buscar empresa..."
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
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Carregando...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Nenhuma empresa para renovar neste período
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>{company.consultant_name || "—"}</TableCell>
                          <TableCell>{formatDate(company.contract_start_date)}</TableCell>
                          <TableCell>{formatDate(company.contract_end_date)}</TableCell>
                          <TableCell className="text-right">{company.contract_months} meses</TableCell>
                          <TableCell className="text-right text-blue-500">
                            {formatCurrency(company.monthly_value)}
                          </TableCell>
                          <TableCell className="text-right text-green-500 font-medium">
                            {formatCurrency(company.contract_value || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Select
                                value={company.renewal_status || "pendente"}
                                onValueChange={(value) => handleInlineStatusChange(company.id, value)}
                              >
                                <SelectTrigger className="w-[160px] h-8 text-xs">
                                  <SelectValue>
                                    {(() => {
                                      const statusOption = RENEWAL_STATUS_OPTIONS.find(s => s.value === (company.renewal_status || "pendente"));
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
                              {company.renewal_status === "reuniao_agendada" && company.renewal_meeting_date && (
                                <span className="text-xs text-purple-500 pl-1">{formatDate(company.renewal_meeting_date)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openHistoryDialog(company)}
                                title="Histórico"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openRenewalDialog(company)}
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
            <DialogDescription>{selectedCompany?.name}</DialogDescription>
          </DialogHeader>

          {selectedCompany && (
            <div className="space-y-6 py-4">
              {/* Current Contract Info */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Contrato Atual</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="font-medium">{formatDate(selectedCompany.contract_start_date)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Término</p>
                    <p className="font-medium">{formatDate(selectedCompany.contract_end_date)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-medium">{selectedCompany.contract_months} meses</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Valor Mensal</p>
                    <p className="font-medium text-blue-500">{formatCurrency(selectedCompany.monthly_value)}</p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Valor Total do Contrato</p>
                  <p className="font-medium text-green-500 text-lg">{formatCurrency(selectedCompany.contract_value || 0)}</p>
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
                    ({formatCurrency(calculatedValues.monthlyValue)}/mês × {renewalMode === "same" ? selectedCompany.contract_months : newTermMonths} meses)
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
            <DialogDescription>{historyCompanyName}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {companyHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma renovação registrada
              </div>
            ) : (
              <div className="space-y-3">
                {companyHistory.map((renewal) => (
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
    </>
  );
}
