import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Settings } from "./types";

let cache: Settings | null = null;

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(cache);
  const [loading, setLoading] = useState(!cache);

  const reload = async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      cache = data as Settings;
      setSettings(cache);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!cache) void reload();
  }, []);

  return { settings, loading, reload };
}
