import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook global para manter o status de presença do usuário como "online"
 * enquanto estiver logado no sistema, independente da página atual.
 */
export const useGlobalPresence = (staffId: string | null) => {
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!staffId) return;

    const updatePresence = async (status: "online" | "offline") => {
      try {
        await supabase
          .from("virtual_office_presence")
          .upsert({
            staff_id: staffId,
            status,
            last_seen_at: new Date().toISOString(),
          }, { onConflict: "staff_id" });
      } catch (error) {
        console.error("Error updating global presence:", error);
      }
    };

    // Marca como online ao iniciar
    updatePresence("online");

    // Atualiza presença a cada 2 minutos para manter vivo
    presenceIntervalRef.current = setInterval(() => {
      updatePresence("online");
    }, 2 * 60 * 1000);

    // Marca como offline ao sair da página
    const handleBeforeUnload = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/virtual_office_presence?staff_id=eq.${staffId}`;
      const data = JSON.stringify({ 
        status: "offline", 
        last_seen_at: new Date().toISOString() 
      });
      
      navigator.sendBeacon(url, new Blob([data], { type: "application/json" }));
    };

    // Marca como offline ao perder visibilidade (trocar de aba por muito tempo)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Não marca offline imediatamente, só para de atualizar
      } else {
        // Volta a marcar online quando a aba fica visível
        updatePresence("online");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Marca como offline ao desmontar
      updatePresence("offline");
    };
  }, [staffId]);
};
