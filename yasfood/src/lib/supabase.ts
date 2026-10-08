import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "https://placeholder.supabase.co", key ?? "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Converte erro do Postgres/RPC em mensagem amigável (as functions lançam "CODIGO: mensagem"). */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const m = msg.match(/^(?:[A-Z_]+:\s*)?(.+)$/);
  const text = m ? m[1] : msg;
  if (/fetch|network/i.test(text)) return "Sem conexão. Tenta de novo em instantes.";
  if (/Invalid login credentials/i.test(text)) return "E-mail ou senha incorretos.";
  return text.replace(/^[A-Z_]+:\s*/, "");
}
