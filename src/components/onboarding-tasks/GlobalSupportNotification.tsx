import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Headphones, FolderOpen, AlertTriangle } from "lucide-react";
import { playNotificationSound } from "@/lib/notificationSound";

interface SupportSession {
  id: string;
  project_id: string;
  client_name: string;
  company_name: string | null;
  status: "waiting" | "in_progress" | "completed" | "cancelled" | "timeout";
  started_at: string;
  timeout_at: string | null;
}

export const GlobalSupportNotification = () => {
  const navigate = useNavigate();
  const [activeToasts, setActiveToasts] = useState<Map<string, string | number>>(new Map());
  const hasCheckedInitial = useRef(false);

  // Dismiss toast for a specific session
  const dismissSessionToast = (sessionId: string) => {
    const toastId = activeToasts.get(sessionId);
    if (toastId) {
      toast.dismiss(toastId);
      setActiveToasts(prev => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
    }
  };

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

        // Show notification for each waiting session
        if (data && data.length > 0) {
          data.forEach((session) => {
            if (!activeToasts.has(session.id)) {
              showSupportNotification(session as SupportSession);
            }
          });
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
          
          // Only show notification for new waiting sessions
          if (session.status === "waiting" && !activeToasts.has(session.id)) {
            playNotificationSound();
            showSupportNotification(session);
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
          
          // Dismiss notification when session is no longer waiting
          if (session.status !== "waiting") {
            dismissSessionToast(session.id);
          }

          // Show timeout escalation notification for admins
          if (session.status === "timeout") {
            showTimeoutEscalationNotification(session);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeToasts]);

  const showTimeoutEscalationNotification = (session: SupportSession) => {
    const clientName = session.client_name || "Cliente";
    const companyName = session.company_name || "Empresa";

    playNotificationSound();

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
        duration: 60000, // 60 seconds for escalation
        position: "top-right",
      }
    );
  };

  const showSupportNotification = (session: SupportSession) => {
    const clientName = session.client_name || "Cliente";
    const companyName = session.company_name || "Empresa";

    const toastId = toast.custom(
      (t) => (
        <div className="bg-background border border-primary/30 shadow-lg rounded-lg p-4 max-w-md w-full animate-in slide-in-from-right">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 animate-pulse">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">🆘 Cliente Aguardando Suporte</h4>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">{clientName}</span> de{" "}
                <span className="font-medium">{companyName}</span> está aguardando atendimento.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    toast.dismiss(t);
                    navigate("/onboarding-tasks/office", { state: { openSupport: true } });
                  }}
                >
                  <Headphones className="h-4 w-4 mr-1" />
                  Ir para Suporte
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast.dismiss(t);
                    navigate(`/onboarding-tasks/project/${session.project_id}`, { 
                      state: { supportSessionId: session.id } 
                    });
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
        duration: Infinity, // Keep until dismissed or status changes
        position: "top-right",
      }
    );

    setActiveToasts(prev => new Map(prev).set(session.id, toastId));
  };

  return null;
};

export default GlobalSupportNotification;
