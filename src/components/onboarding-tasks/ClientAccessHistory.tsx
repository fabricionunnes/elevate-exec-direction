import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Clock,
  Calendar,
  User,
  Activity,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle2,
  PlusCircle,
  CalendarCheck,
  MessageSquare,
  Upload,
  Send,
  Star,
  MousePointer,
  Eye,
  Layers,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccessLog {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  login_at: string;
  logout_at: string | null;
  session_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

interface ActivityLog {
  id: string;
  access_log_id: string | null;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  page_path: string | null;
  created_at: string;
}

interface ClientAccessHistoryProps {
  projectId: string;
  companyId?: string;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  page_view: <Eye className="h-3.5 w-3.5 text-blue-500" />,
  task_completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  task_created: <PlusCircle className="h-3.5 w-3.5 text-purple-500" />,
  task_updated: <FileText className="h-3.5 w-3.5 text-amber-500" />,
  meeting_scheduled: <CalendarCheck className="h-3.5 w-3.5 text-cyan-500" />,
  meeting_completed: <CalendarCheck className="h-3.5 w-3.5 text-green-500" />,
  ticket_created: <MessageSquare className="h-3.5 w-3.5 text-orange-500" />,
  ticket_replied: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
  file_uploaded: <Upload className="h-3.5 w-3.5 text-indigo-500" />,
  file_downloaded: <Upload className="h-3.5 w-3.5 text-green-500" />,
  note_added: <FileText className="h-3.5 w-3.5 text-yellow-500" />,
  form_submitted: <Send className="h-3.5 w-3.5 text-teal-500" />,
  nps_submitted: <Star className="h-3.5 w-3.5 text-yellow-500" />,
  button_clicked: <MousePointer className="h-3.5 w-3.5 text-gray-500" />,
  tab_changed: <Layers className="h-3.5 w-3.5 text-slate-500" />,
  export_generated: <FileText className="h-3.5 w-3.5 text-emerald-500" />,
};

export function ClientAccessHistory({ projectId, companyId }: ClientAccessHistoryProps) {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<Map<string, ActivityLog[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loadingActivities, setLoadingActivities] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalSessions: 0,
    avgDuration: 0,
    activeNow: 0,
    lastAccess: null as string | null,
    totalActivities: 0,
  });

  useEffect(() => {
    fetchAccessLogs();
  }, [projectId, companyId]);

  const fetchAccessLogs = async () => {
    try {
      let query = supabase
        .from("client_access_logs" as any)
        .select("*")
        .order("login_at", { ascending: false })
        .limit(50);

      if (projectId) {
        query = query.eq("project_id", projectId);
      } else if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const logs = (data as unknown as AccessLog[]) || [];
      setAccessLogs(logs);

      // Fetch activity count for stats
      let activityQuery = supabase
        .from("client_activity_logs" as any)
        .select("id", { count: "exact", head: true });
      
      if (projectId) {
        activityQuery = activityQuery.eq("project_id", projectId);
      }

      const { count: activityCount } = await activityQuery;

      // Calcular estatísticas
      const totalSessions = logs.length;
      const completedSessions = logs.filter((l) => l.session_duration_minutes);
      const avgDuration =
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce(
                (acc, l) => acc + (l.session_duration_minutes || 0),
                0
              ) / completedSessions.length
            )
          : 0;
      const activeNow = logs.filter((l) => l.is_active).length;
      const lastAccess = logs.length > 0 ? logs[0].login_at : null;

      setStats({ 
        totalSessions, 
        avgDuration, 
        activeNow, 
        lastAccess,
        totalActivities: activityCount || 0,
      });
    } catch (error) {
      console.error("Error fetching access logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivitiesForSession = async (accessLogId: string, userId: string, loginAt: string, logoutAt: string | null) => {
    if (activityLogs.has(accessLogId)) return;

    setLoadingActivities((prev) => new Set(prev).add(accessLogId));

    try {
      // Fetch activities for this session (by access_log_id or by time range)
      let query = supabase
        .from("client_activity_logs" as any)
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .gte("created_at", loginAt)
        .order("created_at", { ascending: true });

      if (logoutAt) {
        query = query.lte("created_at", logoutAt);
      }

      const { data, error } = await query;

      if (error) throw error;

      setActivityLogs((prev) => {
        const newMap = new Map(prev);
        newMap.set(accessLogId, (data as unknown as ActivityLog[]) || []);
        return newMap;
      });
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoadingActivities((prev) => {
        const newSet = new Set(prev);
        newSet.delete(accessLogId);
        return newSet;
      });
    }
  };

  const toggleSession = (log: AccessLog) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(log.id)) {
      newExpanded.delete(log.id);
    } else {
      newExpanded.add(log.id);
      fetchActivitiesForSession(log.id, log.user_id, log.login_at, log.logout_at);
    }
    setExpandedSessions(newExpanded);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const getActionIcon = (actionType: string) => {
    return actionTypeIcons[actionType] || <Activity className="h-3.5 w-3.5 text-gray-500" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Histórico de Acesso e Atividades do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground">Total de Acessos</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalActivities}</p>
            <p className="text-xs text-muted-foreground">Atividades</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{formatDuration(stats.avgDuration)}</p>
            <p className="text-xs text-muted-foreground">Tempo Médio</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-foreground">{stats.activeNow}</p>
              {stats.activeNow > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Online Agora</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-foreground">
              {stats.lastAccess
                ? formatDistanceToNow(new Date(stats.lastAccess), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : "-"}
            </p>
            <p className="text-xs text-muted-foreground">Último Acesso</p>
          </div>
        </div>

        {/* Access Logs List with Activities */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {accessLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum registro de acesso encontrado
              </p>
            ) : (
              accessLogs.map((log) => {
                const isExpanded = expandedSessions.has(log.id);
                const activities = activityLogs.get(log.id) || [];
                const isLoadingActivities = loadingActivities.has(log.id);

                return (
                  <Collapsible
                    key={log.id}
                    open={isExpanded}
                    onOpenChange={() => toggleSession(log)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full p-3 h-auto flex items-center justify-between hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-sm">
                                {log.user_name || log.user_email || "Usuário"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(log.login_at), "dd/MM/yyyy 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>{formatDuration(log.session_duration_minutes)}</span>
                              </div>
                              {activities.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {activities.length} atividade{activities.length !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            {log.is_active ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                <span className="relative flex h-2 w-2 mr-1">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Offline</Badge>
                            )}
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t bg-muted/20 p-3">
                          {isLoadingActivities ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                              <span className="ml-2 text-sm text-muted-foreground">
                                Carregando atividades...
                              </span>
                            </div>
                          ) : activities.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">
                              Nenhuma atividade registrada nesta sessão
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                Atividades durante esta sessão:
                              </p>
                              {activities.map((activity) => (
                                <div
                                  key={activity.id}
                                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                                >
                                  <div className="mt-0.5">
                                    {getActionIcon(activity.action_type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground">
                                      {activity.action_description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(activity.created_at), "HH:mm:ss", {
                                        locale: ptBR,
                                      })}
                                      {activity.page_path && (
                                        <span className="ml-2 opacity-60">
                                          • {activity.page_path.split('#').pop()?.substring(0, 30)}...
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
