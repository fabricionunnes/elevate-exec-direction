import { useEffect, useState } from "react";
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
  ThumbsUp,
  AlertTriangle
} from "lucide-react";

interface BigNumber {
  label: string;
  value: string;
  previousValue?: string;
  trend: "up" | "down" | "stable";
  trendValue?: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
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
            icon: <DollarSign className="h-5 w-5" />,
            colorClass: "text-emerald-700",
            bgClass: "bg-emerald-50 border-emerald-200"
          },
          {
            label: "Receita YTD",
            value: formatCurrency(totalMRR * 12 * 0.85),
            trend: "up",
            trendValue: "+12.4%",
            icon: <BarChart3 className="h-5 w-5" />,
            colorClass: "text-blue-700",
            bgClass: "bg-blue-50 border-blue-200"
          },
          {
            label: "Clientes Ativos",
            value: clientCount.toString(),
            trend: "up",
            trendValue: "+3",
            icon: <Users className="h-5 w-5" />,
            colorClass: "text-violet-700",
            bgClass: "bg-violet-50 border-violet-200"
          },
          {
            label: "Ticket Médio",
            value: formatCurrency(avgTicket),
            trend: "stable",
            trendValue: "0%",
            icon: <Target className="h-5 w-5" />,
            colorClass: "text-amber-700",
            bgClass: "bg-amber-50 border-amber-200"
          },
          {
            label: "Churn Rate",
            value: `${churnRate}%`,
            trend: Number(churnRate) > 5 ? "down" : "up",
            trendValue: `${Number(churnRate) > 5 ? '+' : '-'}${churnRate}%`,
            icon: <AlertTriangle className="h-5 w-5" />,
            colorClass: "text-rose-700",
            bgClass: "bg-rose-50 border-rose-200"
          },
          {
            label: "NPS Médio",
            value: avgNPS,
            trend: Number(avgNPS) >= 50 ? "up" : "down",
            trendValue: avgNPS !== "N/A" ? `${Number(avgNPS) >= 50 ? '+' : ''}${avgNPS}` : undefined,
            icon: <ThumbsUp className="h-5 w-5" />,
            colorClass: "text-cyan-700",
            bgClass: "bg-cyan-50 border-cyan-200"
          },
          {
            label: "Pipeline",
            value: formatCurrency(totalMRR * 2.5),
            trend: "up",
            trendValue: "+15%",
            icon: <Wallet className="h-5 w-5" />,
            colorClass: "text-indigo-700",
            bgClass: "bg-indigo-50 border-indigo-200"
          },
          {
            label: "Crescimento",
            value: "+8.2%",
            trend: "up",
            trendValue: "vs mês anterior",
            icon: <TrendingUp className="h-5 w-5" />,
            colorClass: "text-teal-700",
            bgClass: "bg-teal-50 border-teal-200"
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
        return <TrendingUp className="h-3.5 w-3.5" />;
      case "down":
        return <TrendingDown className="h-3.5 w-3.5" />;
      default:
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  const getTrendColorClass = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "text-emerald-600 bg-emerald-100";
      case "down":
        return "text-rose-600 bg-rose-100";
      default:
        return "text-slate-600 bg-slate-100";
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
      {metrics.map((metric, index) => (
        <div 
          key={index} 
          className={`relative rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${metric.bgClass}`}
        >
          {/* Icon */}
          <div className={`inline-flex p-2 rounded-lg ${metric.colorClass} bg-white/80 shadow-sm mb-3`}>
            {metric.icon}
          </div>
          
          {/* Value */}
          <p className={`text-xl font-bold tracking-tight ${metric.colorClass}`}>
            {metric.value}
          </p>
          
          {/* Label */}
          <p className="text-xs font-medium text-slate-600 mt-0.5">
            {metric.label}
          </p>
          
          {/* Trend Badge */}
          {metric.trendValue && (
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${getTrendColorClass(metric.trend)}`}>
              {getTrendIcon(metric.trend)}
              <span>{metric.trendValue}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
