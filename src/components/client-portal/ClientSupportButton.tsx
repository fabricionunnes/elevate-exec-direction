import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Headphones, 
  Phone, 
  Clock, 
  ExternalLink, 
  X,
  Video,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface SupportSession {
  id: string;
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  meet_link: string | null;
  started_at: string;
  attended_at: string | null;
}

interface ClientSupportButtonProps {
  projectId: string;
  userId: string;
  userName: string;
  companyName: string;
}

export const ClientSupportButton = ({ 
  projectId, 
  userId, 
  userName, 
  companyName 
}: ClientSupportButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [activeSession, setActiveSession] = useState<SupportSession | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActiveSession();
    subscribeToSession();
  }, [projectId, userId]);

  const fetchActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from("support_room_sessions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["waiting", "in_progress"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveSession(data as SupportSession | null);
    } catch (error) {
      console.error("Error fetching active session:", error);
    }
  };

  const subscribeToSession = () => {
    const channel = supabase
      .channel(`client-support-${userId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "support_room_sessions",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log("Session update:", payload);
          fetchActiveSession();
          
          // Notificar cliente quando alguém atender
          if (payload.eventType === "UPDATE") {
            const newSession = payload.new as SupportSession;
            if (newSession.status === "in_progress" && newSession.meet_link) {
              toast.success("Um membro da equipe está pronto para atendê-lo!", {
                description: "Clique no botão para entrar na videochamada",
                duration: 10000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const startSupportSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_room_sessions")
        .insert({
          project_id: projectId,
          user_id: userId,
          client_name: userName,
          company_name: companyName,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;
      
      setActiveSession(data as SupportSession);
      toast.success("Solicitação enviada!", {
        description: "Aguarde, um membro da equipe entrará em contato em breve.",
      });
    } catch (error) {
      console.error("Error starting support session:", error);
      toast.error("Erro ao solicitar suporte");
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async () => {
    if (!activeSession) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("support_room_sessions")
        .update({
          status: "cancelled",
          ended_at: new Date().toISOString(),
        })
        .eq("id", activeSession.id);

      if (error) throw error;
      
      setActiveSession(null);
      setShowDialog(false);
      toast.success("Solicitação cancelada");
    } catch (error) {
      console.error("Error cancelling session:", error);
      toast.error("Erro ao cancelar solicitação");
    } finally {
      setLoading(false);
    }
  };

  const openMeetLink = () => {
    if (activeSession?.meet_link) {
      const link = activeSession.meet_link.startsWith("http") 
        ? activeSession.meet_link 
        : `https://${activeSession.meet_link}`;
      window.open(link, "_blank");
    }
  };

  return (
    <>
      {/* Floating Support Button - Positioned above bottom nav */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] right-4 z-40"
      >
        <Button
          size="lg"
          className={`
            rounded-full shadow-xl h-14 min-w-14 px-4 gap-2 touch-manipulation
            transition-all active:scale-95
            ${activeSession 
              ? activeSession.status === "in_progress"
                ? "bg-green-600 hover:bg-green-700 shadow-green-500/30"
                : "bg-amber-500 hover:bg-amber-600 animate-pulse shadow-amber-500/30"
              : "bg-primary hover:bg-primary/90 shadow-primary/30"
            }
          `}
          onClick={() => setShowDialog(true)}
        >
          {activeSession ? (
            activeSession.status === "in_progress" ? (
              <>
                <Video className="h-5 w-5" />
                <span className="hidden sm:inline text-sm">Entrar</span>
              </>
            ) : (
              <>
                <Headphones className="h-5 w-5" />
                <span className="hidden sm:inline text-sm">Aguardando</span>
              </>
            )
          ) : (
            <>
              <Headphones className="h-5 w-5" />
              <span className="hidden sm:inline text-sm">Suporte</span>
            </>
          )}
        </Button>
      </motion.div>

      {/* Support Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Suporte ao Vivo
            </DialogTitle>
            <DialogDescription>
              Fale com nossa equipe em tempo real através de videochamada.
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!activeSession ? (
              <motion.div
                key="start"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Important notice */}
                <Card className="border-amber-500/30 bg-amber-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-amber-700">Atenção: Suporte Rápido</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Este canal é exclusivo para <strong>dúvidas rápidas e questões emergenciais</strong>. 
                          Não é destinado a reuniões demoradas. Caso identifiquemos que sua demanda requer 
                          maior atenção, <strong>agendaremos uma data específica</strong> para execução junto com você.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">Como funciona?</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ao solicitar suporte, nossa equipe será notificada imediatamente e entrará 
                          em contato com você através de uma videochamada do Google Meet.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={startSupportSession} disabled={loading}>
                    {loading ? "Solicitando..." : "Solicitar Atendimento"}
                  </Button>
                </DialogFooter>
              </motion.div>
            ) : activeSession.status === "waiting" ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Headphones className="h-8 w-8 text-amber-600 animate-pulse" />
                    </div>
                    <Badge variant="outline" className="border-amber-500 text-amber-600 mb-3">
                      Aguardando Atendimento
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Nossa equipe foi notificada e entrará em contato em breve.
                    </p>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-3">
                      <Clock className="h-3 w-3" />
                      Aguardando há {formatDistanceToNow(new Date(activeSession.started_at), { locale: ptBR })}
                    </div>
                  </CardContent>
                </Card>

                <DialogFooter>
                  <Button variant="destructive" onClick={cancelSession} disabled={loading}>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar Solicitação
                  </Button>
                </DialogFooter>
              </motion.div>
            ) : (
              <motion.div
                key="in_progress"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <Badge variant="outline" className="border-green-500 text-green-600 mb-3">
                      Atendimento Pronto
                    </Badge>
                    <p className="text-sm text-muted-foreground mb-4">
                      Um membro da equipe está pronto para atendê-lo!
                    </p>
                    <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" onClick={openMeetLink}>
                      <Video className="h-5 w-5 mr-2" />
                      Entrar na Videochamada
                    </Button>
                  </CardContent>
                </Card>

                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowDialog(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientSupportButton;
