import { persistentAuthStorage } from "@/lib/persistentAuthStorage";

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

export const authStorage = persistentAuthStorage;
