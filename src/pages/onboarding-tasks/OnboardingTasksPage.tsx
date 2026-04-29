import { useState, useEffect, useMemo } from "react";
import { isHoliday } from "@/lib/businessDays";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STAFF_MENU_KEYS } from "@/types/staffPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FolderOpen, Search, ArrowLeft, Users, Calendar, CheckCircle2, Building2, ChevronRight, LogOut, Package, ChevronDown, X, Upload, ChevronLeft, Video, CalendarClock, Megaphone, RefreshCw, Settings, History, FileBarChart, BookOpen, TrendingUp, MessageSquareHeart, BarChart3, Heart, Calculator, MessageSquare, User, Target, TrendingDown, Users2, Award, Database, Activity, Crown, Gift, Briefcase, Eye, Star, GraduationCap, FileText, Sparkles, UserX, Bell, AlertTriangle, Gamepad2, Presentation, LayoutGrid, Zap, Code2 } from "lucide-react";
import { GlobalAccessControlPanel } from "@/components/onboarding-tasks/GlobalAccessControlPanel";
import { getRiskLevelInfo } from "@/hooks/useHealthScore";
import { WelcomeHeader } from "@/components/onboarding-tasks/WelcomeHeader";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
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
import { useTenant } from "@/contexts/TenantContext";
import { MyTasksPanel } from "@/components/onboarding-tasks/MyTasksPanel";
import { MeetingsPanel } from "@/components/onboarding-tasks/DashboardMeetingsTab";
import { UnassignedTasksDialog } from "@/components/onboarding-tasks/UnassignedTasksDialog";

interface Service {
  id: string;
  name: string;
  slug: string;
}

interface Staff {
  id: string;
  name: string;
  role: string;
  user_id?: string;
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
  churn_date?: string | null;
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
  is_simulator?: boolean;
}

