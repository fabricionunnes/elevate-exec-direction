import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AccessTrackingOptions {
  userId: string;
  userEmail?: string;
  userName?: string;
  projectId?: string;
  companyId?: string;
}

/**
 * Hook para rastrear o acesso do cliente ao sistema
 * Registra login, logout e calcula duração da sessão
 */
export const useClientAccessTracking = (options: AccessTrackingOptions | null) => {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    if (!options?.userId) return;

    const createAccessLog = async () => {
      try {
        const result = await supabase
          .from("client_access_logs" as any)
          .insert({
            user_id: options.userId,
            project_id: options.projectId || null,
            company_id: options.companyId || null,
            user_email: options.userEmail || null,
            user_name: options.userName || null,
            login_at: new Date().toISOString(),
            is_active: true,
            user_agent: navigator.userAgent,
          })
          .single();

        const data = (result.data as unknown) as { id: string } | null;
        const error = result.error;

        if (error) {
          console.warn("Error creating access log:", error.message);
          return;
        }

        if (data && isMounted.current) {
          sessionIdRef.current = data.id;
          startTimeRef.current = new Date();
        }
      } catch (error) {
        console.warn("Error in access tracking:", error);
      }
    };

    createAccessLog();

    // Atualizar ao sair da página
    const handleBeforeUnload = () => {
      if (sessionIdRef.current && startTimeRef.current) {
        const endTime = new Date();
        const durationMinutes = Math.round(
          (endTime.getTime() - startTimeRef.current.getTime()) / 60000
        );

        // Usar sendBeacon para garantir que a requisição seja enviada
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/client_access_logs?id=eq.${sessionIdRef.current}`;
        const data = JSON.stringify({
          logout_at: endTime.toISOString(),
          session_duration_minutes: durationMinutes,
          is_active: false,
        });

        navigator.sendBeacon(
          url,
          new Blob([data], { type: "application/json" })
        );
      }
    };

    // Atualizar ao mudar visibilidade (para detectar quando usuário fecha aba)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleBeforeUnload();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted.current = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Finalizar sessão ao desmontar
      if (sessionIdRef.current && startTimeRef.current) {
        const endTime = new Date();
        const durationMinutes = Math.round(
          (endTime.getTime() - startTimeRef.current.getTime()) / 60000
        );

        supabase
          .from("client_access_logs" as any)
          .update({
            logout_at: endTime.toISOString(),
            session_duration_minutes: durationMinutes,
            is_active: false,
          })
          .eq("id", sessionIdRef.current)
          .then(() => {});
      }
    };
  }, [options?.userId, options?.projectId, options?.companyId]);
};
