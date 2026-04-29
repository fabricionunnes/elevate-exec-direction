import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const SUPABASE_PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID || "czmyjgdixwhpfasfugkm";
export const AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const COOKIE_CHUNK_SIZE = 1800;
const MAX_COOKIE_CHUNKS = 12;

const memoryCache = new Map<string, string>();
const isNative = Capacitor.isNativePlatform();

const canUseDOM = () => typeof window !== "undefined" && typeof document !== "undefined";

const getCookieDomain = () => {
  if (!canUseDOM()) return "";
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "unvholdings.com.br" || hostname.endsWith(".unvholdings.com.br")
    ? "; Domain=unvholdings.com.br"
    : "";
};

const cookieOptions = (maxAge: number) => {
  const secure = canUseDOM() && window.location.protocol === "https:" ? "; Secure" : "";
  return `; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}${getCookieDomain()}`;
};

const getLocalStorageItem = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalStorageItem = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // WebViews can disable localStorage; cookie fallback below keeps the session.
  }
};

const removeLocalStorageItem = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {}
};

const readCookie = (name: string) => {
  if (!canUseDOM()) return null;
  const encodedName = `${encodeURIComponent(name)}=`;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  return item ? decodeURIComponent(item.slice(encodedName.length)) : null;
};

const writeCookie = (name: string, value: string, maxAge = COOKIE_MAX_AGE_SECONDS) => {
  if (!canUseDOM()) return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${cookieOptions(maxAge)}`;
};

const clearCookie = (name: string) => writeCookie(name, "", 0);

const readChunkedCookie = (key: string) => {
  const chunkCount = Number(readCookie(`${key}.chunks`) || "0");
  if (chunkCount > 0) {
    let value = "";
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = readCookie(`${key}.${index}`);
      if (chunk === null) return null;
      value += chunk;
    }
    return value;
  }
  return readCookie(key);
};

const writeChunkedCookie = (key: string, value: string) => {
  clearChunkedCookie(key);

  if (value.length <= COOKIE_CHUNK_SIZE) {
    writeCookie(key, value);
    writeCookie(`${key}.chunks`, "0");
    return;
  }

  const chunks = value.match(new RegExp(`.{1,${COOKIE_CHUNK_SIZE}}`, "g")) || [];
  chunks.slice(0, MAX_COOKIE_CHUNKS).forEach((chunk, index) => writeCookie(`${key}.${index}`, chunk));
  writeCookie(`${key}.chunks`, String(Math.min(chunks.length, MAX_COOKIE_CHUNKS)));
};

const clearChunkedCookie = (key: string) => {
  clearCookie(key);
  clearCookie(`${key}.chunks`);
  for (let index = 0; index < MAX_COOKIE_CHUNKS; index += 1) {
    clearCookie(`${key}.${index}`);
  }
};

export const persistentAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isNative) {
      try {
        const { value } = await Preferences.get({ key });
        if (value) {
          memoryCache.set(key, value);
          return value;
        }
      } catch {}
    }

    const localValue = getLocalStorageItem(key);
    if (localValue) {
      memoryCache.set(key, localValue);
      return localValue;
    }

    const cookieValue = readChunkedCookie(key);
    if (cookieValue) {
      memoryCache.set(key, cookieValue);
      setLocalStorageItem(key, cookieValue);
      if (isNative) void Preferences.set({ key, value: cookieValue });
      return cookieValue;
    }

    return memoryCache.get(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryCache.set(key, value);
    setLocalStorageItem(key, value);
    writeChunkedCookie(key, value);

    if (isNative) {
      try {
        await Preferences.set({ key, value });
      } catch (error) {
        console.warn("[persistentAuthStorage] Preferences.set error:", error);
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryCache.delete(key);
    removeLocalStorageItem(key);
    clearChunkedCookie(key);

    if (isNative) {
      try {
        await Preferences.remove({ key });
      } catch {}
    }
  },
};

export async function syncPersistentAuthStorage(): Promise<void> {
  const stored = await persistentAuthStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    await persistentAuthStorage.setItem(AUTH_STORAGE_KEY, stored);
  }
}

export async function restoreAuthSession(supabaseClient: any): Promise<void> {
  const { data } = await supabaseClient.auth.getSession();
  if (data?.session) return;

  const rawSession = await persistentAuthStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) return;

  try {
    const parsed = JSON.parse(rawSession);
    const session = parsed?.currentSession ?? parsed;
    if (session?.access_token && session?.refresh_token) {
      await supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  } catch (error) {
    console.warn("[persistentAuthStorage] session restore error:", error);
  }
}