const OnboardingTasksPage = () => {
  const navigate = useNavigate();
  const { tenant, isWhiteLabel, isModuleEnabled, isStaffMenuAllowed } = useTenant();
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
  const [hasCRMPermission, setHasCRMPermission] = useState<boolean>(false);
  const [hasFinancialPermission, setHasFinancialPermission] = useState<boolean>(false);
  const [staffMenuPermissions, setStaffMenuPermissions] = useState<string[]>([]);
  
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
  const [allProjects, setAllProjects] = useState<{ id: string; product_id: string; product_name: string; status: string; created_at: string; updated_at: string; consultant_id: string | null; reactivated_at: string | null; onboarding_company_id: string | null; company_id: string | null; churn_date: string | null; churn_reason: string | null }[]>([]);
  const [npsResponses, setNpsResponses] = useState<{ project_id: string; score: number }[]>([]);
  // Full NPS responses for DashboardMetrics (eliminates duplicate query)
  const [fullNpsResponses, setFullNpsResponses] = useState<{ id: string; project_id: string; score: number; feedback: string | null; what_can_improve: string | null; would_recommend_why: string | null; respondent_name: string | null; respondent_email: string | null; created_at: string }[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<{ project_id: string; month: number; year: number; sales_target: number | null; sales_result: number | null }[]>([]);
  const [companyKpis, setCompanyKpis] = useState<{ id: string; company_id: string; target_value: number; kpi_type: string; periodicity: string; is_main_goal: boolean }[]>([]);
  const [kpiEntries, setKpiEntries] = useState<{ company_id: string; kpi_id: string; value: number; entry_date: string }[]>([]);
  const [contractRenewals, setContractRenewals] = useState<{ company_id: string; renewal_date: string }[]>([]);
  const [healthScoresByProject, setHealthScoresByProject] = useState<Map<string, { total_score: number; risk_level: string }>>(new Map());
  // Health scores array for DashboardMetrics (eliminates duplicate query)
  const [healthScoresArray, setHealthScoresArray] = useState<{ project_id: string; total_score: number; risk_level: string | null }[]>([]);
  const [companyDailyGoalSettings, setCompanyDailyGoalSettings] = useState<Record<string, { includeSaturday: boolean; includeSunday: boolean; includeHolidays: boolean }>>({});
  
  const [monthlyTargetsForProjection, setMonthlyTargetsForProjection] = useState<{ kpi_id: string; company_id: string; target_value: number; month_year: string; unit_id: string | null; team_id: string | null; salesperson_id: string | null }[]>([]);
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
  
  // Global access control panel state
  const [showAccessControlPanel, setShowAccessControlPanel] = useState(false);
  
  // My Tasks panel state
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [showMeetings, setShowMeetings] = useState(false);
  
  // Bulk health score update state
  const [updatingAllHealthScores, setUpdatingAllHealthScores] = useState(false);
  
  // Unassigned tasks dialog state
  const [showUnassignedTasks, setShowUnassignedTasks] = useState(false);

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
          fetchCompanyDailyGoalSettings(),
        ]);
        
        // Then fetch tasks and companies (companies now depends on tasks)
        await fetchAllTasks();
      } catch (error) {
        console.error("Error loading dashboard:", error);
      }
    };
    loadData();
  }, []);

  // Fetch kpi_monthly_targets for current dateRange period (and current month for badge projection)
  useEffect(() => {
    const fetchMonthlyTargets = async () => {
      const periodMonth = dateRange.start.getMonth() + 1;
      const periodYear = dateRange.start.getFullYear();
      const monthYear = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
      
      // Also fetch current month if different
      const now = new Date();
      const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYears = [monthYear];
      if (currentMonthYear !== monthYear) monthYears.push(currentMonthYear);
      
      const { data } = await supabase
        .from("kpi_monthly_targets")
        .select("kpi_id, company_id, target_value, month_year, unit_id, team_id, salesperson_id")
        .in("month_year", monthYears);
      
      if (data) setMonthlyTargetsForProjection(data);
    };
    fetchMonthlyTargets();
  }, [dateRange]);

  // Keep KPI entries synced with the selected period.
  // Fetching all entries without date filters hits the backend default limit (1000) and causes missing data,
  // which makes the projection badge show 0% even when the company has projection (e.g., Vitale 77%).
  useEffect(() => {
    fetchKpiEntriesForRange(dateRange.start, dateRange.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start, dateRange.end]);

  const fetchAllTasks = async () => {
    try {
      // OPTIMIZATION: Use RPC function to get only relevant tasks (pending/in_progress + completed in last 90 days)
      // This reduces data transfer from 11k+ to ~1-2k records
      const { data: optimizedTasks, error: rpcError } = await supabase.rpc('get_pending_and_overdue_tasks');
      
      if (rpcError) {
        // Fallback to old method if RPC fails
        console.warn("RPC failed, falling back to paginated fetch:", rpcError);
        await fetchAllTasksFallback();
        return;
      }

      const tasks = (optimizedTasks || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        due_date: t.due_date,
        project_id: t.project_id,
        responsible_staff_id: t.responsible_staff_id,
        completed_at: t.completed_at
      }));

      setAllTasks(tasks);
      
      // After tasks are loaded, fetch companies with task metrics from SQL function
      await fetchCompaniesWithMetrics();
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
    }
  };

  // Fallback method for when RPC is not available
  const fetchAllTasksFallback = async () => {
    try {
      const pageSize = 1000;
      let from = 0;
      let all: { id: string; status: string; due_date: string | null; project_id: string; responsible_staff_id: string | null; completed_at: string | null }[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("onboarding_tasks")
          .select("id, status, due_date, project_id, responsible_staff_id, completed_at")
          .neq("status", "inactive")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        all = all.concat(batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setAllTasks(all);
      await fetchCompanies(all);
    } catch (error) {
      console.error("Error in fallback fetch:", error);
      setLoading(false);
    }
  };

  // New optimized company fetch using SQL function for task metrics
  const fetchCompaniesWithMetrics = async () => {
    try {
      // Fetch companies, projects, and task metrics in parallel
      const [companiesResult, projectsResult, metricsResult] = await Promise.all([
        supabase
          .from("onboarding_companies")
          .select(`
            id,
            name,
            status,
            segment,
            cs_id,
            consultant_id,
            kickoff_date,
            contract_start_date,
            contract_end_date,
            contract_value,
            payment_method,
            status_changed_at,
            created_at,
            instagram,
            is_simulator,
            goal_not_required,
            cs:onboarding_staff!onboarding_companies_cs_id_fkey(id, name, role),
            consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(id, name, role)
          `)
          .order("contract_start_date", { ascending: false, nullsFirst: false }),
        supabase
          .from("onboarding_projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.rpc('get_task_metrics_by_project')
      ]);

      if (companiesResult.error) throw companiesResult.error;
      if (projectsResult.error) throw projectsResult.error;

      const companiesData = companiesResult.data || [];
      const projectsData = projectsResult.data || [];
      
      // Use metrics from SQL function if available, otherwise use empty map
      const metricsMap = new Map<string, { total: number; completed: number }>();
      if (!metricsResult.error && metricsResult.data) {
        (metricsResult.data as any[]).forEach((m: any) => {
          metricsMap.set(m.project_id, { 
            total: Number(m.total_tasks) || 0, 
            completed: Number(m.completed_tasks) || 0 
          });
        });
      }

      // Add counts to projects
      const projectsWithCounts = projectsData.map(project => {
        const counts = metricsMap.get(project.id) || { total: 0, completed: 0 };
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
        churn_reason: p.churn_reason || null,
      })));

      // Sort companies: new companies (last 30 days) first, then by contract_start_date desc
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const sortedCompanies = companiesWithProjects.sort((a, b) => {
        const aStartDate = new Date(a.contract_start_date ?? a.created_at);
        const bStartDate = new Date(b.contract_start_date ?? b.created_at);
        const aIsNew = aStartDate >= thirtyDaysAgo;
        const bIsNew = bStartDate >= thirtyDaysAgo;
        
        // New companies come first
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        
        // Within the same group, sort by start date descending (most recent first)
        return bStartDate.getTime() - aStartDate.getTime();
      });

      setCompanies(sortedCompanies);
    } catch (error: any) {
      console.error("Error fetching companies with metrics:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  const fetchNpsResponses = async () => {
    try {
      // Fetch full NPS data for DashboardMetrics to avoid duplicate query
      const { data, error } = await supabase
        .from("onboarding_nps_responses")
        .select("id, project_id, score, feedback, what_can_improve, would_recommend_why, respondent_name, respondent_email, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Store full data for DashboardMetrics
      setFullNpsResponses(data || []);
      // Also store simplified version for backward compatibility
      setNpsResponses((data || []).map(d => ({ project_id: d.project_id, score: d.score })));
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
      const { data, error } = await supabase
        .from("company_kpis")
        .select("id, company_id, target_value, kpi_type, periodicity, is_main_goal")
        .eq("is_active", true);

      if (error) throw error;
      setCompanyKpis(data || []);
    } catch (error) {
      console.error("Error fetching company KPIs:", error);
    }
  };

  const fetchKpiEntriesForRange = async (start: Date, end: Date) => {
    try {
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      const pageSize = 1000;
      let from = 0;
      let all: { company_id: string; kpi_id: string; value: number; entry_date: string }[] = [];

      while (true) {
        const { data, error } = await supabase
          .from("kpi_entries")
          .select("company_id, kpi_id, value, entry_date")
          .gte("entry_date", startStr)
          .lte("entry_date", endStr)
          .order("entry_date", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        all = all.concat(batch);

        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setKpiEntries(all);
    } catch (error) {
      console.error("Error fetching KPI entries:", error);
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

  const fetchCompanyDailyGoalSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_daily_goal_settings")
        .select("company_id, include_saturday, include_sunday, include_holidays");

      if (error) throw error;

      const settingsMap = (data || []).reduce((acc, setting) => {
        acc[setting.company_id] = {
          includeSaturday: setting.include_saturday,
          includeSunday: setting.include_sunday,
          includeHolidays: setting.include_holidays,
        };
        return acc;
      }, {} as Record<string, { includeSaturday: boolean; includeSunday: boolean; includeHolidays: boolean }>);

      setCompanyDailyGoalSettings(settingsMap);
    } catch (error) {
      console.error("Error fetching company daily goal settings:", error);
    }
  };

  const fetchHealthScores = async () => {
    try {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("project_id, total_score, risk_level");

      if (error) throw error;
      
      // Store array for DashboardMetrics (eliminates duplicate query)
      setHealthScoresArray(data || []);
      
      // Create map for backward compatibility
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

  const getCompanyDaySettings = (companyId: string) => {
    return companyDailyGoalSettings[companyId] ?? {
      includeSaturday: false,
      includeSunday: false,
      includeHolidays: false,
    };
  };

  const countWorkingDaysForCompany = (year: number, monthIndex: number, companyId: string, upToDay?: number) => {
    const settings = getCompanyDaySettings(companyId);
    const lastDay = upToDay ?? new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, monthIndex, day);
      const dayOfWeek = date.getDay();

      if (dayOfWeek === 6 && !settings.includeSaturday) continue;
      if (dayOfWeek === 0 && !settings.includeSunday) continue;
      if (!settings.includeHolidays && isHoliday(date)) continue;

      count++;
    }

    return count;
  };

  const getTimeElapsedPercentForCompany = (
    companyId: string,
    year: number,
    monthIndex: number,
    currentDayOfMonth: number,
    isCurrentMonth: boolean
  ) => {
    const totalWorkingDays = countWorkingDaysForCompany(year, monthIndex, companyId);
    const elapsedWorkingDays = isCurrentMonth
      ? countWorkingDaysForCompany(year, monthIndex, companyId, Math.max(currentDayOfMonth - 1, 0))
      : totalWorkingDays;

    return totalWorkingDays > 0 ? elapsedWorkingDays / totalWorkingDays : 0;
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

          // Check all menu permissions
          if (normalizedRole === "master") {
            setHasCRMPermission(true);
            setHasFinancialPermission(true);
            setStaffMenuPermissions(Object.values(STAFF_MENU_KEYS));
          } else {
            const { data: allPerms } = await supabase
              .from("staff_menu_permissions")
              .select("menu_key")
              .eq("staff_id", staffMember.id);
            
            const permKeys = (allPerms || []).map(p => p.menu_key);
            setStaffMenuPermissions(permKeys);
            setHasCRMPermission(permKeys.includes("crm"));
            setHasFinancialPermission(permKeys.includes("financial"));

            // Redirect staff without dashboard access to their appropriate module
            const hasDashboardAccess = normalizedRole === "admin" || 
              permKeys.includes("dashboard") || 
              permKeys.includes("companies") || 
              permKeys.includes("tasks");
            
            if (!hasDashboardAccess && permKeys.length > 0) {
              // Only CRM permission → redirect to CRM
              if (permKeys.includes("crm") && !permKeys.some(k => k.startsWith("fin_") || k === "financial")) {
                navigate("/crm");
                return;
              }
              // Only financial permissions → redirect to financial
              if ((permKeys.includes("financial") || permKeys.some(k => k.startsWith("fin_"))) && !permKeys.includes("crm")) {
                navigate("/onboarding-tasks/financeiro/recorrencias");
                return;
              }
              // Has CRM among other non-dashboard permissions → prefer CRM
              if (permKeys.includes("crm")) {
                navigate("/crm");
                return;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const fetchFiltersData = async () => {
    try {
      // Fetch all active staff for consultant filter
      const { data: consultantsData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role, user_id")
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
            id,
            name,
            status,
            segment,
            cs_id,
            consultant_id,
            kickoff_date,
            contract_start_date,
            contract_end_date,
            contract_value,
            payment_method,
            status_changed_at,
            created_at,
            instagram,
            goal_not_required,
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
        churn_reason: p.churn_reason || null,
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
    // Include active + cancellation/notice projects (they still have pending tasks)
    const active = allProjects.filter(p => 
      p.status === "active" || p.status === "cancellation_signaled" || p.status === "notice_period"
    );
    
    // Always filter out projects from inactive companies (for all roles)
    // But keep cancellation/notice projects even from inactive companies
    const activeCompanyIds = new Set(
      companies.filter(c => c.status !== "inactive" && c.status !== "closed").map(c => c.id)
    );
    
    return active.filter(p => {
      const companyId = getProjectCompanyId(p);
      if (!companyId) return true;
      // Keep cancellation/notice projects regardless of company status
      if (p.status === "cancellation_signaled" || p.status === "notice_period") return true;
      return activeCompanyIds.has(companyId);
    });
  }, [allProjects, companies]);

  const filteredProjectIds = useMemo(() => {
    // Start with active projects only
    const baseProjects = activeProjects;
    
    if (filterConsultant === "all" && filterService === "all" && filterStatus === "all") {
      return new Set(baseProjects.map((p) => p.id));
    }

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

      // Filter by responsible staff when a consultant/staff is selected
      if (filterConsultant !== "all") {
        if (!t.responsible_staff_id || t.responsible_staff_id !== filterConsultant) {
          return false;
        }
      }

      const dueDate = normalizeDueDate(t.due_date);

      // Overdue tasks: show ALL overdue regardless of period filter
      // This ensures we see the full backlog of pending work
      return isBefore(dueDate, todayStart);
    });
  }, [allTasks, filteredProjectIds, filterConsultant]);

  const todayTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return allTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false;
      if (!filteredProjectIds.has(t.project_id)) return false;

      // Filter by responsible staff when a consultant/staff is selected
      if (filterConsultant !== "all") {
        if (!t.responsible_staff_id || t.responsible_staff_id !== filterConsultant) {
          return false;
        }
      }

      const dueDate = normalizeDueDate(t.due_date);

      // Today tasks: show ALL tasks due today regardless of period filter
      // This ensures we always see what needs to be done today
      return dueDate.getTime() === today.getTime();
    });
  }, [allTasks, filteredProjectIds, filterConsultant]);



  // Handle metric card filter
  const handleMetricFilterChange = (filter: { type: string; value: string } | null) => {
    // Get the previous filter to check what we're toggling
    const previousFilter = activeMetricFilter;
    setActiveMetricFilter(filter);
    
    if (filter?.type === "status") {
      // Always show the companies list when a status metric card is clicked
      setActiveDashboardTab("empresas");

      // IMPORTANT: some metric filters are "virtual" (not actual project statuses).
      // Example: "churn_signaled" represents (cancellation_signaled OR notice_period).
      // Setting filterStatus to it would zero the list because no project has that status.
      if (filter.value === "churn_signaled") {
        setFilterStatus("all");
      } else {
        setFilterStatus(filter.value);
      }
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

  // Helper: resolve the effective monthly target for a KPI from kpi_monthly_targets.
  // Priority: company-level target (no unit/team/salesperson) > sum of unit-level targets > kpi.target_value adjusted by periodicity
  const resolveMonthlyTarget = (kpiId: string, companyId: string, monthYear: string, kpiTargetValue: number, kpiPeriodicity: string, daysInMonth: number): number => {
    // 1. Company-level target
    const companyLevel = monthlyTargetsForProjection.find(
      t => t.kpi_id === kpiId && t.company_id === companyId && t.month_year === monthYear &&
           t.unit_id === null && t.team_id === null && t.salesperson_id === null
    );
    if (companyLevel) return companyLevel.target_value;

    // 2. Sum of unit-level targets (no team/salesperson)
    const unitTargets = monthlyTargetsForProjection.filter(
      t => t.kpi_id === kpiId && t.company_id === companyId && t.month_year === monthYear &&
           t.unit_id !== null && t.team_id === null && t.salesperson_id === null
    );
    if (unitTargets.length > 0) return unitTargets.reduce((sum, t) => sum + t.target_value, 0);

    // 3. Fallback to kpi.target_value adjusted by periodicity
    if (kpiPeriodicity === "daily") return kpiTargetValue * daysInMonth;
    if (kpiPeriodicity === "weekly") return kpiTargetValue * Math.ceil(daysInMonth / 7);
    return kpiTargetValue;
  };

  // Calculate company goal projection ranges for the selected period (using company KPIs - same logic as DashboardMetrics)
  const companiesGoalRanges = useMemo(() => {
    const periodMonth = dateRange.start.getMonth() + 1;
    const periodYear = dateRange.start.getFullYear();
    
    // Calculate time elapsed percentage using each company's working day settings (same logic as projection screen)
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === periodMonth && today.getFullYear() === periodYear;
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const monthYear = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
    const timeElapsedPercentCache = new Map<string, number>();
    const getCompanyTimeElapsedPercent = (companyId: string) => {
      const cached = timeElapsedPercentCache.get(companyId);
      if (cached !== undefined) return cached;

      const value = getTimeElapsedPercentForCompany(companyId, periodYear, periodMonth - 1, today.getDate(), isCurrentMonth);
      timeElapsedPercentCache.set(companyId, value);
      return value;
    };
    
    // Get active company IDs (exclude inactive/closed companies AND simulator companies)
    const activeCompanyIds = new Set(
      companies.filter(c => c.status !== "inactive" && c.status !== "closed" && !c.is_simulator).map(c => c.id)
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

    // Some legacy KPI entries may have company_id null/incorrect.
    // Normalize by inferring the company from the KPI relationship.
    const kpiIdToCompanyId = new Map<string, string>();
    companyKpis.forEach(k => {
      if (k?.id && k?.company_id) kpiIdToCompanyId.set(k.id, k.company_id);
    });

    const getEntryCompanyId = (e: { company_id: string; kpi_id: string }) => {
      return e.company_id || kpiIdToCompanyId.get(e.kpi_id) || "";
    };
    
    // Helper to get KPIs for a company.
    // Priority: Main Goal KPIs; if there are NO entries for main goal in the selected month,
    // fallback to monetary KPIs that DO have entries (avoids showing 0% when users are launching in another KPI).
    const getCompanyKpisList = (companyId: string) => {
      const allCompanyKpis = companyKpis.filter(k => k.company_id === companyId);
      const mainGoalKpis = allCompanyKpis.filter(k => k.is_main_goal === true);
      const monetaryKpis = allCompanyKpis.filter(k => k.kpi_type === "monetary");

      if (mainGoalKpis.length === 0) return monetaryKpis;

      // If main goal exists but has no entries this month, try falling back to monetary KPIs with entries
      const hasMainGoalEntries = kpiEntries.some(e =>
        getEntryCompanyId(e as any) === companyId &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd &&
        mainGoalKpis.some(k => k.id === e.kpi_id) &&
        e.value !== 0
      );

      if (hasMainGoalEntries) return mainGoalKpis;

      const hasMonetaryEntries = kpiEntries.some(e =>
        getEntryCompanyId(e as any) === companyId &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd &&
        monetaryKpis.some(k => k.id === e.kpi_id) &&
        e.value !== 0
      );

      return hasMonetaryEntries ? monetaryKpis : mainGoalKpis;
    };
    
    // Companies with KPI configured with target_value > 0 (same logic as DashboardMetrics)
    const companiesWithAnyKpiIds = new Set(
      Array.from(activeCompanyIds).filter(companyId => {
        const kpis = getCompanyKpisList(companyId);
        return kpis.some(k => k.target_value > 0);
      })
    );
    
    // Companies without goals (no KPI configured) - exclude goal_not_required
    const noGoalIds = new Set<string>();
    activeCompanyIds.forEach(companyId => {
      if (!companiesWithAnyKpiIds.has(companyId)) {
        const company = companies.find(c => c.id === companyId);
        if (!(company as any)?.goal_not_required) {
          noGoalIds.add(companyId);
        }
      }
    });
    
    // Calculate metrics per company (same logic as DashboardMetrics.tsx)
    activeCompanyIds.forEach(companyId => {
      if (!companyId) return;
      
      // Get KPIs for this company - prioritizes is_main_goal, falls back to monetary
      const companyKpisList = getCompanyKpisList(companyId);
      
      if (companyKpisList.length === 0) return;
      
      // Calculate monthly target using resolveMonthlyTarget helper
      let totalMonthlyTarget = 0;
      companyKpisList.forEach(kpi => {
        totalMonthlyTarget += resolveMonthlyTarget(kpi.id, companyId, monthYear, kpi.target_value, kpi.periodicity, daysInMonth);
      });
      
      // Get entries for this company in the period
      const companyEntries = kpiEntries.filter(e => 
        getEntryCompanyId(e as any) === companyId &&
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
      const timeElapsedPercent = getCompanyTimeElapsedPercent(companyId);
      
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
    
    // Also calculate the PROJECTION percentage per company for display
    // Projection = (realized / target) / timeElapsedPercent * 100
    // Now: show 0% if company has goal but no entries (instead of N/A)
    const realizedPercentByCompany = new Map<string, number | null>();
    
    activeCompanyIds.forEach(companyId => {
      if (!companyId) return;
      
      const companyKpisList = getCompanyKpisList(companyId);
      
      if (companyKpisList.length === 0) {
        realizedPercentByCompany.set(companyId, null); // No KPI configured = S/M
        return;
      }
      
      // Calculate monthly target using resolveMonthlyTarget helper
      let totalMonthlyTarget = 0;
      companyKpisList.forEach(kpi => {
        totalMonthlyTarget += resolveMonthlyTarget(kpi.id, companyId, monthYear, kpi.target_value, kpi.periodicity, daysInMonth);
      });
      
      if (totalMonthlyTarget === 0) {
        realizedPercentByCompany.set(companyId, null); // Target is 0 = S/M
        return;
      }
      
      // Get entries for this company in the period
      const companyEntries = kpiEntries.filter(e => 
        getEntryCompanyId(e as any) === companyId &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd &&
        companyKpisList.some(k => k.id === e.kpi_id)
      );
      
      // If company has goal but no entries, show 0% (not S/M)
      if (companyEntries.length === 0) {
        realizedPercentByCompany.set(companyId, 0); // Has goal, no entries = 0%
        return;
      }
      
      const totalRealized = companyEntries.reduce((sum, e) => sum + e.value, 0);
      const timeElapsedPercent = getCompanyTimeElapsedPercent(companyId);
      
      // Calculate PROJECTION (not just realized) - same formula as the first loop
      const projectionPercent = timeElapsedPercent > 0 && totalMonthlyTarget > 0 
        ? Math.round(((totalRealized / totalMonthlyTarget) / timeElapsedPercent) * 100) 
        : 0;
      
      realizedPercentByCompany.set(companyId, projectionPercent);
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
  }, [dateRange, companies, companyKpis, kpiEntries, monthlyTargetsForProjection, companyDailyGoalSettings]);

  // Badge projection should match the company KPI dashboard's "Projeção do Mês",
  // which is always based on the current month (not the MonthYearPicker range).
  const currentMonthProjectionByCompany = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentMonthYear = `${year}-${String(month).padStart(2, "0")}`;
    
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-${daysInMonth}`;

    const kpiIdToCompanyId = new Map<string, string>();
    companyKpis.forEach(k => {
      if (k?.id && k?.company_id) kpiIdToCompanyId.set(k.id, k.company_id);
    });
    const getEntryCompanyId = (e: { company_id: string; kpi_id: string }) => {
      return e.company_id || kpiIdToCompanyId.get(e.kpi_id) || "";
    };

    const map = new Map<string, number | null>();

    // Compute only for active companies (same exclusion as the main ranges)
    const activeCompanies = companies.filter(c => c.status !== "inactive" && c.status !== "closed" && !c.is_simulator);

    activeCompanies.forEach(company => {
      const companyId = company.id;
      
      // Skip goal projection for companies where goal is not required
      if ((company as any).goal_not_required) {
        map.set(companyId, null); // Will show "—" instead of "S/M"
        return;
      }
      
      const allCompanyKpis = companyKpis.filter(k => k.company_id === companyId);
      const mainGoalKpis = allCompanyKpis.filter(k => k.is_main_goal === true);
      const monetaryKpis = allCompanyKpis.filter(k => k.kpi_type === "monetary");
      const kpisForProjection = mainGoalKpis.length > 0 ? mainGoalKpis : monetaryKpis;

      if (kpisForProjection.length === 0) {
        map.set(companyId, null);
        return;
      }

      // Calculate monthly target using resolveMonthlyTarget helper
      let totalMonthlyTarget = 0;
      kpisForProjection.forEach(kpi => {
        totalMonthlyTarget += resolveMonthlyTarget(kpi.id, companyId, currentMonthYear, kpi.target_value, kpi.periodicity, daysInMonth);
      });

      if (totalMonthlyTarget <= 0) {
        map.set(companyId, null);
        return;
      }

      const companyEntries = kpiEntries.filter(e =>
        getEntryCompanyId(e as any) === companyId &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd &&
        kpisForProjection.some(k => k.id === e.kpi_id)
      );

      if (companyEntries.length === 0) {
        map.set(companyId, 0);
        return;
      }

      const totalRealized = companyEntries.reduce((sum, e) => sum + e.value, 0);
      const timeElapsedPercent = getTimeElapsedPercentForCompany(companyId, year, month - 1, now.getDate(), true);
      const projectionPercent = timeElapsedPercent > 0
        ? Math.round(((totalRealized / totalMonthlyTarget) / timeElapsedPercent) * 100)
        : 0;
      map.set(companyId, projectionPercent);
    });

    return map;
  }, [companies, companyKpis, kpiEntries, monthlyTargetsForProjection, companyDailyGoalSettings]);

  const filteredCompanies = useMemo(() => {
    const filtered = companies.filter((company) => {
      // Hide inactive and closed companies entirely from dashboard
      // Exception: show them when filtering by relevant status metrics OR status dropdown
      const isCancellationMetricFilter = activeMetricFilter?.type === "status" && 
        (activeMetricFilter?.value === "closed" || activeMetricFilter?.value === "churn_signaled" || 
         activeMetricFilter?.value === "cancellation_signaled" || activeMetricFilter?.value === "notice_period");
      const isCancellationStatusFilter = filterStatus === "cancellation_signaled" || filterStatus === "notice_period" || filterStatus === "closed";
      if (company.status === "inactive" || company.status === "closed") {
        // Must be filtering by a relevant status to show inactive/closed companies
        if (!isCancellationMetricFilter && !isCancellationStatusFilter) {
          return false;
        }
        // Company must have projects matching the filter
        const hasCancellationProject = company.projects?.some(p => 
          p.status === "cancellation_signaled" || p.status === "notice_period"
        );
        const hasClosedProject = company.projects?.some(p => p.status === "closed");
        const isClosedFilter = filterStatus === "closed" || activeMetricFilter?.value === "closed";
        if (!hasCancellationProject && !(isClosedFilter && hasClosedProject)) {
          return false;
        }
      }
      
      // Hide companies without any projects from the dashboard
      if (!company.projects || company.projects.length === 0) {
        return false;
      }
      
      // For consultants: only show companies where they have non-closed projects as consultant or CS
      if (currentUserRole === "consultant" && currentStaffId) {
        const isMyCompany = company.consultant_id === currentStaffId || company.cs_id === currentStaffId;
        const hasMyNonClosedProject = company.projects?.some(p => 
          (p.consultant_id === currentStaffId || p.cs_id === currentStaffId) && 
          p.status !== 'closed' && p.status !== 'completed'
        );
        if (!isMyCompany && !hasMyNonClosedProject) return false;
      }
      
      // Text search filter
      const matchesSearch =
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.segment && company.segment.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Consultant filter - check if consultant has non-closed projects in this company
      // Skip for consultants since they already see only their companies
      const nonClosedProjects = company.projects?.filter(p => p.status !== 'closed' && p.status !== 'completed') || [];
      const matchesConsultant = 
        currentUserRole === "consultant" ||
        filterConsultant === "all" || 
        company.consultant_id === filterConsultant ||
        company.cs_id === filterConsultant ||
        nonClosedProjects.some(p => p.consultant_id === filterConsultant || p.cs_id === filterConsultant);
      
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
          // Filter companies with closed projects in the period,
          // but exclude those that are classified as non-renewed (same logic as card counter).
          const closedProjectsInPeriod = (company.projects || []).filter(p => {
            if (p.status !== "closed") return false;
            const closedDate = new Date((p.churn_date || p.updated_at));
            return isWithinInterval(closedDate, { start: dateRange.start, end: dateRange.end });
          });
          const hasClosedProjectInPeriod = closedProjectsInPeriod.length > 0;

          if (!hasClosedProjectInPeriod) {
            matchesMetricFilter = false;
          } else {
            const hasRenewalInPeriod = contractRenewals.some(r => {
              if (r.company_id !== company.id) return false;
              const renewalDate = new Date(r.renewal_date.substring(0, 10) + "T12:00:00");
              return isWithinInterval(renewalDate, { start: dateRange.start, end: dateRange.end });
            });

            // Match card counter logic: check churn_reason from allProjects
            const closedProjectIds = new Set(closedProjectsInPeriod.map(p => p.id));
            const matchingAllProjects = allProjects.filter(p => closedProjectIds.has(p.id));
            const hasProjectWithChurnReason = matchingAllProjects.some(p => p.churn_reason);
            const hasProjectWithoutChurnReason = matchingAllProjects.some(p => !p.churn_reason);
            const hasOnlyChurnReasons = hasProjectWithChurnReason && !hasProjectWithoutChurnReason;

            const isAutoNotRenewed =
              company.payment_method !== "monthly" &&
              !hasRenewalInPeriod &&
              !hasOnlyChurnReasons;

            matchesMetricFilter = !isAutoNotRenewed;
          }
        } else if (activeMetricFilter.type === "status" && activeMetricFilter.value === "churn_signaled") {
          // Special filter: includes both cancellation_signaled AND notice_period
          // No date filter here - matches how projectMetrics.churnSignaled is calculated
          matchesMetricFilter = company.projects?.some(p => 
            p.status === "cancellation_signaled" || p.status === "notice_period"
          ) ?? false;
        } else if (activeMetricFilter.type === "status" && (activeMetricFilter.value === "cancellation_signaled" || activeMetricFilter.value === "notice_period")) {
          // For cancellation/notice filters, don't require date range - show all current
          matchesMetricFilter = company.projects?.some(p => p.status === activeMetricFilter.value) ?? false;
        } else if (activeMetricFilter.type === "status") {
          // For other status filters (active, etc.), filter by date range
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
        } else if (activeMetricFilter.type === "projects_active") {
          // Filter companies that have at least one active project (exclude simulators)
          matchesMetricFilter = !company.is_simulator && (company.projects?.some(p => p.status === "active") ?? false);
        }
      }
      
      return matchesSearch && matchesConsultant && matchesService && matchesStatus && matchesMetricFilter;
    });
    
    // Sort rule (business): companies that entered now (<= 30 days) must appear first.
    // Fallback for integrations that may not set contract_start_date: use created_at.
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const getStartDate = (c: Company) => new Date(c.contract_start_date ?? c.created_at);

    // IMPORTANT: never mutate `filtered` in-place (it can cause subtle UI issues)
    return [...filtered].sort((a, b) => {
      const aStart = getStartDate(a);
      const bStart = getStartDate(b);
      const aIsNew = aStart >= thirtyDaysAgo;
      const bIsNew = bStart >= thirtyDaysAgo;

      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;

      return bStart.getTime() - aStart.getTime();
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
    // Get IDs of active companies (exclude inactive and closed)
    const activeCompanyIds = new Set(
      companies.filter(c => c.status !== "inactive" && c.status !== "closed").map(c => c.id)
    );
    
    // Always exclude closed/completed projects AND projects from inactive companies
    // BUT keep cancellation_signaled/notice_period projects even from inactive companies
    const actionableProjects = allProjects.filter(p => {
      if (p.status === "closed" || p.status === "completed") return false;
      
      // Keep cancellation/notice projects even from inactive companies
      if (p.status === "cancellation_signaled" || p.status === "notice_period") return true;
      
      // Filter out projects from inactive/closed companies
      const companyId = getProjectCompanyId(p);
      if (companyId && !activeCompanyIds.has(companyId)) return false;
      
      return true;
    });

    if (filterConsultant === "all" && filterService === "all" && filterStatus === "all") {
      return actionableProjects;
    }

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

  // TEMP DEBUG: diagnose why the "Solicitou Canc." card shows 5 but the list/card becomes 0 after click
  useEffect(() => {
    try {
      const churnProjectsInFiltered = filteredProjects.filter(
        (p) => p.status === "cancellation_signaled" || p.status === "notice_period"
      );
      const churnProjectsInAll = allProjects.filter(
        (p) => p.status === "cancellation_signaled" || p.status === "notice_period"
      );

      console.debug("[dashboard-debug] state", {
        activeMetricFilter,
        filterStatus,
        filterConsultant,
        filterService,
        activeDashboardTab,
        companiesCount: companies.length,
        filteredCompaniesCount: filteredCompanies.length,
        filteredProjectsCount: filteredProjects.length,
        churnProjectsInFilteredCount: churnProjectsInFiltered.length,
        churnProjectsInAllCount: churnProjectsInAll.length,
      });
    } catch (e) {
      console.debug("[dashboard-debug] failed to log", e);
    }
  }, [
    activeMetricFilter,
    filterStatus,
    filterConsultant,
    filterService,
    activeDashboardTab,
    companies.length,
    filteredCompanies.length,
    filteredProjects.length,
    allProjects.length,
    filteredProjects,
    allProjects,
  ]);

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

  // Function to update all health scores using the same backend logic as the daily automation
  const handleUpdateAllHealthScores = async () => {
    setUpdatingAllHealthScores(true);
    try {
      toast.loading("Atualizando saúde global...", { id: "health-update" });

      const { data, error } = await supabase.functions.invoke("calculate-all-health-scores");

      if (error) throw error;

      await fetchHealthScores();

      const processed = typeof data?.processed === "number" ? data.processed : 0;
      const errors = typeof data?.errors === "number" ? data.errors : 0;

      toast.dismiss("health-update");

      if (errors === 0) {
        toast.success(
          processed > 0
            ? `Saúde de ${processed} projetos atualizada com a lógica oficial.`
            : "Saúde global atualizada com a lógica oficial."
        );
      } else {
        toast.warning(`${processed} projetos atualizados, ${errors} com erro.`);
      }
    } catch (error: any) {
      console.error("Error updating all health scores:", error);
      toast.dismiss("health-update");
      toast.error("Erro ao atualizar saúde das empresas");
    } finally {
      setUpdatingAllHealthScores(false);
    }
  };

  const getStatusBadge = (status: string, noticeEndDate?: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "cancellation_signaled":
        return <Badge className="bg-amber-500">Sinalizou Cancelamento</Badge>;
      case "notice_period":
        return (
          <span className="inline-flex items-center gap-1">
            <Badge className="bg-orange-500">Cumprindo Aviso</Badge>
            {noticeEndDate && (
              <span className="text-[10px] text-orange-600 font-medium whitespace-nowrap">
                até {format(new Date(noticeEndDate + "T12:00:00"), "dd/MM/yyyy")}
              </span>
            )}
          </span>
        );
      case "closed":
        return <Badge variant="destructive">Encerrado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCompanyClick = (companyId: string) => {
    setExpandedCompanyId(expandedCompanyId === companyId ? null : companyId);
  };

  const isMaster = currentUserRole === "master";
  const isAdmin = currentUserRole === "admin" || isMaster;
  const isCS = currentUserRole === "cs";
  const isConsultant = currentUserRole === "consultant";
  const canCreateCompany = isAdmin || isCS;
  const canAccessAnalytics = isAdmin || isCS || isConsultant;
  // Permission helper: master has all, others check staff_menu_permissions
  // Tenant white-label gate: se o módulo estiver desabilitado no tenant, ninguém vê (nem admin do tenant).
  const hasMenuPerm = (key: string) => {
    if (!isModuleEnabled(key)) return false;
    if (!isStaffMenuAllowed(key)) return false; // whitelist por menu (master define no /whitelabel-gestao)
    return isMaster || staffMenuPermissions.includes(key);
  };
  const canAccessCRM = hasCRMPermission && isModuleEnabled("crm") && isStaffMenuAllowed("crm");
  const canAccessFinancial = (isAdmin || hasFinancialPermission) && isModuleEnabled("financial") && isStaffMenuAllowed("financial");
  const canAccessResults = hasMenuPerm("results");
  const canAccessCircle = hasMenuPerm("circle");
  const canAccessCalendar = hasMenuPerm("calendar");
  const canAccessHR = hasMenuPerm("hr");
  const canAccessAcademy = hasMenuPerm("academy");
  const canAccessAnnouncements = hasMenuPerm("announcements");

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
      {/* Sticky mobile header - logo + action buttons */}
      <div className="sticky top-0 z-50 overflow-visible border-b border-border/40 bg-background/95 pt-[max(env(safe-area-inset-top,0px),44px)] backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:static sm:border-b-0 sm:bg-transparent sm:pt-0 sm:backdrop-blur-none">
        <div className="container mx-auto px-2 pb-2 pt-1 sm:px-4 sm:py-0 sm:pt-8">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <NexusHeader className="min-w-0 flex-1" />
              <WelcomeHeader className="text-xs sm:text-sm text-muted-foreground hidden sm:block" />
            </div>
            
            {/* Mobile Actions - Compact */}
            <div className="flex items-center gap-1 sm:hidden">
              {/* Quick action buttons visible on mobile */}
              {currentUserRole && currentStaffId && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowMyTasks(true)} title="Minhas Tarefas">
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate("/onboarding-tasks/task-manager")} title="Gerenciador">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
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
                  {/* Reuniões */}
                  {(canAccessCalendar || isConsultant || isCS) && currentStaffId && (
                    <DropdownMenuItem onClick={() => setShowMeetings(true)}>
                      <Video className="h-4 w-4 mr-2" />
                      Reuniões
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/office")}>
                    <Video className="h-4 w-4 mr-2" />
                    Escritório UNV
                  </DropdownMenuItem>
                  {/* Contratos */}
                  {(isAdmin || isCS || currentUserRole === "closer") && (
                    <DropdownMenuItem onClick={() => navigate("/contratos?history=true")}>
                      <FileText className="h-4 w-4 mr-2" />
                      Contratos
                    </DropdownMenuItem>
                  )}
                  {/* Hotseat */}
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/hotseat")}>
                      <Heart className="h-4 w-4 mr-2" />
                      Hotseat
                    </DropdownMenuItem>
                  )}
                  {/* Consultorias */}
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/consultorias")}>
                      <Briefcase className="h-4 w-4 mr-2" />
                      Consultorias
                    </DropdownMenuItem>
                  )}
                  {/* Onboarding */}
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding")}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Onboarding
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/nota-fiscal")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Nota Fiscal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/whatsapp")}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    UNV Disparador
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/whatsapp-hub")}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp Hub
                  </DropdownMenuItem>
                  {/* Vagas RH */}
                  {canAccessHR && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/vagas")}>
                      <Briefcase className="h-4 w-4 mr-2" />
                      Vagas (RH)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/b2b-prospection")}>
                    <Target className="h-4 w-4 mr-2" />
                    Prospecção B2B
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/slide-generator")}>
                    <Presentation className="h-4 w-4 mr-2" />
                    Gerador de Slides
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
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/cancellations-retention")}>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Cancelamentos & Retenção
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
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/gamificacao-geral")}>
                        <Gamepad2 className="h-4 w-4 mr-2" />
                        Gamificação Geral
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/commercial-actions")}>
                        <Target className="h-4 w-4 mr-2" />
                        Ações Comerciais
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/churn-prediction")}>
                        <TrendingDown className="h-4 w-4 mr-2" />
                        Previsão de Churn
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/cohort-retention")}>
                        <Users2 className="h-4 w-4 mr-2" />
                        Análise de Cohort
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/executive")}>
                        <Activity className="h-4 w-4 mr-2" />
                        Dashboard Executivo
                      </DropdownMenuItem>
                      {currentUserEmail === "fabricio@universidadevendas.com.br" && (
                        <>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/master-ai")}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            IA
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/ceo")}>
                            <Crown className="h-4 w-4 mr-2" />
                            Painel do CEO
                          </DropdownMenuItem>
                        </>
                      )}
                      {canAccessFinancial && (
                        <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/financeiro/recorrencias")}>
                          <Calculator className="h-4 w-4 mr-2" />
                          Financeiro
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowAccessControlPanel(true)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Controle de Acesso
                      </DropdownMenuItem>
                    </>
                  )}
                  {canCreateCompany && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/staff")}>
                      <Users className="h-4 w-4 mr-2" />
                      Equipe
                    </DropdownMenuItem>
                  )}
                  {/* Resultados for CS and consultants */}
                  {canAccessCRM && (
                    <DropdownMenuItem onClick={() => navigate("/crm")}>
                      <Target className="h-4 w-4 mr-2" />
                      CRM Comercial
                    </DropdownMenuItem>
                  )}
                  {canAccessResults && !isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/results")}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Resultados
                    </DropdownMenuItem>
                  )}
                  {/* UNV Academy */}
                  {canAccessAnalytics && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/pdi")}>
                        <Target className="h-4 w-4 mr-2" />
                        PDI
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/academy")}>
                        <GraduationCap className="h-4 w-4 mr-2" />
                        UNV Academy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/unv-profile")}>
                        <Users className="h-4 w-4 mr-2" />
                        UNV Profile
                      </DropdownMenuItem>
                    </>
                  )}
                  {/* UNV Circle */}
                  {canAccessCircle && (
                    <DropdownMenuItem onClick={() => navigate("/circle")}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      UNV Circle
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowStaffSettings(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    await supabase.auth.signOut();
                    navigate("/onboarding-tasks/login");
                  }}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main content below sticky header */}
      <div className="container mx-auto px-2 sm:px-4 pb-4 sm:pb-8">
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">

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

            <Button variant="outline" size="sm" onClick={() => navigate("/onboarding-tasks/task-manager")}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Gerenciador
            </Button>

            <Button variant="outline" size="sm" onClick={() => navigate("/onboarding-tasks/office")}>
              <Video className="h-4 w-4 mr-2" />
              Escritório
            </Button>

            <Button variant="outline" size="sm" onClick={() => navigate("/onboarding-tasks/unv-office")}>
              <Building2 className="h-4 w-4 mr-2" />
              UNV Office
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate("/onboarding-tasks/hotseat")}
                  className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  <Heart className="h-4 w-4" />
                  Hotseat
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate("/onboarding-tasks/consultorias")}
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Briefcase className="h-4 w-4" />
                  Consultorias
                </Button>
              </>
            )}
            {/* Contratos button - Admin, CS and Closer */}
            {(isAdmin || isCS || currentUserRole === "closer") && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/contratos?history=true")}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Contratos
              </Button>
            )}
            {/* Minhas Tarefas button - visible for all staff */}
            {currentUserRole && currentStaffId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMyTasks(true)}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Minhas Tarefas
              </Button>
            )}
            {/* Reuniões button - visible for all staff */}
            {(canAccessCalendar || isConsultant || isCS) && currentStaffId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMeetings(true)}
                className="gap-2"
              >
                <Video className="h-4 w-4" />
                Reuniões
              </Button>
            )}
            {/* Resultados button - permission-gated */}
            {canAccessResults && (
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
            {/* UNV Circle button - permission-gated */}
            {canAccessCircle && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/circle")}
                className="gap-2 border-violet-300 text-violet-600 hover:bg-violet-50"
              >
                <Sparkles className="h-4 w-4" />
                UNV Circle
              </Button>
            )}
            {/* Vagas (RH) button - permission-gated */}
            {canAccessHR && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/onboarding-tasks/vagas")}
                className="gap-2"
              >
                <Briefcase className="h-4 w-4" />
                Vagas (RH)
              </Button>
            )}
            {/* UNV Disparador button - visible for all staff */}
            {currentUserRole && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/onboarding-tasks/whatsapp")}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                UNV Disparador
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
            {/* Financeiro button - visible for admin, master, and users with financial permission */}
            {canAccessFinancial && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/onboarding-tasks/financeiro/recorrencias")}
                className="gap-2"
              >
                <Calculator className="h-4 w-4" />
                Financeiro
              </Button>
            )}

            {/* API Docs button - visible for admin and master only */}
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/onboarding-tasks/api-docs")}
                className="gap-2"
              >
                <Code2 className="h-4 w-4" />
                API
              </Button>
            )}

            {(isAdmin || isCS) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/onboarding-tasks/cancellations-retention")}
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
              >
                <AlertTriangle className="h-4 w-4" />
                Cancelamentos
              </Button>
            )}

            {/* Nota Fiscal button - visible for all staff */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/onboarding-tasks/nota-fiscal")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Nota Fiscal
            </Button>

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
                  {/* CEO Panel - First item for CEO */}
                  {currentUserEmail === "fabricio@universidadevendas.com.br" && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/master-ai")}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        IA
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/ceo")}>
                        <Crown className="h-4 w-4 mr-2" />
                        Painel do CEO
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/whitelabel-gestao")}>
                        <Building2 className="h-4 w-4 mr-2" />
                        White-Label
                      </DropdownMenuItem>
                    </>
                  )}
                  {/* Painel White-Label para admin de tenant (branding, integrações, usuários) */}
                  {isWhiteLabel && isAdmin && currentUserEmail !== "fabricio@universidadevendas.com.br" && (
                    <DropdownMenuItem onClick={() => navigate("/whitelabel-admin")}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Painel White-Label
                    </DropdownMenuItem>
                  )}
                  {canAccessFinancial && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/financeiro/recorrencias")}>
                      <Calculator className="h-4 w-4 mr-2" />
                      Financeiro
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/cancellations-retention")}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Cancelamentos & Retenção
                    </DropdownMenuItem>
                  )}
                  {(currentUserEmail === "fabricio@universidadevendas.com.br" || canAccessFinancial || isAdmin) && (
                    <DropdownMenuSeparator />
                  )}

                  {/* Leader Panel - For admins except CEO */}
                  {isAdmin && currentUserEmail !== "fabricio@universidadevendas.com.br" && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/leader")}>
                        <Activity className="h-4 w-4 mr-2" />
                        Painel do Líder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  {/* Análises - Available to Admin, CS, and Consultants */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Análises
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/executive")}>
                          <Activity className="h-4 w-4 mr-2" />
                          Dashboard Executivo
                        </DropdownMenuItem>
                      )}
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
                        <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/payment-notifications")}>
                          <Bell className="h-4 w-4 mr-2" />
                          Notificações de Pagamento
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
                            <DropdownMenuItem onClick={() => navigate("/sales-report")}>
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Relatório de Vendas do Mês
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
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/client-access")}>
                            <Eye className="h-4 w-4 mr-2" />
                            Acessos dos Clientes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/segments")}>
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Segmentos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/gamificacao-geral")}>
                            <Gamepad2 className="h-4 w-4 mr-2" />
                            Gamificação Geral
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/commercial-actions")}>
                            <Target className="h-4 w-4 mr-2" />
                            Ações Comerciais
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {/* Operacional */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Operacional
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-56">
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/renewals")}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Renovações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/cancellations")}>
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Cancelamentos & Retenção
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/reschedule")}>
                              <CalendarClock className="h-4 w-4 mr-2" />
                              Reagendar Tarefas
                            </DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <DropdownMenuItem 
                              onClick={handleUpdateAllHealthScores}
                              disabled={updatingAllHealthScores}
                            >
                              <Heart className={`h-4 w-4 mr-2 ${updatingAllHealthScores ? "animate-pulse" : ""}`} />
                              {updatingAllHealthScores ? "Atualizando..." : "Atualizar Saúde Global"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setShowUnassignedTasks(true)}>
                            <UserX className="h-4 w-4 mr-2" />
                            Tarefas sem Responsável
                          </DropdownMenuItem>
                          {(isAdmin || hasMenuPerm("financial")) && (
                            <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/billing-rules")}>
                              <Bell className="h-4 w-4 mr-2" />
                              Régua de Cobranças
                            </DropdownMenuItem>
                          )}
                          {(isAdmin || hasMenuPerm("financial")) && (
                            <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/survey-send-config")}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Régua de Pesquisas
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      {/* Central de Automações */}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/automations")}>
                        <Zap className="h-4 w-4 mr-2" />
                        Central de Automações
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/b2b-prospection")}>
                        <Target className="h-4 w-4 mr-2" />
                        Prospecção B2B
                      </DropdownMenuItem>

                      {/* UNV Academy & Tools */}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/pdi")}>
                        <Target className="h-4 w-4 mr-2" />
                        PDI
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/academy")}>
                        <GraduationCap className="h-4 w-4 mr-2" />
                        UNV Academy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/unv-profile")}>
                        <Users className="h-4 w-4 mr-2" />
                        UNV Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/circle")}>
                        <Users className="h-4 w-4 mr-2" />
                        UNV Circle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/whatsapp")}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        UNV Disparador
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/whatsapp-hub")}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        WhatsApp Hub
                      </DropdownMenuItem>

                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setActiveDashboardTab("referrals")}>
                            <Gift className="h-4 w-4 mr-2" />
                            Indicações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowAnnouncementDialog(true)}>
                            <Megaphone className="h-4 w-4 mr-2" />
                            Enviar Comunicado
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/onboarding-tasks/slide-generator")}>
                    <Presentation className="h-4 w-4 mr-2" />
                    Gerador de Slides
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <ThemeToggle />
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
          currentStaffUserId={currentStaffId}
          selectedConsultantStaffId={filterConsultant !== "all" ? filterConsultant : undefined}
          onActiveTabChange={setActiveDashboardTab}
          staffRole={currentUserRole}
          // Pass data to eliminate duplicate queries in DashboardMetrics
          externalNpsResponses={fullNpsResponses}
          externalCompanyKpis={companyKpis}
          externalKpiEntries={kpiEntries}
          externalContractRenewals={contractRenewals}
          externalHealthScores={healthScoresArray}
          consultants={consultants}
        />

        {/* Referrals Panel - Shown when on referrals tab */}
        {activeDashboardTab === "referrals" && (
          <ReferralsPanel />
        )}

        {/* Companies List - Hidden when on NPS, CSAT or Referrals tab */}
        {activeDashboardTab === "nps" || activeDashboardTab === "csat" || activeDashboardTab === "referrals" ? null : filteredCompanies.length === 0 ? (
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
              const companyGoalPercent = currentMonthProjectionByCompany.get(company.id);

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
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            <h3 className="text-sm sm:text-base md:text-lg font-bold text-foreground uppercase tracking-wide break-words max-w-full">{company.name}</h3>
                            <div className="flex flex-wrap items-center gap-1">
                              {getStatusBadge(company.status, (company.projects as any[])?.find((p: any) => p.status === "notice_period")?.notice_end_date)}
                              {/* Tag "Empresa Nova" for companies started within last 30 days.
                                  Fallback: if contract_start_date is missing (ex: leads coming from integrations), use created_at. */}
                              {differenceInDays(
                                new Date(),
                                new Date(company.contract_start_date ?? company.created_at)
                              ) <= 30 && (
                                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] sm:text-xs font-semibold shadow-md animate-pulse">
                                  ✨ Empresa Nova
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-muted-foreground mt-0.5">
                            {company.segment && <span className="break-words">{company.segment}</span>}
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
                            <span 
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                                (company as any).goal_not_required
                                  ? 'bg-blue-100'
                                  : companyGoalPercent === null || companyGoalPercent === undefined 
                                    ? 'bg-muted' 
                                    : companyGoalPercent >= 100 
                                      ? 'bg-green-100' 
                                      : companyGoalPercent >= 70 
                                        ? 'bg-yellow-100' 
                                        : 'bg-red-100'
                              }`}
                              title={(company as any).goal_not_required ? "Meta Não Necessária" : "Projeção da Meta Principal"}
                            >
                              <Target className={`h-2.5 w-2.5 ${
                                (company as any).goal_not_required
                                  ? 'text-blue-600'
                                  : companyGoalPercent === null || companyGoalPercent === undefined 
                                    ? 'text-muted-foreground' 
                                    : companyGoalPercent >= 100 
                                      ? 'text-green-600' 
                                      : companyGoalPercent >= 70 
                                        ? 'text-yellow-600' 
                                        : 'text-red-600'
                              }`} />
                              <span className={`font-semibold ${
                                (company as any).goal_not_required
                                  ? 'text-blue-600'
                                  : companyGoalPercent === null || companyGoalPercent === undefined 
                                    ? 'text-muted-foreground' 
                                    : companyGoalPercent >= 100 
                                      ? 'text-green-600' 
                                      : companyGoalPercent >= 70 
                                        ? 'text-yellow-600' 
                                        : 'text-red-600'
                              }`}>
                                {(company as any).goal_not_required ? '—' : companyGoalPercent === null || companyGoalPercent === undefined ? 'S/M' : `${companyGoalPercent}%`}
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
                        <div 
                          className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full ${
                            (company as any).goal_not_required
                              ? 'bg-blue-100'
                              : companyGoalPercent === null || companyGoalPercent === undefined 
                                ? 'bg-muted' 
                                : companyGoalPercent >= 100 
                                  ? 'bg-green-100' 
                                  : companyGoalPercent >= 70 
                                    ? 'bg-yellow-100' 
                                    : 'bg-red-100'
                          }`}
                          title={(company as any).goal_not_required ? "Meta Não Necessária" : "Projeção da Meta Principal"}
                        >
                          <Target className={`h-3.5 w-3.5 ${
                            (company as any).goal_not_required
                              ? 'text-blue-600'
                              : companyGoalPercent === null || companyGoalPercent === undefined 
                                ? 'text-muted-foreground' 
                                : companyGoalPercent >= 100 
                                  ? 'text-green-600' 
                                  : companyGoalPercent >= 70 
                                    ? 'text-yellow-600' 
                                    : 'text-red-600'
                          }`} />
                          <span className={`text-sm font-semibold ${
                            (company as any).goal_not_required
                              ? 'text-blue-600'
                              : companyGoalPercent === null || companyGoalPercent === undefined 
                                ? 'text-muted-foreground' 
                                : companyGoalPercent >= 100 
                                  ? 'text-green-600' 
                                  : companyGoalPercent >= 70 
                                    ? 'text-yellow-600' 
                                    : 'text-red-600'
                          }`}>
                            {(company as any).goal_not_required ? '—' : companyGoalPercent === null || companyGoalPercent === undefined ? 'S/M' : `${companyGoalPercent}%`}
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
                          className={`h-4 w-4 sm:h-5 sm:w-5 text-foreground transition-transform ${
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
                      company.projects
                        .filter((project) => {
                          // For consultants: only show projects where they are assigned
                          if (currentUserRole === "consultant" && currentStaffId) {
                            return project.consultant_id === currentStaffId || project.cs_id === currentStaffId;
                          }
                          return true;
                        })
                        .map((project) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:shadow-md transition-all bg-card border border-muted hover:border-primary/50"
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
                                {getStatusBadge(project.status, (project as any).notice_end_date)}
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
              <div className="flex items-center justify-center gap-1 sm:gap-2 pt-4 max-w-full overflow-hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 px-2 sm:px-3"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Anterior</span>
                </Button>
                
                <div className="flex items-center gap-1 overflow-hidden">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      return page === 1 || 
                             page === totalPages || 
                             Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, idx, arr) => (
                      <div key={page} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-1 sm:px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="min-w-[32px] sm:min-w-[40px] px-2"
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
                  className="shrink-0 px-2 sm:px-3"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <span className="hidden sm:inline mr-1">Próximo</span>
                  <ChevronRight className="h-4 w-4" />
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

      {/* Global Access Control Panel */}
      <GlobalAccessControlPanel
        open={showAccessControlPanel}
        onOpenChange={setShowAccessControlPanel}
      />

      {/* Staff Settings Sheet */}
      <StaffSettingsSheet
        open={showStaffSettings}
        onOpenChange={setShowStaffSettings}
      />

      {/* My Tasks Panel */}
      <MyTasksPanel
        open={showMyTasks}
        onOpenChange={setShowMyTasks}
        staffId={currentStaffId}
      />

      {/* Meetings Panel */}
      <MeetingsPanel
        open={showMeetings}
        onOpenChange={setShowMeetings}
        staffId={currentStaffId}
        staffRole={currentUserRole}
      />

      {/* Unassigned Tasks Dialog */}
      <UnassignedTasksDialog
        open={showUnassignedTasks}
        onOpenChange={setShowUnassignedTasks}
      />
    </div>
  );
};

export default OnboardingTasksPage;
