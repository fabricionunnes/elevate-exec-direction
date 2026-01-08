import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Percent, 
  Hash, 
  Building2,
  Users,
  Package,
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  Cell
} from "recharts";

interface Company {
  id: string;
  name: string;
  cs_id: string | null;
  consultant_id: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface Service {
  id: string;
  name: string;
}

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  onboarding_company_id: string | null;
  status: string;
}

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  company_id: string;
  target_value: number;
}

interface KPIEntry {
  id: string;
  kpi_id: string;
  value: number;
  entry_date: string;
  company_id: string;
}

interface MonthlyTarget {
  kpi_id: string;
  company_id: string;
  target_value: number;
  level_name: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B'];

const OnboardingResultsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [currentStaff, setCurrentStaff] = useState<{ id: string; name: string; role: string } | null>(null);
  
  // Filter states from URL or defaults
  const [selectedMonth, setSelectedMonth] = useState(() => searchParams.get("month") || format(new Date(), "yyyy-MM"));
  const [selectedCompany, setSelectedCompany] = useState<string>(() => searchParams.get("company") || "all");
  const [selectedConsultant, setSelectedConsultant] = useState<string>(() => searchParams.get("consultant") || "all");
  const [selectedService, setSelectedService] = useState<string>(() => searchParams.get("service") || "all");
  
  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [consultants, setConsultants] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [entries, setEntries] = useState<KPIEntry[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);

