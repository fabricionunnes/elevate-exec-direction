import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { B2BSavedList, B2BLead } from "@/types/b2bProspection";

export function useSavedLists() {
  const [lists, setLists] = useState<B2BSavedList[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("b2b_saved_lists")
        .select("*")
        .order("created_at", { ascending: false });
      setLists((data || []) as B2BSavedList[]);
    } catch (err) {
      console.error("Error fetching lists:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const createList = useCallback(async (name: string, leads: B2BLead[], description?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: list, error } = await supabase
        .from("b2b_saved_lists")
        .insert({ user_id: user.id, name, description: description || null, lead_count: leads.length })
        .select()
        .single();

      if (error) throw error;

      if (leads.length > 0) {
        const leadsToInsert = leads.map(l => ({
          user_id: user.id,
          list_id: list.id,
          place_id: l.place_id,
          name: l.name,
          segment: l.segment,
          phone: l.phone,
          address: l.address,
          city: l.city,
          state: l.state,
          website: l.website,
          google_rating: l.google_rating,
          status: l.status || "new",
        }));

        await supabase.from("b2b_leads").insert(leadsToInsert);
      }

      toast.success(`Lista "${name}" salva com ${leads.length} leads!`);
      fetchLists();
      return list;
    } catch (err) {
      console.error("Error creating list:", err);
      toast.error("Erro ao salvar lista");
      return null;
    }
  }, [fetchLists]);

  const deleteList = useCallback(async (listId: string) => {
    try {
      await supabase.from("b2b_saved_lists").delete().eq("id", listId);
      toast.success("Lista excluída");
      fetchLists();
    } catch (err) {
      toast.error("Erro ao excluir lista");
    }
  }, [fetchLists]);

  const getListLeads = useCallback(async (listId: string): Promise<B2BLead[]> => {
    const { data } = await supabase
      .from("b2b_leads")
      .select("*")
      .eq("list_id", listId)
      .order("created_at");
    return (data || []) as B2BLead[];
  }, []);

  return { lists, loading, fetchLists, createList, deleteList, getListLeads };
}
