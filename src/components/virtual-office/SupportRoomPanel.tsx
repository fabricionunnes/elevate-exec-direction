import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Headphones, 
  Phone, 
  Video, 
  Clock, 
  CheckCircle2, 
  XCircle,
  User,
  Building2,
  ExternalLink,
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
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SupportRoomPanelProps {
  currentStaff: StaffMember | null;
  onSessionUpdate?: () => void;
}

export const SupportRoomPanel = ({ currentStaff, onSessionUpdate }: SupportRoomPanelProps) => {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttendDialog, setShowAttendDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null);
  const [meetLink, setMeetLink] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);

  useEffect(() => {
    fetchSessions();
    subscribeToSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("support_room_sessions")
        .select("*")
        .in("status", ["waiting", "in_progress"])
        .order("started_at", { ascending: true });

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
      .channel("support-sessions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_room_sessions" },
        (payload) => {
          console.log("Support session change:", payload);
          fetchSessions();
          onSessionUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAttendSession = (session: SupportSession) => {
    setSelectedSession(session);
    setMeetLink("");
    setCreatingMeet(false);
    setShowAttendDialog(true);
  };

  const createMeetWithCalendar = async () => {
    if (!selectedSession) return;
    
    setCreatingMeet(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Você precisa estar logado para usar esta funcionalidade");
        setCreatingMeet(false);
        return;
      }

      const eventTitle = `Suporte (${selectedSession.company_name || selectedSession.client_name})`;
      const now = new Date();
      const end = new Date(now.getTime() + 15 * 60000); // 15 min duration

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/google-calendar?action=create-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            title: eventTitle,
            description: `Sessão de suporte ao cliente ${selectedSession.client_name}`,
            startDateTime: now.toISOString(),
            endDateTime: end.toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data?.needsAuth) {
          toast.error("Você precisa conectar sua conta Google na aba 'Minha Agenda'");
          return;
        }
        throw new Error(data?.error || "Erro ao criar evento");
      }

      if (data?.success && data?.event?.meetingLink) {
        setMeetLink(data.event.meetingLink);
        toast.success("Link do Meet criado com sucesso!");
      } else {
        toast.error("Não foi possível obter o link do Meet");
      }
    } catch (error: unknown) {
      console.error("Error creating calendar event:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao criar evento no calendário";
      toast.error(errorMessage);
    } finally {
      setCreatingMeet(false);
    }
  };

  const confirmAttendSession = async () => {
    if (!selectedSession || !currentStaff) return;
    if (!meetLink.trim()) {
      toast.error("Por favor, informe o link do Google Meet");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("support_room_sessions")
        .update({
          status: "in_progress",
          attended_by: currentStaff.id,
          meet_link: meetLink.trim(),
          attended_at: new Date().toISOString(),
        })
        .eq("id", selectedSession.id);

      if (error) throw error;

      toast.success("Sessão de atendimento iniciada!");
      setShowAttendDialog(false);
      
      // Abrir o link do Meet
      window.open(meetLink.trim().startsWith("http") ? meetLink.trim() : `https://${meetLink.trim()}`, "_blank");
    } catch (error) {
      console.error("Error attending session:", error);
      toast.error("Erro ao iniciar atendimento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSession = (session: SupportSession) => {
    setSelectedSession(session);
    setSessionNotes("");
    setShowCompleteDialog(true);
  };

  const confirmCompleteSession = async () => {
    if (!selectedSession) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("support_room_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          notes: sessionNotes.trim() || null,
        })
        .eq("id", selectedSession.id);

      if (error) throw error;
      toast.success("Atendimento finalizado e registrado no histórico");
      setShowCompleteDialog(false);
      setSelectedSession(null);
      setSessionNotes("");
    } catch (error) {
      console.error("Error completing session:", error);
      toast.error("Erro ao finalizar atendimento");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSession = async (session: SupportSession) => {
    try {
      const { error } = await supabase
        .from("support_room_sessions")
        .update({
          status: "cancelled",
          ended_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (error) throw error;
      toast.success("Sessão cancelada");
    } catch (error) {
      console.error("Error cancelling session:", error);
      toast.error("Erro ao cancelar sessão");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return <Badge variant="destructive" className="animate-pulse">Aguardando</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-green-500">Em Atendimento</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const waitingSessions = sessions.filter(s => s.status === "waiting");
  const inProgressSessions = sessions.filter(s => s.status === "in_progress");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sessões Aguardando */}
      {waitingSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <Headphones className="h-5 w-5 animate-pulse" />
            <h3 className="font-semibold">Clientes Aguardando ({waitingSessions.length})</h3>
          </div>
          
          {waitingSessions.map((session) => (
            <Card key={session.id} className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-destructive/20 text-destructive">
                        {session.client_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{session.client_name}</span>
                        {getStatusBadge(session.status)}
                      </div>
                      {session.company_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {session.company_name}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        Aguardando há {formatDistanceToNow(new Date(session.started_at), { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleAttendSession(session)}>
                    <Video className="h-4 w-4 mr-1" />
                    Atender
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sessões Em Andamento */}
      {inProgressSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <Phone className="h-5 w-5" />
            <h3 className="font-semibold">Em Atendimento ({inProgressSessions.length})</h3>
          </div>
          
          {inProgressSessions.map((session) => (
            <Card key={session.id} className="border-green-500/50 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-green-500/20 text-green-600">
                        {session.client_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{session.client_name}</span>
                        {getStatusBadge(session.status)}
                      </div>
                      {session.company_name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {session.company_name}
                        </div>
                      )}
                      {session.attended_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          Em atendimento há {formatDistanceToNow(new Date(session.attended_at), { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {session.meet_link && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(session.meet_link!.startsWith("http") ? session.meet_link! : `https://${session.meet_link}`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Entrar
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleCompleteSession(session)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Finalizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Nenhuma sessão */}
      {sessions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Headphones className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nenhum cliente aguardando</p>
          <p className="text-sm">Quando um cliente entrar na sala de suporte, você será notificado.</p>
        </div>
      )}

      {/* Dialog para atender */}
      <Dialog open={showAttendDialog} onOpenChange={setShowAttendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Atendimento</DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Avatar>
                  <AvatarFallback>
                    {selectedSession.client_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedSession.client_name}</p>
                  {selectedSession.company_name && (
                    <p className="text-sm text-muted-foreground">{selectedSession.company_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="meet-link">Link do Google Meet</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={createMeetWithCalendar}
                    disabled={creatingMeet}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    {creatingMeet ? "Criando..." : "Criar no Google Agenda"}
                  </Button>
                </div>
                <Input
                  id="meet-link"
                  placeholder="meet.google.com/xxx-xxxx-xxx"
                  value={meetLink}
                  onChange={(e) => setMeetLink(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Clique em "Criar no Google Agenda" para gerar um link automaticamente, ou cole um link existente
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAttendDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmAttendSession} disabled={submitting}>
              {submitting ? "Iniciando..." : "Iniciar Atendimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para finalizar atendimento com notas */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Finalizar Atendimento</DialogTitle>
            <DialogDescription>
              Registre o que foi tratado neste atendimento. Essas informações ficarão salvas no histórico do cliente.
            </DialogDescription>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Avatar>
                  <AvatarFallback>
                    {selectedSession.client_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedSession.client_name}</p>
                  {selectedSession.company_name && (
                    <p className="text-sm text-muted-foreground">{selectedSession.company_name}</p>
                  )}
                  {selectedSession.attended_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Em atendimento há {formatDistanceToNow(new Date(selectedSession.attended_at), { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="session-notes">
                  <MessageSquare className="h-4 w-4 inline mr-1" />
                  O que foi tratado neste atendimento?
                </Label>
                <Textarea
                  id="session-notes"
                  placeholder="Descreva os principais pontos discutidos, dúvidas resolvidas, encaminhamentos..."
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Essas notas ficam visíveis no histórico de suporte do cliente
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={confirmCompleteSession} 
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? "Finalizando..." : "Finalizar Atendimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportRoomPanel;