  // Check staff permissions
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/onboarding-tasks/login");
        return;
      }

      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!staff || (staff.role !== "admin" && staff.role !== "cs")) {
        toast.error("Acesso restrito a Admin e CS");
        navigate("/onboarding-tasks");
        return;
      }

      setCurrentStaff(staff);
    };

    checkAuth();
  }, [navigate]);

  // Fetch filters data
  useEffect(() => {
    if (currentStaff) {
      fetchFiltersData();
    }
  }, [currentStaff]);

  // Fetch KPI data when filters change
  useEffect(() => {
    if (currentStaff && companies.length > 0) {
      fetchKPIData();
    }
  }, [currentStaff, companies, selectedMonth, selectedCompany, selectedConsultant, selectedService]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedMonth !== format(new Date(), "yyyy-MM")) params.set("month", selectedMonth);
    if (selectedCompany !== "all") params.set("company", selectedCompany);
    if (selectedConsultant !== "all") params.set("consultant", selectedConsultant);
    if (selectedService !== "all") params.set("service", selectedService);
    setSearchParams(params, { replace: true });
  }, [selectedMonth, selectedCompany, selectedConsultant, selectedService, setSearchParams]);

  const fetchFiltersData = async () => {
    try {
      const [companiesRes, staffRes, servicesRes, projectsRes] = await Promise.all([
        supabase.from("onboarding_companies").select("id, name, cs_id, consultant_id").eq("status", "active").order("name"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        supabase.from("onboarding_services").select("id, name").order("name"),
        supabase.from("onboarding_projects").select("id, product_id, product_name, onboarding_company_id, status").eq("status", "active"),
      ]);

      setCompanies(companiesRes.data || []);
      setConsultants((staffRes.data || []).filter(s => s.role === "consultant" || s.role === "cs"));
      setServices(servicesRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error("Error fetching filters data:", error);
    }
  };

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      // Calculate date range for selected month
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");

      // Get filtered company IDs
      let filteredCompanyIds: string[] = [];
      
      if (selectedCompany !== "all") {
        filteredCompanyIds = [selectedCompany];
      } else {
        // Apply consultant and service filters
        let companyList = [...companies];
        
        if (selectedConsultant !== "all") {
          companyList = companyList.filter(c => 
            c.cs_id === selectedConsultant || c.consultant_id === selectedConsultant
          );
        }
        
        if (selectedService !== "all") {
          const companyIdsWithService = projects
            .filter(p => p.product_id === selectedService && p.onboarding_company_id)
            .map(p => p.onboarding_company_id!);
          companyList = companyList.filter(c => companyIdsWithService.includes(c.id));
        }
        
        filteredCompanyIds = companyList.map(c => c.id);
      }

      if (filteredCompanyIds.length === 0) {
        setKpis([]);
        setEntries([]);
        setMonthlyTargets([]);
        setLoading(false);
        return;
      }

      // Fetch KPIs for filtered companies
      const [kpisRes, entriesRes, targetsRes] = await Promise.all([
        supabase
          .from("company_kpis")
          .select("id, name, kpi_type, company_id, target_value")
          .in("company_id", filteredCompanyIds)
          .eq("is_active", true),
        supabase
          .from("kpi_entries")
          .select("id, kpi_id, value, entry_date, company_id")
          .in("company_id", filteredCompanyIds)
          .gte("entry_date", startDate)
          .lte("entry_date", endDate),
        supabase
          .from("kpi_monthly_targets")
          .select("kpi_id, company_id, target_value, level_name")
          .in("company_id", filteredCompanyIds)
          .eq("month_year", selectedMonth)
          .is("unit_id", null)
          .is("salesperson_id", null),
      ]);

      setKpis((kpisRes.data || []) as KPI[]);
      setEntries(entriesRes.data || []);
      setMonthlyTargets(targetsRes.data || []);
    } catch (error) {
      console.error("Error fetching KPI data:", error);
      toast.error("Erro ao carregar dados de KPIs");
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(format(prevDate, "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(format(nextDate, "yyyy-MM"));
  };

  const clearFilters = () => {
    setSelectedCompany("all");
    setSelectedConsultant("all");
    setSelectedService("all");
  };

  const hasActiveFilters = selectedCompany !== "all" || selectedConsultant !== "all" || selectedService !== "all";

  // Aggregate KPIs by type
  const aggregatedData = useMemo(() => {
    const kpiGroups: Record<string, { 
      name: string; 
      type: string; 
      realized: number; 
      target: number;
      companies: Set<string>;
    }> = {};

    kpis.forEach(kpi => {
      const normalizedName = kpi.name.toLowerCase().trim();
      
      if (!kpiGroups[normalizedName]) {
        kpiGroups[normalizedName] = {
          name: kpi.name,
          type: kpi.kpi_type,
          realized: 0,
          target: 0,
          companies: new Set(),
        };
      }
      
      // Sum entries for this KPI
      const kpiEntries = entries.filter(e => e.kpi_id === kpi.id);
      kpiGroups[normalizedName].realized += kpiEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Get target (monthly target or default)
      const monthlyTarget = monthlyTargets.find(t => t.kpi_id === kpi.id);
      kpiGroups[normalizedName].target += monthlyTarget?.target_value ?? kpi.target_value;
      
      kpiGroups[normalizedName].companies.add(kpi.company_id);
    });

    return Object.values(kpiGroups).map(g => ({
      ...g,
      companies: g.companies.size,
      percentage: g.target > 0 ? (g.realized / g.target) * 100 : 0,
    }));
  }, [kpis, entries, monthlyTargets]);

  // Revenue totals (monetary KPIs)
  const revenueTotals = useMemo(() => {
    const monetaryKpis = aggregatedData.filter(k => k.type === "monetary");
    const realized = monetaryKpis.reduce((sum, k) => sum + k.realized, 0);
    const target = monetaryKpis.reduce((sum, k) => sum + k.target, 0);
    return { realized, target, percentage: target > 0 ? (realized / target) * 100 : 0 };
  }, [aggregatedData]);

  // Companies with data
  const companiesWithData = useMemo(() => {
    const companyIds = new Set(entries.map(e => e.company_id));
    return companies.filter(c => companyIds.has(c.id));
  }, [companies, entries]);

  // Per-company revenue breakdown
  const companyBreakdown = useMemo(() => {
    const breakdown: { id: string; name: string; realized: number; target: number; percentage: number }[] = [];
    
    companies.forEach(company => {
      const companyKpis = kpis.filter(k => k.company_id === company.id && k.kpi_type === "monetary");
      if (companyKpis.length === 0) return;
      
      let realized = 0;
      let target = 0;
      
      companyKpis.forEach(kpi => {
        const kpiEntries = entries.filter(e => e.kpi_id === kpi.id);
        realized += kpiEntries.reduce((sum, e) => sum + e.value, 0);
        
        const monthlyTarget = monthlyTargets.find(t => t.kpi_id === kpi.id);
        target += monthlyTarget?.target_value ?? kpi.target_value;
      });
      
      if (realized > 0 || target > 0) {
        breakdown.push({
          id: company.id,
          name: company.name,
          realized,
          target,
          percentage: target > 0 ? (realized / target) * 100 : 0,
        });
      }
    });
    
    return breakdown.sort((a, b) => b.realized - a.realized);
  }, [companies, kpis, entries, monthlyTargets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  };

  const formatValue = (value: number, type: string) => {
    if (type === "monetary") return formatCurrency(value);
    if (type === "percentage") return `${value.toFixed(1)}%`;
    return value.toLocaleString("pt-BR");
  };

  const getKpiIcon = (type: string) => {
    switch (type) {
      case "monetary": return <DollarSign className="h-4 w-4" />;
      case "percentage": return <Percent className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: ptBR });
  }, [selectedMonth]);

  const navigateToCompany = (companyId: string) => {
    // Find project for this company
    const project = projects.find(p => p.onboarding_company_id === companyId);
    if (project) {
      navigate(`/onboarding-tasks/${project.id}?tab=kpis`);
    } else {
      navigate(`/onboarding-tasks/companies/${companyId}`);
    }
  };

  if (!currentStaff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <NexusHeader />
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                Resultados Consolidados
              </h1>
              <p className="text-sm text-muted-foreground">
                Dashboard de KPIs de todas as empresas
              </p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={() => fetchKPIData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Month Navigation */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 min-w-[200px] justify-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-semibold capitalize">{monthLabel}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger className="w-[200px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Consultor/CS</Label>
                <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
                  <SelectTrigger className="w-[200px]">
                    <Users className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {consultants.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Serviço</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-[200px]">
                    <Package className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os serviços</SelectItem>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                  <X className="h-4 w-4 mr-1" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-96" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Faturamento Total</p>
                      <p className="text-2xl font-bold">{formatCurrency(revenueTotals.realized)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Meta: {formatCurrency(revenueTotals.target)}
                      </p>
                    </div>
                    <div className={`text-2xl font-bold ${revenueTotals.percentage >= 100 ? 'text-green-500' : revenueTotals.percentage >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                      {revenueTotals.percentage.toFixed(0)}%
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Empresas com Dados</p>
                      <p className="text-2xl font-bold">{companiesWithData.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        de {companies.length} empresas ativas
                      </p>
                    </div>
                    <Building2 className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Lançamentos</p>
                      <p className="text-2xl font-bold">{entries.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        neste mês
                      </p>
                    </div>
                    <Hash className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KPI Summary Cards */}
            {aggregatedData.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {aggregatedData.slice(0, 8).map((kpi, idx) => (
                  <Card key={idx} className="relative overflow-hidden">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-muted">
                          {getKpiIcon(kpi.type)}
                        </div>
                        <span className="text-xs font-medium truncate">{kpi.name}</span>
                      </div>
                      <p className="text-lg font-bold">
                        {formatValue(kpi.realized, kpi.type)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>Meta: {formatValue(kpi.target, kpi.type)}</span>
                        <Badge variant={kpi.percentage >= 100 ? "default" : kpi.percentage >= 70 ? "secondary" : "destructive"} className="text-[10px] h-5">
                          {kpi.percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Company Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Faturamento por Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companyBreakdown.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum dado de faturamento encontrado para este período</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {companyBreakdown.map((company, idx) => (
                      <div
                        key={company.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                        onClick={() => navigateToCompany(company.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{company.name}</span>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  company.percentage >= 100 ? 'bg-green-500' : company.percentage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(company.percentage, 100)}%` }}
                              />
                            </div>
                            <Badge
                              variant={company.percentage >= 100 ? "default" : company.percentage >= 70 ? "secondary" : "destructive"}
                              className="text-[10px] h-5 shrink-0"
                            >
                              {company.percentage.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{formatCurrency(company.realized)}</p>
                          <p className="text-xs text-muted-foreground">Meta: {formatCurrency(company.target)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPIs Table */}
            {aggregatedData.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Todos os KPIs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">KPI</th>
                          <th className="text-right py-2 px-3 font-medium">Realizado</th>
                          <th className="text-right py-2 px-3 font-medium">Meta</th>
                          <th className="text-right py-2 px-3 font-medium">%</th>
                          <th className="text-right py-2 px-3 font-medium">Empresas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aggregatedData.map((kpi, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="p-1 rounded bg-muted">
                                  {getKpiIcon(kpi.type)}
                                </div>
                                <span>{kpi.name}</span>
                              </div>
                            </td>
                            <td className="text-right py-3 px-3 font-medium">
                              {formatValue(kpi.realized, kpi.type)}
                            </td>
                            <td className="text-right py-3 px-3 text-muted-foreground">
                              {formatValue(kpi.target, kpi.type)}
                            </td>
                            <td className="text-right py-3 px-3">
                              <Badge variant={kpi.percentage >= 100 ? "default" : kpi.percentage >= 70 ? "secondary" : "destructive"}>
                                {kpi.percentage.toFixed(0)}%
                              </Badge>
                            </td>
                            <td className="text-right py-3 px-3 text-muted-foreground">
                              {kpi.companies}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingResultsPage;
