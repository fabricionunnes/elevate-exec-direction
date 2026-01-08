import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Headphones, 
  Clock, 
  X,
  Video,
  CheckCircle2,
  AlertTriangle,
  Phone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SupportSession {
  id: string;
  status: "waiting" | "in_progress" | "completed" | "cancelled" | "timeout";
  meet_link: string | null;
  started_at: string;
  attended_at: string | null;
  timeout_at: string | null;
}

interface ClientSupportButtonProps {
  projectId: string;
  userId: string;
  userName: string;
  companyName: string;
}

const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export const ClientSupportButton = ({ 
  projectId, 
  userId, 
  userName, 
  companyName 
}: ClientSupportButtonProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [activeSession, setActiveSession] = useState<SupportSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchActiveSession();
    const unsubscribe = subscribeToSession();
    
    return () => {
      unsubscribe?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [projectId, userId]);

  // Handle countdown timer
  useEffect(() => {
    if (activeSession?.status === "waiting" && activeSession.timeout_at) {
      const timeoutDate = new Date(activeSession.timeout_at).getTime();
      
      // Update countdown every second
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, timeoutDate - now);
        setTimeRemaining(remaining);
        
        // Check if timeout has passed
        if (remaining <= 0) {
          handleTimeout();
        }
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setTimeRemaining(null);
    }
  }, [activeSession]);

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
          
          if (payload.eventType === "UPDATE") {
            const newSession = payload.new as SupportSession;
            setActiveSession(newSession);
            
            // Notify client when someone attends
            if (newSession.status === "in_progress" && newSession.meet_link) {
              toast.success("Um membro da equipe está pronto para atendê-lo!", {
                description: "Clique no botão para entrar na videochamada",
                duration: 10000,
              });
            }
            
            // Notify client when session times out
            if (newSession.status === "timeout") {
              setActiveSession(null);
              setShowDialog(false);
            }
          } else if (payload.eventType === "DELETE") {
            setActiveSession(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleTimeout = async () => {
    if (!activeSession || activeSession.status !== "waiting") return;
    
    try {
      const { error } = await supabase
        .from("support_room_sessions")
        .update({
          status: "timeout",
          ended_at: new Date().toISOString(),
        })
        .eq("id", activeSession.id)
        .eq("status", "waiting"); // Only update if still waiting

      if (error) throw error;
      
      setActiveSession(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      // Show timeout message to client
      toast.info("Tempo de espera excedido", {
        description: "Não se preocupe! Nossa equipe foi notificada e entrará em contato com você o mais breve possível.",
        duration: 10000,
      });
      
      setShowDialog(false);
    } catch (error) {
      console.error("Error handling timeout:", error);
    }
  };

  const startSupportSession = async () => {
    setLoading(true);
    try {
      const timeoutAt = new Date(Date.now() + TIMEOUT_DURATION).toISOString();
      
      const { data, error } = await supabase
        .from("support_room_sessions")
        .insert({
          project_id: projectId,
          user_id: userId,
          client_name: userName,
          company_name: companyName,
          status: "waiting",
          timeout_at: timeoutAt,
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
      if (intervalRef.current) clearInterval(intervalRef.current);
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

  const formatTimeRemaining = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = () => {
    if (!timeRemaining) return 100;
    return (timeRemaining / TIMEOUT_DURATION) * 100;
  };

  return (
    <>
      {/* Floating Support Button */}
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
                    
                    {/* Countdown Timer */}
                    {timeRemaining !== null && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                          <Clock className="h-5 w-5 text-amber-600" />
                          <span className={timeRemaining < 60000 ? "text-destructive" : "text-amber-600"}>
                            {formatTimeRemaining(timeRemaining)}
                          </span>
                        </div>
                        <Progress 
                          value={getProgressPercentage()} 
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {timeRemaining < 60000 
                            ? "Tempo quase esgotando..." 
                            : "Tempo de espera estimado"
                          }
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <DialogFooter>
                  <Button variant="destructive" onClick={cancelSession} disabled={loading}>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar Solicitação
                  </Button>
                </DialogFooter>
              </motion.div>
            ) : activeSession.status === "in_progress" ? (
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
            ) : (
              <motion.div
                key="timeout"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Phone className="h-8 w-8 text-blue-600" />
                    </div>
                    <Badge variant="outline" className="border-blue-500 text-blue-600 mb-3">
                      Entraremos em Contato
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Não foi possível atendê-lo no momento. Nossa equipe foi notificada e entrará 
                      em contato com você o mais breve possível.
                    </p>
                  </CardContent>
                </Card>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
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
