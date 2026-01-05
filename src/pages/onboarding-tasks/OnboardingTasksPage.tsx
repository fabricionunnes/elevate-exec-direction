import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FolderOpen, Search, ArrowLeft, Users, Calendar, CheckCircle2, Building2, ChevronRight, LogOut, Package, ChevronDown, X, Upload, ChevronLeft } from "lucide-react";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import { format, isBefore, startOfDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateProjectDialog } from "@/components/onboarding-tasks/CreateProjectDialog";
import { TaskNotificationsDialog } from "@/components/onboarding-tasks/TaskNotificationsDialog";
import DashboardMetrics from "@/components/onboarding-tasks/DashboardMetrics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface OnboardingProject {
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  onboarding_company_id: string | null;
  consultant_id: string | null;
  cs_id: string | null;
  current_nps?: number | null;
  reactivated_at?: string | null;
  tasks_count?: number;
  completed_count?: number;
}

interface Company {
  id: string;
  name: string;
  segment: string | null;
  status: string;
  cs_id: string | null;
  consultant_id: string | null;
  cs?: Staff;
  consultant?: Staff;
  kickoff_date: string | null;
  contract_end_date: string | null;
  status_changed_at?: string | null;
  created_at: string;
  projects?: OnboardingProject[];
  total_tasks?: number;
  completed_tasks?: number;
}

