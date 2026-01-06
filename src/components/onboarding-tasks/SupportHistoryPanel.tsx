import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Headphones, 
  Clock, 
  CheckCircle2, 
  XCircle,
  User,
  Building2,
  MessageSquare,
  Calendar
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SupportSession {
  id: string;
  project_id: string;
  user_id: string;
  client_name: string;
  company_name: string | null;
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  attended_by: string | null;
  meet_link: string | null;
  started_at: string;
  attended_at: string | null;
  ended_at: string | null;
  notes: string | null;
  staff?: { name: string } | null;
}

interface SupportHistoryPanelProps {
  projectId: string;
}

export const SupportHistoryPanel = ({ projectId }: SupportHistoryPanelProps) => {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
    subscribeToSessions();
  }, [projectId]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("support_room_sessions")
        .select(`
          *,
          staff:onboarding_staff!support_room_sessions_attended_by_fkey(name)
        `)
        .eq("project_id", projectId)
        .order("started_at", { ascending: false });

      if (error) throw error;
      setSessions((data || []) as SupportSession[]);
    } catch (error) {
      console.error("Error fetching support sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToSessions = () => {
    const channel = supabase
      .channel(`support-history-${projectId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "support_room_sessions",
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return <Badge variant="destructive" className="animate-pulse">Aguardando</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-green-500">Em Atendimento</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-blue-500 text-white">Finalizado</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Headphones className="h-5 w-5 text-primary" />;
    }
  };

  const completedSessions = sessions.filter(s => s.status === "completed");
  const cancelledSessions = sessions.filter(s => s.status === "cancelled");
  const activeSessions = sessions.filter(s => s.status === "waiting" || s.status === "in_progress");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Headphones className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <p className="font-medium text-lg">Nenhum suporte solicitado</p>
        <p className="text-sm">O histórico de suportes do cliente aparecerá aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{completedSessions.length}</div>
            <div className="text-sm text-muted-foreground">Atendidos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{cancelledSessions.length}</div>
            <div className="text-sm text-muted-foreground">Cancelados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Sessões Ativas */}
      {activeSessions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-primary">
            <Headphones className="h-5 w-5 animate-pulse" />
            Atendimentos Ativos ({activeSessions.length})
          </h3>
          {activeSessions.map((session) => (
            <Card key={session.id} className="border-primary/50 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(session.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{session.client_name}</span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Iniciado em {format(new Date(session.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      {session.status === "in_progress" && session.staff && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Atendido por {session.staff.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Histórico */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Histórico de Atendimentos
        </h3>
        
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {[...completedSessions, ...cancelledSessions]
              .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
              .map((session) => (
                <Card key={session.id} className={
                  session.status === "completed" 
                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30" 
                    : "border-muted"
                }>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(session.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{session.client_name}</span>
                            {getStatusBadge(session.status)}
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(session.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </div>
                          
                          {session.status === "completed" && session.staff && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Atendido por {session.staff.name}
                            </div>
                          )}
                          
                          {session.attended_at && session.ended_at && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Duração: {formatDistanceToNow(new Date(session.attended_at), { 
                                locale: ptBR,
                                includeSeconds: true 
                              }).replace("menos de ", "").replace("cerca de ", "")}
                            </div>
                          )}
                        </div>

                        {/* Notas do atendimento */}
                        {session.notes && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-1 text-sm font-medium mb-1">
                              <MessageSquare className="h-3 w-3" />
                              Observações do Atendimento
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {session.notes}
                            </p>
                          </div>
                        )}

                        {/* Indicador de não atendido */}
                        {session.status === "cancelled" && !session.attended_by && (
                          <div className="mt-2 text-sm text-red-600 dark:text-red-400 italic">
                            Cliente cancelou antes de ser atendido
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SupportHistoryPanel;
