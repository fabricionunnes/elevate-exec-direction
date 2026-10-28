// Adaptador: o escritório 3D usa o client Supabase do próprio Nexus,
// então a sessão de login do usuário vale aqui dentro.
import { supabase } from "@/integrations/supabase/client";

export { supabase };

// Cérebro dos agentes: ai-team-chat (Time de IA). O agente-unv antigo segue nos
// canais Telegram/WhatsApp e na reunião matinal.
export const AGENT_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-team-chat`;

// Token da sessão logada — a edge function exige usuário staff master
export async function getAgentAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
