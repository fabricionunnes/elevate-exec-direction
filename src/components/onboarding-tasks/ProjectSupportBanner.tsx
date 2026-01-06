import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Headphones, Video, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface SupportSession {
  id: string;
  client_name: string;
  company_name: string | null;
  status: "waiting" | "in_progress" | "completed" | "cancelled";
  started_at: string;
  meet_link: string | null;
}

interface ProjectSupportBannerProps {
  projectId: string;
}

export const ProjectSupportBanner = ({ projectId }: ProjectSupportBannerProps) => {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<SupportSession | null>(null);

  useEffect(() => {
    fetchActiveSession();
    subscribeToSessions();
  }, [projectId]);

  const fetchActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from("support_room_sessions")
        .select("*")
        .eq("project_id", projectId)
        .in("status", ["waiting", "in_progress"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveSession(data as SupportSession | null);
    } catch (error) {
      console.error("Error fetching active support session:", error);
    }
  };

  const subscribeToSessions = () => {
    const channel = supabase
      .channel(`project-support-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_room_sessions",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchActiveSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const goToSupport = () => {
    navigate("/onboarding-tasks/office", { state: { openSupport: true } });
  };

  if (!activeSession) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`
          mb-4 p-3 rounded-lg border flex items-center justify-between gap-4
          ${activeSession.status === "waiting" 
            ? "bg-amber-500/10 border-amber-500/30" 
            : "bg-green-500/10 border-green-500/30"
          }
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            p-2 rounded-full
            ${activeSession.status === "waiting" 
              ? "bg-amber-500/20 animate-pulse" 
              : "bg-green-500/20"
            }
          `}>
            <Headphones className={`h-5 w-5 ${
              activeSession.status === "waiting" ? "text-amber-600" : "text-green-600"
            }`} />
          </div>
          <div>
            <p className="font-medium text-sm">
              {activeSession.status === "waiting" 
                ? "🆘 Cliente aguardando suporte" 
                : "📞 Atendimento em andamento"
              }
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{activeSession.client_name}</span>
              {" · "}
              <Clock className="h-3 w-3 inline" />{" "}
              {formatDistanceToNow(new Date(activeSession.started_at), { 
                locale: ptBR, 
                addSuffix: true 
              })}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          className={
            activeSession.status === "waiting"
              ? "bg-amber-500 hover:bg-amber-600"
              : "bg-green-600 hover:bg-green-700"
          }
          onClick={goToSupport}
        >
          <Video className="h-4 w-4 mr-1" />
          {activeSession.status === "waiting" ? "Atender Cliente" : "Ver Chamada"}
        </Button>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProjectSupportBanner;
