import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Calendar, User, Activity, Monitor } from "lucide-react";
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

interface ClientAccessHistoryProps {
  projectId: string;
  companyId?: string;
}

export function ClientAccessHistory({ projectId, companyId }: ClientAccessHistoryProps) {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    avgDuration: 0,
    activeNow: 0,
    lastAccess: null as string | null,
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

      setStats({ totalSessions, avgDuration, activeNow, lastAccess });
    } catch (error) {
      console.error("Error fetching access logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
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
          Histórico de Acesso do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground">Total de Acessos</p>
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

        {/* Access Logs List */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {accessLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum registro de acesso encontrado
              </p>
            ) : (
              accessLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
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
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{formatDuration(log.session_duration_minutes)}</span>
                      </div>
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
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
