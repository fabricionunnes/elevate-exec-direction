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
import { supabase } from "@/integrations/supabase/client";
import {
  AUTH_STORAGE_KEY,
  persistentAuthStorage,
  restoreAuthSession,
  syncPersistentAuthStorage,
} from "@/lib/persistentAuthStorage";

let patched = false;

export async function setupNativeAuthPersistence(): Promise<void> {
  if (patched) return;
  patched = true;

  try {
    await syncPersistentAuthStorage();

    // Substitui o storage do GoTrue client por um proxy persistente.
    // O GoTrue lê via `this.storage`, então monkey-patch funciona.
    try {
      // @ts-expect-error - acesso interno ao client de auth
      supabase.auth.storage = persistentAuthStorage;
    } catch (e) {
      console.warn("[nativeAuth] could not patch auth.storage:", e);
    }

    await restoreAuthSession(supabase);

    // Persiste mudanças futuras de sessão fora do sessionStorage.
    supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
      try {
        if (session) {
          await persistentAuthStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        } else {
          await persistentAuthStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (e) {
        console.warn("[nativeAuth] persist session error:", e);
      }
      })();
    });
  } catch (e) {
    console.warn("[nativeAuth] setup error:", e);
  }
}
