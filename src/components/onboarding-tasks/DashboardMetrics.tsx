import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Building2,
  Package,
  XCircle, 
  CalendarX,
  TrendingUp,
  ListTodo,
  TrendingDown,
  Clock,
  Target,
  Zap,
  RotateCcw,
  Star,
  UserCheck,
  UserX,
  Percent,
  FileWarning,
  DollarSign,
  Calendar,
  HeartPulse
} from "lucide-react";
import { format, isBefore, startOfDay, isWithinInterval, eachDayOfInterval, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  CartesianGrid,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { TasksListDialog } from "./TasksListDialog";
import { DashboardAgenda } from "./DashboardAgenda";

interface Task {
  id: string;
  title?: string;
  status: string;
  due_date: string | null;
  project_id: string;
  completed_at: string | null;
  responsible_staff_id?: string | null;
}

interface Project {
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  consultant_id: string | null;
  reactivated_at?: string | null;
  current_nps?: number | null;
  onboarding_company_id?: string | null;
  // Some records use company_id instead of onboarding_company_id
  company_id?: string | null;
  churn_date?: string | null;
}

interface Company {
  id: string;
  name: string;
  status: string;
  contract_end_date: string | null;
  contract_start_date: string | null;
  contract_value: number | null;
  status_changed_at?: string | null;
  created_at: string;
  payment_method?: string | null;
  consultant_id?: string | null;
}

interface DashboardMetricsProps {
  companies: Company[];
  projects: Project[];
  onFilterChange: (filter: { type: string; value: string } | null) => void;
  activeMetricFilter: { type: string; value: string } | null;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  overdueTasks: Task[];
  todayTasks: Task[];
  allTasks?: Task[];
  onDataRefresh?: () => void;
  currentStaffUserId?: string | null;
  selectedConsultantStaffId?: string | null;
  onNpsDetailChange?: (isShowingDetail: boolean) => void;
  onActiveTabChange?: (tab: string) => void;
  staffRole?: string | null;
}

const DashboardMetrics = ({ 
  companies, 
  projects,
  onFilterChange, 
  activeMetricFilter,
  dateRange,
  overdueTasks,
  todayTasks,
  allTasks: externalTasks,
  onDataRefresh,
  currentStaffUserId,
  selectedConsultantStaffId,
  onNpsDetailChange,
  onActiveTabChange,
  staffRole
}: DashboardMetricsProps) => {
  const navigate = useNavigate();
  const [internalTasks, setInternalTasks] = useState<Task[]>([]);
  const [npsResponses, setNpsResponses] = useState<{ id: string; project_id: string; score: number; feedback: string | null; what_can_improve: string | null; would_recommend_why: string | null; respondent_name: string | null; respondent_email: string | null; created_at: string }[]>([]);
  const [kpiEntries, setKpiEntries] = useState<{ company_id: string; kpi_id: string; value: number; entry_date: string }[]>([]);
  const [companyKpis, setCompanyKpis] = useState<{ id: string; company_id: string; kpi_type: string; periodicity: string; target_value: number }[]>([]);
  const [contractRenewals, setContractRenewals] = useState<{ company_id: string; renewal_date: string }[]>([]);
  const [healthScores, setHealthScores] = useState<{ project_id: string; total_score: number; risk_level: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const [tasksDialogType, setTasksDialogType] = useState<"overdue" | "today" | "status">("overdue");
  const [tasksDialogIds, setTasksDialogIds] = useState<string[]>([]);
  const [tasksDialogStatus, setTasksDialogStatus] = useState<"completed" | "pending" | "in_progress" | null>(null);
  const [npsDetailType, setNpsDetailType] = useState<"promoters" | "detractors" | "neutrals" | "all" | null>(null);
  const [npsDetailPage, setNpsDetailPage] = useState(1);
  const [showCompaniesWithoutTasks, setShowCompaniesWithoutTasks] = useState(false);
  const npsPerPage = 10;

  // Use external tasks if provided, otherwise fetch internally
  const allTasks = externalTasks || internalTasks;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Only fetch tasks if not provided externally
      if (!externalTasks) {
        const pageSize = 1000;
        let from = 0;
        let allTasksData: Task[] = [];

        while (true) {
          const { data, error } = await supabase
            .from("onboarding_tasks")
            .select("id, title, status, due_date, project_id, completed_at, responsible_staff_id")
            .range(from, from + pageSize - 1);

          if (error) throw error;
          const batch = data || [];
          allTasksData = allTasksData.concat(batch);
          if (batch.length < pageSize) break;
          from += pageSize;
        }
        setInternalTasks(allTasksData);
      }

      const [npsResult, kpisResult, entriesResult, renewalsResult, healthResult] = await Promise.all([
        supabase.from("onboarding_nps_responses").select("id, project_id, score, feedback, what_can_improve, would_recommend_why, respondent_name, respondent_email, created_at").order("created_at", { ascending: false }),
        supabase.from("company_kpis").select("id, company_id, kpi_type, periodicity, target_value").eq("is_active", true),
        supabase.from("kpi_entries").select("company_id, kpi_id, value, entry_date"),
        supabase.from("onboarding_contract_renewals").select("company_id, renewal_date"),
        supabase.from("client_health_scores").select("project_id, total_score, risk_level"),
      ]);

      if (npsResult.error) throw npsResult.error;
      if (kpisResult.error) throw kpisResult.error;
      if (entriesResult.error) throw entriesResult.error;
      if (renewalsResult.error) throw renewalsResult.error;
      if (healthResult.error) throw healthResult.error;

      setNpsResponses(npsResult.data || []);
      setCompanyKpis(kpisResult.data || []);
      setKpiEntries(entriesResult.data || []);
      setContractRenewals((renewalsResult.data as any) || []);
      setHealthScores(healthResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };


  const fetchHealthScores = async () => {
    const { data, error } = await supabase
      .from("client_health_scores")
      .select("project_id, total_score, risk_level");

    if (error) {
      console.error("Error fetching health scores:", error);
      return;
    }

    setHealthScores(data || []);
  };

  // When the user changes the company/project filters, refresh health scores so the card doesn't show stale values
  useEffect(() => {
    fetchHealthScores();
  }, [projects]);

  // Project IDs for filtering
  const filteredProjectIds = useMemo(() => new Set(projects.map(p => p.id)), [projects]);
  const filteredTasks = useMemo(() => {
    return allTasks.filter(t => filteredProjectIds.has(t.project_id));
  }, [allTasks, filteredProjectIds]);

  const taskMetrics = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayTasksCount = todayTasks.length;
    const overdueTasksCount = overdueTasks.length;
    const todayCompletedTasks = filteredTasks.filter(t => {
      if (t.status !== "completed" || !t.completed_at) return false;
      return format(parseISO(t.completed_at), "yyyy-MM-dd") === today;
    });
    const completedTasks = filteredTasks.filter(t => t.status === "completed");
    const pendingTasks = filteredTasks.filter(t => t.status === "pending");
    const inProgressTasks = filteredTasks.filter(t => t.status === "in_progress");
    
    return { 
      todayTasks: todayTasksCount, 
      todayCompleted: todayCompletedTasks.length, 
      todayCompletedIds: todayCompletedTasks.map(t => t.id),
      overdueTasks: overdueTasksCount, 
      totalPending: pendingTasks.length, 
      pendingIds: pendingTasks.map(t => t.id),
      totalInProgress: inProgressTasks.length, 
      inProgressIds: inProgressTasks.map(t => t.id),
      totalCompleted: completedTasks.length, 
      completedIds: completedTasks.map(t => t.id),
      totalTasks: filteredTasks.length,
      pendingTasks: pendingTasks,
      inProgressTasks: inProgressTasks
    };
  }, [filteredTasks, overdueTasks, todayTasks]);

  const completedByDayData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const completedCount = filteredTasks.filter(t => {
        if (!t.completed_at) return false;
        return format(parseISO(t.completed_at), "yyyy-MM-dd") === dayStr;
      }).length;
      return { date: format(day, "dd/MM", { locale: ptBR }), fullDate: format(day, "dd 'de' MMM", { locale: ptBR }), concluídas: completedCount };
    });
  }, [filteredTasks, dateRange]);

  const projectMetrics = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === "active").length;
    const cancellationSignaled = projects.filter(p => p.status === "cancellation_signaled").length;
    const noticePeriod = projects.filter(p => p.status === "notice_period").length;
    const closedProjects = projects.filter(p => p.status === "closed" || p.status === "completed").length;
    const reactivatedInPeriod = projects.filter(p => {
      if (!p.reactivated_at) return false;
      return isWithinInterval(new Date(p.reactivated_at), { start: dateRange.start, end: dateRange.end });
    }).length;
    return { activeProjects, cancellationSignaled, noticePeriod, closedProjects, churnSignaled: cancellationSignaled + noticePeriod, reactivatedInPeriod };
  }, [projects, dateRange]);

  const getProjectCompanyId = (p: Project) => p.onboarding_company_id ?? p.company_id ?? null;

  const filteredCompanyIds = useMemo(
    () => new Set(projects.map(getProjectCompanyId).filter(Boolean) as string[]),
    [projects]
  );
  const filteredCompanies = useMemo(() => companies.filter(c => filteredCompanyIds.has(c.id) && c.status !== "inactive" && c.status !== "closed"), [companies, filteredCompanyIds]);

  // Calculate companies without pending tasks
  const companiesWithoutPendingTasks = useMemo(() => {
    // Get all pending/in_progress tasks per project
    const pendingTasksByProject = new Map<string, number>();
    [...taskMetrics.pendingTasks, ...taskMetrics.inProgressTasks, ...overdueTasks].forEach(task => {
      const count = pendingTasksByProject.get(task.project_id) || 0;
      pendingTasksByProject.set(task.project_id, count + 1);
    });

    // Get company IDs from projects that have NO pending tasks
    const companyIdsWithoutTasks = new Set<string>();
    
    projects.forEach(project => {
      if (project.status !== "active") return;
      const hasPendingTasks = (pendingTasksByProject.get(project.id) || 0) > 0;
      if (!hasPendingTasks) {
        const companyId = getProjectCompanyId(project);
        if (companyId) {
          companyIdsWithoutTasks.add(companyId);
        }
      }
    });

    // Filter only active companies that have no pending tasks
    return filteredCompanies.filter(c => 
      c.status === "active" && companyIdsWithoutTasks.has(c.id)
    );
  }, [projects, taskMetrics.pendingTasks, taskMetrics.inProgressTasks, overdueTasks, filteredCompanies]);

  const companyMetrics = useMemo(() => {
    const today = startOfDay(new Date());

    // "Ativas" is based on company status (portfolio), not on having an active project.
    const activeCompanies = filteredCompanies.filter(c => c.status === "active").length;

    // Empresas ativas sem consultor atribuído
    const activeWithoutConsultant = filteredCompanies.filter(c => 
      c.status === "active" && !c.consultant_id
    ).length;

    // Excluir: empresas com pagamento recorrente (monthly) e empresas inativas/encerradas
    const activeNonRecurringCompanies = filteredCompanies.filter(c => 
      c.payment_method !== "monthly" && 
      c.status !== "inactive" && 
      c.status !== "closed"
    );
    const contractsEndingInPeriod = activeNonRecurringCompanies.filter(c => c.contract_end_date && isWithinInterval(new Date(c.contract_end_date), { start: dateRange.start, end: dateRange.end })).length;
    const expiredContracts = activeNonRecurringCompanies.filter(c => c.contract_end_date && isBefore(new Date(c.contract_end_date), today)).length;
    return { activeCompanies, contractsEndingInPeriod, expiredContracts, activeWithoutConsultant };
  }, [filteredCompanies, dateRange]);

  const renewalMetrics = useMemo(() => {
    const start = dateRange.start;
    const end = dateRange.end;

    // Base: empresas que têm contrato com término (não-recorrente) no período
    const eligibleCompanyIds = new Set(
      filteredCompanies
        .filter(c => c.payment_method !== "monthly" && c.contract_end_date && isWithinInterval(new Date(c.contract_end_date), { start, end }))
        .map(c => c.id)
    );

    const renewalsInPeriod = contractRenewals.filter(r => {
      if (!eligibleCompanyIds.has(r.company_id)) return false;
      const d = new Date(r.renewal_date.substring(0, 10) + "T12:00:00");
      return isWithinInterval(d, { start, end });
    });

    const renewedCompanyIds = new Set(renewalsInPeriod.map(r => r.company_id));

    const renewalsCount = renewalsInPeriod.length;
    const renewedClientsCount = renewedCompanyIds.size;
    const eligibleCount = eligibleCompanyIds.size;
    const renewedPercent = eligibleCount > 0 ? Math.round((renewedClientsCount / eligibleCount) * 100) : 0;

    return { renewalsCount, renewedClientsCount, renewedPercent };
  }, [contractRenewals, dateRange, filteredCompanies]);

  const churnMetrics = useMemo(() => {
    const getClosedDate = (p: Project) => {
      const churnDateStr = p.churn_date || p.updated_at;
      const dateOnly = churnDateStr.substring(0, 10);
      return new Date(dateOnly + "T12:00:00");
    };

    const closedInPeriod = projects.filter(
      p => (p.status === "closed" || p.status === "completed") && isWithinInterval(getClosedDate(p), { start: dateRange.start, end: dateRange.end })
    ).length;

    const signaledInPeriod = projects.filter(
      p => (p.status === "cancellation_signaled" || p.status === "notice_period") && isWithinInterval(new Date(p.updated_at), { start: dateRange.start, end: dateRange.end })
    ).length;

    const totalActiveStart = projectMetrics.activeProjects + closedInPeriod + signaledInPeriod;
    const churnRate = totalActiveStart > 0 ? Math.round((closedInPeriod / totalActiveStart) * 100) : 0;

    // Count unique companies with closed projects in the period
    const closedCompanyIds = new Set(
      projects
        .filter(p => (p.status === "closed" || p.status === "completed") && isWithinInterval(getClosedDate(p), { start: dateRange.start, end: dateRange.end }))
        .map(getProjectCompanyId)
        .filter(Boolean) as string[]
    );
    const closedCompaniesInPeriod = closedCompanyIds.size;

    return { closedInPeriod, signaledInPeriod, churnRate, closedCompaniesInPeriod };
  }, [projects, dateRange, projectMetrics]);

  const monthlyChurnData = useMemo(() => {
    const currentYear = dateRange.start.getFullYear();
    const months = eachMonthOfInterval({ start: startOfYear(new Date(currentYear, 0, 1)), end: endOfYear(new Date(currentYear, 0, 1)) });
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      // Usa churn_date como referência para determinar o mês do churn
      const closedInMonth = projects.filter(p => {
        if (p.status !== "closed" && p.status !== "completed") return false;
        // Prioriza churn_date, depois updated_at como fallback
        const churnDateStr = p.churn_date || p.updated_at;
        // Extrai apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
        const dateOnly = churnDateStr.substring(0, 10);
        const churnDate = new Date(dateOnly + "T12:00:00");
        return isWithinInterval(churnDate, { start: monthStart, end: monthEnd });
      }).length;
      const activeAtMonthStart = projects.filter(p => {
        if (new Date(p.created_at) > monthEnd) return false;
        if (p.status === "closed" || p.status === "completed") {
          // Usa churn_date como referência
          const churnDateStr = p.churn_date || p.updated_at;
          const dateOnly = churnDateStr.substring(0, 10);
          const churnDate = new Date(dateOnly + "T12:00:00");
          return churnDate >= monthStart;
        }
        return true;
      }).length;
      const churnRate = activeAtMonthStart > 0 ? Math.round((closedInMonth / activeAtMonthStart) * 100 * 10) / 10 : 0;
      return { month: format(monthDate, "MMM", { locale: ptBR }), churn: churnRate };
    });
  }, [projects, dateRange]);

  const ltvMetrics = useMemo(() => {
    const today = new Date();

    const parseDateOnlySafe = (value: string | null): Date | null => {
      if (!value) return null;
      const dateOnly = value.substring(0, 10);
      const d = new Date(dateOnly + "T12:00:00");
      return isNaN(d.getTime()) ? null : d;
    };

    // Tempo médio: calcular tempo real de permanência por empresa
    const companiesWithContractStart = filteredCompanies
      .map(c => ({ company: c, start: parseDateOnlySafe(c.contract_start_date) }))
      .filter(x => x.start);

    const lifetimes = companiesWithContractStart
      .map(({ company, start }) => {
        const end = (company.status === "closed" || company.status === "inactive")
          ? parseDateOnlySafe(company.status_changed_at) || today
          : today;

        const lifetimeMonths = Math.max(0, differenceInMonths(end, start as Date));
        return lifetimeMonths;
      })
      // Evita que datas claramente erradas distorçam o dashboard
      .filter(m => m >= 0 && m <= 180);

    const averageLifetimeMonths = lifetimes.length > 0
      ? Math.round((lifetimes.reduce((sum, m) => sum + m, 0) / lifetimes.length) * 10) / 10
      : 0;

    // Ticket médio: somente empresas com valor de contrato
    const companiesWithValue = filteredCompanies.filter(c => c.contract_value && c.contract_value > 0);
    const totalContractValue = companiesWithValue.reduce((sum, c) => sum + (c.contract_value || 0), 0);
    const averageTicket = companiesWithValue.length > 0
      ? Math.round(totalContractValue / companiesWithValue.length)
      : 0;

    // LTV = Ticket Médio Mensal × Tempo Médio de Permanência (em meses)
    const ltv = Math.round(averageTicket * averageLifetimeMonths);

    return { averageLifetimeMonths, ltv };
  }, [filteredCompanies]);

  const npsMetrics = useMemo(() => {
    const filteredProjectIds = new Set(projects.map(p => p.id));
    const totalFilteredProjects = filteredProjectIds.size;
    const filteredResponses = npsResponses.filter(r => filteredProjectIds.has(r.project_id));
    const totalResponses = filteredResponses.length;
    const projectsWithResponse = new Set(filteredResponses.map(r => r.project_id));
    const respondedCount = projectsWithResponse.size;
    const notRespondedCount = totalFilteredProjects - respondedCount;
    const responseRate = totalFilteredProjects > 0 ? Math.round((respondedCount / totalFilteredProjects) * 100) : 0;
    if (totalResponses === 0) return { averageNps: null, promoters: 0, detractors: 0, neutrals: 0, totalResponses: 0, respondedCount: 0, notRespondedCount: totalFilteredProjects, responseRate: 0, totalProjects: totalFilteredProjects };
    const averageNps = Math.round((filteredResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses) * 10) / 10;
    const promoters = filteredResponses.filter(r => r.score >= 9).length;
    const detractors = filteredResponses.filter(r => r.score <= 6).length;
    const neutrals = filteredResponses.filter(r => r.score >= 7 && r.score <= 8).length;
    return { averageNps, promoters, detractors, neutrals, totalResponses, respondedCount, notRespondedCount, responseRate, totalProjects: totalFilteredProjects };
  }, [projects, npsResponses]);

  const healthMetrics = useMemo(() => {
    // Exclude only truly closed/completed projects from health average
    // Keep active + cancellation_signaled + notice_period (they're still "in progress")
    const relevantProjectIds = new Set(
      projects
        .filter(p => !["closed", "completed"].includes(p.status))
        .map(p => p.id)
    );
    const filteredScores = healthScores.filter(h => relevantProjectIds.has(h.project_id));
    
    if (filteredScores.length === 0) {
      return { averageScore: null, critical: 0, warning: 0, healthy: 0, excellent: 0, totalWithScore: 0 };
    }
    
    const averageScore = Math.round(filteredScores.reduce((sum, h) => sum + h.total_score, 0) / filteredScores.length);
    const critical = filteredScores.filter(h => h.risk_level === "critical").length;
    const warning = filteredScores.filter(h => h.risk_level === "warning" || h.risk_level === "high").length;
    const healthy = filteredScores.filter(h => h.risk_level === "healthy" || h.risk_level === "medium").length;
    const excellent = filteredScores.filter(h => h.risk_level === "excellent" || h.risk_level === "low").length;
    
    return { averageScore, critical, warning, healthy, excellent, totalWithScore: filteredScores.length };
  }, [projects, healthScores]);

  const goalsMetrics = useMemo(() => {
    const periodMonth = dateRange.start.getMonth() + 1;
    const periodYear = dateRange.start.getFullYear();
    const today = new Date();
    const isCurrentMonth = today.getMonth() + 1 === periodMonth && today.getFullYear() === periodYear;
    const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
    const currentDay = isCurrentMonth ? today.getDate() : daysInMonth;
    const timeElapsedPercent = currentDay / daysInMonth;

    // Use all active companies (filteredCompanies already excludes inactive/closed)
    const filteredCompanyIds = new Set(filteredCompanies.map(c => c.id));

    // Filter entries for the period
    const monthStart = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
    const monthEnd = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${daysInMonth}`;
    
    // Calculate metrics per company
    const companyMetricsMap = new Map<string, { target: number; realized: number; projectionPercent: number }>();

    filteredCompanyIds.forEach(companyId => {
      if (!companyId) return;

      // Get KPIs for this company (only monetary for main goals tracking)
      const companyKpisList = companyKpis.filter(k => k.company_id === companyId && k.kpi_type === "monetary");
      
      if (companyKpisList.length === 0) return;

      // Calculate monthly target
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

      const totalRealized = companyEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Calculate projection
      const projectionPercent = timeElapsedPercent > 0 && totalMonthlyTarget > 0 
        ? Math.round(((totalRealized / totalMonthlyTarget) / timeElapsedPercent) * 100) 
        : 0;

      companyMetricsMap.set(companyId, { 
        target: totalMonthlyTarget, 
        realized: totalRealized, 
        projectionPercent 
      });
    });

    // Calculate aggregated metrics
    const companiesWithGoals = Array.from(companyMetricsMap.entries()).filter(([_, m]) => m.target > 0);

    // A empresa "tem meta" se existir QUALQUER KPI cadastrado para ela (independente do valor/periodicidade/tipo)
    const companiesWithAnyKpiIds = new Set(
      companyKpis
        .filter(k => filteredCompanyIds.has(k.company_id))
        .map(k => k.company_id)
    );

    const noGoalCount = Array.from(filteredCompanyIds).filter(id => id && !companiesWithAnyKpiIds.has(id)).length;
    
    const meetingGoal = companiesWithGoals.filter(([_, m]) => m.projectionPercent >= 100).length;
    const above70 = companiesWithGoals.filter(([_, m]) => m.projectionPercent >= 70 && m.projectionPercent < 100).length;
    const between50And70 = companiesWithGoals.filter(([_, m]) => m.projectionPercent >= 50 && m.projectionPercent < 70).length;
    const below50 = companiesWithGoals.filter(([_, m]) => m.projectionPercent < 50).length;
    
    // Total with goals = companies that have ANY KPI configured
    const totalWithGoals = Array.from(filteredCompanyIds).filter(id => id && companiesWithAnyKpiIds.has(id)).length;
    const goalRate = totalWithGoals > 0 ? Math.round((meetingGoal / totalWithGoals) * 100) : 0;

    return { totalWithGoals, meetingGoal, above70, between50And70, below50, noGoalCount, goalRate };
  }, [projects, companyKpis, kpiEntries, dateRange, filteredCompanies]);

  const handleCardClick = (filterType: string, filterValue: string) => {
    if (activeMetricFilter?.type === filterType && activeMetricFilter?.value === filterValue) {
      onFilterChange(null);
    } else {
      onFilterChange({ type: filterType, value: filterValue });
    }
  };

  const isCardActive = (type: string, value: string) => activeMetricFilter?.type === type && activeMetricFilter?.value === value;

  const handleNpsCardClick = (type: "promoters" | "detractors" | "neutrals") => {
    const newValue = npsDetailType === type ? "all" : type;
    setNpsDetailType(newValue);
    setNpsDetailPage(1);
  };

  const getFilteredNpsResponses = (type: "promoters" | "detractors" | "neutrals" | "all" | null) => {
    const filteredProjectIds = new Set(projects.map(p => p.id));
    const responses = npsResponses.filter(r => filteredProjectIds.has(r.project_id));
    if (!type || type === "all") return responses;
    switch (type) {
      case "promoters":
        return responses.filter(r => r.score >= 9);
      case "detractors":
        return responses.filter(r => r.score <= 6);
      case "neutrals":
        return responses.filter(r => r.score >= 7 && r.score <= 8);
      default:
        return responses;
    }
  };

  const getCompanyName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const companyId = project ? getProjectCompanyId(project) : null;
    if (!companyId) return "Empresa não encontrada";
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Empresa não encontrada";
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.product_name || "Projeto";
  };

  const taskStatusData = [
    { name: "Concluídas", value: taskMetrics.totalCompleted, color: "#22c55e" },
    { name: "Em Progresso", value: taskMetrics.totalInProgress, color: "#3b82f6" },
    { name: "Pendentes", value: taskMetrics.totalPending, color: "#f59e0b" },
    { name: "Atrasadas", value: taskMetrics.overdueTasks, color: "#ef4444" },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-4">
              <div className="h-8 bg-muted rounded mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
      {/* Summary Row - Always Visible - Mobile Optimized */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
        <Card className={cn("cursor-pointer transition-all hover:shadow-md", isCardActive("status", "active") && "ring-2 ring-primary")} onClick={() => handleCardClick("status", "active")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none">{companyMetrics.activeCompanies}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("cursor-pointer transition-all hover:shadow-md", isCardActive("status", "cancellation_signaled") && "ring-2 ring-amber-500")} onClick={() => handleCardClick("status", "cancellation_signaled")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none text-amber-500">{projectMetrics.churnSignaled}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Risco</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => { setTasksDialogType("today"); setTasksDialogStatus(null); setTasksDialogIds(todayTasks.map(t => t.id)); setTasksDialogOpen(true); }}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <ListTodo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none">{taskMetrics.todayTasks}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-all hover:shadow-md" onClick={() => { setTasksDialogType("overdue"); setTasksDialogStatus(null); setTasksDialogIds(overdueTasks.map(t => t.id)); setTasksDialogOpen(true); }}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className="text-base sm:text-lg font-bold leading-none text-red-500">{taskMetrics.overdueTasks}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Atrasadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden sm:block">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className={cn("h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0", npsMetrics.averageNps === null ? "bg-gray-400/10" : npsMetrics.averageNps >= 9 ? "bg-green-500/10" : npsMetrics.averageNps >= 7 ? "bg-yellow-500/10" : "bg-red-500/10")}>
                <Star className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", npsMetrics.averageNps === null ? "text-gray-400" : npsMetrics.averageNps >= 9 ? "text-green-500" : npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500")} />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className={cn("text-base sm:text-lg font-bold leading-none", npsMetrics.averageNps === null ? "text-muted-foreground" : npsMetrics.averageNps >= 9 ? "text-green-500" : npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500")}>
                  {npsMetrics.averageNps ?? "—"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">NPS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden sm:block">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className={cn("h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0", 
                healthMetrics.averageScore === null ? "bg-gray-400/10" : 
                healthMetrics.averageScore >= 80 ? "bg-green-500/10" : 
                healthMetrics.averageScore >= 60 ? "bg-yellow-500/10" : 
                healthMetrics.averageScore >= 40 ? "bg-orange-500/10" : "bg-red-500/10")}>
                <HeartPulse className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", 
                  healthMetrics.averageScore === null ? "text-gray-400" : 
                  healthMetrics.averageScore >= 80 ? "text-green-500" : 
                  healthMetrics.averageScore >= 60 ? "text-yellow-500" : 
                  healthMetrics.averageScore >= 40 ? "text-orange-500" : "text-red-500")} />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className={cn("text-base sm:text-lg font-bold leading-none", 
                  healthMetrics.averageScore === null ? "text-muted-foreground" : 
                  healthMetrics.averageScore >= 80 ? "text-green-500" : 
                  healthMetrics.averageScore >= 60 ? "text-yellow-500" : 
                  healthMetrics.averageScore >= 40 ? "text-orange-500" : "text-red-500")}>
                  {healthMetrics.averageScore ?? "—"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Saúde</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("hidden sm:block cursor-pointer transition-all hover:shadow-md", isCardActive("goals", "meeting") && "ring-2 ring-teal-500")} onClick={() => handleCardClick("goals", "meeting")}>
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-500" />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <p className={cn("text-base sm:text-lg font-bold leading-none", goalsMetrics.goalRate >= 70 ? "text-teal-500" : goalsMetrics.goalRate >= 40 ? "text-amber-500" : "text-red-500")}>
                  {goalsMetrics.goalRate}%
                </p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Meta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Details - Mobile Optimized */}
      <Tabs defaultValue="empresas" className="w-full" onValueChange={(value) => {
        onActiveTabChange?.(value);
        if (value === "nps") {
          setNpsDetailType("all");
          setNpsDetailPage(1);
        } else {
          setNpsDetailType(null);
        }
      }}>
        <TabsList className="w-full grid grid-cols-5 h-8 sm:h-9">
          <TabsTrigger value="empresas" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-0.5 sm:px-2"><Building2 className="h-3 w-3" /><span className="hidden sm:inline">Empresas</span><span className="sm:hidden">Emp</span></TabsTrigger>
          <TabsTrigger value="agenda" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-0.5 sm:px-2"><Calendar className="h-3 w-3" /><span className="hidden sm:inline">Agenda</span><span className="sm:hidden">Ag</span></TabsTrigger>
          <TabsTrigger value="tarefas" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-0.5 sm:px-2"><ListTodo className="h-3 w-3" /><span className="hidden sm:inline">Tarefas</span><span className="sm:hidden">Tar</span></TabsTrigger>
          <TabsTrigger value="metas" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-0.5 sm:px-2"><Target className="h-3 w-3" />Metas</TabsTrigger>
          <TabsTrigger value="nps" className="text-[10px] sm:text-xs gap-0.5 sm:gap-1 px-0.5 sm:px-2"><Star className="h-3 w-3" />NPS</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-1.5 sm:gap-2">
            <Card className={cn("cursor-pointer transition-all hover:shadow-md", isCardActive("status", "all") && "ring-2 ring-primary")} onClick={() => handleCardClick("status", "all")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold">{filteredCompanies.length}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Total</p></CardContent></Card>
            <Card className={cn("cursor-pointer transition-all hover:shadow-md", isCardActive("company", "no_consultant") && "ring-2 ring-amber-500")} onClick={() => handleCardClick("company", "no_consultant")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-amber-500">{companyMetrics.activeWithoutConsultant}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Sem Consultor</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("status", "notice_period") && "ring-2 ring-orange-500")} onClick={() => handleCardClick("status", "notice_period")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-orange-500">{projectMetrics.noticePeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Aviso</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("status", "closed") && "ring-2 ring-red-600")} onClick={() => handleCardClick("status", "closed")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-600">{churnMetrics.closedCompaniesInPeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Encerradas</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden sm:block", isCardActive("contracts", "ending") && "ring-2 ring-purple-500")} onClick={() => handleCardClick("contracts", "ending")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-purple-500">{companyMetrics.contractsEndingInPeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Vencendo</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden sm:block", isCardActive("contracts", "expired") && "ring-2 ring-rose-500")} onClick={() => handleCardClick("contracts", "expired")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-rose-500">{companyMetrics.expiredContracts}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Vencidos</p></CardContent></Card>
            <Card className="hidden sm:block"><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-emerald-500">{renewalMetrics.renewedPercent}%</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Renovados ({renewalMetrics.renewalsCount})</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("status", "reactivated") && "ring-2 ring-cyan-500")} onClick={() => handleCardClick("status", "reactivated")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-cyan-500">{projectMetrics.reactivatedInPeriod}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Revertidos</p></CardContent></Card>
            <Card className="hidden lg:block"><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-500">{churnMetrics.churnRate}%</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Churn</p></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            <Card>
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5"><Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-indigo-500" />{staffRole === "admin" ? "LTV & Retenção" : "Retenção"}</CardTitle></CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <div className={cn("text-center", staffRole === "admin" ? "grid grid-cols-2 gap-2 sm:gap-4" : "")}>
                  <div><p className="text-xl sm:text-2xl font-bold text-indigo-500">{ltvMetrics.averageLifetimeMonths}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Tempo Médio (meses)</p></div>
                  {staffRole === "admin" && (
                    <div><p className="text-xl sm:text-2xl font-bold text-emerald-500">{ltvMetrics.ltv > 0 ? `R$ ${(ltvMetrics.ltv / 1000).toFixed(1)}k` : "—"}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">LTV Médio</p></div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="hidden sm:block">
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5"><Percent className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />Churn Mensal</CardTitle></CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <div className="h-[60px] sm:h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChurnData}>
                      <XAxis dataKey="month" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={20} tickFormatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="churn" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-2 sm:mt-3">
          <DashboardAgenda
            tasks={allTasks}
            projects={projects}
            companies={companies}
            filteredProjectIds={filteredProjectIds}
            onTaskAdded={() => {
              fetchData();
              onDataRefresh?.();
            }}
            currentStaffUserId={currentStaffUserId}
            selectedConsultantStaffId={selectedConsultantStaffId}
          />
        </TabsContent>

        <TabsContent value="tarefas" className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("today"); setTasksDialogStatus(null); setTasksDialogIds(taskMetrics.todayCompletedIds); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-green-500">{taskMetrics.todayCompleted}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Concl. Hoje</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("status"); setTasksDialogStatus("completed"); setTasksDialogIds([]); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold">{taskMetrics.totalCompleted}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Total Concl.</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("status"); setTasksDialogStatus("pending"); setTasksDialogIds([]); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-amber-500">{taskMetrics.totalPending}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Pendentes</p></CardContent></Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setTasksDialogType("status"); setTasksDialogStatus("in_progress"); setTasksDialogIds([]); setTasksDialogOpen(true); }}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-blue-500">{taskMetrics.totalInProgress}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Em Progresso</p></CardContent></Card>
            <Card 
              className={cn(
                "cursor-pointer hover:shadow-md transition-all", 
                showCompaniesWithoutTasks && "ring-2 ring-emerald-500"
              )} 
              onClick={() => setShowCompaniesWithoutTasks(!showCompaniesWithoutTasks)}
            >
              <CardContent className="p-2 sm:p-3 text-center">
                <p className="text-lg sm:text-xl font-bold text-emerald-500">{companiesWithoutPendingTasks.length}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground">Sem Tarefas</p>
              </CardContent>
            </Card>
          </div>

          {/* List of companies without pending tasks */}
          {showCompaniesWithoutTasks && companiesWithoutPendingTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Empresas sem tarefas pendentes ({companiesWithoutPendingTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {companiesWithoutPendingTasks.map(company => {
                    const companyProjects = projects.filter(p => getProjectCompanyId(p) === company.id && p.status === "active");
                    const firstProject = companyProjects[0];
                    return (
                      <div 
                        key={company.id} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors",
                          firstProject && "cursor-pointer"
                        )}
                        onClick={() => {
                          if (firstProject) {
                            navigate(`/onboarding-tasks/project/${firstProject.id}`);
                          }
                        }}
                      >
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{company.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {companyProjects.map(p => p.product_name).join(", ") || "Sem projetos ativos"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
            <Card>
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5"><CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />Concluídas/Dia</CardTitle></CardHeader>
              <CardContent className="px-2 sm:px-4 pb-2 sm:pb-3">
                <div className="h-[70px] sm:h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={completedByDayData}>
                      <defs><linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 8 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} width={16} />
                      <Area type="monotone" dataKey="concluídas" stroke="#22c55e" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCompleted)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="hidden md:block">
              <CardHeader className="pb-1 sm:pb-2 pt-2 sm:pt-3 px-3 sm:px-4"><CardTitle className="text-[10px] sm:text-xs font-medium">Distribuição</CardTitle></CardHeader>
              <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
                <div className="h-[70px] sm:h-[100px] flex items-center justify-center">
                  {taskStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={20} outerRadius={35} paddingAngle={2} dataKey="value">
                          {taskStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-xs text-muted-foreground">Sem tarefas</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metas" className="mt-2 sm:mt-3">
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <Card className={cn("cursor-pointer", isCardActive("goals", "100plus") && "ring-2 ring-green-500")} onClick={() => handleCardClick("goals", "100plus")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-green-500">{goalsMetrics.meetingGoal}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">≥100%</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("goals", "above70") && "ring-2 ring-blue-500")} onClick={() => handleCardClick("goals", "above70")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-blue-500">{goalsMetrics.above70}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">70-99%</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("goals", "between50and70") && "ring-2 ring-amber-500")} onClick={() => handleCardClick("goals", "between50and70")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-amber-500">{goalsMetrics.between50And70}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">50-69%</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("goals", "below50") && "ring-2 ring-red-500")} onClick={() => handleCardClick("goals", "below50")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-500">{goalsMetrics.below50}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">&lt;50%</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("goals", "noGoal") && "ring-2 ring-gray-500")} onClick={() => handleCardClick("goals", "noGoal")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-gray-500">{goalsMetrics.noGoalCount}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Sem Meta</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("goals", "hasGoal") && "ring-2 ring-primary")} onClick={() => handleCardClick("goals", "hasGoal")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold">{goalsMetrics.totalWithGoals}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Com Meta</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="nps" className="mt-2 sm:mt-3 space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
            <Card><CardContent className="p-2 sm:p-3 text-center"><p className={cn("text-lg sm:text-xl font-bold", npsMetrics.averageNps === null ? "text-muted-foreground" : npsMetrics.averageNps >= 9 ? "text-green-500" : npsMetrics.averageNps >= 7 ? "text-yellow-500" : "text-red-500")}>{npsMetrics.averageNps ?? "—"}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Média</p></CardContent></Card>
            <Card><CardContent className="p-2 sm:p-3 text-center"><p className={cn("text-lg sm:text-xl font-bold", npsMetrics.responseRate >= 70 ? "text-green-500" : npsMetrics.responseRate >= 40 ? "text-yellow-500" : "text-orange-500")}>{npsMetrics.responseRate}%</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Taxa</p></CardContent></Card>
            <Card className={cn("cursor-pointer", isCardActive("nps", "responded") && "ring-2 ring-blue-500")} onClick={() => handleCardClick("nps", "responded")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-blue-500">{npsMetrics.respondedCount}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Respond.</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block", isCardActive("nps", "not_responded") && "ring-2 ring-gray-500")} onClick={() => handleCardClick("nps", "not_responded")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-gray-500">{npsMetrics.notRespondedCount}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Não Resp.</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block hover:shadow-md transition-all", npsDetailType === "promoters" && "ring-2 ring-green-500")} onClick={() => handleNpsCardClick("promoters")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-green-500">{npsMetrics.promoters}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Promotores</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block hover:shadow-md transition-all", npsDetailType === "neutrals" && "ring-2 ring-yellow-500")} onClick={() => handleNpsCardClick("neutrals")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-yellow-500">{npsMetrics.neutrals}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Neutros</p></CardContent></Card>
            <Card className={cn("cursor-pointer hidden lg:block hover:shadow-md transition-all", npsDetailType === "detractors" && "ring-2 ring-red-500")} onClick={() => handleNpsCardClick("detractors")}><CardContent className="p-2 sm:p-3 text-center"><p className="text-lg sm:text-xl font-bold text-red-500">{npsMetrics.detractors}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground">Detratores</p></CardContent></Card>
          </div>
          
          {npsDetailType && (() => {
            const allResponses = getFilteredNpsResponses(npsDetailType);
            const totalPages = Math.ceil(allResponses.length / npsPerPage);
            const paginatedResponses = allResponses.slice((npsDetailPage - 1) * npsPerPage, npsDetailPage * npsPerPage);
            
            const getTitle = () => {
              switch (npsDetailType) {
                case "promoters": return "Promotores (9-10)";
                case "detractors": return "Detratores (0-6)";
                case "neutrals": return "Neutros (7-8)";
                default: return "Todas as Respostas";
              }
            };
            
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Star className={cn("h-4 w-4", npsDetailType === "promoters" ? "text-green-500" : npsDetailType === "detractors" ? "text-red-500" : npsDetailType === "neutrals" ? "text-yellow-500" : "text-primary")} />
                    {getTitle()}
                    <span className="text-muted-foreground">({allResponses.length})</span>
                  </h4>
                  {npsDetailType !== "all" && (
                    <button onClick={() => { setNpsDetailType("all"); setNpsDetailPage(1); }} className="text-xs text-muted-foreground hover:text-foreground">Limpar filtro</button>
                  )}
                </div>
                <div className="grid gap-2">
                  {paginatedResponses.map((response) => (
                    <Card key={response.id} className="border-l-4" style={{ borderLeftColor: response.score >= 9 ? "#22c55e" : response.score <= 6 ? "#ef4444" : "#eab308" }}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{getCompanyName(response.project_id)}</span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{getProjectName(response.project_id)}</span>
                            </div>
                            {response.respondent_name && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{response.respondent_name}</p>
                            )}
                            {(response.feedback || response.would_recommend_why || response.what_can_improve) && (
                              <div className="mt-2 space-y-1 text-xs text-foreground/80">
                                {response.would_recommend_why && <p>"{response.would_recommend_why}"</p>}
                                {response.feedback && <p className="text-muted-foreground">{response.feedback}</p>}
                                {response.what_can_improve && <p className="text-muted-foreground italic">Melhoria: {response.what_can_improve}</p>}
                              </div>
                            )}
                          </div>
                          <div className={cn("shrink-0 text-white font-bold text-sm rounded-full w-8 h-8 flex items-center justify-center", response.score >= 9 ? "bg-green-500" : response.score <= 6 ? "bg-red-500" : "bg-yellow-500")}>
                            {response.score}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button 
                      onClick={() => setNpsDetailPage(p => Math.max(1, p - 1))} 
                      disabled={npsDetailPage === 1}
                      className="px-3 py-1 text-xs rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Página {npsDetailPage} de {totalPages}
                    </span>
                    <button 
                      onClick={() => setNpsDetailPage(p => Math.min(totalPages, p + 1))} 
                      disabled={npsDetailPage === totalPages}
                      className="px-3 py-1 text-xs rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      <TasksListDialog
        open={tasksDialogOpen}
        onOpenChange={setTasksDialogOpen}
        type={tasksDialogType}
        taskIds={tasksDialogIds}
        status={tasksDialogStatus ?? undefined}
        projectIds={projects.map((p) => p.id)}
      />
    </div>
  );
};

export default DashboardMetrics;
