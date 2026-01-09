import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { format, differenceInMonths, parseISO, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import {
  ArrowLeft,
  RefreshCw,
  DollarSign,
  Building2,
  Clock,
  Search,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  RotateCw,
  Heart,
} from "lucide-react";
import RenewalsPanel from "@/components/onboarding-tasks/RenewalsPanel";
import { getRiskLevelInfo } from "@/hooks/useHealthScore";

interface Staff {
  id: string;
  name: string;
}

interface HealthScore {
  project_id: string;
  total_score: number;
  risk_level: string;
}

interface CompanyReport {
  id: string;
  name: string;
  consultant_id: string | null;
  consultant_name: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  payment_method: string | null;
  status: string;
  // Calculated fields
  total_paid: number;
  contract_months: number;
  avg_ticket: number;
  // Health score
  health_score: number | null;
  health_risk: string | null;
}

type SortField = "name" | "consultant_name" | "contract_start_date" | "contract_end_date" | "contract_months" | "total_paid" | "avg_ticket" | "status" | "payment_method" | "health_score";
type SortDirection = "asc" | "desc";

export default function OnboardingCompaniesReportPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyReport[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterEndDateFrom, setFilterEndDateFrom] = useState<string>("");
  const [filterEndDateTo, setFilterEndDateTo] = useState<string>("");
  const [filterHealthMin, setFilterHealthMin] = useState<number>(0);
  const [filterHealthMax, setFilterHealthMax] = useState<number>(100);

  // Sorting - default to health_score ascending (worst first)
  const [sortField, setSortField] = useState<SortField>("health_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyReport | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editDurationMonths, setEditDurationMonths] = useState<number>(12);
  const [editContractValue, setEditContractValue] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Renewals panel state
  const [renewalsPanelOpen, setRenewalsPanelOpen] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/onboarding-tasks/login");
      return;
    }

    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staffData) {
      navigate("/onboarding-tasks/login");
      return;
    }

    if (staffData.role !== "admin") {
      toast.error("Acesso restrito a administradores");
      navigate("/onboarding-tasks");
      return;
    }

    setStaffId(staffData.id);
    setIsAdmin(true);
    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch staff (only consultants)
    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .eq("role", "consultant")
      .order("name");

    if (staffData) {
      setStaff(staffData);
    }

    // Fetch companies with consultant info
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
        consultant:consultant_id(name),
        onboarding_projects!inner(
          id,
          status,
          client_health_scores(total_score, risk_level)
        )
      `)
      .order("name");
    
    // Also fetch companies without projects
    const { data: companiesWithoutProjects } = await supabase
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
        consultant:consultant_id(name)
      `)
      .order("name");
    
    // Merge - companies without projects won't have health scores
    const allCompaniesMap = new Map<string, any>();
    
    // First add all companies (those without projects)
    (companiesWithoutProjects || []).forEach((c: any) => {
      allCompaniesMap.set(c.id, { ...c, onboarding_projects: [] });
    });
    
    // Then overlay with companies that have projects (with health scores)
    (companiesData || []).forEach((c: any) => {
      allCompaniesMap.set(c.id, c);
    });
    
    const mergedCompanies = Array.from(allCompaniesMap.values());

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      toast.error("Erro ao carregar empresas");
      setLoading(false);
      return;
    }

    // Process companies and calculate metrics
    const processedCompanies: CompanyReport[] = mergedCompanies.map((company: any) => {
      const startDate = company.contract_start_date ? parseISO(company.contract_start_date) : null;
      const endDate = company.contract_end_date ? parseISO(company.contract_end_date) : null;
      const now = new Date();

      // Calculate contract months (how long the company has been a client)
      let contractMonths = 1;
      if (startDate) {
        if (endDate && endDate > startDate) {
          // Contract ended - use the contract duration
          contractMonths = Math.max(1, differenceInMonths(endDate, startDate));
        } else {
          // Ongoing contract - count months from start until now
          contractMonths = Math.max(1, differenceInMonths(now, startDate));
        }
      }

      // Calculate monthly value:
      // - If there's an end date: contract_value is TOTAL, so divide by contract duration
      // - If there's NO end date: contract_value is already MONTHLY
      let monthlyValue = 0;
      const contractValue = company.contract_value || 0;
      
      if (endDate && startDate) {
        // Contract has end date - value is total, calculate monthly
        const contractDuration = Math.max(1, differenceInMonths(endDate, startDate));
        monthlyValue = contractDuration > 0 ? contractValue / contractDuration : contractValue;
      } else {
        // No end date - value is already monthly
        monthlyValue = contractValue;
      }

      // Total paid = monthly value * months active
      const totalPaid = monthlyValue * contractMonths;

      // Average ticket = monthly value
      const avgTicket = monthlyValue;

      // Get health score from projects - only count active projects
      let healthScore: number | null = null;
      let healthRisk: string | null = null;
      
      const projects = company.onboarding_projects || [];
      const activeProjects = projects.filter((p: any) => 
        p.status !== 'completed' && p.status !== 'closed'
      );
      
      if (activeProjects.length > 0) {
        const projectsWithScores = activeProjects.filter(
          (p: any) => p.client_health_scores && 
            (Array.isArray(p.client_health_scores) 
              ? p.client_health_scores.length > 0 
              : p.client_health_scores.total_score !== undefined)
        );
        
        if (projectsWithScores.length > 0) {
          // Average health score across all active projects with scores
          const totalScore = projectsWithScores.reduce((sum: number, p: any) => {
            const score = Array.isArray(p.client_health_scores) 
              ? p.client_health_scores[0]?.total_score 
              : p.client_health_scores?.total_score;
            return sum + (score || 0);
          }, 0);
          healthScore = Math.round(totalScore / projectsWithScores.length);
          
          // Use the risk level of the worst project
          const riskLevels = projectsWithScores.map((p: any) => {
            return Array.isArray(p.client_health_scores) 
              ? p.client_health_scores[0]?.risk_level 
              : p.client_health_scores?.risk_level;
          }).filter(Boolean);
          
          const riskPriority = ['critical', 'high', 'medium', 'low'];
          healthRisk = riskLevels.sort((a: string, b: string) => 
            riskPriority.indexOf(a) - riskPriority.indexOf(b)
          )[0] || null;
        }
      }

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
        total_paid: totalPaid,
        contract_months: contractMonths,
        avg_ticket: avgTicket,
        health_score: healthScore,
        health_risk: healthRisk,
      };
    });

    setCompanies(processedCompanies);
    setLoading(false);
  };

  // Filtered and sorted companies
  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(term));
    }

    // Filter by consultant
    if (filterConsultant !== "all") {
      result = result.filter(c => c.consultant_id === filterConsultant);
    }

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter(c => c.status === filterStatus);
    }

    // Filter by payment method
    if (filterPaymentMethod !== "all") {
      if (filterPaymentMethod === "none") {
        result = result.filter(c => !c.payment_method);
      } else {
        result = result.filter(c => c.payment_method === filterPaymentMethod);
      }
    }

    // Filter by contract end date period
    if (filterEndDateFrom) {
      result = result.filter(c => {
        if (!c.contract_end_date) return false;
        return c.contract_end_date >= filterEndDateFrom;
      });
    }
    if (filterEndDateTo) {
      result = result.filter(c => {
        if (!c.contract_end_date) return false;
        return c.contract_end_date <= filterEndDateTo;
      });
    }

    // Filter by health score range
    if (filterHealthMin > 0 || filterHealthMax < 100) {
      result = result.filter(c => {
        if (c.health_score === null) return filterHealthMin === 0;
        return c.health_score >= filterHealthMin && c.health_score <= filterHealthMax;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nulls - for health score, nulls go to the end
      if (sortField === "health_score") {
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
      } else {
        if (aVal === null || aVal === undefined) aVal = sortField === "name" || sortField === "consultant_name" ? "" : 0;
        if (bVal === null || bVal === undefined) bVal = sortField === "name" || sortField === "consultant_name" ? "" : 0;
      }

      // String comparison
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal, "pt-BR") 
          : bVal.localeCompare(aVal, "pt-BR");
      }

      // Number comparison
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [companies, searchTerm, filterConsultant, filterStatus, filterPaymentMethod, filterEndDateFrom, filterEndDateTo, filterHealthMin, filterHealthMax, sortField, sortDirection]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalLTV = filteredCompanies.reduce((sum, c) => sum + c.total_paid, 0);
    const totalMonths = filteredCompanies.reduce((sum, c) => sum + c.contract_months, 0);
    const avgTicketGeneral = totalMonths > 0 ? totalLTV / totalMonths : 0;
    const totalContractValue = filteredCompanies.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    const companyCount = filteredCompanies.length;

    return {
      totalLTV,
      avgTicketGeneral,
      totalContractValue,
      companyCount,
    };
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case "closed":
      case "completed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Encerrado</Badge>;
      case "cancellation_signaled":
      case "notice_period":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Em Aviso</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/onboarding-tasks/login");
  };

  const openEditDialog = (company: CompanyReport, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCompany(company);
    setEditStartDate(company.contract_start_date || "");
    
    // Calculate duration in months from start to end date
    if (company.contract_start_date && company.contract_end_date) {
      const start = parseISO(company.contract_start_date);
      const end = parseISO(company.contract_end_date);
      setEditDurationMonths(Math.max(1, differenceInMonths(end, start)));
    } else {
      setEditDurationMonths(0); // 0 means ongoing/monthly
    }
    
    setEditContractValue(company.contract_value || 0);
    setEditPaymentMethod(company.payment_method || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCompany) return;

    setSaving(true);
    try {
      // Calculate end date based on duration
      let endDate: string | null = null;
      if (editDurationMonths > 0 && editStartDate) {
        const start = parseISO(editStartDate);
        endDate = format(addMonths(start, editDurationMonths), "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("onboarding_companies")
        .update({
          contract_start_date: editStartDate || null,
          contract_end_date: endDate,
          contract_value: editContractValue,
          payment_method: editPaymentMethod || null,
        })
        .eq("id", editingCompany.id);

      if (error) throw error;

      toast.success("Contrato atualizado com sucesso!");
      setEditDialogOpen(false);
      setEditingCompany(null);
      fetchData();
    } catch (error) {
      console.error("Error updating contract:", error);
      toast.error("Erro ao atualizar contrato");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/onboarding-tasks")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NexusHeader title="Relatório de Empresas" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRenewalsPanelOpen(true)}
              className="bg-primary"
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Renovações
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>

        {/* Renewals Panel */}
        <RenewalsPanel
          open={renewalsPanelOpen}
          onOpenChange={setRenewalsPanelOpen}
          staffId={staffId}
          staff={staff}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-green-500" />
                Valor Total Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl sm:text-2xl font-bold text-green-500">
                {formatCurrency(summaryMetrics.totalLTV)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Soma dos pagamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Ticket Médio
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl sm:text-2xl font-bold text-blue-500">
                {formatCurrency(summaryMetrics.avgTicketGeneral)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Por mês (ponderado)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4 text-purple-500" />
                Valor Mensal Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl sm:text-2xl font-bold text-purple-500">
                {formatCurrency(summaryMetrics.totalContractValue)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Soma dos contratos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="h-4 w-4 text-orange-500" />
                Empresas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl sm:text-2xl font-bold text-orange-500">
                {summaryMetrics.companyCount}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                No filtro atual
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Consultor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os consultores</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="closed">Encerrado</SelectItem>
                      <SelectItem value="notice_period">Em Aviso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-44">
                  <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos pagamentos</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="monthly">Recorrência</SelectItem>
                      <SelectItem value="none">Não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Date period filter */}
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 sm:flex-none">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Término de</Label>
                  <Input
                    type="date"
                    value={filterEndDateFrom}
                    onChange={(e) => setFilterEndDateFrom(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                <div className="flex-1 sm:flex-none">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Término até</Label>
                  <Input
                    type="date"
                    value={filterEndDateTo}
                    onChange={(e) => setFilterEndDateTo(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>
                {(filterEndDateFrom || filterEndDateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterEndDateFrom("");
                      setFilterEndDateTo("");
                    }}
                    className="text-muted-foreground"
                  >
                    Limpar período
                  </Button>
                )}
              </div>
              {/* Health score filter */}
              <div className="flex flex-col gap-3 p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" fill="currentColor" />
                    <Label className="text-sm font-medium">Filtrar por Saúde</Label>
                  </div>
                  {(filterHealthMin > 0 || filterHealthMax < 100) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterHealthMin(0);
                        setFilterHealthMax(100);
                      }}
                      className="text-muted-foreground text-xs h-7"
                    >
                      Limpar filtro
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[80px]">
                    <div className={`w-3 h-3 rounded-full ${filterHealthMin < 40 ? "bg-red-500" : filterHealthMin < 60 ? "bg-orange-500" : filterHealthMin < 80 ? "bg-yellow-500" : "bg-green-500"}`} />
                    <span className="text-sm font-medium">{filterHealthMin}</span>
                  </div>
                  <div className="flex-1">
                    <Slider
                      value={[filterHealthMin, filterHealthMax]}
                      onValueChange={(value) => {
                        setFilterHealthMin(value[0]);
                        setFilterHealthMax(value[1]);
                      }}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 min-w-[80px] justify-end">
                    <span className="text-sm font-medium">{filterHealthMax}</span>
                    <div className={`w-3 h-3 rounded-full ${filterHealthMax < 40 ? "bg-red-500" : filterHealthMax < 60 ? "bg-orange-500" : filterHealthMax < 80 ? "bg-yellow-500" : "bg-green-500"}`} />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                  <span className="text-red-500">Crítico (0-39)</span>
                  <span className="text-orange-500">Alto (40-59)</span>
                  <span className="text-yellow-500">Médio (60-79)</span>
                  <span className="text-green-500">Saudável (80-100)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <ScrollArea className="h-[calc(100vh-500px)] sm:h-[calc(100vh-480px)] min-h-[300px] sm:min-h-[400px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Empresa
                        <SortIcon field="name" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap hidden sm:table-cell"
                      onClick={() => handleSort("consultant_name")}
                    >
                      <div className="flex items-center">
                        Consultor
                        <SortIcon field="consultant_name" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap hidden md:table-cell"
                      onClick={() => handleSort("contract_start_date")}
                    >
                      <div className="flex items-center">
                        Início
                        <SortIcon field="contract_start_date" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap hidden sm:table-cell"
                      onClick={() => handleSort("contract_end_date")}
                    >
                      <div className="flex items-center">
                        Término
                        <SortIcon field="contract_end_date" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right text-xs sm:text-sm whitespace-nowrap hidden lg:table-cell"
                      onClick={() => handleSort("contract_months")}
                    >
                      <div className="flex items-center justify-end">
                        Meses
                        <SortIcon field="contract_months" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right text-xs sm:text-sm whitespace-nowrap"
                      onClick={() => handleSort("total_paid")}
                    >
                      <div className="flex items-center justify-end">
                        <span className="hidden sm:inline">Valor Total</span>
                        <span className="sm:hidden">Total</span>
                        <SortIcon field="total_paid" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right text-xs sm:text-sm whitespace-nowrap hidden md:table-cell"
                      onClick={() => handleSort("avg_ticket")}
                    >
                      <div className="flex items-center justify-end">
                        Ticket
                        <SortIcon field="avg_ticket" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon field="status" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap"
                      onClick={() => handleSort("health_score")}
                    >
                      <div className="flex items-center">
                        <Heart className="h-3 w-3 mr-1" />
                        Saúde
                        <SortIcon field="health_score" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs sm:text-sm whitespace-nowrap hidden lg:table-cell"
                      onClick={() => handleSort("payment_method")}
                    >
                      <div className="flex items-center">
                        Pgto
                        <SortIcon field="payment_method" />
                      </div>
                    </TableHead>
                    <TableHead className="w-10 sm:w-12"></TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map((company) => (
                    <TableRow 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/onboarding-tasks/companies/${company.id}`)}
                    >
                      <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[120px] sm:max-w-none">{company.name}</span>
                          {/* Show consultant on mobile inline */}
                          <span className="text-[10px] text-muted-foreground sm:hidden">{company.consultant_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs sm:text-sm py-2 sm:py-4">{company.consultant_name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs sm:text-sm py-2 sm:py-4">{formatDate(company.contract_start_date)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs sm:text-sm py-2 sm:py-4">{company.payment_method === "monthly" ? "—" : formatDate(company.contract_end_date)}</TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-xs sm:text-sm py-2 sm:py-4">{company.contract_months}</TableCell>
                      <TableCell className="text-right font-medium text-green-500 text-xs sm:text-sm py-2 sm:py-4">
                        {formatCurrency(company.total_paid)}
                      </TableCell>
                      <TableCell className="text-right text-blue-500 hidden md:table-cell text-xs sm:text-sm py-2 sm:py-4">
                        {formatCurrency(company.avg_ticket)}/mês
                      </TableCell>
                      <TableCell className="py-2 sm:py-4">{getStatusBadge(company.status)}</TableCell>
                      <TableCell className="py-2 sm:py-4">
                        {company.health_score !== null ? (
                          <div className="flex items-center gap-1.5">
                            <Heart 
                              className={`h-3.5 w-3.5 ${
                                company.health_score >= 80 ? "text-green-500" :
                                company.health_score >= 60 ? "text-yellow-500" :
                                company.health_score >= 40 ? "text-orange-500" :
                                "text-red-500"
                              }`}
                              fill="currentColor"
                            />
                            <span className={`text-xs font-medium ${
                              company.health_score >= 80 ? "text-green-500" :
                              company.health_score >= 60 ? "text-yellow-500" :
                              company.health_score >= 40 ? "text-orange-500" :
                              "text-red-500"
                            }`}>
                              {company.health_score}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-2 sm:py-4">
                        {company.payment_method === "card" ? (
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] sm:text-xs">Cartão</Badge>
                        ) : company.payment_method === "monthly" ? (
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] sm:text-xs">Recorrência</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 sm:py-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={(e) => openEditDialog(company, e)}
                        >
                          <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Edit Contract Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Editar Contrato</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editingCompany?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="startDate" className="text-xs sm:text-sm">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="h-9 sm:h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="duration" className="text-xs sm:text-sm">Prazo (meses)</Label>
              <Input
                id="duration"
                type="number"
                min={0}
                value={editDurationMonths}
                onChange={(e) => setEditDurationMonths(parseInt(e.target.value) || 0)}
                placeholder="0 = mensal/sem prazo"
                className="h-9 sm:h-10 text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Use 0 para contratos mensais (sem término)
              </p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="value" className="text-xs sm:text-sm">Valor do Contrato (R$)</Label>
              <Input
                id="value"
                type="number"
                min={0}
                step={0.01}
                value={editContractValue}
                onChange={(e) => setEditContractValue(parseFloat(e.target.value) || 0)}
                className="h-9 sm:h-10 text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {editDurationMonths > 0 
                  ? "Valor TOTAL (será dividido pelo prazo)"
                  : "Valor MENSAL do contrato"
                }
              </p>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="paymentMethod" className="text-xs sm:text-sm">Forma de Pagamento</Label>
              <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="card">Cartão (pagamento único)</SelectItem>
                  <SelectItem value="monthly">Recorrência mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} size="sm" className="h-9">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} size="sm" className="h-9">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
