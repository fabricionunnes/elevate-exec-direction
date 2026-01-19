import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  Building2,
  Clock,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Heart,
} from "lucide-react";
import { getRiskLevelInfo } from "@/hooks/useHealthScore";

interface Staff {
  id: string;
  name: string;
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
  total_paid: number;
  contract_months: number;
  avg_ticket: number;
  health_score: number | null;
  health_risk: string | null;
}

type SortField = "name" | "consultant_name" | "contract_start_date" | "contract_end_date" | "contract_months" | "total_paid" | "avg_ticket" | "status" | "payment_method" | "health_score";
type SortDirection = "asc" | "desc";

export default function CompaniesReportContent() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyReport[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("health_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch staff
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
    const { data: companiesData } = await supabase
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
    
    // Merge companies
    const allCompaniesMap = new Map<string, any>();
    
    (companiesWithoutProjects || []).forEach((c: any) => {
      allCompaniesMap.set(c.id, { ...c, onboarding_projects: [] });
    });
    
    (companiesData || []).forEach((c: any) => {
      allCompaniesMap.set(c.id, c);
    });
    
    const mergedCompanies = Array.from(allCompaniesMap.values());

    // Process companies
    const processedCompanies: CompanyReport[] = mergedCompanies.map((company: any) => {
      const startDate = company.contract_start_date ? parseISO(company.contract_start_date) : null;
      const endDate = company.contract_end_date ? parseISO(company.contract_end_date) : null;
      const now = new Date();

      let contractMonths = 1;
      if (startDate) {
        if (endDate && endDate > startDate) {
          contractMonths = Math.max(1, differenceInMonths(endDate, startDate));
        } else {
          contractMonths = Math.max(1, differenceInMonths(now, startDate));
        }
      }

      let monthlyValue = 0;
      const contractValue = company.contract_value || 0;
      
      if (endDate && startDate) {
        const contractDuration = Math.max(1, differenceInMonths(endDate, startDate));
        monthlyValue = contractDuration > 0 ? contractValue / contractDuration : contractValue;
      } else {
        monthlyValue = contractValue;
      }

      const totalPaid = monthlyValue * contractMonths;
      const avgTicket = endDate ? monthlyValue : contractValue;

      // Get health score
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
          const totalScore = projectsWithScores.reduce((sum: number, p: any) => {
            const score = Array.isArray(p.client_health_scores) 
              ? p.client_health_scores[0]?.total_score 
              : p.client_health_scores?.total_score;
            return sum + (score || 0);
          }, 0);
          healthScore = Math.round(totalScore / projectsWithScores.length);
          
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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(term));
    }

    if (filterConsultant !== "all") {
      result = result.filter(c => c.consultant_id === filterConsultant);
    }

    if (filterStatus !== "all") {
      result = result.filter(c => c.status === filterStatus);
    }

    if (filterPaymentMethod !== "all") {
      if (filterPaymentMethod === "none") {
        result = result.filter(c => !c.payment_method);
      } else {
        result = result.filter(c => c.payment_method === filterPaymentMethod);
      }
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "health_score") {
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
      } else {
        if (aVal === null || aVal === undefined) aVal = sortField === "name" || sortField === "consultant_name" ? "" : 0;
        if (bVal === null || bVal === undefined) bVal = sortField === "name" || sortField === "consultant_name" ? "" : 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal, "pt-BR") 
          : bVal.localeCompare(aVal, "pt-BR");
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [companies, searchTerm, filterConsultant, filterStatus, filterPaymentMethod, sortField, sortDirection]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalLTV = filteredCompanies.reduce((sum, c) => sum + c.total_paid, 0);
    const totalMonths = filteredCompanies.reduce((sum, c) => sum + c.contract_months, 0);
    const avgTicketGeneral = totalMonths > 0 ? totalLTV / totalMonths : 0;
    const companyCount = filteredCompanies.length;

    return {
      totalLTV,
      avgTicketGeneral,
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
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Ativo</Badge>;
      case "closed":
      case "completed":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Encerrado</Badge>;
      case "cancellation_signaled":
      case "notice_period":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Em Aviso</Badge>;
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Relatório de Empresas
        </h2>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de contratos, LTV e saúde das empresas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Empresas</p>
                <p className="text-3xl font-bold">{summaryMetrics.companyCount}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">LTV Total</p>
                <p className="text-3xl font-bold">{formatCurrency(summaryMetrics.totalLTV)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-3xl font-bold">{formatCurrency(summaryMetrics.avgTicketGeneral)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterConsultant} onValueChange={setFilterConsultant}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos consultores</SelectItem>
            {staff.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="closed">Encerrado</SelectItem>
            <SelectItem value="cancellation_signaled">Em Aviso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
            <SelectItem value="Boleto">Boleto</SelectItem>
            <SelectItem value="PIX">PIX</SelectItem>
            <SelectItem value="none">Não informado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Empresa
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("consultant_name")}
                >
                  <div className="flex items-center">
                    Consultor
                    <SortIcon field="consultant_name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("health_score")}
                >
                  <div className="flex items-center">
                    <Heart className="h-4 w-4 mr-1" />
                    Saúde
                    <SortIcon field="health_score" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("contract_months")}
                >
                  <div className="flex items-center">
                    Meses
                    <SortIcon field="contract_months" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("avg_ticket")}
                >
                  <div className="flex items-center">
                    Ticket Médio
                    <SortIcon field="avg_ticket" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("total_paid")}
                >
                  <div className="flex items-center">
                    LTV
                    <SortIcon field="total_paid" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon field="status" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => {
                  const healthInfo = company.health_risk 
                    ? getRiskLevelInfo(company.health_risk)
                    : null;

                  return (
                    <TableRow 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/onboarding-tasks/companies/${company.id}`)}
                    >
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.consultant_name || "—"}</TableCell>
                      <TableCell>
                        {company.health_score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${healthInfo?.color || ""}`}>
                              {company.health_score}
                            </span>
                            {healthInfo && (
                              <Badge className={`${healthInfo.bg} ${healthInfo.color} border-0 text-xs`}>
                                {healthInfo.label}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{company.contract_months}</TableCell>
                      <TableCell>{formatCurrency(company.avg_ticket)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(company.total_paid)}</TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
