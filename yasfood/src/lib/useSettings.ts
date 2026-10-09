import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Settings } from "./types";

const cache: { pub: Settings | null; full: Settings | null } = { pub: null, full: null };

/**
 * Configurações da loja.
 * - `full = false` (padrão): lê a view `public_settings` (sem webhook/mensagens internas). Funciona sem login.
 * - `full = true`: lê a tabela `settings` completa. Só pra páginas do painel (exige admin).
 */
export function useSettings(full = false) {
  const key = full ? "full" : "pub";
  const [settings, setSettings] = useState<Settings | null>(cache[key]);
  const [loading, setLoading] = useState(!cache[key]);

  const reload = async () => {
    const { data } = await supabase.from(full ? "settings" : "public_settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      cache[key] = data as Settings;
      if (full) cache.pub = data as Settings;
      setSettings(data as Settings);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!cache[key]) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { settings, loading, reload };
}
