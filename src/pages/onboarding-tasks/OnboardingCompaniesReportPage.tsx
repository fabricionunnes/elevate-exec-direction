import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, differenceInMonths, parseISO } from "date-fns";
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
} from "lucide-react";

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
  status: string;
  // Calculated fields
  total_paid: number;
  contract_months: number;
  avg_ticket: number;
}

type SortField = "name" | "consultant_name" | "contract_start_date" | "contract_months" | "total_paid" | "avg_ticket" | "status";
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

  // Sorting
  const [sortField, setSortField] = useState<SortField>("total_paid");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
        status,
        consultant:consultant_id(name)
      `)
      .order("name");

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      toast.error("Erro ao carregar empresas");
      setLoading(false);
      return;
    }

    // Process companies and calculate metrics
    const processedCompanies: CompanyReport[] = (companiesData || []).map((company: any) => {
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

      return {
        id: company.id,
        name: company.name,
        consultant_id: company.consultant_id,
        consultant_name: company.consultant?.name || null,
        contract_start_date: company.contract_start_date,
        contract_end_date: company.contract_end_date,
        contract_value: company.contract_value,
        status: company.status || "active",
        total_paid: totalPaid,
        contract_months: contractMonths,
        avg_ticket: avgTicket,
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

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle nulls
      if (aVal === null || aVal === undefined) aVal = sortField === "name" || sortField === "consultant_name" ? "" : 0;
      if (bVal === null || bVal === undefined) bVal = sortField === "name" || sortField === "consultant_name" ? "" : 0;

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
  }, [companies, searchTerm, filterConsultant, filterStatus, sortField, sortDirection]);

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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-green-500" />
                LTV Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl sm:text-2xl font-bold text-green-500">
                {formatCurrency(summaryMetrics.totalLTV)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Valor total recebido
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
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <ScrollArea className="h-[calc(100vh-480px)] min-h-[400px]">
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
                    onClick={() => handleSort("contract_start_date")}
                  >
                    <div className="flex items-center">
                      Data Início
                      <SortIcon field="contract_start_date" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort("contract_months")}
                  >
                    <div className="flex items-center justify-end">
                      Prazo (meses)
                      <SortIcon field="contract_months" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort("total_paid")}
                  >
                    <div className="flex items-center justify-end">
                      Valor Total
                      <SortIcon field="total_paid" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort("avg_ticket")}
                  >
                    <div className="flex items-center justify-end">
                      Ticket Médio
                      <SortIcon field="avg_ticket" />
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
                  filteredCompanies.map((company) => (
                    <TableRow 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/onboarding-tasks/companies/${company.id}`)}
                    >
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.consultant_name || "—"}</TableCell>
                      <TableCell>{formatDate(company.contract_start_date)}</TableCell>
                      <TableCell className="text-right">{company.contract_months}</TableCell>
                      <TableCell className="text-right font-medium text-green-500">
                        {formatCurrency(company.total_paid)}
                      </TableCell>
                      <TableCell className="text-right text-blue-500">
                        {formatCurrency(company.avg_ticket)}/mês
                      </TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
