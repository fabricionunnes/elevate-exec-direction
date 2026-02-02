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

// Helper to calculate MRR from companies
const calculateMRRFromCompanies = (companies: any[]): number => {
  let mrr = 0;
  
  companies?.forEach((c) => {
    const value = Number(c.contract_value) || 0;
    const paymentMethod = c.payment_method?.toLowerCase() || "";
    
    // Monthly payments = value is already monthly
    if (paymentMethod === "monthly" || paymentMethod === "mensal" || paymentMethod === "recorrente") {
      mrr += value;
    }
    // Quarterly = value / 3
    else if (paymentMethod === "quarterly" || paymentMethod === "trimestral") {
      mrr += value / 3;
    }
    // Semiannual = value / 6
    else if (paymentMethod === "semiannual" || paymentMethod === "semestral") {
      mrr += value / 6;
    }
    // Annual or card (typically annual payments) = value / 12
    else if (paymentMethod === "annual" || paymentMethod === "anual" || paymentMethod === "card" || paymentMethod === "cartao" || paymentMethod === "cartão") {
      mrr += value / 12;
    }
    // Boleto or pix could be annual too
    else if (paymentMethod === "boleto" || paymentMethod === "pix") {
      mrr += value / 12;
    }
    // Skip one-time payments (à vista, único)
    else if (paymentMethod.includes("vista") || paymentMethod.includes("unico") || paymentMethod.includes("único")) {
      // Don't add to MRR - one-time payment
    }
    // Unknown payment method with value > 1000 assume annual
    else if (value > 1000) {
      mrr += value / 12;
    }
    // Small values without payment method, assume monthly
    else if (value > 0) {
      mrr += value;
    }
  });
  
  return mrr;
};

export function CEOBigNumbers() {
  const [metrics, setMetrics] = useState<BigNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch active companies with contract values (main MRR source)
        const { data: companies, error: companiesError } = await supabase
          .from("onboarding_companies")
          .select("id, contract_value, payment_method, status")
          .eq("status", "active");

        if (companiesError) throw companiesError;

        const clientCount = companies?.length || 0;
        const totalMRR = calculateMRRFromCompanies(companies || []);

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

        // Calculate LTV (12 months of MRR per client)
        const avgLTV = clientCount > 0 ? (totalMRR / clientCount) * 12 : 0;

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
            label: "Ticket Médio Mensal",
            value: formatCurrency(avgTicket),
            trend: "stable",
            trendValue: "0%",
            icon: <Target className="h-5 w-5" />,
            colorClass: "text-amber-700",
            bgClass: "bg-amber-50 border-amber-200"
          },
          {
            label: "LTV Médio",
            value: formatCurrency(avgLTV),
            trend: "up",
            trendValue: "+5.2%",
            icon: <Wallet className="h-5 w-5" />,
            colorClass: "text-purple-700",
            bgClass: "bg-purple-50 border-purple-200"
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
        return <TrendingUp className="h-3 w-3" />;
      case "down":
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColorClass = (trend: "up" | "down" | "stable", label: string) => {
    // For churn rate, invert the colors (down is good)
    if (label === "Churn Rate") {
      switch (trend) {
        case "up":
          return "text-rose-600 bg-rose-50";
        case "down":
          return "text-emerald-600 bg-emerald-50";
        default:
          return "text-slate-500 bg-slate-50";
      }
    }
    
    switch (trend) {
      case "up":
        return "text-emerald-600 bg-emerald-50";
      case "down":
        return "text-rose-600 bg-rose-50";
      default:
        return "text-slate-500 bg-slate-50";
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className={`p-4 rounded-xl border-2 ${metric.bgClass} transition-all duration-200 hover:shadow-lg hover:scale-[1.02]`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className={`p-2 rounded-lg bg-white shadow-sm ${metric.colorClass}`}>
              {metric.icon}
            </div>
            {metric.trendValue && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${getTrendColorClass(metric.trend, metric.label)}`}>
                {getTrendIcon(metric.trend)}
                {metric.trendValue}
              </span>
            )}
          </div>
          <div className={`text-xl font-bold ${metric.colorClass} mb-1`}>
            {metric.value}
          </div>
          <div className="text-xs text-slate-600 font-medium">
            {metric.label}
          </div>
        </div>
      ))}
    </div>
  );
}
