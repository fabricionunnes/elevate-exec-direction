/**
 * Patcha o Supabase Auth para usar Capacitor Preferences como storage em apps nativos.
 *
 * O arquivo src/integrations/supabase/client.ts é auto-gerado e sempre usa
 * `storage: localStorage`. No Capacitor (iOS/Android), o WebView pode limpar
 * o localStorage entre sessões, derrubando o login.
 *
 * Este módulo é importado bem cedo (antes do App montar) e:
 *  1) Substitui a referência do auth.storage do client por um adapter persistente
 *  2) Migra qualquer sessão existente do localStorage para o Preferences
 *  3) Reidrata a sessão a partir do storage persistente
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";
import { capacitorStorage } from "@/lib/capacitorStorage";

const SUPABASE_PROJECT_REF = "czmyjgdixwhpfasfugkm";
const AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

let patched = false;

export async function setupNativeAuthPersistence(): Promise<void> {
  if (patched) return;
  patched = true;

  if (!Capacitor.isNativePlatform()) {
    return; // No web puro, localStorage já basta
  }

  try {
    // 1) Migra sessão do localStorage (se existir) para Preferences
    try {
      const legacy = localStorage.getItem(AUTH_STORAGE_KEY);
      if (legacy) {
        const existing = await Preferences.get({ key: AUTH_STORAGE_KEY });
        if (!existing.value) {
          await Preferences.set({ key: AUTH_STORAGE_KEY, value: legacy });
        }
      }
    } catch (e) {
      console.warn("[nativeAuth] migration error:", e);
    }

    // 2) Substitui o storage do GoTrue client por um proxy persistente.
    // O GoTrue lê via `this.storage`, então monkey-patch funciona.
    try {
      // @ts-expect-error - acesso interno ao client de auth
      supabase.auth.storage = capacitorStorage;
    } catch (e) {
      console.warn("[nativeAuth] could not patch auth.storage:", e);
    }

    // 3) Reidrata a sessão a partir do Preferences caso o localStorage esteja vazio
    try {
      const { value } = await Preferences.get({ key: AUTH_STORAGE_KEY });
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const session = parsed?.currentSession ?? parsed;
          if (session?.access_token && session?.refresh_token) {
            await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          }
        } catch (e) {
          console.warn("[nativeAuth] parse session error:", e);
        }
      }
    } catch (e) {
      console.warn("[nativeAuth] rehydrate error:", e);
    }

    // 4) Persiste mudanças futuras de sessão no Preferences
    supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session) {
          await Preferences.set({
            key: AUTH_STORAGE_KEY,
            value: JSON.stringify(session),
          });
        } else {
          await Preferences.remove({ key: AUTH_STORAGE_KEY });
        }
      } catch (e) {
        console.warn("[nativeAuth] persist session error:", e);
      }
    });
  } catch (e) {
    console.warn("[nativeAuth] setup error:", e);
  }
}
