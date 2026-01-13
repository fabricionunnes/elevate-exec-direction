import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Target,
  Clock,
  Bell,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface HealthScoreHistoryTabProps {
  projectId: string;
  snapshots: Array<{
    snapshot_date: string;
    total_score: number;
    satisfaction_score?: number;
    goals_score?: number;
    commercial_score?: number;
    engagement_score?: number;
    support_score?: number;
    trend_score?: number;
    risk_level?: string;
  }>;
}

interface HealthEvent {
  id: string;
  event_type: string;
  event_data: unknown;
  previous_score: number | null;
  new_score: number | null;
  triggered_by: string | null;
  created_at: string;
}

export const HealthScoreHistoryTab = ({ projectId, snapshots }: HealthScoreHistoryTabProps) => {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("health_score_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setEvents(data);
      }
      setLoading(false);
    };

    fetchEvents();
  }, [projectId]);

  const historyData = snapshots
    .slice(0, 30)
    .reverse()
    .map((s, idx, arr) => {
      const prevScore = idx > 0 ? arr[idx - 1].total_score : s.total_score;
      const change = s.total_score - prevScore;
      return {
        date: format(parseISO(s.snapshot_date), "dd/MM", { locale: ptBR }),
        fullDate: format(parseISO(s.snapshot_date), "dd 'de' MMMM", { locale: ptBR }),
        score: Number(s.total_score),
        change: idx > 0 ? change : 0,
        riskLevel: s.risk_level,
      };
    });

  // Calculate daily changes from snapshots
  const dailyChanges = snapshots
    .slice(0, 15)
    .map((s, idx, arr) => {
      if (idx === arr.length - 1) return null;
      const nextSnapshot = arr[idx + 1];
      const change = s.total_score - nextSnapshot.total_score;
      return {
        date: s.snapshot_date,
        currentScore: s.total_score,
        previousScore: nextSnapshot.total_score,
        change,
        riskLevel: s.risk_level,
      };
    })
    .filter(Boolean);

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "calculation":
        return <RefreshCw className="h-4 w-4" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4" />;
      case "recovery":
        return <CheckCircle className="h-4 w-4" />;
      case "goal_achievement":
        return <Target className="h-4 w-4" />;
      case "inactivity_penalty":
        return <Clock className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case "calculation":
        return "Recálculo";
      case "alert":
        return "Alerta";
      case "recovery":
        return "Recuperação";
      case "goal_achievement":
        return "Meta Atingida";
      case "inactivity_penalty":
        return "Penalidade Inatividade";
      case "daily_snapshot":
        return "Snapshot Diário";
      default:
        return eventType;
    }
  };

  const getEventDescription = (event: HealthEvent) => {
    const data = (typeof event.event_data === 'object' && event.event_data !== null ? event.event_data : {}) as Record<string, any>;
    const parts: string[] = [];
    const details = data.details || {};
    const penalties = details.penalties || {};
    const bonuses = details.bonuses || {};

    // Calculate changes based on previous vs new score
    const change = event.new_score !== null && event.previous_score !== null
      ? event.new_score - event.previous_score
      : 0;

    // Check for goal projection info
    if (details.goal_projection !== undefined) {
      if (!details.has_goals_configured) {
        parts.push("⚠️ Sem meta configurada");
      } else if (!details.has_kpi_entries) {
        parts.push("⚠️ Sem lançamento de KPIs no mês");
      } else if (details.goal_projection < 50) {
        parts.push(`📉 Projeção de meta: ${details.goal_projection}%`);
      } else if (details.goal_projection < 80) {
        parts.push(`📊 Projeção de meta: ${details.goal_projection}%`);
      } else if (details.goal_projection < 100) {
        parts.push(`📈 Projeção de meta: ${details.goal_projection}%`);
      } else {
        parts.push(`🎯 Projetando bater meta: ${details.goal_projection}%`);
      }
    }

    // Overdue tasks
    if (details.overdue_tasks_count > 0) {
      parts.push(`⏰ ${details.overdue_tasks_count} tarefas atrasadas`);
    }

    // Completed tasks recent
    if (details.completed_tasks_recent > 0) {
      parts.push(`✅ ${details.completed_tasks_recent} tarefas concluídas (30d)`);
    }

    // Meetings
    if (details.meetings_count_30d > 0) {
      parts.push(`📅 ${details.meetings_count_30d} reuniões (30d)`);
    }

    // Days since last task
    if (details.days_since_last_task >= 14) {
      parts.push(`🔴 ${details.days_since_last_task} dias sem concluir tarefas`);
    } else if (details.days_since_last_task >= 7) {
      parts.push(`🟡 ${details.days_since_last_task} dias sem concluir tarefas`);
    }

    // Penalties
    if (penalties.inactivity > 0) {
      parts.push(`-${penalties.inactivity} inatividade`);
    }
    if (penalties.cancellation > 0) {
      parts.push(`-${penalties.cancellation} cancelamento`);
    }
    if (penalties.overdue_tasks > 0) {
      parts.push(`-${penalties.overdue_tasks} tarefas atrasadas`);
    }

    // Bonuses
    if (bonuses.projection > 0) {
      parts.push(`+${bonuses.projection} projeção meta`);
    }
    if (bonuses.meetings > 0) {
      parts.push(`+${bonuses.meetings} reuniões`);
    }
    if (bonuses.completed_tasks > 0) {
      parts.push(`+${bonuses.completed_tasks} tarefas`);
    }
    if (bonuses.renewal > 0) {
      parts.push(`+${bonuses.renewal} renovação`);
    }

    // Fallback to legacy format
    if (parts.length === 0) {
      if (data.goals_score !== undefined) {
        if (data.goals_score <= 20) {
          parts.push("Sem meta ou atingimento muito baixo");
        } else if (data.goals_score < 50) {
          parts.push(`Metas abaixo do esperado (${data.goals_score})`);
        }
      }

      if (data.engagement_score !== undefined && data.engagement_score < 40) {
        parts.push(`Baixo engajamento (${data.engagement_score})`);
      }

      // Risk level
      if (data.risk_level) {
        const riskLabels: Record<string, string> = {
          excellent: "Excelente",
          healthy: "Saudável",
          attention: "Atenção",
          at_risk: "Em risco",
          critical: "Crítico",
        };
        parts.push(`Nível: ${riskLabels[data.risk_level] || data.risk_level}`);
      }
    }

    if (parts.length === 0 && change !== 0) {
      parts.push(`Score ${change > 0 ? "subiu" : "caiu"} ${Math.abs(change)} pontos`);
    }

    return parts.length > 0 ? parts.join(" • ") : "Atualização de score";
  };

  const getRiskBadge = (riskLevel: string | undefined) => {
    if (!riskLevel) return null;
    const config: Record<string, { label: string; className: string }> = {
      excellent: { label: "Excelente", className: "bg-emerald-100 text-emerald-700" },
      healthy: { label: "Saudável", className: "bg-green-100 text-green-700" },
      attention: { label: "Atenção", className: "bg-yellow-100 text-yellow-700" },
      at_risk: { label: "Em Risco", className: "bg-orange-100 text-orange-700" },
      critical: { label: "Crítico", className: "bg-red-100 text-red-700" },
    };
    const cfg = config[riskLevel] || { label: riskLevel, className: "bg-muted" };
    return <Badge variant="outline" className={cn("text-[10px]", cfg.className)}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Evolução do Score (últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {historyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-medium">{data.fullDate}</p>
                          <p className={cn(
                            "text-lg font-bold",
                            data.score >= 80 ? "text-green-600" :
                            data.score >= 60 ? "text-yellow-600" :
                            data.score >= 40 ? "text-orange-600" : "text-red-600"
                          )}>
                            Score: {data.score}
                          </p>
                          {data.change !== 0 && (
                            <p className={cn(
                              "text-xs",
                              data.change > 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {data.change > 0 ? "+" : ""}{data.change} pontos
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="5 5" />
                <ReferenceLine y={60} stroke="#eab308" strokeDasharray="5 5" />
                <ReferenceLine y={40} stroke="#f97316" strokeDasharray="5 5" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Sem dados históricos disponíveis
            </p>
          )}
        </CardContent>
      </Card>

      {/* Daily Changes */}
      {dailyChanges.length > 0 && (
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Variações Diárias
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <ScrollArea className="h-[200px] sm:h-[250px]">
              <div className="space-y-2">
                {dailyChanges.map((item, idx) => item && (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-3 p-2 sm:p-3 rounded-lg border",
                      item.change > 0 ? "bg-green-50/50 border-green-200" :
                      item.change < 0 ? "bg-red-50/50 border-red-200" :
                      "bg-muted/30"
                    )}
                  >
                    {getChangeIcon(item.change)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-medium">
                          {format(parseISO(item.date), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                        {getRiskBadge(item.riskLevel)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.previousScore} → {item.currentScore}</span>
                        <span className={cn(
                          "font-medium",
                          item.change > 0 ? "text-green-600" :
                          item.change < 0 ? "text-red-600" : ""
                        )}>
                          ({item.change > 0 ? "+" : ""}{item.change} pontos)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Events Log */}
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Histórico de Atualizações
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : events.length > 0 ? (
            <ScrollArea className="h-[300px] sm:h-[350px]">
              <div className="space-y-2">
                {events.map((event) => {
                  const change = event.new_score !== null && event.previous_score !== null
                    ? event.new_score - event.previous_score
                    : 0;
                  
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "p-3 rounded-lg border transition-colors",
                        change > 0 ? "bg-green-50/30 border-green-200/50 hover:bg-green-50/50" :
                        change < 0 ? "bg-red-50/30 border-red-200/50 hover:bg-red-50/50" :
                        "bg-muted/20 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-1.5 rounded-full shrink-0",
                          change > 0 ? "bg-green-100 text-green-600" :
                          change < 0 ? "bg-red-100 text-red-600" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {getEventIcon(event.event_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {getEventLabel(event.event_type)}
                            </Badge>
                            {change !== 0 && (
                              <span className={cn(
                                "text-xs font-semibold",
                                change > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {change > 0 ? "+" : ""}{change} pts
                              </span>
                            )}
                          </div>
                          
                          {event.previous_score !== null && event.new_score !== null && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Score: {event.previous_score} → <span className="font-medium">{event.new_score}</span>
                            </div>
                          )}
                          
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {getEventDescription(event)}
                          </p>
                          
                          <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {event.triggered_by && (
                              <span className="ml-2">• {event.triggered_by}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum evento registrado ainda
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
