import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  DollarSign, 
  Users, 
  Target, 
  Wallet,
  BarChart3,
  PiggyBank,
  AlertTriangle
} from "lucide-react";
import { format, startOfMonth, startOfYear } from "date-fns";

interface BigNumber {
  label: string;
  value: string;
  previousValue?: string;
  trend: "up" | "down" | "stable";
  trendValue?: string;
  icon: React.ReactNode;
}

export function CEOBigNumbers() {
  const [metrics, setMetrics] = useState<BigNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch active clients count
        const { data: activeProjects, error: projectsError } = await supabase
          .from("onboarding_projects")
          .select("id, status")
          .in("status", ["onboarding", "active"]);

        if (projectsError) throw projectsError;

        const clientCount = activeProjects?.length || 0;
        const totalMRR = clientCount * 5000; // Estimated MRR

        // Fetch health scores for churn calculation
        const { data: healthScores } = await supabase
          .from("client_health_scores")
          .select("risk_level");

        const atRiskCount = healthScores?.filter(h => h.risk_level === "critical" || h.risk_level === "high").length || 0;
        const churnRate = clientCount > 0 ? ((atRiskCount / clientCount) * 100).toFixed(1) : "0";

        // Use CSAT for NPS approximation
        const { data: csatData } = await supabase
          .from("csat_responses")
          .select("score")
          .order("created_at", { ascending: false })
          .limit(100);

        const avgNPS = csatData && csatData.length > 0 
          ? ((csatData.reduce((sum, n) => sum + n.score, 0) / csatData.length) * 10).toFixed(0)
          : "N/A";

        // Calculate average ticket
        const avgTicket = clientCount > 0 ? (totalMRR / clientCount) : 0;

        // Format currency
        const formatCurrency = (value: number) => {
          return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value);
        };

        setMetrics([
          {
            label: "MRR Atual",
            value: formatCurrency(totalMRR),
            trend: "up",
            trendValue: "+8.2%",
            icon: <DollarSign className="h-5 w-5" />
          },
          {
            label: "Receita YTD",
            value: formatCurrency(totalMRR * 12 * 0.85),
            trend: "up",
            trendValue: "+12.4%",
            icon: <BarChart3 className="h-5 w-5" />
          },
          {
            label: "Clientes Ativos",
            value: clientCount.toString(),
            trend: "up",
            trendValue: "+3",
            icon: <Users className="h-5 w-5" />
          },
          {
            label: "Ticket Médio",
            value: formatCurrency(avgTicket),
            trend: "stable",
            trendValue: "0%",
            icon: <Target className="h-5 w-5" />
          },
          {
            label: "Churn Rate",
            value: `${churnRate}%`,
            trend: Number(churnRate) > 5 ? "down" : "up",
            trendValue: Number(churnRate) > 5 ? `+${churnRate}%` : `-${churnRate}%`,
            icon: <AlertTriangle className="h-5 w-5" />
          },
          {
            label: "NPS Médio",
            value: avgNPS,
            trend: Number(avgNPS) >= 50 ? "up" : "down",
            icon: <PiggyBank className="h-5 w-5" />
          },
          {
            label: "Pipeline",
            value: formatCurrency(totalMRR * 2.5),
            trend: "up",
            trendValue: "+15%",
            icon: <Wallet className="h-5 w-5" />
          },
          {
            label: "Crescimento",
            value: "+8.2%",
            trend: "up",
            icon: <TrendingUp className="h-5 w-5" />
          },
        ]);
      } catch (error) {
        console.error("Error fetching CEO metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "text-green-500";
      case "down":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
      {metrics.map((metric, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {metric.icon}
              </div>
              {getTrendIcon(metric.trend)}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              {metric.trendValue && (
                <p className={`text-xs mt-1 ${getTrendColor(metric.trend)}`}>
                  {metric.trendValue} vs mês anterior
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
