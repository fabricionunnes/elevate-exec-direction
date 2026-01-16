import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FolderOpen, Search, ArrowLeft, Users, Calendar, CheckCircle2, Building2, ChevronRight, LogOut, Package, ChevronDown, X, Upload, ChevronLeft, Video, CalendarClock, Megaphone, RefreshCw, Settings, History, FileBarChart, BookOpen, TrendingUp, MessageSquareHeart, BarChart3, Heart, Calculator, MessageSquare, User, Target, TrendingDown, Users2, Award, Database, Activity, Crown, Gift } from "lucide-react";
import { getRiskLevelInfo } from "@/hooks/useHealthScore";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";
import { format, isBefore, startOfDay, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateProjectDialog } from "@/components/onboarding-tasks/CreateProjectDialog";
import { TaskNotificationsDialog } from "@/components/onboarding-tasks/TaskNotificationsDialog";
import DashboardMetrics from "@/components/onboarding-tasks/DashboardMetrics";
import { PendingMeetingsAlert } from "@/components/onboarding-tasks/PendingMeetingsAlert";
import { AnnouncementDialog } from "@/components/onboarding-tasks/AnnouncementDialog";
import { NPSGlobalDialog } from "@/components/onboarding-tasks/NPSGlobalDialog";
import { CSATGlobalDialog } from "@/components/onboarding-tasks/CSATGlobalDialog";
import { StaffSettingsSheet } from "@/components/onboarding-tasks/StaffSettingsSheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReferralsPanel } from "@/components/onboarding-tasks/ReferralsPanel";

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
  // Some records use company_id instead of onboarding_company_id
  company_id?: string | null;
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
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  payment_method?: string | null;
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  
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
  const [allTasks, setAllTasks] = useState<{ id: string; status: string; due_date: string | null; project_id: string; responsible_staff_id: string | null; completed_at: string | null }[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; product_id: string; product_name: string; status: string; created_at: string; updated_at: string; consultant_id: string | null; reactivated_at: string | null; onboarding_company_id: string | null; company_id: string | null; churn_date: string | null }[]>([]);
  const [npsResponses, setNpsResponses] = useState<{ project_id: string; score: number }[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<{ project_id: string; month: number; year: number; sales_target: number | null; sales_result: number | null }[]>([]);
  const [companyKpis, setCompanyKpis] = useState<{ id: string; company_id: string; target_value: number; kpi_type: string; periodicity: string }[]>([]);
  const [kpiEntries, setKpiEntries] = useState<{ company_id: string; kpi_id: string; value: number; entry_date: string }[]>([]);
  const [contractRenewals, setContractRenewals] = useState<{ company_id: string; renewal_date: string }[]>([]);
  const [healthScoresByProject, setHealthScoresByProject] = useState<Map<string, { total_score: number; risk_level: string }>>(new Map());
  
  // Announcement dialog state
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  
  // NPS and CSAT global dialogs
  const [showNPSGlobalDialog, setShowNPSGlobalDialog] = useState(false);
  const [showCSATGlobalDialog, setShowCSATGlobalDialog] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const companiesPerPage = 10;
  
  // Active dashboard tab state (hides companies list when on NPS tab)
  const [activeDashboardTab, setActiveDashboardTab] = useState("empresas");
  
  // Staff settings sheet state
  const [showStaffSettings, setShowStaffSettings] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Run all independent fetches in parallel for faster load
        await Promise.all([
          checkUserPermissions(),
          fetchFiltersData(),
          fetchNpsResponses(),
          fetchMonthlyGoals(),
          fetchHealthScores(),
          fetchCompanyKpis(),
          fetchContractRenewals(),
        ]);
        
        // Then fetch tasks and companies (companies now depends on tasks)
        await fetchAllTasks();
      } catch (error) {
        console.error("Error loading dashboard:", error);
      }
    };
    loadData();
  }, []);

  const fetchAllTasks = async () => {
    try {
      // IMPORTANT: PostgREST has a default max of 1000 rows per request.
      // Use pagination to guarantee we load the full dataset used by dashboard metrics.
      const pageSize = 1000;
      let from = 0;
      let all: { id: string; status: string; due_date: string | null; project_id: string; responsible_staff_id: string | null; completed_at: string | null }[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("onboarding_tasks")
          .select("id, status, due_date, project_id, responsible_staff_id, completed_at")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        all = all.concat(batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setAllTasks(all);
      
      // After tasks are loaded, fetch companies (which will use task counts from allTasks)
      await fetchCompanies(all);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
    }
  };

  const fetchNpsResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_nps_responses")
        .select("project_id, score");

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

  const fetchCompanyKpis = async () => {
    try {
      const [kpisResult, entriesResult] = await Promise.all([
        supabase
          .from("company_kpis")
          .select("id, company_id, target_value, kpi_type, periodicity")
          .eq("is_active", true),
        supabase
          .from("kpi_entries")
          .select("company_id, kpi_id, value, entry_date")
      ]);

      if (kpisResult.error) throw kpisResult.error;
      if (entriesResult.error) throw entriesResult.error;
      
      setCompanyKpis(kpisResult.data || []);
      setKpiEntries(entriesResult.data || []);
    } catch (error) {
      console.error("Error fetching company KPIs:", error);
    }
  };

  const fetchContractRenewals = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_contract_renewals")
        .select("company_id, renewal_date");

      if (error) throw error;
      setContractRenewals(data || []);
    } catch (error) {
      console.error("Error fetching contract renewals:", error);
    }
  };

  const fetchHealthScores = async () => {
    try {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("project_id, total_score, risk_level");

      if (error) throw error;
      
      const scoresMap = new Map<string, { total_score: number; risk_level: string }>();
      (data || []).forEach(score => {
        scoresMap.set(score.project_id, {
          total_score: score.total_score,
          risk_level: score.risk_level || "unknown"
        });
      });
      setHealthScoresByProject(scoresMap);
    } catch (error) {
      console.error("Error fetching health scores:", error);
    }
  };

  const checkUserPermissions = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || null);

        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .single();

        if (staffMember) {
          const normalizedRole = (staffMember.role || "").trim().toLowerCase();
          setCurrentUserRole(normalizedRole);
          setCurrentStaffId(staffMember.id);

          // For consultants, auto-filter to their own projects
          if (normalizedRole === "consultant") {
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

  const fetchCompanies = async (tasksData: typeof allTasks) => {
    try {
      // Fetch companies and projects in parallel
      const [companiesResult, projectsResult] = await Promise.all([
        supabase
          .from("onboarding_companies")
          .select(`
            *,
            cs:onboarding_staff!onboarding_companies_cs_id_fkey(id, name, role),
            consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(id, name, role)
          `)
          .order("contract_start_date", { ascending: false, nullsFirst: false }),
        supabase
          .from("onboarding_projects")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

      if (companiesResult.error) throw companiesResult.error;
      if (projectsResult.error) throw projectsResult.error;

      const companiesData = companiesResult.data || [];
      const projectsData = projectsResult.data || [];

      // Calculate task counts from the already-loaded tasks (no extra queries!)
      const taskCountsByProject = new Map<string, { total: number; completed: number }>();
      
      tasksData.forEach(task => {
        const counts = taskCountsByProject.get(task.project_id) || { total: 0, completed: 0 };
        counts.total++;
        if (task.status === "completed") {
          counts.completed++;
        }
        taskCountsByProject.set(task.project_id, counts);
      });

      // Add counts to projects
      const projectsWithCounts = projectsData.map(project => {
        const counts = taskCountsByProject.get(project.id) || { total: 0, completed: 0 };
        return {
          ...project,
          tasks_count: counts.total,
          completed_count: counts.completed,
        };
      });

      // Group projects by company
      const getProjectCompanyId = (p: any) => p.onboarding_company_id ?? p.company_id ?? null;

      const companiesWithProjects = companiesData.map((company) => {
        const companyProjects = projectsWithCounts.filter(
          (p) => getProjectCompanyId(p) === company.id
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
      setAllProjects(projectsData.map(p => ({
        id: p.id,
        product_id: p.product_id,
        product_name: p.product_name,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        consultant_id: p.consultant_id,
        reactivated_at: p.reactivated_at,
        onboarding_company_id: p.onboarding_company_id,
        company_id: p.company_id,
        churn_date: p.churn_date,
      })));

      setCompanies(companiesWithProjects);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  // Wrapper to refresh all data (used by child components)
  const refreshData = async () => {
    await fetchAllTasks();
  };
  // Calculate overdue and today tasks for dashboard (respects consultant/service/status filters)
  // IMPORTANT: Only consider ACTIVE projects for dashboard metrics
  // For consultants: also exclude projects from inactive companies
  const getProjectCompanyId = (p: { onboarding_company_id: string | null; company_id: string | null }) =>
    p.onboarding_company_id ?? p.company_id ?? null;

  const activeProjects = useMemo(() => {
    const active = allProjects.filter(p => p.status === "active");
    
    // Always filter out projects from inactive companies (for all roles)
    const activeCompanyIds = new Set(
      companies.filter(c => c.status !== "inactive" && c.status !== "closed").map(c => c.id)
    );
    
    return active.filter(p => {
      const companyId = getProjectCompanyId(p);
      // Include projects without company OR projects from active companies
      return !companyId || activeCompanyIds.has(companyId);
    });
  }, [allProjects, companies]);

  const filteredProjectIds = useMemo(() => {
    // Start with active projects only
    const baseProjects = activeProjects;
    
    if (filterConsultant === "all" && filterService === "all" && filterStatus === "all") {
      return new Set(baseProjects.map((p) => p.id));
    }

    // If tasks are directly linked to a consultant, include their projects too
    const responsibleProjectIds =
      filterConsultant === "all"
        ? new Set<string>()
        : new Set(
            allTasks
              .filter((t) => t.responsible_staff_id === filterConsultant)
              .map((t) => t.project_id)
          );

    // If consultant is responsible for the company, ALL company tasks/projects are theirs
    const companyPortfolioProjectIds =
      filterConsultant === "all"
        ? new Set<string>()
        : new Set(
            companies
              .filter((c) => c.consultant_id === filterConsultant)
              .flatMap((c) => c.projects?.map((p) => p.id) ?? [])
          );

    // Also include projects where consultant is set at the project level
    const projectPortfolioProjectIds =
      filterConsultant === "all"
        ? new Set<string>()
        : new Set(baseProjects.filter((p) => p.consultant_id === filterConsultant).map((p) => p.id));

    const consultantProjectIds =
      filterConsultant === "all"
        ? null
        : new Set<string>([
            ...responsibleProjectIds,
            ...companyPortfolioProjectIds,
            ...projectPortfolioProjectIds,
          ]);

    return new Set(
      baseProjects
        .filter((project) => {
          const matchesConsultant =
            filterConsultant === "all" || (consultantProjectIds?.has(project.id) ?? false);

          const matchesService = filterService === "all" || project.product_id === filterService;

          // Status filter now filters by project status within active projects
          const matchesStatus = filterStatus === "all" || project.status === filterStatus;

          return matchesConsultant && matchesService && matchesStatus;
        })
        .map((p) => p.id)
    );
  }, [activeProjects, allTasks, companies, filterConsultant, filterService, filterStatus]);

  const normalizeDueDate = (due: string) => {
    // Ensure date-only strings are parsed as local midnight for consistent "today/overdue" checks
    return startOfDay(new Date(due.includes("T") ? due : `${due}T00:00:00`));
  };

  const overdueTasks = useMemo(() => {
    const todayStart = startOfDay(new Date());
    return allTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      if (!filteredProjectIds.has(t.project_id)) return false;

      const dueDate = normalizeDueDate(t.due_date);

      // Overdue tasks: show ALL overdue regardless of period filter
      // This ensures we see the full backlog of pending work
      return isBefore(dueDate, todayStart);
    });
  }, [allTasks, filteredProjectIds]);

  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return allTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      if (!filteredProjectIds.has(t.project_id)) return false;

      const dueDate = normalizeDueDate(t.due_date);

      // Today tasks: show ALL tasks due today regardless of period filter
      // This ensures we always see what needs to be done today
      return dueDate.getTime() === today.getTime();
    });
  }, [allTasks, filteredProjectIds]);



  // Handle metric card filter
  const handleMetricFilterChange = (filter: { type: string; value: string } | null) => {
    // Get the previous filter to check what we're toggling
    const previousFilter = activeMetricFilter;
    setActiveMetricFilter(filter);
    
    if (filter?.type === "status") {
      setFilterStatus(filter.value);
    } else if (filter === null && previousFilter?.type === "status") {
      // When clearing a status filter, reset to "all"
      setFilterStatus("all");
    }
    
    // When filtering by NPS responded/not_responded, switch to empresas tab to show results
    if (filter?.type === "nps" && (filter.value === "responded" || filter.value === "not_responded")) {
      setActiveDashboardTab("empresas");
    }
  };

  // Get set of project IDs that have NPS responses
  const projectsWithNpsResponse = useMemo(() => {
    return new Set(npsResponses.map(r => r.project_id));
  }, [npsResponses]);

  // Get sets of project IDs by NPS category (promoters: 9-10, detractors: 0-6)
  const projectsNpsCategories = useMemo(() => {
    const promoters = new Set<string>();
    const detractors = new Set<string>();
    
    npsResponses.forEach(r => {
      if (r.score >= 9) {
        promoters.add(r.project_id);
      } else if (r.score <= 6) {
        detractors.add(r.project_id);
      }
    });
    
    return { promoters, detractors };
  }, [npsResponses]);

  // Calculate company goal projection ranges for the selected period (using company KPIs - same logic as DashboardMetrics)
  const companiesGoalRanges = useMemo(() => {
    const periodMonth = dateRange.start.getMonth() + 1;
    const periodYear = dateRange.start.getFullYear();
    
    // Calculate time elapsed percentage in the month
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === periodMonth && today.getFullYear() === periodYear;
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const timeElapsedPercent = currentDay / daysInMonth;
    
    // Get active company IDs (exclude inactive/closed companies)
    const activeCompanyIds = new Set(
      companies.filter(c => c.status !== "inactive" && c.status !== "closed").map(c => c.id)
    );
    
    // We need to fetch kpi_entries - use the state that should be set
    const monthStart = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
    const monthEnd = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${daysInMonth}`;
    
    const meetingGoalIds = new Set<string>(); // >=100%
    const above70Ids = new Set<string>(); // 70-99%
    const between50And70Ids = new Set<string>(); // 50-69%
    const below50Ids = new Set<string>(); // <50%
    const noEntriesIds = new Set<string>(); // Has KPI but no entries in month
    const hasEntriesIds = new Set<string>(); // Has KPI AND entries in month
    
    // Companies with monetary KPI configured with target_value > 0 (same logic as DashboardMetrics)
    const companiesWithAnyKpiIds = new Set(
      companyKpis.filter(k => activeCompanyIds.has(k.company_id) && k.kpi_type === "monetary" && k.target_value > 0).map(k => k.company_id)
    );
    
    // Companies without goals (no KPI configured)
    const noGoalIds = new Set<string>();
    activeCompanyIds.forEach(companyId => {
      if (!companiesWithAnyKpiIds.has(companyId)) {
        noGoalIds.add(companyId);
      }
    });
    
    // Calculate metrics per company (same logic as DashboardMetrics.tsx)
    activeCompanyIds.forEach(companyId => {
      if (!companyId) return;
      
      // Get KPIs for this company (only monetary for main goals tracking - same as DashboardMetrics)
      const companyKpisList = companyKpis.filter(k => k.company_id === companyId && k.kpi_type === "monetary");
      
      if (companyKpisList.length === 0) return;
      
      // Calculate monthly target (considering periodicity - same as DashboardMetrics)
      let totalMonthlyTarget = 0;
      companyKpisList.forEach(kpi => {
        if (kpi.periodicity === "daily") {
          totalMonthlyTarget += kpi.target_value * daysInMonth;
        } else if (kpi.periodicity === "weekly") {
          totalMonthlyTarget += kpi.target_value * Math.ceil(daysInMonth / 7);
        } else {
          totalMonthlyTarget += kpi.target_value;
        }
      });
      
      // Get entries for this company in the period
      const companyEntries = kpiEntries.filter(e => 
        e.company_id === companyId &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd &&
        companyKpisList.some(k => k.id === e.kpi_id)
      );
      
      const hasEntries = companyEntries.length > 0;
      
      // Track companies with/without entries
      if (hasEntries) {
        hasEntriesIds.add(companyId);
      } else if (totalMonthlyTarget > 0) {
        // Has goal but no entries
        noEntriesIds.add(companyId);
      }
      
      // Only calculate projection for companies WITH entries
      if (!hasEntries) return;
      
      const totalRealized = companyEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Calculate projection
      const projectionPercent = timeElapsedPercent > 0 && totalMonthlyTarget > 0 
        ? Math.round(((totalRealized / totalMonthlyTarget) / timeElapsedPercent) * 100) 
        : 0;
      
      if (projectionPercent >= 100) {
        meetingGoalIds.add(companyId);
      } else if (projectionPercent >= 70) {
        above70Ids.add(companyId);
      } else if (projectionPercent >= 50) {
        between50And70Ids.add(companyId);
      } else {
        below50Ids.add(companyId);
      }
    });
    
    // Also calculate the actual realized percentage per company for display
    const realizedPercentByCompany = new Map<string, number | null>();
    
    activeCompanyIds.forEach(companyId => {
      if (!companyId) return;
      
      const companyKpisList = companyKpis.filter(k => k.company_id === companyId && k.kpi_type === "monetary");
      
      if (companyKpisList.length === 0) {
        realizedPercentByCompany.set(companyId, null); // No KPI configured
        return;
      }
      
      // Calculate monthly target (considering periodicity)
      let totalMonthlyTarget = 0;
      companyKpisList.forEach(kpi => {
        if (kpi.periodicity === "daily") {
          totalMonthlyTarget += kpi.target_value * daysInMonth;
        } else if (kpi.periodicity === "weekly") {
          totalMonthlyTarget += kpi.target_value * Math.ceil(daysInMonth / 7);
        } else {
          totalMonthlyTarget += kpi.target_value;
        }
      });
      
      if (totalMonthlyTarget === 0) {
        realizedPercentByCompany.set(companyId, null); // Target is 0
        return;
      }
      
      // Get entries for this company in the period
      const companyEntries = kpiEntries.filter(e => 
        e.company_id === companyId &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd &&
        companyKpisList.some(k => k.id === e.kpi_id)
      );
      
      if (companyEntries.length === 0) {
        realizedPercentByCompany.set(companyId, null); // No entries = N/A
        return;
      }
      
      const totalRealized = companyEntries.reduce((sum, e) => sum + e.value, 0);
      const realizedPercent = Math.round((totalRealized / totalMonthlyTarget) * 100);
      realizedPercentByCompany.set(companyId, realizedPercent);
    });
    
    return {
      meetingGoal: meetingGoalIds,
      above70: above70Ids,
      between50And70: between50And70Ids,
      below50: below50Ids,
      noGoal: noGoalIds,
      hasGoal: companiesWithAnyKpiIds,
      noEntries: noEntriesIds,
      hasEntries: hasEntriesIds,
      realizedPercent: realizedPercentByCompany
    };
  }, [dateRange, companies, companyKpis, kpiEntries]);

  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((company) => {
      // Hide inactive and closed companies entirely from dashboard
      // Exception: show closed companies when filtering by "closed" status metric
      const isClosedFilter = activeMetricFilter?.type === "status" && activeMetricFilter?.value === "closed";
      if (company.status === "inactive" || company.status === "closed") {
        if (!isClosedFilter) {
          return false;
        }
      }
      
      // For consultants: only show companies where they are the consultant or CS
      if (currentUserRole === "consultant" && currentStaffId) {
        const isMyCompany = company.consultant_id === currentStaffId || company.cs_id === currentStaffId;
        if (!isMyCompany) return false;
      }
      
      // Text search filter
      const matchesSearch =
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.segment && company.segment.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Consultant filter - check company's consultant OR project's consultant OR tasks with this consultant responsible
      // Skip for consultants since they already see only their companies
      const matchesConsultant = 
        currentUserRole === "consultant" ||
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
      // Special case: "reactivated" is not a project status, but a field (reactivated_at)
      const matchesStatus = 
        filterStatus === "all" || 
        filterStatus === "reactivated" 
          ? (filterStatus === "all" || company.projects?.some(p => {
              if (filterStatus === "reactivated") {
                if (!p.reactivated_at) return false;
                const reactivatedDate = new Date(p.reactivated_at);
                return isWithinInterval(reactivatedDate, { start: dateRange.start, end: dateRange.end });
              }
              return true;
            }))
          : company.projects?.some(p => p.status === filterStatus);
      
      // Metric card filters
      let matchesMetricFilter = true;
      if (activeMetricFilter) {
        const today = startOfDay(new Date());
        
        if (activeMetricFilter.type === "contracts" && activeMetricFilter.value === "ending") {
          // Contratos recorrentes, empresas encerradas e projetos encerrados não aparecem
          const hasClosedProject = company.projects?.some(p => p.status === "closed" || p.status === "completed");
          if (company.payment_method === "monthly" || company.status === "inactive" || company.status === "closed" || hasClosedProject) {
            matchesMetricFilter = false;
          } else if (!company.contract_end_date) {
            matchesMetricFilter = false;
          } else {
            const endDate = new Date(company.contract_end_date);
            // Vencendo: data de fim dentro do período E ainda não passou
            matchesMetricFilter = isWithinInterval(endDate, { start: dateRange.start, end: dateRange.end }) && !isBefore(endDate, today);
          }
        } else if (activeMetricFilter.type === "contracts" && activeMetricFilter.value === "expired") {
          // Contratos recorrentes, empresas encerradas e projetos encerrados não aparecem
          const hasClosedProject = company.projects?.some(p => p.status === "closed" || p.status === "completed");
          if (company.payment_method === "monthly" || company.status === "inactive" || company.status === "closed" || hasClosedProject) {
            matchesMetricFilter = false;
          } else if (!company.contract_end_date) {
            matchesMetricFilter = false;
          } else {
            const endDate = new Date(company.contract_end_date);
            matchesMetricFilter = isBefore(endDate, today);
          }
        } else if (activeMetricFilter.type === "contracts" && activeMetricFilter.value === "renewed") {
          // Filter companies that have renewals in the selected period
          matchesMetricFilter = contractRenewals.some(r => {
            if (r.company_id !== company.id) return false;
            const renewalDate = new Date(r.renewal_date.substring(0, 10) + "T12:00:00");
            return isWithinInterval(renewalDate, { start: dateRange.start, end: dateRange.end });
          });
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
        } else if (activeMetricFilter.type === "status" && activeMetricFilter.value === "closed") {
          // Filter companies with closed projects in the period
          matchesMetricFilter = company.projects?.some(p => {
            if (p.status !== "closed" && p.status !== "completed") return false;
            const updatedAt = new Date(p.updated_at);
            return isWithinInterval(updatedAt, { start: dateRange.start, end: dateRange.end });
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
          // Filter by goal projection ranges or by company KPI status (now company-based, not project-based)
          if (activeMetricFilter.value === "hasGoal") {
            // Company has any KPI configured
            matchesMetricFilter = companiesGoalRanges.hasGoal.has(company.id);
          } else if (activeMetricFilter.value === "noGoal") {
            // Company has NO KPI configured
            matchesMetricFilter = companiesGoalRanges.noGoal.has(company.id);
          } else if (activeMetricFilter.value === "noEntries") {
            // Company has KPI but no entries in the selected month
            matchesMetricFilter = companiesGoalRanges.noEntries.has(company.id);
          } else if (activeMetricFilter.value === "hasEntries") {
            // Company has KPI AND entries in the selected month
            matchesMetricFilter = companiesGoalRanges.hasEntries.has(company.id);
          } else if (activeMetricFilter.value === "meeting" || activeMetricFilter.value === "100plus") {
            matchesMetricFilter = companiesGoalRanges.meetingGoal.has(company.id);
          } else if (activeMetricFilter.value === "above70") {
            matchesMetricFilter = companiesGoalRanges.above70.has(company.id);
          } else if (activeMetricFilter.value === "between50and70") {
            matchesMetricFilter = companiesGoalRanges.between50And70.has(company.id);
          } else if (activeMetricFilter.value === "below50") {
            matchesMetricFilter = companiesGoalRanges.below50.has(company.id);
          }
        } else if (activeMetricFilter.type === "company" && activeMetricFilter.value === "no_consultant") {
          // Filter active companies without consultant
          matchesMetricFilter = company.status === "active" && !company.consultant_id;
        }
      }
      
      return matchesSearch && matchesConsultant && matchesService && matchesStatus && matchesMetricFilter;
    });
    
    // Sort by contract_start_date descending (newest first), nulls last
    return filtered.sort((a, b) => {
      const dateA = a.contract_start_date ? new Date(a.contract_start_date).getTime() : 0;
      const dateB = b.contract_start_date ? new Date(b.contract_start_date).getTime() : 0;
      return dateB - dateA;
    });
  }, [companies, searchTerm, filterConsultant, filterService, filterStatus, activeMetricFilter, dateRange, projectsWithNpsResponse, projectsNpsCategories, companiesGoalRanges, currentUserRole, currentStaffId, allTasks, contractRenewals]);

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
  // IMPORTANT: Always exclude closed/completed projects from metrics - their tasks are no longer actionable
  const filteredProjects = useMemo(() => {
    // Always exclude closed/completed projects from metrics
    const actionableProjects = allProjects.filter(p => 
      p.status !== "closed" && p.status !== "completed"
    );

    if (filterConsultant === "all" && filterService === "all" && filterStatus === "all") {
      return actionableProjects;
    }

    const responsibleProjectIds =
      filterConsultant === "all"
        ? new Set<string>()
        : new Set(
            allTasks
              .filter((t) => t.responsible_staff_id === filterConsultant)
              .map((t) => t.project_id)
          );

    const companyPortfolioProjectIds =
      filterConsultant === "all"
        ? new Set<string>()
        : new Set(
            companies
              .filter((c) => c.consultant_id === filterConsultant)
              .flatMap((c) => c.projects?.map((p) => p.id) ?? [])
          );

    const projectPortfolioProjectIds =
      filterConsultant === "all"
        ? new Set<string>()
        : new Set(actionableProjects.filter((p) => p.consultant_id === filterConsultant).map((p) => p.id));

    const consultantProjectIds =
      filterConsultant === "all"
        ? null
        : new Set<string>([
            ...responsibleProjectIds,
            ...companyPortfolioProjectIds,
            ...projectPortfolioProjectIds,
          ]);

    return actionableProjects.filter((project) => {
      const matchesConsultant =
        filterConsultant === "all" || (consultantProjectIds?.has(project.id) ?? false);

      const matchesService = filterService === "all" || project.product_id === filterService;

      // Status filter is project status
      const matchesStatus = filterStatus === "all" || project.status === filterStatus;

      return matchesConsultant && matchesService && matchesStatus;
    });
  }, [allProjects, allTasks, companies, filterConsultant, filterService, filterStatus]);

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
  const isCS = currentUserRole === "cs";
  const isConsultant = currentUserRole === "consultant";
  const canCreateCompany = isAdmin || isCS;
  const canAccessAnalytics = isAdmin || isCS || isConsultant;
  const CRM_ROLES = ["admin", "head_comercial", "closer", "sdr"];
  const canAccessCRM = currentUserRole ? CRM_ROLES.includes(currentUserRole) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
          {/* Skeleton Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-muted animate-pulse" />
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          </div>
          
          {/* Skeleton Filters */}
          <div className="flex gap-2 mb-6">
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
            <div className="h-9 flex-1 bg-muted animate-pulse rounded" />
          </div>
          
          {/* Skeleton Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          
          {/* Skeleton Companies List */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          {/* Top Row - Logo, Title & Logout */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <NexusHeader />
              <WelcomeHeader className="text-xs sm:text-sm text-muted-foreground hidden sm:block" />
            </div>
            
            {/* Mobile Actions - Compact */}
            <div className="flex items-center gap-1 sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/companies/new")}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Nova Empresa
                    </DropdownMenuItem>
                  )}
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Projeto
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/staff")}>
                      <Users className="h-4 w-4 mr-2" />
                      Equipe
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/office")}>
                    <Video className="h-4 w-4 mr-2" />
                    Escritório UNV
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowAnnouncementDialog(true)}>
                        <Megaphone className="h-4 w-4 mr-2" />
                        Enviar Comunicado
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/services")}>
                        <Package className="h-4 w-4 mr-2" />
                        Serviços
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/import")}>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/reschedule")}>
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Reagendar Tarefas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/renewals")}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Renovações
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/activity-history")}>
                        <History className="h-4 w-4 mr-2" />
                        Histórico de Atividades
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowNPSGlobalDialog(true)}>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Painel NPS
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCSATGlobalDialog(true)}>
                        <MessageSquareHeart className="h-4 w-4 mr-2" />
                        Painel CSAT
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/results")}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Resultados
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/churn-prediction")}>
                        <TrendingDown className="h-4 w-4 mr-2" />
                        Previsão de Churn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/cohort-retention")}>
                        <Users2 className="h-4 w-4 mr-2" />
                        Análise de Cohort
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/whatsapp")}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        WhatsApp Admin
                      </DropdownMenuItem>
                      {currentUserEmail === "fabricio@universidadevendas.com.br" && (
                        <>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/ceo")}>
                            <Crown className="h-4 w-4 mr-2" />
                            Painel do CEO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/financeiro")}>
                            <Calculator className="h-4 w-4 mr-2" />
                            Módulo Financeiro
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                  {/* Resultados for CS and consultants in mobile menu */}
                  {canAccessCRM && (
                    <DropdownMenuItem onClick={() => navigate("/crm")}>
                      <Target className="h-4 w-4 mr-2" />
                      CRM Comercial
                    </DropdownMenuItem>
                  )}
                  {(currentUserRole === "cs" || currentUserRole === "consultant") && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/results")}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Resultados
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowStaffSettings(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Desktop Actions - Second Row */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {/* Primary Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  Empresas
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
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
                      .filter((c) => {
                        // Filter by search term
                        const matchesSearch = c.name.toLowerCase().includes(companySearchTerm.toLowerCase());
                        // Consultants only see their companies
                        if (currentUserRole === "consultant" && currentStaffId) {
                          return matchesSearch && (c.consultant_id === currentStaffId || c.cs_id === currentStaffId);
                        }
                        return matchesSearch;
                      })
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
                    {companies.filter((c) => {
                      const matchesSearch = c.name.toLowerCase().includes(companySearchTerm.toLowerCase());
                      if (currentUserRole === "consultant" && currentStaffId) {
                        return matchesSearch && (c.consultant_id === currentStaffId || c.cs_id === currentStaffId);
                      }
                      return matchesSearch;
                    }).length === 0 && (
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
            
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>

            <Button variant="outline" size="sm" onClick={() => navigate("/onboarding-tasks/office")}>
              <Video className="h-4 w-4 mr-2" />
              Escritório
            </Button>

            {canCreateCompany && (
              <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")}>
                <BookOpen className="h-4 w-4 mr-2" />
                Onboarding
              </Button>
            )}

            {/* NPS, CSAT and Results Buttons - Admin/CS only, Resultados for all staff */}
            {canCreateCompany && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowNPSGlobalDialog(true)}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  NPS
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCSATGlobalDialog(true)}
                  className="gap-2"
                >
                  <MessageSquareHeart className="h-4 w-4" />
                  CSAT
                </Button>
              </>
            )}
            {/* Resultados button - visible for all staff (admin, cs, consultant) */}
            {currentUserRole && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/onboarding-tasks/results")}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Resultados
              </Button>
            )}
            {/* CRM Comercial button - visible for admin, head_comercial, closer, sdr */}
            {canAccessCRM && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/crm")}
                className="gap-2"
              >
                <Target className="h-4 w-4" />
                CRM Comercial
              </Button>
            )}

            {/* Admin/CS/Consultant Actions Menu - Reorganized with submenus */}
            {canAccessAnalytics && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Administrar
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* Análises - Available to Admin, CS, and Consultants */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Análises
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/churn-prediction")}>
                        <TrendingDown className="h-4 w-4 mr-2" />
                        Previsão de Churn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/cohort-retention")}>
                        <Users2 className="h-4 w-4 mr-2" />
                        Análise de Cohort
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {/* Cadastros - Admin and CS only */}
                  {canCreateCompany && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Database className="h-4 w-4 mr-2" />
                        Cadastros
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-48">
                        <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/staff")}>
                          <Users className="h-4 w-4 mr-2" />
                          Equipe
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/services")}>
                          <Package className="h-4 w-4 mr-2" />
                          Serviços
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/import")}>
                          <Upload className="h-4 w-4 mr-2" />
                          Importar
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}

                  {(isAdmin || isCS) && (
                    <>
                      {/* Relatórios */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <FileBarChart className="h-4 w-4 mr-2" />
                          Relatórios
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-52">
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/executive")}>
                              <Activity className="h-4 w-4 mr-2" />
                              Dashboard Executivo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/companies-report")}>
                            <FileBarChart className="h-4 w-4 mr-2" />
                            Relatório de Empresas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/activity-history")}>
                            <History className="h-4 w-4 mr-2" />
                            Histórico de Atividades
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/engagement")}>
                            <Award className="h-4 w-4 mr-2" />
                            Ranking de Engajamento
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {/* Operacional */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Operacional
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48">
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/renewals")}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Renovações
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/reschedule")}>
                              <CalendarClock className="h-4 w-4 mr-2" />
                              Reagendar Tarefas
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {currentUserEmail === "fabricio@universidadevendas.com.br" && (
                        <>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/ceo")}>
                            <Crown className="h-4 w-4 mr-2" />
                            Painel do CEO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/financeiro")}>
                            <Calculator className="h-4 w-4 mr-2" />
                            Módulo Financeiro
                          </DropdownMenuItem>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setActiveDashboardTab("referrals")}>
                            <Gift className="h-4 w-4 mr-2" />
                            Indicações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/whatsapp")}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            WhatsApp Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowAnnouncementDialog(true)}>
                            <Megaphone className="h-4 w-4 mr-2" />
                            Enviar Comunicado
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowStaffSettings(true)}
              title="Meu Perfil"
            >
              <User className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/onboarding-tasks/login");
              }}
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Staff Settings Sheet */}
          <StaffSettingsSheet 
            open={showStaffSettings} 
            onOpenChange={setShowStaffSettings} 
          />

          {/* Search and Filters - Responsive */}
          <div className="flex flex-col gap-2">
            {/* Search Row */}
            <div className="flex items-center gap-2">
              <MonthYearPicker 
                value={dateRange.start} 
                onChange={setDateRange} 
              />
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 sm:h-10 text-sm"
                />
              </div>
            </div>

            {/* Filters Row - Horizontal Scroll on Mobile */}
            <div className="flex items-end gap-2 overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 sm:overflow-visible">
              {currentUserRole !== "consultant" && (
                <div className="flex flex-col gap-0.5 min-w-[120px] sm:min-w-[150px]">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Consultores</span>
                  <Select value={filterConsultant} onValueChange={setFilterConsultant}>
                    <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {consultants.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-0.5 min-w-[120px] sm:min-w-[150px]">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Serviços</span>
                <Select value={filterService} onValueChange={setFilterService}>
                  <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-0.5 min-w-[120px] sm:min-w-[150px]">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Status</span>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="cancellation_signaled">Sinalizou</SelectItem>
                    <SelectItem value="notice_period">Aviso</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 sm:h-10 px-2 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Pending Meetings Alert */}
        <PendingMeetingsAlert />

        {/* Dashboard Metrics */}
        <DashboardMetrics
          companies={companies} 
          projects={filteredProjects}
          allProjects={allProjects}
          onFilterChange={handleMetricFilterChange}
          activeMetricFilter={activeMetricFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          overdueTasks={overdueTasks}
          todayTasks={todayTasks}
          allTasks={allTasks}
          onDataRefresh={refreshData}
          currentStaffUserId={currentUserId}
          selectedConsultantStaffId={filterConsultant !== "all" ? filterConsultant : undefined}
          onActiveTabChange={setActiveDashboardTab}
          staffRole={currentUserRole}
        />

        {/* Referrals Panel - Shown when on referrals tab */}
        {activeDashboardTab === "referrals" && (
          <ReferralsPanel />
        )}

        {/* Companies List - Hidden when on NPS or Referrals tab */}
        {activeDashboardTab === "nps" || activeDashboardTab === "referrals" ? null : filteredCompanies.length === 0 ? (
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
          <div className="space-y-2 sm:space-y-4">
            {/* Companies count and pagination info */}
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span>
                {((currentPage - 1) * companiesPerPage) + 1}-{Math.min(currentPage * companiesPerPage, filteredCompanies.length)} de {filteredCompanies.length}
              </span>
              {totalPages > 1 && (
                <span>Pág. {currentPage}/{totalPages}</span>
              )}
            </div>

            {paginatedCompanies.map((company) => {
              // Calculate company health score (average of all projects)
              const companyHealthData = (() => {
                const projectScores = (company.projects || [])
                  .map(p => healthScoresByProject.get(p.id))
                  .filter(Boolean) as { total_score: number; risk_level: string }[];
                
                if (projectScores.length === 0) return null;
                
                const avgScore = Math.round(
                  projectScores.reduce((sum, s) => sum + s.total_score, 0) / projectScores.length
                );
                
                // Determine overall risk level based on average score
                let riskLevel = "healthy";
                if (avgScore < 40) riskLevel = "critical";
                else if (avgScore < 60) riskLevel = "at_risk";
                else if (avgScore < 75) riskLevel = "attention";
                
                return { avgScore, riskLevel, riskInfo: getRiskLevelInfo(riskLevel) };
              })();

              // Get the realized goal percentage for this company
              const companyGoalPercent = companiesGoalRanges.realizedPercent.get(company.id);

              return (
              <div key={company.id}>
                {/* Company Card - Mobile Optimized */}
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-[#0A2240] bg-gradient-to-r from-[#0A2240]/5 to-transparent"
                  onClick={() => handleCompanyClick(company.id)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-[#0A2240] flex items-center justify-center shadow-md shrink-0">
                          <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <h3 className="text-sm sm:text-lg font-bold text-[#0A2240] uppercase tracking-wide truncate">{company.name}</h3>
                            {getStatusBadge(company.status)}
                            {/* Tag "Empresa Nova" for companies with contract_start_date within last 30 days */}
                            {company.contract_start_date && differenceInDays(new Date(), new Date(company.contract_start_date)) <= 30 && (
                              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] sm:text-xs font-semibold shadow-md animate-pulse">
                                ✨ Empresa Nova
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-muted-foreground mt-0.5">
                            {company.segment && <span className="truncate max-w-[100px] sm:max-w-none">{company.segment}</span>}
                            <span className="hidden sm:inline">•</span>
                            <span>{company.projects?.length || 0} projetos</span>
                            {company.total_tasks ? (
                              <>
                                <span className="hidden sm:inline">•</span>
                                <span className="hidden sm:inline">
                                  {company.completed_tasks}/{company.total_tasks} tarefas
                                </span>
                              </>
                            ) : null}
                          </div>
                          {/* Mobile: Show CS/Consultant, Health, Goal % and Contract inline */}
                          <div className="flex sm:hidden flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground mt-1">
                            <span>CS: {company.cs?.name || "—"}</span>
                            <span>Cons: {company.consultant?.name || "—"}</span>
                            {/* Contract info */}
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100">
                              <Calendar className="h-2.5 w-2.5 text-slate-600" />
                              <span className="font-medium text-slate-700">
                                {company.payment_method === 'monthly'
                                  ? 'Recorr.'
                                  : company.contract_end_date 
                                    ? format(new Date(company.contract_end_date), "dd/MM/yy")
                                    : '—'}
                              </span>
                            </span>
                            {companyHealthData && (
                              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${companyHealthData.riskInfo.bg}`}>
                                <Heart className={`h-2.5 w-2.5 ${companyHealthData.riskInfo.color}`} />
                                <span className={`font-semibold ${companyHealthData.riskInfo.color}`}>{companyHealthData.avgScore}</span>
                              </span>
                            )}
                            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                              companyGoalPercent === null || companyGoalPercent === undefined 
                                ? 'bg-muted' 
                                : companyGoalPercent >= 100 
                                  ? 'bg-green-100' 
                                  : companyGoalPercent >= 70 
                                    ? 'bg-yellow-100' 
                                    : 'bg-red-100'
                            }`}>
                              <Target className={`h-2.5 w-2.5 ${
                                companyGoalPercent === null || companyGoalPercent === undefined 
                                  ? 'text-muted-foreground' 
                                  : companyGoalPercent >= 100 
                                    ? 'text-green-600' 
                                    : companyGoalPercent >= 70 
                                      ? 'text-yellow-600' 
                                      : 'text-red-600'
                              }`} />
                              <span className={`font-semibold ${
                                companyGoalPercent === null || companyGoalPercent === undefined 
                                  ? 'text-muted-foreground' 
                                  : companyGoalPercent >= 100 
                                    ? 'text-green-600' 
                                    : companyGoalPercent >= 70 
                                      ? 'text-yellow-600' 
                                      : 'text-red-600'
                              }`}>
                                {companyGoalPercent === null || companyGoalPercent === undefined ? 'N/A' : `${companyGoalPercent}%`}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        {/* Health Score Indicator */}
                        {companyHealthData && (
                          <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full ${companyHealthData.riskInfo.bg}`}>
                            <Heart className={`h-3.5 w-3.5 ${companyHealthData.riskInfo.color}`} />
                            <span className={`text-sm font-semibold ${companyHealthData.riskInfo.color}`}>
                              {companyHealthData.avgScore}
                            </span>
                          </div>
                        )}
                        {/* Goal % Indicator - Desktop */}
                        <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full ${
                          companyGoalPercent === null || companyGoalPercent === undefined 
                            ? 'bg-muted' 
                            : companyGoalPercent >= 100 
                              ? 'bg-green-100' 
                              : companyGoalPercent >= 70 
                                ? 'bg-yellow-100' 
                                : 'bg-red-100'
                        }`}>
                          <Target className={`h-3.5 w-3.5 ${
                            companyGoalPercent === null || companyGoalPercent === undefined 
                              ? 'text-muted-foreground' 
                              : companyGoalPercent >= 100 
                                ? 'text-green-600' 
                                : companyGoalPercent >= 70 
                                  ? 'text-yellow-600' 
                                  : 'text-red-600'
                          }`} />
                          <span className={`text-sm font-semibold ${
                            companyGoalPercent === null || companyGoalPercent === undefined 
                              ? 'text-muted-foreground' 
                              : companyGoalPercent >= 100 
                                ? 'text-green-600' 
                                : companyGoalPercent >= 70 
                                  ? 'text-yellow-600' 
                                  : 'text-red-600'
                          }`}>
                            {companyGoalPercent === null || companyGoalPercent === undefined ? 'N/A' : `${companyGoalPercent}%`}
                          </span>
                        </div>
                        {/* Contract End Date / Recurring */}
                        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100">
                          <Calendar className="h-3.5 w-3.5 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">
                            {company.payment_method === 'monthly'
                              ? 'Recorrente'
                              : company.contract_end_date 
                                ? format(new Date(company.contract_end_date), "dd/MM/yyyy")
                                : '—'}
                          </span>
                        </div>
                        {/* Desktop: Show CS/Consultant */}
                        <div className="hidden sm:block text-right text-sm">
                          <div className="text-muted-foreground">CS: {company.cs?.name || "—"}</div>
                          <div className="text-muted-foreground">
                            Consultor: {company.consultant?.name || "—"}
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 sm:h-5 sm:w-5 text-[#0A2240] transition-transform ${
                            expandedCompanyId === company.id ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* Progress bar */}
                    {company.total_tasks ? (
                      <div className="mt-2 sm:mt-3 w-full bg-muted rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-[#C41E3A] h-1.5 sm:h-2 rounded-full transition-all"
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
                  <div className="mt-1 ml-3 sm:ml-6 pl-3 sm:pl-6 border-l-2 border-dashed border-muted-foreground/30 space-y-2 py-2">
                    {company.projects && company.projects.length > 0 ? (
                      company.projects.map((project) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:shadow-md transition-all bg-white border border-muted hover:border-primary/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/onboarding-tasks/${project.id}`);
                          }}
                        >
                          <CardContent className="p-2 sm:p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviço</span>
                                    <h4 className="font-semibold text-foreground text-sm sm:text-base truncate">{project.product_name}</h4>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                    <Calendar className="h-3 w-3 hidden sm:inline" />
                                    <span className="hidden sm:inline">
                                      {format(new Date(project.created_at), "dd MMM yyyy", {
                                        locale: ptBR,
                                      })}
                                    </span>
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>
                                      {project.completed_count}/{project.tasks_count} tarefas
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                {getStatusBadge(project.status)}
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>

                            {/* Project progress */}
                            {project.tasks_count ? (
                              <div className="mt-2 w-full bg-muted rounded-full h-1 sm:h-1.5">
                                <div
                                  className="bg-primary h-1 sm:h-1.5 rounded-full transition-all"
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
                      <Card className="border-dashed bg-muted/30">
                        <CardContent className="p-3 sm:p-4 text-center text-muted-foreground">
                          <p className="text-xs sm:text-sm">Nenhum projeto nesta empresa</p>
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-1 text-xs"
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
                      className="text-muted-foreground hover:text-primary"
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
            )})}


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
        onProjectCreated={refreshData}
      />

      {/* Task notifications popup */}
      <TaskNotificationsDialog />

      {/* Announcement dialog for admins */}
      {isAdmin && currentStaffId && (
        <AnnouncementDialog
          open={showAnnouncementDialog}
          onOpenChange={setShowAnnouncementDialog}
          staffId={currentStaffId}
        />
      )}

      {/* NPS Global Dialog */}
      <NPSGlobalDialog
        open={showNPSGlobalDialog}
        onOpenChange={setShowNPSGlobalDialog}
      />

      {/* CSAT Global Dialog */}
      <CSATGlobalDialog
        open={showCSATGlobalDialog}
        onOpenChange={setShowCSATGlobalDialog}
      />
    </div>
  );
};

export default OnboardingTasksPage;
