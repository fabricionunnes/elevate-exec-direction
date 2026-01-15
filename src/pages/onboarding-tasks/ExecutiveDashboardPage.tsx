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

  const fetchData = async () => {
    try {
      // Fetch active projects with health scores
      const { data: projects, error: projectsError } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
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

      // Fetch NPS data
      const { data: npsData } = await supabase
        .from("onboarding_nps_responses")
        .select("score")
        .gte("responded_at", format(subMonths(new Date(), 3), "yyyy-MM-dd"));

      const avgNPS = npsData && npsData.length > 0
        ? npsData.reduce((sum, r) => sum + r.score, 0) / npsData.length
        : 0;

      // Fetch churn data using same logic as DashboardMetrics
      // Get all projects to calculate churn properly
      const periodStart = subMonths(new Date(), parseInt(period) / 30);
      const periodEnd = new Date();
      
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

      // Use same formula as DashboardMetrics: churnRate = closedInPeriod / (activeProjects + closedInPeriod + signaledInPeriod)
      const totalActiveStart = totalProjects + closedInPeriod + signaledInPeriod;
      const churnRate = totalActiveStart > 0 
        ? closedInPeriod / totalActiveStart
        : 0;

      // Fetch renewal data
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const { data: renewals } = await supabase
        .from("onboarding_contract_renewals")
        .select("id")
        .eq("status", "confirmed")
        .gte("renewal_date", periodStartStr);

      const renewalRate = totalProjects > 0
        ? (renewals?.length || 0) / totalProjects
        : 0;

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
        avgLTV: 12000, // Placeholder - calculate from actual contract values
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
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="leadership">Reunião Liderança</TabsTrigger>
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
              value={`${(metrics.churnRate * 100).toFixed(1)}%`}
              subtitle="No período selecionado"
              icon={TrendingDown}
              colorClass={metrics.churnRate <= 0.05 ? "text-green-600" : metrics.churnRate <= 0.1 ? "text-yellow-600" : "text-red-600"}
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
              subtitle="Últimos 3 meses"
              icon={ThumbsUp}
              colorClass={metrics.avgNPS >= 50 ? "text-green-600" : metrics.avgNPS >= 0 ? "text-yellow-600" : "text-red-600"}
            />
            <ExecutiveKPICard
              title="Taxa de Renovação"
              value={`${(metrics.renewalRate * 100).toFixed(0)}%`}
              subtitle="Renovações confirmadas"
              icon={RefreshCw}
              colorClass={metrics.renewalRate >= 0.8 ? "text-green-600" : metrics.renewalRate >= 0.6 ? "text-yellow-600" : "text-red-600"}
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

        <TabsContent value="leadership">
          <DailyLeadershipAgenda />
        </TabsContent>

        <TabsContent value="oneOnOne">
          <ConsultantOneOnOnePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
