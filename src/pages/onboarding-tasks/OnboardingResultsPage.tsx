import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { KPIDashboardTab } from "@/components/onboarding-tasks/kpis/KPIDashboardTab";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  TrendingUp, 
  Building2,
  Users,
  Package,
  Search,
  ArrowLeft,
  ChevronRight,
  X,
  Target,
  BarChart3,
  CheckCircle2,
  Trophy,
  ThumbsUp,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Company {
  id: string;
  name: string;
  segment: string | null;
  cs_id: string | null;
  consultant_id: string | null;
  status: string;
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

const OnboardingResultsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [currentStaff, setCurrentStaff] = useState<{ id: string; name: string; role: string } | null>(null);
  
  // Selected company for detailed view
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => searchParams.get("company"));
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConsultant, setFilterConsultant] = useState<string>(() => searchParams.get("consultant") || "all");
  const [filterService, setFilterService] = useState<string>(() => searchParams.get("service") || "all");
  const [filterGoals, setFilterGoals] = useState<string>(() => searchParams.get("goals") || "all");
  const [filterResults, setFilterResults] = useState<string>(() => searchParams.get("results") || "all");
  const [filterProjection, setFilterProjection] = useState<string>(() => searchParams.get("projection") || "all");
  
  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [consultants, setConsultants] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companiesWithGoals, setCompaniesWithGoals] = useState<Set<string>>(new Set());
  const [companiesWithResults, setCompaniesWithResults] = useState<Set<string>>(new Set());
  const [companyProjections, setCompanyProjections] = useState<Map<string, number>>(new Map());

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

      // Admin, CS and Consultants can access
      if (!staff || (staff.role !== "admin" && staff.role !== "cs" && staff.role !== "consultant")) {
        toast.error("Acesso restrito");
        navigate("/onboarding-tasks");
        return;
      }

      setCurrentStaff(staff);
    };

    checkAuth();
  }, [navigate]);

  // Fetch data
  useEffect(() => {
    if (currentStaff) {
      fetchData();
    }
  }, [currentStaff]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.set("company", selectedCompanyId);
    if (filterConsultant !== "all") params.set("consultant", filterConsultant);
    if (filterService !== "all") params.set("service", filterService);
    if (filterGoals !== "all") params.set("goals", filterGoals);
    if (filterResults !== "all") params.set("results", filterResults);
    if (filterProjection !== "all") params.set("projection", filterProjection);
    setSearchParams(params, { replace: true });
  }, [selectedCompanyId, filterConsultant, filterService, filterGoals, filterResults, filterProjection, setSearchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentMonth = format(now, "yyyy-MM");
      const periodMonth = now.getMonth() + 1;
      const periodYear = now.getFullYear();
      const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
      const currentDay = now.getDate();
      const timeElapsedPercent = currentDay / daysInMonth;

      const startDate = format(startOfMonth(now), "yyyy-MM-dd");
      const endDate = format(endOfMonth(now), "yyyy-MM-dd");
      
      const [companiesRes, staffRes, servicesRes, projectsRes] = await Promise.all([
        supabase.from("onboarding_companies").select("id, name, segment, cs_id, consultant_id, status, is_simulator").eq("status", "active").order("name"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true).order("name"),
        supabase.from("onboarding_services").select("id, name").order("name"),
        supabase.from("onboarding_projects").select("id, product_id, product_name, onboarding_company_id, status").eq("status", "active"),
      ]);
      
      // Filter out simulator companies from the results
      const realCompanies = (companiesRes.data || []).filter(c => !c.is_simulator);

      setCompanies(realCompanies);
      setConsultants((staffRes.data || []).filter(s => s.role === "consultant" || s.role === "cs"));
      setServices(servicesRes.data || []);
      setProjects(projectsRes.data || []);
      
      // Build set of real company IDs (non-simulators) for filtering
      const realCompanyIds = new Set(realCompanies.map(c => c.id));
      
      // Fetch companies with KPI marked as "Meta Principal" (is_main_goal)
      // IMPORTANT: Only fetch company-level KPIs (scope = 'company' or null) for projection
      // This excludes individual salesperson, unit, team, sector KPIs
      const { data: kpisData } = await supabase
        .from("company_kpis")
        .select("id, company_id, kpi_type, target_value, periodicity, is_main_goal, scope")
        .eq("is_active", true);
      
      // Create set of company IDs that have a KPI marked as "Meta Principal"
      // Only consider company-level KPIs (scope = 'company' or null/undefined)
      const companyIdsWithGoals = new Set<string>();
      (kpisData || []).forEach(k => {
        const kpiScope = k.scope || "company";
        if (k.company_id && k.is_main_goal && kpiScope === "company") {
          companyIdsWithGoals.add(k.company_id);
        }
      });
      setCompaniesWithGoals(companyIdsWithGoals);
      
      // Create map of company -> main goal KPI IDs for projection calculation
      // IMPORTANT: When a company has a main goal KPI, ONLY use that for projection
      // Otherwise fallback to all monetary KPIs
      const mainGoalKpisByCompany = new Map<string, Set<string>>();
      const companyLevelMonetaryKpisByCompany = new Map<string, Set<string>>();
      
      (kpisData || []).forEach(k => {
        const kpiScope = k.scope || "company";
        if (kpiScope !== "company") return; // Only company-level KPIs
        
        if (!companyLevelMonetaryKpisByCompany.has(k.company_id)) {
          companyLevelMonetaryKpisByCompany.set(k.company_id, new Set());
        }
        
        if (k.kpi_type === "monetary") {
          companyLevelMonetaryKpisByCompany.get(k.company_id)!.add(k.id);
        }
        
        if (k.is_main_goal) {
          if (!mainGoalKpisByCompany.has(k.company_id)) {
            mainGoalKpisByCompany.set(k.company_id, new Set());
          }
          mainGoalKpisByCompany.get(k.company_id)!.add(k.id);
        }
      });
      
      // For projection, use main goal KPIs if exist, otherwise all monetary
      const getKpisForProjection = (companyId: string): Set<string> => {
        const mainGoalKpis = mainGoalKpisByCompany.get(companyId);
        if (mainGoalKpis && mainGoalKpis.size > 0) {
          return mainGoalKpis;
        }
        return companyLevelMonetaryKpisByCompany.get(companyId) || new Set();
      };
      
      // Create a map for KPI periodicity
      const kpiPeriodicityMap = new Map<string, { periodicity: string; target: number; isMainGoal: boolean }>();
      (kpisData || []).forEach(k => {
        const kpiScope = k.scope || "company";
        if (kpiScope === "company" && k.kpi_type === "monetary") {
          kpiPeriodicityMap.set(k.id, { 
            periodicity: k.periodicity, 
            target: k.target_value,
            isMainGoal: k.is_main_goal || false
          });
        }
      });
      
      // Fetch current month entries for all KPIs
      // IMPORTANT: backend has a default per-query limit (1000). We must paginate,
      // otherwise we will undercount companies with results.
      const entriesData: any[] = [];
      const pageSize = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("kpi_entries")
          .select(
            "kpi_id, value, entry_date, company_kpis!inner(id, company_id, kpi_type, target_value, periodicity)"
          )
          .gte("entry_date", startDate)
          .lte("entry_date", endDate)
          .not("value", "is", null)
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (data?.length) entriesData.push(...data);

        if (!data || data.length < pageSize) break;
        offset += pageSize;
      }
      
      // Fetch monthly targets for current month
      const { data: monthlyTargets } = await supabase
        .from("kpi_monthly_targets")
        .select("kpi_id, target_value")
        .eq("month_year", currentMonth);
      
      const targetMap = new Map<string, number>();
      (monthlyTargets || []).forEach(t => {
        targetMap.set(t.kpi_id, t.target_value);
      });
      
      // Calculate projection for each company (using same logic as dashboard)
      const projectionsMap = new Map<string, number>();
      const companyIdsWithResultsSet = new Set<string>();
      
      // Group entries by company - only for company-level monetary KPIs
      const entriesByCompany = new Map<string, { value: number; target: number; kpiId: string }[]>();
      
      (entriesData || []).forEach((entry: any) => {
        const companyId = entry.company_kpis?.company_id;
        const kpiType = entry.company_kpis?.kpi_type;
        if (!companyId) return;
        
        // Skip simulator companies
        if (!realCompanyIds.has(companyId)) return;
        
        companyIdsWithResultsSet.add(companyId);
        
        // Only process monetary KPIs for projection
        if (kpiType !== "monetary") return;
        
        // Get the KPIs that should be used for this company's projection
        const kpisForProjection = getKpisForProjection(companyId);
        
        // Skip if this KPI is not in the projection set
        if (!kpisForProjection.has(entry.kpi_id)) return;
        
        // Get target: first from monthly targets, then from KPI default
        const monthlyTarget = targetMap.get(entry.kpi_id);
        const kpiInfo = kpiPeriodicityMap.get(entry.kpi_id);
        const defaultTarget = kpiInfo?.target || entry.company_kpis?.target_value || 0;
        const periodicity = kpiInfo?.periodicity || entry.company_kpis?.periodicity || "monthly";
        
        // Calculate monthly target based on periodicity (same as dashboard)
        let calculatedTarget = monthlyTarget ?? defaultTarget;
        if (!monthlyTarget) {
          if (periodicity === "daily") {
            calculatedTarget = defaultTarget * daysInMonth;
          } else if (periodicity === "weekly") {
            calculatedTarget = defaultTarget * Math.ceil(daysInMonth / 7);
          }
        }
        
        if (!entriesByCompany.has(companyId)) {
          entriesByCompany.set(companyId, []);
        }
        entriesByCompany.get(companyId)!.push({
          value: entry.value || 0,
          target: calculatedTarget,
          kpiId: entry.kpi_id
        });
      });
      
      // Calculate projection for each company (same formula as dashboard)
      entriesByCompany.forEach((entries, companyId) => {
        // Sum all values and targets
        let totalRealized = 0;
        let totalTarget = 0;
        
        // Group by KPI and sum values
        const kpiTotals = new Map<string, { total: number; target: number }>();
        entries.forEach(e => {
          if (!kpiTotals.has(e.kpiId)) {
            kpiTotals.set(e.kpiId, { total: 0, target: e.target });
          }
          kpiTotals.get(e.kpiId)!.total += e.value;
        });
        
        // Sum totals
        kpiTotals.forEach(({ total, target }) => {
          totalRealized += total;
          totalTarget += target;
        });
        
        // Calculate projection with time elapsed (same formula as dashboard)
        // projectionPercent = ((totalRealized / totalTarget) / timeElapsedPercent) * 100
        if (totalTarget > 0 && timeElapsedPercent > 0) {
          const projectionPercent = Math.round(((totalRealized / totalTarget) / timeElapsedPercent) * 100);
          projectionsMap.set(companyId, projectionPercent);
        }
      });
      
      setCompaniesWithResults(companyIdsWithResultsSet);
      setCompanyProjections(projectionsMap);
      
      console.log("Companies with KPIs configured:", Array.from(companyIdsWithGoals));
      console.log("Companies with results:", Array.from(companyIdsWithResultsSet));
      console.log("Company projections:", Object.fromEntries(projectionsMap));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Helper to check projection range
  const getProjectionRange = (companyId: string): string | null => {
    const projection = companyProjections.get(companyId);
    if (projection === undefined) return null;
    if (projection >= 100) return "above_100";
    if (projection >= 70) return "70_99";
    if (projection >= 50) return "50_69";
    return "below_50";
  };

  // Filtered companies - consultants only see their own companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Consultants can only see their own companies
      if (currentStaff?.role === "consultant") {
        if (company.consultant_id !== currentStaff.id && company.cs_id !== currentStaff.id) {
          return false;
        }
      }
      
      // Search filter
      const matchesSearch = searchTerm === "" || 
        company.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Consultant filter
      const matchesConsultant = filterConsultant === "all" || 
        company.cs_id === filterConsultant || 
        company.consultant_id === filterConsultant;
      
      // Service filter
      let matchesService = filterService === "all";
      if (!matchesService) {
        const companyProjects = projects.filter(p => p.onboarding_company_id === company.id);
        matchesService = companyProjects.some(p => p.product_id === filterService);
      }
      
      // Goals filter
      let matchesGoals = filterGoals === "all";
      if (!matchesGoals) {
        const hasGoals = companiesWithGoals.has(company.id);
        matchesGoals = filterGoals === "with_goals" ? hasGoals : !hasGoals;
      }
      
      // Results filter
      let matchesResults = filterResults === "all";
      if (!matchesResults) {
        const hasResults = companiesWithResults.has(company.id);
        matchesResults = filterResults === "with_results" ? hasResults : !hasResults;
      }
      
      // Projection filter
      let matchesProjection = filterProjection === "all";
      if (!matchesProjection) {
        const range = getProjectionRange(company.id);
        matchesProjection = range === filterProjection;
      }
      
      return matchesSearch && matchesConsultant && matchesService && matchesGoals && matchesResults && matchesProjection;
    });
  }, [companies, searchTerm, filterConsultant, filterService, filterGoals, filterResults, filterProjection, projects, currentStaff, companiesWithGoals, companiesWithResults, companyProjections]);

  const clearFilters = () => {
    setSearchTerm("");
    // Don't reset consultant filter for consultants since it's not visible
    if (currentStaff?.role !== "consultant") {
      setFilterConsultant("all");
    }
    setFilterService("all");
    setFilterGoals("all");
    setFilterResults("all");
    setFilterProjection("all");
  };

  // For consultants, don't consider consultant filter as active since they only see their own companies
  const hasActiveFilters = (currentStaff?.role !== "consultant" && filterConsultant !== "all") || filterService !== "all" || filterGoals !== "all" || filterResults !== "all" || filterProjection !== "all" || searchTerm !== "";
  
  // Count companies with/without results based on filtered list (excluding the results filter itself)
  const baseFilteredCompanies = useMemo(() => {
    return companies.filter(company => {
      // Consultants can only see their own companies
      if (currentStaff?.role === "consultant") {
        if (company.consultant_id !== currentStaff.id && company.cs_id !== currentStaff.id) {
          return false;
        }
      }
      
      // Search filter
      const matchesSearch = searchTerm === "" || 
        company.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Consultant filter
      const matchesConsultant = filterConsultant === "all" || 
        company.cs_id === filterConsultant || 
        company.consultant_id === filterConsultant;
      
      // Service filter
      let matchesService = filterService === "all";
      if (!matchesService) {
        const companyProjects = projects.filter(p => p.onboarding_company_id === company.id);
        matchesService = companyProjects.some(p => p.product_id === filterService);
      }
      
      // Goals filter
      let matchesGoals = filterGoals === "all";
      if (!matchesGoals) {
        const hasGoals = companiesWithGoals.has(company.id);
        matchesGoals = filterGoals === "with_goals" ? hasGoals : !hasGoals;
      }
      
      return matchesSearch && matchesConsultant && matchesService && matchesGoals;
    });
  }, [companies, searchTerm, filterConsultant, filterService, filterGoals, projects, currentStaff, companiesWithGoals]);

  const companiesWithResultsCount = useMemo(() => {
    return baseFilteredCompanies.filter(company => companiesWithResults.has(company.id)).length;
  }, [baseFilteredCompanies, companiesWithResults]);

  const companiesWithoutResultsCount = useMemo(() => {
    return baseFilteredCompanies.filter(company => !companiesWithResults.has(company.id)).length;
  }, [baseFilteredCompanies, companiesWithResults]);

  // Projection-based counters for companies with results
  const projectionCounts = useMemo(() => {
    const companiesWithResultsList = baseFilteredCompanies.filter(c => companiesWithResults.has(c.id));
    
    return {
      above100: companiesWithResultsList.filter(c => {
        const proj = companyProjections.get(c.id);
        return proj !== undefined && proj >= 100;
      }).length,
      range70to99: companiesWithResultsList.filter(c => {
        const proj = companyProjections.get(c.id);
        return proj !== undefined && proj >= 70 && proj < 100;
      }).length,
      range50to69: companiesWithResultsList.filter(c => {
        const proj = companyProjections.get(c.id);
        return proj !== undefined && proj >= 50 && proj < 70;
      }).length,
      below50: companiesWithResultsList.filter(c => {
        const proj = companyProjections.get(c.id);
        return proj !== undefined && proj < 50;
      }).length,
    };
  }, [baseFilteredCompanies, companiesWithResults, companyProjections]);

  // Get selected company data
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find(c => c.id === selectedCompanyId) || null;
  }, [selectedCompanyId, companies]);

  // Get consultant name
  const getConsultantName = (id: string | null) => {
    if (!id) return null;
    return consultants.find(c => c.id === id)?.name || null;
  };

  // Get project for company
  const getProjectForCompany = (companyId: string) => {
    return projects.find(p => p.onboarding_company_id === companyId);
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
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => {
                if (selectedCompanyId) {
                  setSelectedCompanyId(null);
                } else {
                  navigate("/onboarding-tasks");
                }
              }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader showTitle={false} />
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {selectedCompany ? selectedCompany.name : "Resultados"}
                </h1>
                {selectedCompany && (
                  <p className="text-xs text-muted-foreground">
                    Dashboard de KPIs
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Show company list or KPI Dashboard */}
        {selectedCompanyId && selectedCompany ? (
          /* KPI Dashboard for selected company */
          <div>
            {/* Company Info Bar */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{selectedCompany.name}</h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {selectedCompany.segment && (
                          <span>{selectedCompany.segment}</span>
                        )}
                        {getConsultantName(selectedCompany.consultant_id) && (
                          <>
                            <span>•</span>
                            <span>{getConsultantName(selectedCompany.consultant_id)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const project = getProjectForCompany(selectedCompanyId);
                        if (project) {
                          navigate(`/onboarding-tasks/${project.id}?tab=kpis`);
                        } else {
                          navigate(`/onboarding-tasks/companies/${selectedCompanyId}`);
                        }
                      }}
                    >
                      Ver Projeto Completo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI Dashboard Component */}
            <KPIDashboardTab 
              companyId={selectedCompanyId} 
              projectId={getProjectForCompany(selectedCompanyId)?.id}
              canDeleteEntries={currentStaff.role === "admin" || currentStaff.role === "cs" || currentStaff.role === "consultant"}
              canEditSalesHistory={currentStaff.role === "admin" || currentStaff.role === "cs" || currentStaff.role === "consultant"}
            />
          </div>
        ) : (
          /* Company List */
          <>
            {/* Results Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {/* With Results */}
              <Card 
                className={`cursor-pointer transition-colors ${filterResults === "with_results" && filterProjection === "all" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setFilterProjection("all");
                  setFilterResults(filterResults === "with_results" ? "all" : "with_results");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{companiesWithResultsCount}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Com lançamentos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Without Results */}
              <Card 
                className={`cursor-pointer transition-colors ${filterResults === "without_results" ? "ring-2 ring-primary" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setFilterProjection("all");
                  setFilterResults(filterResults === "without_results" ? "all" : "without_results");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{companiesWithoutResultsCount}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Sem lançamentos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Above 100% */}
              <Card 
                className={`cursor-pointer transition-colors ${filterProjection === "above_100" ? "ring-2 ring-emerald-500" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setFilterResults("all");
                  setFilterProjection(filterProjection === "above_100" ? "all" : "above_100");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{projectionCounts.above100}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Acima de 100%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 70-99% */}
              <Card 
                className={`cursor-pointer transition-colors ${filterProjection === "70_99" ? "ring-2 ring-blue-500" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setFilterResults("all");
                  setFilterProjection(filterProjection === "70_99" ? "all" : "70_99");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <ThumbsUp className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{projectionCounts.range70to99}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Entre 70% e 99%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 50-69% */}
              <Card 
                className={`cursor-pointer transition-colors ${filterProjection === "50_69" ? "ring-2 ring-amber-500" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setFilterResults("all");
                  setFilterProjection(filterProjection === "50_69" ? "all" : "50_69");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{projectionCounts.range50to69}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Entre 50% e 69%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Below 50% */}
              <Card 
                className={`cursor-pointer transition-colors ${filterProjection === "below_50" ? "ring-2 ring-red-500" : "hover:bg-muted/50"}`}
                onClick={() => {
                  setFilterResults("all");
                  setFilterProjection(filterProjection === "below_50" ? "all" : "below_50");
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{projectionCounts.below50}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Abaixo de 50%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Buscar empresa</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite o nome da empresa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Consultant filter - hidden for consultants since they only see their own companies */}
                  {currentStaff.role !== "consultant" && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Consultor/CS</Label>
                      <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                        <SelectTrigger className="w-[180px]">
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
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Serviço</Label>
                    <Select value={filterService} onValueChange={setFilterService}>
                      <SelectTrigger className="w-[180px]">
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

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Metas</Label>
                    <Select value={filterGoals} onValueChange={setFilterGoals}>
                      <SelectTrigger className="w-[160px]">
                        <Target className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="with_goals">Com metas</SelectItem>
                        <SelectItem value="without_goals">Sem metas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Resultados</Label>
                    <Select value={filterResults} onValueChange={setFilterResults}>
                      <SelectTrigger className="w-[160px]">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="with_results">Com lançamentos</SelectItem>
                        <SelectItem value="without_results">Sem lançamentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Companies List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma empresa encontrada</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Limpar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? 's' : ''} encontrada{filteredCompanies.length !== 1 ? 's' : ''}
                </p>
                {filteredCompanies.map((company) => {
                  const project = getProjectForCompany(company.id);
                  const consultantName = getConsultantName(company.consultant_id);
                  const csName = getConsultantName(company.cs_id);
                  const projection = companyProjections.get(company.id);
                  const hasResults = companiesWithResults.has(company.id);
                  
                  // Determine projection badge styling
                  const getProjectionBadge = () => {
                    if (!hasResults || projection === undefined) return null;
                    
                    if (projection >= 100) {
                      return (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
                          <Trophy className="h-3 w-3 mr-1" />
                          {projection.toFixed(0)}%
                        </Badge>
                      );
                    }
                    if (projection >= 70) {
                      return (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {projection.toFixed(0)}%
                        </Badge>
                      );
                    }
                    if (projection >= 50) {
                      return (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {projection.toFixed(0)}%
                        </Badge>
                      );
                    }
                    return (
                      <Badge className="bg-red-500/10 text-red-600 border-red-200 text-[10px]">
                        <XCircle className="h-3 w-3 mr-1" />
                        {projection.toFixed(0)}%
                      </Badge>
                    );
                  };
                  
                  return (
                    <Card 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedCompanyId(company.id)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium">{company.name}</h3>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                {company.segment && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {company.segment}
                                  </Badge>
                                )}
                                {project && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {project.product_name}
                                  </Badge>
                                )}
                                {consultantName && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {consultantName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getProjectionBadge()}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingResultsPage;
