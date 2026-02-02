import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw, 
  TrendingDown, 
  Users, 
  AlertTriangle,
  Heart
} from "lucide-react";
import { toast } from "sonner";
import { subDays } from "date-fns";

// Import retention components
import { CohortMatrix } from "@/components/retention/CohortMatrix";
import { RetentionBySegmentChart } from "@/components/retention/RetentionBySegmentChart";
import { ChurnPredictionWidget } from "@/components/retention/ChurnPredictionWidget";

export default function ExecutiveDashboardContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState("30");
  
  const [metrics, setMetrics] = useState({
    totalProjects: 0,
    activeProjects: 0,
    avgHealthScore: 0,
    churnRate: 0,
    criticalProjects: 0
  });

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch projects count
      const { data: projectsData } = await supabase
        .from("onboarding_projects")
        .select("id, status")
        .eq("status", "active");

      const activeProjects = projectsData?.length || 0;

      // Fetch health scores
      const { data: healthData } = await supabase
        .from("client_health_scores")
        .select("total_score, risk_level");

      const avgHealthScore = healthData && healthData.length > 0
        ? Math.round(healthData.reduce((sum, h) => sum + (h.total_score || 0), 0) / healthData.length)
        : 0;

      const criticalCount = healthData?.filter(h => h.risk_level === "critical" || h.risk_level === "high").length || 0;

      setMetrics({
        totalProjects: activeProjects,
        activeProjects,
        avgHealthScore,
        churnRate: 0,
        criticalProjects: criticalCount
      });

    } catch (error) {
      console.error("Error fetching executive data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Health Score Médio</p>
                <p className="text-3xl font-bold text-blue-600">{metrics.avgHealthScore}/100</p>
              </div>
              <Heart className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                <p className="text-3xl font-bold text-green-600">{metrics.activeProjects}</p>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos em Risco</p>
                <p className="text-3xl font-bold text-orange-600">{metrics.criticalProjects}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Churn Widget and Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChurnPredictionWidget limit={5} />
        <RetentionBySegmentChart />
      </div>

      {/* Cohort Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Matriz de Cohort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CohortMatrix monthsToShow={6} />
        </CardContent>
      </Card>
    </div>
  );
}
