/**
 * Storage adapter para Supabase Auth.
 *
 * Em apps nativos (Capacitor iOS/Android), o WebView pode limpar o localStorage
 * entre sessões, fazendo o usuário precisar logar de novo toda vez que abre o app.
 *
 * Para resolver isso, usamos @capacitor/preferences (que persiste em
 * NSUserDefaults no iOS e SharedPreferences no Android) como storage primário
 * em apps nativos, mantendo localStorage no web.
 *
 * O adapter é síncrono no spec do Supabase, mas o Supabase aceita storage assíncrono
 * (interface { getItem, setItem, removeItem } pode retornar Promise).
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const isNative = Capacitor.isNativePlatform();

// Cache em memória para acelerar leituras síncronas e evitar flicker
const memoryCache = new Map<string, string>();

export const capacitorStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative) {
      try {
        return localStorage.getItem(key);
      } catch {
        return memoryCache.get(key) ?? null;
      }
    }
    // Native: try Preferences first, fallback to localStorage (migração)
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null && value !== undefined) {
        memoryCache.set(key, value);
        return value;
      }
      // Migração: se ainda existe no localStorage, copia para Preferences
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          await Preferences.set({ key, value: legacy });
          memoryCache.set(key, legacy);
          return legacy;
        }
      } catch {}
      return null;
    } catch (e) {
      console.warn("[capacitorStorage] getItem error:", e);
      return memoryCache.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryCache.set(key, value);
    if (!isNative) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn("[capacitorStorage] localStorage.setItem error:", e);
      }
      return;
    }
    try {
      await Preferences.set({ key, value });
      // Também grava em localStorage como redundância
      try {
        localStorage.setItem(key, value);
      } catch {}
    } catch (e) {
      console.warn("[capacitorStorage] setItem error:", e);
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryCache.delete(key);
    if (!isNative) {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }
    try {
      await Preferences.remove({ key });
      try {
        localStorage.removeItem(key);
      } catch {}
    } catch (e) {
      console.warn("[capacitorStorage] removeItem error:", e);
    }
  },
};
