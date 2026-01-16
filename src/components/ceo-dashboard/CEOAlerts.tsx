import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X, TrendingDown, DollarSign, Users, Star, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Alert {
  id: string;
  alert_type: string;
  title: string;
  description: string | null;
  severity: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

const ALERT_ICONS: Record<string, React.ReactNode> = {
  churn: <TrendingDown className="h-5 w-5" />,
  mrr: <DollarSign className="h-5 w-5" />,
  caixa: <DollarSign className="h-5 w-5" />,
  satisfaction: <Star className="h-5 w-5" />,
  client_risk: <Users className="h-5 w-5" />,
  goal: <Target className="h-5 w-5" />,
  default: <AlertTriangle className="h-5 w-5" />,
};

export function CEOAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("ceo_alerts")
        .select("*")
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    generateAutoAlerts();
  }, []);

  const generateAutoAlerts = async () => {
    try {
      // Check for high-risk clients
      const { data: riskClients } = await supabase
        .from("client_health_scores")
        .select("project_id, risk_level, total_score")
        .in("risk_level", ["critical", "high"]);

      if (riskClients && riskClients.length > 0) {
        // Check if alert already exists for today
        const today = new Date().toISOString().split("T")[0];
        const { data: existingAlerts } = await supabase
          .from("ceo_alerts")
          .select("id")
          .eq("alert_type", "client_risk")
          .gte("created_at", today);

        if (!existingAlerts || existingAlerts.length === 0) {
          await supabase.from("ceo_alerts").insert({
            alert_type: "client_risk",
            title: `${riskClients.length} cliente(s) em risco`,
            description: "Existem clientes com health score crítico que precisam de atenção imediata.",
            severity: riskClients.some(c => c.risk_level === "critical") ? "critical" : "warning",
          });
          fetchAlerts();
        }
      }

      // Check CSAT for satisfaction alerts
      const { data: csatData } = await supabase
        .from("csat_responses")
        .select("score")
        .order("created_at", { ascending: false })
        .limit(10);

      if (csatData && csatData.length > 0) {
        const avgCSAT = csatData.reduce((sum, n) => sum + n.score, 0) / csatData.length;
        if (avgCSAT < 3) {
          const today = new Date().toISOString().split("T")[0];
          const { data: existingAlerts } = await supabase
            .from("ceo_alerts")
            .select("id")
            .eq("alert_type", "satisfaction")
            .gte("created_at", today);

          if (!existingAlerts || existingAlerts.length === 0) {
            await supabase.from("ceo_alerts").insert({
              alert_type: "satisfaction",
              title: "CSAT abaixo do esperado",
              description: `CSAT médio atual: ${avgCSAT.toFixed(1)}. Requer ação imediata.`,
              severity: avgCSAT < 2 ? "critical" : "warning",
            });
            fetchAlerts();
          }
        }
      }
    } catch (error) {
      console.error("Error generating auto alerts:", error);
    }
  };

  const dismissAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ceo_alerts")
        .update({ is_dismissed: true })
        .eq("id", id);

      if (error) throw error;
      setAlerts(alerts.filter(a => a.id !== id));
      toast.success("Alerta dispensado");
    } catch (error) {
      console.error("Error dismissing alert:", error);
      toast.error("Erro ao dispensar alerta");
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ceo_alerts")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (error) {
      console.error("Error marking alert as read:", error);
    }
  };

  if (isLoading || alerts.length === 0) {
    return null;
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400";
      default:
        return "bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-400";
    }
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={cn(
            "border-l-4 transition-opacity",
            getSeverityStyles(alert.severity),
            alert.is_read && "opacity-60"
          )}
          onMouseEnter={() => !alert.is_read && markAsRead(alert.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-current/10">
                {ALERT_ICONS[alert.alert_type] || ALERT_ICONS.default}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{alert.title}</h4>
                {alert.description && (
                  <p className="text-sm mt-1 opacity-80">{alert.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dismissAlert(alert.id)}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
