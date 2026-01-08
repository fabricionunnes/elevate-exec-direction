import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Headphones, FolderOpen, AlertTriangle, Phone, X } from "lucide-react";
import { startPhoneRing, stopPhoneRing } from "@/lib/phoneRingSound";
import { motion, AnimatePresence } from "framer-motion";

interface SupportSession {
  id: string;
  project_id: string;
  client_name: string;
  company_name: string | null;
  status: "waiting" | "in_progress" | "completed" | "cancelled" | "timeout";
  started_at: string;
  timeout_at: string | null;
}

// Fullscreen phone ringing overlay component
const PhoneRingingOverlay = ({ 
  session, 
  onGoToSupport, 
  onGoToProject, 
  onDismiss 
}: { 
  session: SupportSession; 
  onGoToSupport: () => void;
  onGoToProject: () => void;
  onDismiss: () => void;
}) => {
  const clientName = session.client_name || "Cliente";
  const companyName = session.company_name || "Empresa";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-background border-2 border-primary/50 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-primary/20"
      >
        {/* Ringing phone icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ 
              rotate: [-15, 15, -15],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 0.3, 
              repeat: Infinity,
              repeatType: "reverse"
            }}
            className="relative"
          >
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
              <Phone className="h-12 w-12 text-primary" />
            </div>
            {/* Pulse rings */}
            <motion.div
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 rounded-full border-2 border-primary"
            />
            <motion.div
              animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
              className="absolute inset-0 rounded-full border-2 border-primary"
            />
          </motion.div>
        </div>

        {/* Badge */}
        <div className="flex justify-center mb-4">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-sm px-4 py-1">
            🆘 Suporte Solicitado
          </Badge>
        </div>

        {/* Client info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Cliente Aguardando</h2>
          <p className="text-lg text-muted-foreground">
            <span className="font-semibold text-foreground">{clientName}</span>
          </p>
          <p className="text-muted-foreground">
            de <span className="font-medium">{companyName}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Button 
            size="lg" 
            className="w-full h-14 text-lg gap-2"
            onClick={onGoToSupport}
          >
            <Headphones className="h-5 w-5" />
            Atender Agora
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="w-full h-12 gap-2"
            onClick={onGoToProject}
          >
            <FolderOpen className="h-4 w-4" />
            Ver Projeto
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="h-4 w-4 mr-1" />
            Dispensar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const GlobalSupportNotification = () => {
  const navigate = useNavigate();
  const [waitingSessions, setWaitingSessions] = useState<SupportSession[]>([]);
  const [dismissedSessions, setDismissedSessions] = useState<Set<string>>(new Set());
  const hasCheckedInitial = useRef(false);

  // Get current session to display (first non-dismissed waiting session)
  const currentSession = waitingSessions.find(s => !dismissedSessions.has(s.id));

  // Manage phone ringing sound
  useEffect(() => {
    if (currentSession) {
      startPhoneRing();
    } else {
      stopPhoneRing();
    }

    return () => {
      stopPhoneRing();
    };
  }, [currentSession?.id]);

  // Check for existing waiting sessions on mount
  useEffect(() => {
    if (hasCheckedInitial.current) return;
    hasCheckedInitial.current = true;

    const checkExistingSessions = async () => {
      try {
        const { data, error } = await supabase
          .from("support_room_sessions")
          .select("*")
          .eq("status", "waiting")
          .order("started_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setWaitingSessions(data as SupportSession[]);
        }
      } catch (error) {
        console.error("Error checking existing support sessions:", error);
      }
    };

    checkExistingSessions();
  }, []);

  // Subscribe to support session changes
  useEffect(() => {
    const channel = supabase
      .channel("global-support-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_room_sessions",
        },
        (payload) => {
          const session = payload.new as SupportSession;
          
          if (session.status === "waiting") {
            setWaitingSessions(prev => [session, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_room_sessions",
        },
        (payload) => {
          const session = payload.new as SupportSession;
          
          // Remove from waiting list when no longer waiting
          if (session.status !== "waiting") {
            setWaitingSessions(prev => prev.filter(s => s.id !== session.id));
            setDismissedSessions(prev => {
              const newSet = new Set(prev);
              newSet.delete(session.id);
              return newSet;
            });
          }

          // Show timeout escalation notification
          if (session.status === "timeout") {
            showTimeoutEscalationNotification(session);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showTimeoutEscalationNotification = (session: SupportSession) => {
    const clientName = session.client_name || "Cliente";
    const companyName = session.company_name || "Empresa";

    toast.custom(
      (t) => (
        <div className="bg-destructive/10 border border-destructive/30 shadow-lg rounded-lg p-4 max-w-md w-full animate-in slide-in-from-right">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-destructive">⚠️ Suporte Não Atendido</h4>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">{clientName}</span> de{" "}
                <span className="font-medium">{companyName}</span> aguardou 5 minutos e não foi atendido.
              </p>
              <p className="text-xs text-destructive/80 mt-2 font-medium">
                Por favor, entre em contato com o cliente o mais rápido possível!
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    toast.dismiss(t);
                    navigate(`/onboarding-tasks/project/${session.project_id}`);
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Ver Projeto
                </Button>
              </div>
            </div>
            <button
              onClick={() => toast.dismiss(t)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      ),
      {
        duration: 60000,
        position: "top-right",
      }
    );
  };

  const handleGoToSupport = () => {
    if (currentSession) {
      stopPhoneRing();
      setDismissedSessions(prev => new Set(prev).add(currentSession.id));
      navigate("/onboarding-tasks/office", { state: { openSupport: true } });
    }
  };

  const handleGoToProject = () => {
    if (currentSession) {
      stopPhoneRing();
      setDismissedSessions(prev => new Set(prev).add(currentSession.id));
      navigate(`/onboarding-tasks/project/${currentSession.project_id}`, { 
        state: { supportSessionId: currentSession.id } 
      });
    }
  };

  const handleDismiss = () => {
    if (currentSession) {
      stopPhoneRing();
      setDismissedSessions(prev => new Set(prev).add(currentSession.id));
    }
  };

  return (
    <AnimatePresence>
      {currentSession && (
        <PhoneRingingOverlay
          session={currentSession}
          onGoToSupport={handleGoToSupport}
          onGoToProject={handleGoToProject}
          onDismiss={handleDismiss}
        />
      )}
    </AnimatePresence>
  );
};

export default GlobalSupportNotification;
