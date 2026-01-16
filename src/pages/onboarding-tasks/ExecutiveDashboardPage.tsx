import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  TrendingDown, 
  DollarSign, 
  ThumbsUp, 
  RefreshCw,
  ArrowLeft,
  Calendar,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { ExecutiveKPICard } from "@/components/executive-dashboard/ExecutiveKPICard";
import { PortfolioHealthGauge } from "@/components/executive-dashboard/PortfolioHealthGauge";
import { RiskDistributionChart } from "@/components/executive-dashboard/RiskDistributionChart";
import { CriticalAlertsPanel } from "@/components/executive-dashboard/CriticalAlertsPanel";
import { ExecutiveAIInsights } from "@/components/executive-dashboard/ExecutiveAIInsights";
import { HealthTrendChart } from "@/components/executive-dashboard/HealthTrendChart";
import { ConsultantPerformanceRanking } from "@/components/executive-dashboard/ConsultantPerformanceRanking";
import { DailyLeadershipAgenda } from "@/components/executive-dashboard/DailyLeadershipAgenda";
import { ConsultantOneOnOnePanel } from "@/components/executive-dashboard/ConsultantOneOnOnePanel";
import { CohortMatrix } from "@/components/retention/CohortMatrix";
import { RetentionBySegmentChart } from "@/components/retention/RetentionBySegmentChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PortfolioMetrics {
  totalProjects: number;
  avgHealthScore: number;
  criticalCount: number;
  highRiskCount: number;
  attentionCount: number;
  healthyCount: number;
  churnRate: number;
  avgNPS: number;
  renewalRate: number;
  avgLTV: number;
}

interface CriticalProject {
  id: string;
  companyName: string;
  score: number;
  riskLevel: string;
  mainRiskFactor?: string;
  churnProbability?: number;
}

interface ConsultantPerformance {
  id: string;
  name: string;
  avatar?: string;
  avgHealthScore: number;
  retentionRate: number;
  taskCompletionRate: number;
  projectCount: number;
}

