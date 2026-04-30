import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/**
 * Storage adapter para o Supabase Auth.
 *
 * - No navegador (web/PWA) usa localStorage normalmente.
 * - Em apps nativos (Capacitor: iOS, Android, Desktop wrapper) usa
 *   @capacitor/preferences, que persiste no armazenamento nativo do
 *   dispositivo. Isso garante que a sessão de login NÃO seja perdida
 *   ao fechar e reabrir o aplicativo.
 *
 * Implementa a interface esperada pelo supabase-js (getItem/setItem/removeItem).
 * Pode retornar Promise — o supabase-js aceita storage assíncrono.
 */

const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform?.();

export const authStorage = isNative
  ? {
      async getItem(key: string): Promise<string | null> {
        const { value } = await Preferences.get({ key });
        return value ?? null;
      },
      async setItem(key: string, value: string): Promise<void> {
        await Preferences.set({ key, value });
      },
      async removeItem(key: string): Promise<void> {
        await Preferences.remove({ key });
      },
    }
  : {
      getItem(key: string) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem(key: string, value: string) {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          /* ignore */
        }
      },
      removeItem(key: string) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      },
    };