const OnboardingTasksPage = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  
  // Filter states
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [consultants, setConsultants] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  // Dashboard filter states
  const [activeMetricFilter, setActiveMetricFilter] = useState<{ type: string; value: string } | null>(null);
  const [dateRange, setDateRange] = useState(() => ({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  }));
  const [allTasks, setAllTasks] = useState<{ id: string; status: string; due_date: string | null; project_id: string; responsible_staff_id: string | null }[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; product_id: string; product_name: string; status: string; created_at: string; updated_at: string; consultant_id: string | null; reactivated_at: string | null; onboarding_company_id: string | null }[]>([]);
  const [npsResponses, setNpsResponses] = useState<{ project_id: string }[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<{ project_id: string; month: number; year: number; sales_target: number | null; sales_result: number | null }[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const companiesPerPage = 10;

  useEffect(() => {
    checkUserPermissions();
    fetchCompanies();
    fetchFiltersData();
    fetchAllTasks();
    fetchNpsResponses();
    fetchMonthlyGoals();
  }, []);

  const fetchAllTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select("id, status, due_date, project_id, responsible_staff_id");

      if (error) throw error;
      setAllTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchNpsResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_nps_responses")
        .select("project_id");

      if (error) throw error;
      setNpsResponses(data || []);
    } catch (error) {
      console.error("Error fetching NPS responses:", error);
    }
  };

  const fetchMonthlyGoals = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_monthly_goals")
        .select("project_id, month, year, sales_target, sales_result");

      if (error) throw error;
      setMonthlyGoals(data || []);
    } catch (error) {
      console.error("Error fetching monthly goals:", error);
    }
  };

  const checkUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .single();
        
        if (staffMember) {
          setCurrentUserRole(staffMember.role);
          setCurrentStaffId(staffMember.id);
          
          // For consultants, auto-filter to their own projects
          if (staffMember.role === "consultant") {
            setFilterConsultant(staffMember.id);
          }
        }
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const fetchFiltersData = async () => {
    try {
      // Fetch consultants
      const { data: consultantsData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("role", "consultant")
        .eq("is_active", true)
        .order("name");
      
      setConsultants(consultantsData || []);

      // Fetch services
      const { data: servicesData } = await supabase
        .from("onboarding_services")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name");
      
      setServices(servicesData || []);
    } catch (error) {
      console.error("Error fetching filters data:", error);
    }
  };

  const fetchCompanies = async () => {
    try {
      // Fetch companies with staff info
      const { data: companiesData, error: companiesError } = await supabase
        .from("onboarding_companies")
        .select(`
          *,
          cs:onboarding_staff!onboarding_companies_cs_id_fkey(id, name, role),
          consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(id, name, role)
        `)
        .order("name");

      if (companiesError) throw companiesError;

      // Fetch all projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("onboarding_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch task counts for each project
      const projectsWithCounts = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { count: tasksCount } = await supabase
            .from("onboarding_tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);

          const { count: completedCount } = await supabase
            .from("onboarding_tasks")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id)
            .eq("status", "completed");

          return {
            ...project,
            tasks_count: tasksCount || 0,
            completed_count: completedCount || 0,
          };
        })
      );

      // Group projects by company
      const companiesWithProjects = (companiesData || []).map((company) => {
        const companyProjects = projectsWithCounts.filter(
          (p) => p.onboarding_company_id === company.id
        );
        const totalTasks = companyProjects.reduce((acc, p) => acc + (p.tasks_count || 0), 0);
        const completedTasks = companyProjects.reduce((acc, p) => acc + (p.completed_count || 0), 0);

        return {
          ...company,
          projects: companyProjects,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
        };
      });

      // Store all projects for dashboard metrics
      setAllProjects((projectsData || []).map(p => ({
        id: p.id,
        product_id: p.product_id,
        product_name: p.product_name,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        consultant_id: p.consultant_id,
        reactivated_at: p.reactivated_at,
        onboarding_company_id: p.onboarding_company_id,
      })));

      setCompanies(companiesWithProjects);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  // Calculate overdue and today tasks for dashboard
  const overdueTasks = useMemo(() => {
    const todayStart = startOfDay(new Date());
    return allTasks.filter(t => {
      if (!t.due_date || t.status === "completed") return false;
      const dueDate = new Date(t.due_date);
      return isBefore(dueDate, todayStart);
    });
  }, [allTasks]);

  const todayTasks = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return allTasks.filter(t => t.due_date === today);
  }, [allTasks]);

  // Handle metric card filter
  const handleMetricFilterChange = (filter: { type: string; value: string } | null) => {
    setActiveMetricFilter(filter);
    // When clicking on a status card, also update the status filter
    if (filter?.type === "status") {
      setFilterStatus(filter.value);
    } else if (filter === null) {
      // Clear metric filter but keep other filters
    }
  };

  // Get set of project IDs that have NPS responses
  const projectsWithNpsResponse = useMemo(() => {
    return new Set(npsResponses.map(r => r.project_id));
  }, [npsResponses]);

  // Calculate projects by goal projection ranges for the selected period (respects all filters)
  const projectsGoalRanges = useMemo(() => {
    const periodMonth = dateRange.start.getMonth() + 1;
    const periodYear = dateRange.start.getFullYear();
    
    // Calculate time elapsed percentage in the month
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === periodMonth && today.getFullYear() === periodYear;
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const timeElapsedPercent = currentDay / daysInMonth;
    
    // Get company IDs that match the status filter
    const statusFilteredCompanyIds = filterStatus === "all" 
      ? null 
      : new Set(companies.filter(c => c.status === filterStatus).map(c => c.id));
    
    // Build set of filtered project IDs based on consultant, service, and status filters
    const filteredProjectIdSet = new Set(
      allProjects
        .filter((project) => {
          const matchesConsultant = 
            filterConsultant === "all" || 
            project.consultant_id === filterConsultant;
          
          const matchesService = 
            filterService === "all" || 
            project.product_id === filterService;
          
          const matchesStatus = statusFilteredCompanyIds === null || 
            (project.onboarding_company_id && statusFilteredCompanyIds.has(project.onboarding_company_id));
          
          return matchesConsultant && matchesService && matchesStatus;
        })
        .map(p => p.id)
    );
    
    const meetingGoalIds = new Set<string>(); // >=100%
    const above70Ids = new Set<string>(); // 70-99%
    const between50And70Ids = new Set<string>(); // 50-69%
    const below50Ids = new Set<string>(); // <50%
    const projectsWithGoalsIds = new Set<string>(); // Projects that have goals for this period
    
    monthlyGoals.forEach(g => {
      // Only include goals for filtered projects
      if (
        filteredProjectIdSet.has(g.project_id) &&
        g.month === periodMonth &&
        g.year === periodYear &&
        g.sales_target && g.sales_target > 0
      ) {
        projectsWithGoalsIds.add(g.project_id);
        
        const result = g.sales_result || 0;
        const achievementPercent = result / g.sales_target;
        // Project to end of month based on time elapsed
        const projectionPercent = timeElapsedPercent > 0 
          ? Math.round((achievementPercent / timeElapsedPercent) * 100)
          : 0;
        
        if (projectionPercent >= 100) {
          meetingGoalIds.add(g.project_id);
        } else if (projectionPercent >= 70) {
          above70Ids.add(g.project_id);
        } else if (projectionPercent >= 50) {
          between50And70Ids.add(g.project_id);
        } else {
          below50Ids.add(g.project_id);
        }
      }
    });
    
    // Projects without goals: filtered projects that don't have a goal for this period
    const noGoalIds = new Set<string>();
    filteredProjectIdSet.forEach(projectId => {
      if (!projectsWithGoalsIds.has(projectId)) {
        noGoalIds.add(projectId);
      }
    });
    
    return {
      meetingGoal: meetingGoalIds,
      above70: above70Ids,
      between50And70: between50And70Ids,
      below50: below50Ids,
      noGoal: noGoalIds
    };
  }, [monthlyGoals, dateRange, allProjects, filterConsultant, filterService, filterStatus, companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Text search filter
      const matchesSearch =
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.segment && company.segment.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Consultant filter - check company's consultant OR project's consultant OR tasks with this consultant responsible
      const matchesConsultant = 
        filterConsultant === "all" || 
        company.consultant_id === filterConsultant ||
        company.projects?.some(p => p.consultant_id === filterConsultant) ||
        company.projects?.some(p => 
          allTasks.some(t => t.project_id === p.id && t.responsible_staff_id === filterConsultant)
        );
      
      // Service filter - check if company has any project with the selected service (using slug)
      const matchesService = 
        filterService === "all" || 
        company.projects?.some(p => p.product_id === filterService);
      
      // Status filter - filter by project (service) status, not company status
      // When filtering via metric cards, also check if status changed in selected period
      const matchesStatus = 
        filterStatus === "all" || 
        company.projects?.some(p => p.status === filterStatus);
      
      // Metric card filters
      let matchesMetricFilter = true;
      if (activeMetricFilter) {
        const today = startOfDay(new Date());
        
        if (activeMetricFilter.type === "contracts" && activeMetricFilter.value === "ending") {
          // Filter companies with contracts ending in the selected period
          if (!company.contract_end_date) {
            matchesMetricFilter = false;
          } else {
            const endDate = new Date(company.contract_end_date);
            matchesMetricFilter = isWithinInterval(endDate, { start: dateRange.start, end: dateRange.end });
          }
        } else if (activeMetricFilter.type === "contracts" && activeMetricFilter.value === "expired") {
          // Filter companies with expired contracts (end date before today)
          if (!company.contract_end_date) {
            matchesMetricFilter = false;
          } else {
            const endDate = new Date(company.contract_end_date);
            matchesMetricFilter = isBefore(endDate, today);
          }
        } else if (activeMetricFilter.type === "nps" && activeMetricFilter.value === "responded") {
          // Filter companies that have at least one project with NPS response
          matchesMetricFilter = company.projects?.some(p => projectsWithNpsResponse.has(p.id)) ?? false;
        } else if (activeMetricFilter.type === "nps" && activeMetricFilter.value === "not_responded") {
          // Filter companies that have at least one project WITHOUT NPS response
          matchesMetricFilter = company.projects?.some(p => !projectsWithNpsResponse.has(p.id)) ?? false;
        } else if (activeMetricFilter.type === "status" && activeMetricFilter.value === "reactivated") {
          // Filter companies with projects reactivated in the period
          matchesMetricFilter = company.projects?.some(p => {
            if (!p.reactivated_at) return false;
            const reactivatedDate = new Date(p.reactivated_at);
            return isWithinInterval(reactivatedDate, { start: dateRange.start, end: dateRange.end });
          }) ?? false;
        } else if (activeMetricFilter.type === "status") {
          // For status filters from cards (active, cancellation_signaled, notice_period), 
          // filter by projects that changed to this status in the selected period
          matchesMetricFilter = company.projects?.some(p => {
            if (p.status !== activeMetricFilter.value) return false;
            const updatedAt = new Date(p.updated_at);
            return isWithinInterval(updatedAt, { start: dateRange.start, end: dateRange.end });
          }) ?? false;
        } else if (activeMetricFilter.type === "goals") {
          // Filter by goal projection ranges
          if (activeMetricFilter.value === "meeting") {
            matchesMetricFilter = company.projects?.some(p => projectsGoalRanges.meetingGoal.has(p.id)) ?? false;
          } else if (activeMetricFilter.value === "100plus") {
            matchesMetricFilter = company.projects?.some(p => projectsGoalRanges.meetingGoal.has(p.id)) ?? false;
          } else if (activeMetricFilter.value === "above70") {
            matchesMetricFilter = company.projects?.some(p => projectsGoalRanges.above70.has(p.id)) ?? false;
          } else if (activeMetricFilter.value === "between50and70") {
            matchesMetricFilter = company.projects?.some(p => projectsGoalRanges.between50And70.has(p.id)) ?? false;
          } else if (activeMetricFilter.value === "below50") {
            matchesMetricFilter = company.projects?.some(p => projectsGoalRanges.below50.has(p.id)) ?? false;
          } else if (activeMetricFilter.value === "noGoal") {
            matchesMetricFilter = company.projects?.some(p => projectsGoalRanges.noGoal.has(p.id)) ?? false;
          }
        }
      }
      
      return matchesSearch && matchesConsultant && matchesService && matchesStatus && matchesMetricFilter;
    });
  }, [companies, searchTerm, filterConsultant, filterService, filterStatus, activeMetricFilter, dateRange, projectsWithNpsResponse, projectsGoalRanges]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterConsultant, filterService, filterStatus, activeMetricFilter]);

  // Paginated companies
  const totalPages = Math.ceil(filteredCompanies.length / companiesPerPage);
  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * companiesPerPage;
    return filteredCompanies.slice(startIndex, startIndex + companiesPerPage);
  }, [filteredCompanies, currentPage, companiesPerPage]);

  // Filtered projects for dashboard metrics (respects consultant, service, and status filters)
  const filteredProjects = useMemo(() => {
    // Get company IDs that match the status filter
    const statusFilteredCompanyIds = filterStatus === "all" 
      ? null 
      : new Set(companies.filter(c => c.status === filterStatus).map(c => c.id));
    
    return allProjects.filter((project) => {
      const matchesConsultant = 
        filterConsultant === "all" || 
        project.consultant_id === filterConsultant;
      
      const matchesService = 
        filterService === "all" || 
        project.product_id === filterService;
      
      // Check if project belongs to a company that matches status filter
      const matchesStatus = statusFilteredCompanyIds === null || 
        (project.onboarding_company_id && statusFilteredCompanyIds.has(project.onboarding_company_id));
      
      return matchesConsultant && matchesService && matchesStatus;
    });
  }, [allProjects, filterConsultant, filterService, filterStatus, companies]);

  // For consultants, don't show consultant filter as active since it's auto-applied
  const hasActiveFilters = (currentUserRole !== "consultant" && filterConsultant !== "all") || filterService !== "all" || filterStatus !== "all" || activeMetricFilter !== null;

  const clearFilters = () => {
    // For consultants, keep their own filter active
    if (currentUserRole !== "consultant") {
      setFilterConsultant("all");
    }
    setFilterService("all");
    setFilterStatus("all");
    setActiveMetricFilter(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "cancellation_signaled":
        return <Badge className="bg-amber-500">Sinalizou Cancelamento</Badge>;
      case "notice_period":
        return <Badge className="bg-orange-500">Cumprindo Aviso</Badge>;
      case "closed":
        return <Badge variant="destructive">Encerrado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCompanyClick = (companyId: string) => {
    setExpandedCompanyId(expandedCompanyId === companyId ? null : companyId);
  };

  const isAdmin = currentUserRole === "admin";
  const canCreateCompany = currentUserRole === "admin" || currentUserRole === "cs";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Gestão de Onboarding</h1>
              <p className="text-muted-foreground">
                Gerencie tarefas e acompanhamento de clientes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => navigate("/onboarding-tasks/import")}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Button>
                <Button variant="outline" onClick={() => navigate("/onboarding-tasks/services")}>
                  <Package className="h-4 w-4 mr-2" />
                  Serviços
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => navigate("/onboarding-tasks/staff")}>
              <Users className="h-4 w-4 mr-2" />
              Equipe
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Building2 className="h-4 w-4 mr-2" />
                  Empresas
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {canCreateCompany && (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/companies/new")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Empresa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <div className="px-2 py-2">
                  <Input
                    placeholder="Buscar empresa..."
                    value={companySearchTerm}
                    onChange={(e) => setCompanySearchTerm(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <DropdownMenuSeparator />
                {companies.length > 0 ? (
                  <ScrollArea className="max-h-64">
                    {companies
                      .filter((c) => c.name.toLowerCase().includes(companySearchTerm.toLowerCase()))
                      .slice(0, 20)
                      .map((company) => (
                        <DropdownMenuItem
                          key={company.id}
                          onClick={() => navigate(`/onboarding-tasks/companies/${company.id}`)}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{company.name}</span>
                          <Badge variant={company.status === "active" ? "default" : "secondary"} className="ml-2 text-xs">
                            {company.status === "active" ? "Ativa" : company.status}
                          </Badge>
                        </DropdownMenuItem>
                      ))}
                    {companies.filter((c) => c.name.toLowerCase().includes(companySearchTerm.toLowerCase())).length === 0 && (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Nenhuma empresa encontrada
                      </div>
                    )}
                  </ScrollArea>
                ) : (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    Nenhuma empresa cadastrada
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/onboarding-tasks/login");
              }}
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Date Period Selector */}
          <MonthYearPicker 
            value={dateRange.start} 
            onChange={setDateRange} 
          />

          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou segmento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          
          {/* Only show consultant filter for admins and CS */}
          {currentUserRole !== "consultant" && (
            <Select value={filterConsultant} onValueChange={setFilterConsultant}>
              <SelectTrigger className="w-[150px] h-10">
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos consultores</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="w-[150px] h-10">
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos serviços</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="cancellation_signaled">Sinalizou Cancelamento</SelectItem>
              <SelectItem value="notice_period">Cumprindo Aviso</SelectItem>
              <SelectItem value="closed">Encerrado</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}

          {activeMetricFilter && (
            <Button variant="outline" size="sm" onClick={() => handleMetricFilterChange(null)} className="h-10">
              <X className="h-4 w-4 mr-1" />
              Limpar card
            </Button>
          )}
        </div>

        {/* Dashboard Metrics */}
        <DashboardMetrics 
          companies={companies} 
          projects={filteredProjects}
          onFilterChange={handleMetricFilterChange}
          activeMetricFilter={activeMetricFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          overdueTasks={overdueTasks}
          todayTasks={todayTasks}
        />

        {/* Companies List */}
        {filteredCompanies.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma empresa encontrada</h3>
            <p className="text-muted-foreground mb-4">
              {canCreateCompany
                ? "Cadastre sua primeira empresa para começar"
                : "Aguarde o cadastro de empresas pelo CS ou Admin"}
            </p>
            {canCreateCompany && (
              <Button onClick={() => navigate("/onboarding-tasks/companies/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Companies count and pagination info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Mostrando {((currentPage - 1) * companiesPerPage) + 1}-{Math.min(currentPage * companiesPerPage, filteredCompanies.length)} de {filteredCompanies.length} empresas
              </span>
              {totalPages > 1 && (
                <span>Página {currentPage} de {totalPages}</span>
              )}
            </div>

            {paginatedCompanies.map((company) => (
              <div key={company.id} className="space-y-2">
                {/* Company Card */}
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleCompanyClick(company.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{company.name}</h3>
                            {getStatusBadge(company.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {company.segment && <span>{company.segment}</span>}
                            <span>•</span>
                            <span>{company.projects?.length || 0} projetos</span>
                            {company.total_tasks ? (
                              <>
                                <span>•</span>
                                <span>
                                  {company.completed_tasks}/{company.total_tasks} tarefas
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">CS: {company.cs?.name || "—"}</div>
                          <div className="text-muted-foreground">
                            Consultor: {company.consultant?.name || "—"}
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            expandedCompanyId === company.id ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* Progress bar */}
                    {company.total_tasks ? (
                      <div className="mt-3 w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{
                            width: `${(company.completed_tasks! / company.total_tasks) * 100}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Expanded Projects */}
                {expandedCompanyId === company.id && (
                  <div className="ml-8 space-y-2">
                    {company.projects && company.projects.length > 0 ? (
                      company.projects.map((project) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/onboarding-tasks/${project.id}`);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FolderOpen className="h-5 w-5 text-primary" />
                                <div>
                                  <h4 className="font-medium">{project.product_name}</h4>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {format(new Date(project.created_at), "dd MMM yyyy", {
                                        locale: ptBR,
                                      })}
                                    </span>
                                    <span>•</span>
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>
                                      {project.completed_count}/{project.tasks_count} tarefas
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(project.status)}
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>

                            {/* Project progress */}
                            {project.tasks_count ? (
                              <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{
                                    width: `${
                                      (project.completed_count! / project.tasks_count) * 100
                                    }%`,
                                  }}
                                />
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Card className="border-dashed">
                        <CardContent className="p-4 text-center text-muted-foreground">
                          <p className="text-sm">Nenhum projeto nesta empresa</p>
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowCreateDialog(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Criar projeto
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* View company details link */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/onboarding-tasks/companies/${company.id}`);
                      }}
                    >
                      Ver detalhes da empresa
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, current, and adjacent pages
                      return page === 1 || 
                             page === totalPages || 
                             Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, idx, arr) => (
                      <div key={page} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="min-w-[40px]"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </div>
                    ))
                  }
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProjectCreated={fetchCompanies}
      />

      {/* Task notifications popup */}
      <TaskNotificationsDialog />
    </div>
  );
};

export default OnboardingTasksPage;
