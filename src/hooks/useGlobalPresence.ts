import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook global para manter o status de presença do usuário como "online"
 * enquanto estiver logado no sistema, independente da página atual.
 */
export const useGlobalPresence = (staffId: string | null) => {
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    if (!staffId) return;

    const updatePresence = async (status: "online" | "offline") => {
      try {
        // Check if table exists and we have permission
        const { error } = await supabase
          .from("virtual_office_presence")
          .upsert({
            staff_id: staffId,
            status,
            last_seen_at: new Date().toISOString(),
          }, { onConflict: "staff_id" });
        
        if (error) {
          // Silently fail - table might not exist or user might not have permission
          console.warn("Presence update skipped:", error.message);
        }
      } catch (error) {
        // Silently fail to prevent app crashes
        console.warn("Error updating global presence:", error);
      }
    };

    // Marca como online ao iniciar (com delay para evitar race conditions)
    const initTimeout = setTimeout(() => {
      if (isMounted.current) {
        updatePresence("online");
      }
    }, 500);

    // Atualiza presença a cada 2 minutos para manter vivo
    presenceIntervalRef.current = setInterval(() => {
      if (isMounted.current) {
        updatePresence("online");
      }
    }, 2 * 60 * 1000);

    // Marca como offline ao sair da página
    const handleBeforeUnload = () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/virtual_office_presence?staff_id=eq.${staffId}`;
        const data = JSON.stringify({ 
          status: "offline", 
          last_seen_at: new Date().toISOString() 
        });
        
        navigator.sendBeacon(url, new Blob([data], { type: "application/json" }));
      } catch (e) {
        // Ignore errors on unload
      }
    };

    // Marca como offline ao perder visibilidade (trocar de aba por muito tempo)
    const handleVisibilityChange = () => {
      if (!isMounted.current) return;
      
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
      isMounted.current = false;
      clearTimeout(initTimeout);
      
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
