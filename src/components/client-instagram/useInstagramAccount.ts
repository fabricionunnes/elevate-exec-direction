import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { InstagramAccount } from "./types";

export function useInstagramAccount(projectId: string | undefined) {
  const [account, setAccount] = useState<InstagramAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccount = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "connected")
        .maybeSingle();
      if (error) throw error;
      setAccount(data as InstagramAccount | null);
    } catch (err) {
      console.error("Error fetching instagram account:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  return { account, loading, refetch: fetchAccount };
}
