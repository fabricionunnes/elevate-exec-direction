import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém o token do Google Calendar sincronizado no backend.
 *
 * Por quê:
 * - O OAuth do Google devolve provider_token/provider_refresh_token na sessão.
 * - Precisamos salvar isso no backend para conseguir criar eventos/links de Meet.
 * - Este hook faz isso globalmente (não depende de estar na aba "Minha Agenda").
 */
export function useGoogleCalendarTokenSync() {
  const lastSavedAccessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const saveIfNeeded = async (session: any) => {
      const accessToken: string | null = session?.provider_token ?? null;
      const refreshToken: string | null = session?.provider_refresh_token ?? null;

      if (!accessToken) return;
      if (lastSavedAccessTokenRef.current === accessToken) return;

      try {
        await supabase.functions.invoke("google-calendar?action=save-token", {
          body: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 3600,
          },
        });

        if (!active) return;
        lastSavedAccessTokenRef.current = accessToken;
      } catch (error) {
        // Sem toast aqui para não poluir a UI global; o fluxo local mostra feedback.
        console.error("[useGoogleCalendarTokenSync] Failed to save Google token:", error);
      }
    };

    // 1) Tenta salvar já na montagem (se a sessão atual tiver provider_token)
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void saveIfNeeded(data?.session);
    });

    // 2) Salva quando o auth muda (ex: retorno do OAuth / refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void saveIfNeeded(session);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
}
