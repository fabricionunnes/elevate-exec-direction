import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Building2,
  AlertTriangle,
  Target,
  Calendar,
  FileWarning,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface HealthScoreHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectIds?: string[];
}

interface HealthEvent {
  id: string;
  project_id: string;
  event_type: string;
  event_data: any;
  score_before: number | null;
  score_after: number | null;
  created_at: string;
  project?: {
    product_name: string;
    onboarding_company?: {
      name: string;
    } | null;
  };
}

interface ProjectHealth {
  project_id: string;
  total_score: number;
  risk_level: string | null;
  trend_direction: string | null;
  satisfaction_score: number | null;
  goals_score: number | null;
  updated_at: string;
  project?: {
    product_name: string;
    onboarding_company?: {
      name: string;
    } | null;
  };
}

interface DailySnapshot {
  date: string;
  avgScore: number;
  count: number;
}

export const HealthScoreHistoryDialog = ({
  open,
  onOpenChange,
  projectIds,
}: HealthScoreHistoryDialogProps) => {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [projectHealths, setProjectHealths] = useState<ProjectHealth[]>([]);
  const [dailyData, setDailyData] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, projectIds]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent health events with project info
      let eventsQuery = supabase
        .from("health_score_events")
        .select(`
          id,
          project_id,
          event_type,
          event_data,
          score_before,
          score_after,
          created_at,
          project:onboarding_projects(
            product_name,
            onboarding_company:onboarding_companies(name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (projectIds && projectIds.length > 0) {
        eventsQuery = eventsQuery.in("project_id", projectIds);
      }

      const { data: eventsData } = await eventsQuery;
      setEvents((eventsData || []) as unknown as HealthEvent[]);

      // Fetch current health scores for all projects
      let healthQuery = supabase
        .from("client_health_scores")
        .select(`
          project_id,
          total_score,
          risk_level,
          trend_direction,
          satisfaction_score,
          goals_score,
          updated_at,
          project:onboarding_projects(
            product_name,
            status,
            onboarding_company:onboarding_companies(name)
          )
        `)
        .order("total_score", { ascending: true });

      if (projectIds && projectIds.length > 0) {
        healthQuery = healthQuery.in("project_id", projectIds);
      }

      const { data: healthData } = await healthQuery;
      // Filter only active projects
      const activeHealths = (healthData || []).filter(
        (h: any) => h.project?.status === "active"
      );
      setProjectHealths(activeHealths as unknown as ProjectHealth[]);

      // Fetch snapshots for chart
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      let snapshotsQuery = supabase
        .from("health_score_snapshots")
        .select("snapshot_date, total_score")
        .gte("snapshot_date", thirtyDaysAgo)
        .order("snapshot_date", { ascending: true });

      if (projectIds && projectIds.length > 0) {
        snapshotsQuery = snapshotsQuery.in("project_id", projectIds);
      }

      const { data: snapshotsData } = await snapshotsQuery;

      // Group by date and calculate average
      const byDate = new Map<string, { total: number; count: number }>();
      (snapshotsData || []).forEach((s) => {
        const existing = byDate.get(s.snapshot_date) || { total: 0, count: 0 };
        byDate.set(s.snapshot_date, {
          total: existing.total + (s.total_score || 0),
          count: existing.count + 1,
        });
      });

      const chartData: DailySnapshot[] = [];
      byDate.forEach((value, date) => {
        chartData.push({
          date: format(parseISO(date), "dd/MM", { locale: ptBR }),
          avgScore: Math.round(value.total / value.count),
          count: value.count,
        });
      });

      setDailyData(chartData);
    } catch (error) {
      console.error("Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (riskLevel: string | null) => {
    switch (riskLevel) {
      case "critical":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
            Crítico
          </Badge>
        );
      case "high":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
            Alto
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            Médio
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            Baixo
          </Badge>
        );
      case "excellent":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
            Excelente
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
            —
          </Badge>
        );
    }
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "falling":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "goal_projection":
        return <Target className="h-4 w-4 text-teal-500" />;
      case "task_overdue":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "task_completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "meeting_completed":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "nps_received":
        return <HeartPulse className="h-4 w-4 text-purple-500" />;
      case "renewal_confirmed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "cancellation_signaled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "no_goals":
        return <FileWarning className="h-4 w-4 text-amber-500" />;
      default:
        return <HeartPulse className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case "goal_projection":
        return "Projeção de Meta";
      case "task_overdue":
        return "Tarefa Atrasada";
      case "task_completed":
        return "Tarefa Concluída";
      case "meeting_completed":
        return "Reunião Realizada";
      case "nps_received":
        return "NPS Recebido";
      case "renewal_confirmed":
        return "Renovação Confirmada";
      case "cancellation_signaled":
        return "Cancelamento Sinalizado";
      case "no_goals":
        return "Sem Metas";
      case "inactivity":
        return "Inatividade";
      case "recalculation":
        return "Recálculo";
      default:
        return eventType;
    }
  };

  const getEventDescription = (event: HealthEvent) => {
    const data = event.event_data || {};
    const scoreDiff = (event.score_after || 0) - (event.score_before || 0);
    const diffText =
      scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff < 0 ? `${scoreDiff}` : "0";
    const diffColor =
      scoreDiff > 0 ? "text-green-600" : scoreDiff < 0 ? "text-red-600" : "text-gray-500";

    switch (event.event_type) {
      case "goal_projection":
        return (
          <span>
            Projeção de meta: <strong>{data.projection || 0}%</strong> -{" "}
            <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "task_overdue":
        return (
          <span>
            {data.count || 1} tarefa(s) atrasada(s) -{" "}
            <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "task_completed":
        return (
          <span>
            Tarefa concluída - <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "meeting_completed":
        return (
          <span>
            Reunião realizada - <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "nps_received":
        return (
          <span>
            NPS recebido: <strong>{data.score || 0}</strong> -{" "}
            <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "renewal_confirmed":
        return (
          <span>
            Renovação confirmada - <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "cancellation_signaled":
        return (
          <span>
            Cancelamento sinalizado - <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "no_goals":
        return (
          <span>
            Empresa sem metas configuradas -{" "}
            <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "inactivity":
        return (
          <span>
            {data.days_inactive || 0} dias sem atividade -{" "}
            <span className={diffColor}>{diffText} pts</span>
          </span>
        );
      case "recalculation":
        return (
          <span>
            Score recalculado:{" "}
            <span className={getScoreColor(event.score_after || 0)}>
              {event.score_after || 0}
            </span>
          </span>
        );
      default:
        return (
          <span>
            {data.description || event.event_type} -{" "}
            <span className={diffColor}>{diffText} pts</span>
          </span>
        );
    }
  };

  const getCompanyName = (item: HealthEvent | ProjectHealth) => {
    return (
      item.project?.onboarding_company?.name ||
      item.project?.product_name ||
      "Projeto"
    );
  };

  // Group events by company for better visualization
  const criticalProjects = projectHealths.filter(
    (p) => p.risk_level === "critical" || p.risk_level === "high"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-red-500" />
            Histórico de Saúde - Visão Geral
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-[calc(90vh-120px)]">
              <div className="space-y-4 pr-4">
                {/* Average Score Chart */}
                {dailyData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Evolução da Saúde Média (últimos 30 dias)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10 }}
                              stroke="hsl(var(--muted-foreground))"
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fontSize: 10 }}
                              stroke="hsl(var(--muted-foreground))"
                              width={30}
                            />
                            <Tooltip
                              formatter={(value: number) => [`${value} pts`, "Média"]}
                              labelFormatter={(label) => `Data: ${label}`}
                            />
                            <Line
                              type="monotone"
                              dataKey="avgScore"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Critical Projects */}
                {criticalProjects.length > 0 && (
                  <Card className="border-red-200 bg-red-50/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        Empresas em Risco ({criticalProjects.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {criticalProjects.slice(0, 10).map((project) => (
                          <div
                            key={project.project_id}
                            className="flex items-center justify-between bg-white rounded-lg p-3 border"
                          >
                            <div className="flex items-center gap-3">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">
                                  {getCompanyName(project)}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    Metas: {project.goals_score ?? "—"} |{" "}
                                    Satisfação: {project.satisfaction_score ?? "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getTrendIcon(project.trend_direction)}
                              <span
                                className={cn(
                                  "text-lg font-bold",
                                  getScoreColor(project.total_score)
                                )}
                              >
                                {project.total_score}
                              </span>
                              {getRiskBadge(project.risk_level)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Events */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Eventos Recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum evento registrado
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {events.slice(0, 30).map((event) => (
                          <div
                            key={event.id}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="mt-0.5">
                              {getEventIcon(event.event_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">
                                  {getCompanyName(event)}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {getEventLabel(event.event_type)}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {getEventDescription(event)}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {format(
                                  parseISO(event.created_at),
                                  "dd/MM/yyyy 'às' HH:mm",
                                  { locale: ptBR }
                                )}
                              </p>
                            </div>
                            {event.score_after !== null && (
                              <div className="text-right">
                                <span
                                  className={cn(
                                    "text-sm font-bold",
                                    getScoreColor(event.score_after)
                                  )}
                                >
                                  {event.score_after}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* All Projects Ranking */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Ranking de Saúde
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {projectHealths.slice(0, 20).map((project, idx) => (
                        <div
                          key={project.project_id}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-5">
                              {idx + 1}.
                            </span>
                            <span className="text-sm">{getCompanyName(project)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(project.trend_direction)}
                            <span
                              className={cn(
                                "font-bold",
                                getScoreColor(project.total_score)
                              )}
                            >
                              {project.total_score}
                            </span>
                            {getRiskBadge(project.risk_level)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
