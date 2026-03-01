import { supabase } from "@/integrations/supabase/client";

let cachedDefaultInstance: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getDefaultWhatsAppInstance(): Promise<string> {
  const now = Date.now();
  if (cachedDefaultInstance && now - cacheTimestamp < CACHE_TTL) {
    return cachedDefaultInstance;
  }

  const { data } = await supabase
    .from("whatsapp_default_config")
    .select("setting_value")
    .eq("setting_key", "default_instance")
    .maybeSingle();

  cachedDefaultInstance = data?.setting_value || "fabricionunnes";
  cacheTimestamp = now;
  return cachedDefaultInstance;
}

export function invalidateDefaultInstanceCache() {
  cachedDefaultInstance = null;
  cacheTimestamp = 0;
}