export default function ExecutiveDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("30");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    totalProjects: 0,
    avgHealthScore: 0,
    criticalCount: 0,
    highRiskCount: 0,
    attentionCount: 0,
    healthyCount: 0,
    churnRate: 0,
    avgNPS: 0,
    renewalRate: 0,
    avgLTV: 0,
  });
  
  const [criticalProjects, setCriticalProjects] = useState<CriticalProject[]>([]);
  const [consultantPerformance, setConsultantPerformance] = useState<ConsultantPerformance[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; score: number }[]>([]);

  // Load user email on mount (used to gate the "Reunião Liderança" tab)
  useEffect(() => {
    const loadEmail = async () => {
      try {
        // Prefer authenticated user (cannot be tampered with like localStorage)
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const authUser = authData.user;

        // Prefer staff table email (source of truth for the onboarding app)
        if (authUser?.id) {
          const { data: staffRow, error: staffErr } = await supabase
            .from("onboarding_staff")
            .select("email")
            .eq("user_id", authUser.id)
            .maybeSingle();

          if (!staffErr && staffRow?.email) {
            setUserEmail(staffRow.email);
            return;
          }
        }

        // Fallback to auth email
        if (authUser?.email) {
          setUserEmail(authUser.email);
          return;
        }

        // Last-resort fallback for legacy flows
        try {
          const staffData = localStorage.getItem("onboarding_staff");
          if (staffData) {
            const staff = JSON.parse(staffData);
            setUserEmail(staff?.email ?? null);
            return;
          }
        } catch {
          // ignore
        }

        setUserEmail(null);
      } catch (e) {
        console.log("[ExecutiveDashboard] failed to resolve user email", e);
        setUserEmail(null);
      }
    };

    loadEmail();
  }, []);

  const fetchData = async () => {
    try {

      // Fetch active projects with health scores
      const { data: projects, error: projectsError } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          onboarding_company_id,
          company_id,
          onboarding_companies (name),
          consultant:onboarding_staff!onboarding_projects_consultant_id_fkey (id, name, avatar_url),
          client_health_scores (total_score, risk_level)
        `)
        .eq("status", "active");

      if (projectsError) throw projectsError;

      // Calculate metrics
      const projectsWithScores = projects?.filter(p => p.client_health_scores) || [];
      const totalProjects = projects?.length || 0;
      
      let criticalCount = 0;
      let highRiskCount = 0;
      let attentionCount = 0;
      let healthyCount = 0;
      let totalScore = 0;
      
      const criticalList: CriticalProject[] = [];
      
      projectsWithScores.forEach(p => {
        const score = p.client_health_scores?.total_score || 0;
        const riskLevel = p.client_health_scores?.risk_level || "unknown";
        totalScore += score;
        
        if (score < 40 || riskLevel === "critical") {
          criticalCount++;
          criticalList.push({
            id: p.id,
            companyName: p.onboarding_companies?.name || "Empresa",
            score,
            riskLevel,
          });
        } else if (score < 60 || riskLevel === "high") {
          highRiskCount++;
          criticalList.push({
            id: p.id,
            companyName: p.onboarding_companies?.name || "Empresa",
            score,
            riskLevel,
          });
        } else if (score < 80 || riskLevel === "medium") {
          attentionCount++;
        } else {
          healthyCount++;
        }
      });

      const avgHealthScore = projectsWithScores.length > 0 
        ? totalScore / projectsWithScores.length 
        : 0;

      // Fetch NPS data - filter by active project IDs (same as DashboardMetrics)
      const activeProjectIds = projects?.map(p => p.id) || [];
      
      const { data: npsData } = await supabase
        .from("onboarding_nps_responses")
        .select("score, project_id");

      // Filter NPS responses to only include active projects (same as DashboardMetrics)
      const filteredNpsResponses = (npsData || []).filter(r => activeProjectIds.includes(r.project_id));
      
      const avgNPS = filteredNpsResponses.length > 0
        ? Math.round((filteredNpsResponses.reduce((sum, r) => sum + r.score, 0) / filteredNpsResponses.length) * 10) / 10
        : 0;

      // Fetch churn data using same logic as DashboardMetrics
      // Use the same period logic as the main dashboard (current month by default, or last X days)
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;
      
      if (period === "30") {
        // Default: use current calendar month (same as main dashboard)
        periodStart = startOfMonth(now);
        periodEnd = endOfMonth(now);
      } else {
        // For other periods (60, 90 days), use rolling days
        periodStart = subMonths(now, parseInt(period) / 30);
        periodEnd = now;
      }
      
      const { data: allProjectsData } = await supabase
        .from("onboarding_projects")
        .select("id, status, churn_date, updated_at")
        .in("status", ["closed", "completed", "cancellation_signaled", "notice_period"]);

      // Calculate closed in period using churn_date (fallback to updated_at)
      const closedInPeriod = (allProjectsData || []).filter(p => {
        if (p.status !== "closed" && p.status !== "completed") return false;
        const churnDateStr = p.churn_date || p.updated_at;
        const churnDate = new Date(churnDateStr.substring(0, 10) + "T12:00:00");
        return churnDate >= periodStart && churnDate <= periodEnd;
      }).length;

      // Count signaled in period
      const signaledInPeriod = (allProjectsData || []).filter(p => {
        if (p.status !== "cancellation_signaled" && p.status !== "notice_period") return false;
        const updateDate = new Date(p.updated_at);
        return updateDate >= periodStart && updateDate <= periodEnd;
      }).length;

      // Use same formula as DashboardMetrics: churnRate = closedInPeriod / (activeProjects + closedInPeriod + signaledInPeriod) * 100
      const totalActiveStart = totalProjects + closedInPeriod + signaledInPeriod;
      const churnRate = totalActiveStart > 0 
        ? Math.round((closedInPeriod / totalActiveStart) * 100)
        : 0;

      // Fetch renewal data - match DashboardMetrics logic (unique companies renewed / active companies)
      const companyIdsForActiveProjects = Array.from(
        new Set(
          (projects as any[])
            .map(p => p.onboarding_company_id || p.company_id)
            .filter(Boolean)
        )
      ) as string[];

      // Denominator: active companies in the portfolio (linked to active projects)
      const { data: companiesForRenewalDenominator } = await supabase
        .from("onboarding_companies")
        .select("id, status")
        .in("id", companyIdsForActiveProjects);

      const activeCompaniesCount = (companiesForRenewalDenominator || []).filter(c =>
        c.status !== "inactive" && c.status !== "closed"
      ).length;

      // Fetch renewals (no status filter), then filter by company + period
      const { data: renewals } = await supabase
        .from("onboarding_contract_renewals")
        .select("company_id, renewal_date");

      const companyIdSet = new Set(companyIdsForActiveProjects);

      const renewalsInPeriod = (renewals || []).filter(r => {
        if (!r.renewal_date) return false;
        if (!companyIdSet.has(r.company_id)) return false;
        const d = new Date(r.renewal_date.substring(0, 10) + "T12:00:00");
        return d >= periodStart && d <= periodEnd;
      });

      const renewedCompanyIds = new Set(renewalsInPeriod.map(r => r.company_id));
      const renewedClientsCount = renewedCompanyIds.size;

      const renewalRate = activeCompaniesCount > 0
        ? Math.round((renewedClientsCount / activeCompaniesCount) * 100)
        : 0;

      // Calculate LTV using same logic as DashboardMetrics
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, contract_start_date, contract_value, status, status_changed_at")
        .not("contract_start_date", "is", null);

      let avgLTV = 0;
      if (companiesData && companiesData.length > 0) {
        const today = new Date();
        const lifetimes: number[] = [];
        let totalContractValue = 0;
        let companiesWithValue = 0;

        companiesData.forEach(c => {
          if (!c.contract_start_date) return;
          
          const start = new Date(c.contract_start_date.substring(0, 10) + "T12:00:00");
          const end = (c.status === "closed" || c.status === "inactive") && c.status_changed_at
            ? new Date(c.status_changed_at.substring(0, 10) + "T12:00:00")
            : today;
          
          const lifetimeMonths = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
          if (lifetimeMonths >= 0 && lifetimeMonths <= 180) {
            lifetimes.push(lifetimeMonths);
          }

          if (c.contract_value && c.contract_value > 0) {
            totalContractValue += c.contract_value;
            companiesWithValue++;
          }
        });

        const averageLifetimeMonths = lifetimes.length > 0
          ? lifetimes.reduce((sum, m) => sum + m, 0) / lifetimes.length
          : 0;
        
        const averageMonthlyTicket = companiesWithValue > 0
          ? totalContractValue / companiesWithValue
          : 0;

        avgLTV = Math.round(averageMonthlyTicket * averageLifetimeMonths);
      }

      // Calculate consultant performance
      const consultantMap = new Map<string, ConsultantPerformance>();
      projects?.forEach(p => {
        if (p.consultant) {
          const consultantId = p.consultant.id;
          const existing = consultantMap.get(consultantId);
          const score = p.client_health_scores?.total_score || 0;
          
          if (existing) {
            existing.projectCount++;
            existing.avgHealthScore = (existing.avgHealthScore * (existing.projectCount - 1) + score) / existing.projectCount;
          } else {
            consultantMap.set(consultantId, {
              id: consultantId,
              name: p.consultant.name,
              avatar: p.consultant.avatar_url,
              avgHealthScore: score,
              retentionRate: 0.85, // Placeholder - calculate from actual data
              taskCompletionRate: 0.75, // Placeholder
              projectCount: 1,
            });
          }
        }
      });

      // Sort critical projects by score
      criticalList.sort((a, b) => a.score - b.score);

      setMetrics({
        totalProjects,
        avgHealthScore,
        criticalCount,
        highRiskCount,
        attentionCount,
        healthyCount,
        churnRate,
        avgNPS,
        renewalRate,
        avgLTV,
      });

      setCriticalProjects(criticalList);
      setConsultantPerformance(Array.from(consultantMap.values()));

      // Generate trend data (placeholder - would come from health_score_snapshots)
      const trend = Array.from({ length: 30 }, (_, i) => ({
        date: format(subMonths(new Date(), 1 - i / 30), "dd/MM"),
        score: avgHealthScore + (Math.random() - 0.5) * 10,
      }));
      setTrendData(trend);

    } catch (error) {
      console.error("Error fetching executive dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Listen for tab switch event from DailyLeadershipAgenda
  useEffect(() => {
    const handleSwitchToOneOnOne = () => {
      setActiveTab("oneOnOne");
    };
    window.addEventListener('switchToOneOnOneTab', handleSwitchToOneOnOne);
    return () => window.removeEventListener('switchToOneOnOneTab', handleSwitchToOneOnOne);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const isLeadershipUser = (userEmail ?? "").trim().toLowerCase() === "fabricio@universidadevendas.com.br";

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Dashboard Executivo</h1>
            <p className="text-muted-foreground">
              Visão consolidada da saúde do portfólio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLeadershipUser && (
            <Button 
              variant="outline"
              onClick={() => navigate("/onboarding-tasks/ceo")}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              CEO Dashboard
            </Button>
          )}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-md mb-6 ${isLeadershipUser ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          {isLeadershipUser && (
            <TabsTrigger value="leadership">Reunião Liderança</TabsTrigger>
          )}
          <TabsTrigger value="oneOnOne">1:1 Consultor</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Hero KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <ExecutiveKPICard
              title="Saúde Média"
              value={metrics.avgHealthScore.toFixed(0)}
              subtitle={`${metrics.totalProjects} projetos ativos`}
              icon={Activity}
              colorClass={metrics.avgHealthScore >= 70 ? "text-green-600" : metrics.avgHealthScore >= 50 ? "text-yellow-600" : "text-red-600"}
            />
            <ExecutiveKPICard
              title="Taxa de Churn"
              value={`${metrics.churnRate.toFixed(0)}%`}
              subtitle="No período selecionado"
              icon={TrendingDown}
              colorClass={metrics.churnRate <= 5 ? "text-green-600" : metrics.churnRate <= 10 ? "text-yellow-600" : "text-red-600"}
            />
            <ExecutiveKPICard
              title="LTV Médio"
              value={`R$ ${metrics.avgLTV.toLocaleString("pt-BR")}`}
              subtitle="Valor médio de contrato"
              icon={DollarSign}
              colorClass="text-blue-600"
            />
            <ExecutiveKPICard
              title="NPS Médio"
              value={metrics.avgNPS.toFixed(0)}
              subtitle="Base ativa"
              icon={ThumbsUp}
              colorClass={metrics.avgNPS >= 50 ? "text-green-600" : metrics.avgNPS >= 0 ? "text-yellow-600" : "text-red-600"}
            />
            <ExecutiveKPICard
              title="Taxa de Renovação"
              value={`${metrics.renewalRate.toFixed(0)}%`}
              subtitle="No período selecionado"
              icon={RefreshCw}
              colorClass={metrics.renewalRate >= 80 ? "text-green-600" : metrics.renewalRate >= 60 ? "text-yellow-600" : "text-red-600"}
            />
          </div>

          {/* Main Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PortfolioHealthGauge
              score={metrics.avgHealthScore}
              totalProjects={metrics.totalProjects}
            />
            <RiskDistributionChart
              distribution={{
                healthy: metrics.healthyCount,
                attention: metrics.attentionCount,
                highRisk: metrics.highRiskCount,
                critical: metrics.criticalCount,
              }}
              onSegmentClick={(level) => navigate(`/onboarding-tasks?risk=${level}`)}
            />
            <HealthTrendChart data={trendData} currentAvg={metrics.avgHealthScore} />
          </div>

          {/* Alerts and AI Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CriticalAlertsPanel projects={criticalProjects} maxItems={5} />
            <ExecutiveAIInsights
              portfolioData={{
                totalProjects: metrics.totalProjects,
                avgHealthScore: metrics.avgHealthScore,
                criticalCount: metrics.criticalCount,
                highRiskCount: metrics.highRiskCount,
                churnRate: metrics.churnRate,
                avgNPS: metrics.avgNPS,
                renewalRate: metrics.renewalRate,
              }}
            />
          </div>

          {/* Performance and Retention Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConsultantPerformanceRanking consultants={consultantPerformance} maxItems={5} />
            <RetentionBySegmentChart />
          </div>

          {/* Cohort Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Matriz de Cohort - Retenção por Mês de Início</CardTitle>
            </CardHeader>
            <CardContent>
              <CohortMatrix monthsToShow={6} />
            </CardContent>
          </Card>
        </TabsContent>

        {isLeadershipUser && (
          <TabsContent value="leadership">
            <DailyLeadershipAgenda />
          </TabsContent>
        )}

        <TabsContent value="oneOnOne">
          <ConsultantOneOnOnePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
