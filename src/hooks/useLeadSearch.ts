import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { B2BLead } from "@/types/b2bProspection";

interface UseLeadSearchResult {
  results: B2BLead[];
  loading: boolean;
  search: (params: { niches: string[]; state?: string; city?: string; limit?: number }) => Promise<void>;
  clearResults: () => void;
}

export function useLeadSearch(): UseLeadSearchResult {
  const [results, setResults] = useState<B2BLead[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (params: { niches: string[]; state?: string; city?: string; limit?: number }) => {
    if (!params.niches.length) {
      toast.error("Selecione pelo menos um nicho");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("b2b-prospection", {
        body: params,
      });

      if (error) {
        console.error("Search error:", error);
        toast.error("Erro ao buscar leads. Tente novamente.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResults(data?.results || []);
      
      if (data?.results?.length === 0) {
        toast.info("Nenhum lead encontrado. Tente ajustar os filtros.");
      } else {
        toast.success(`${data.results.length} leads encontrados!`);
      }
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Erro ao buscar leads");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, loading, search, clearResults };
}
