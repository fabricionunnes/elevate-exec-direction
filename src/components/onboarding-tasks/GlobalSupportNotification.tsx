import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Headphones, ExternalLink, FolderOpen } from "lucide-react";

interface SupportSession {
  id: string;
  project_id: string;
  client_name: string;
  company_name: string | null;
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  started_at: string;
}

export const GlobalSupportNotification = () => {
  const navigate = useNavigate();
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Subscribe to new support sessions
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
          if (session.status === "waiting" && !shownNotifications.has(session.id)) {
            showSupportNotification(session);
            setShownNotifications(prev => new Set([...prev, session.id]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shownNotifications]);

  const showSupportNotification = (session: SupportSession) => {
    const clientName = session.client_name || "Cliente";
    const companyName = session.company_name || "Empresa";

    toast.custom(
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
        duration: 30000, // 30 seconds
        position: "top-right",
      }
    );
  };

  return null; // This component doesn't render anything visible
};

export default GlobalSupportNotification;
