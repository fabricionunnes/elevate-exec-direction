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

    const saveIfNeeded = async (session: any, source: string) => {
      const accessToken: string | null = session?.provider_token ?? null;
      const refreshToken: string | null = session?.provider_refresh_token ?? null;

      console.log(`[GoogleCalTokenSync] saveIfNeeded called from: ${source}`, {
        hasSession: !!session,
        hasProviderToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        userId: session?.user?.id?.substring(0, 8),
      });

      if (!accessToken) {
        console.log("[GoogleCalTokenSync] No provider_token in session, skipping save.");
        return;
      }
      if (lastSavedAccessTokenRef.current === accessToken) {
        console.log("[GoogleCalTokenSync] Token already saved, skipping.");
        return;
      }

      try {
        console.log("[GoogleCalTokenSync] Saving token to backend...");
        const { data, error } = await supabase.functions.invoke("google-calendar?action=save-token", {
          body: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 3600,
          },
        });

        if (error) {
          console.error("[GoogleCalTokenSync] Edge function error:", error);
          return;
        }

        if (!active) return;
        lastSavedAccessTokenRef.current = accessToken;
        console.log("[GoogleCalTokenSync] Token saved successfully!", data);
      } catch (error) {
        console.error("[GoogleCalTokenSync] Failed to save Google token:", error);
      }
    };

    // 1) Tenta salvar já na montagem (se a sessão atual tiver provider_token)
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void saveIfNeeded(data?.session, "getSession");
    });

    // 2) Salva quando o auth muda (ex: retorno do OAuth / refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      console.log(`[GoogleCalTokenSync] Auth event: ${event}`, {
        hasProviderToken: !!session?.provider_token,
        hasRefreshToken: !!session?.provider_refresh_token,
      });
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void saveIfNeeded(session, `onAuthStateChange:${event}`);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
}
