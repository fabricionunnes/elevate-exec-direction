import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClientCRMLead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  stage_id: string;
  origin_id: string | null;
  owner_id: string | null;
  opportunity_value: number | null;
  probability: number | null;
  last_activity_at: string | null;
  next_activity_at: string | null;
  urgency: string | null;
  notes: string | null;
  created_at: string;
  pipeline_id: string | null;
  origin?: { name: string } | null;
  owner?: { name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

export interface ClientCRMStage {
  id: string;
  name: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
  color: string;
  pipeline_id: string;
}

export interface ClientCRMOriginGroup {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface ClientCRMOrigin {
  id: string;
  name: string;
  group_id: string | null;
  pipeline_id: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  lead_count?: number;
}

export interface ClientCRMPipelineData {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

export function useClientCRMPipeline(projectId: string) {
  const [pipelines, setPipelines] = useState<ClientCRMPipelineData[]>([]);
  const [stages, setStages] = useState<ClientCRMStage[]>([]);
  const [leads, setLeads] = useState<ClientCRMLead[]>([]);
  const [originGroups, setOriginGroups] = useState<ClientCRMOriginGroup[]>([]);
  const [origins, setOrigins] = useState<ClientCRMOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const isRealtimeRefresh = useRef(false);
  const loadFnRef = useRef<() => Promise<void>>();

  // Tag & owner options for filters
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string; color: string }[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [originOptions, setOriginOptions] = useState<{ id: string; name: string }[]>([]);

  const loadPipelines = useCallback(async () => {
    const { data } = await supabase
      .from("client_crm_pipelines")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    const pipelinesData = (data || []) as ClientCRMPipelineData[];
    setPipelines(pipelinesData);
    if (pipelinesData.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelinesData[0].id);
    }
  }, [projectId, selectedPipeline]);

  const loadOrigins = useCallback(async () => {
    const [groupsRes, originsRes] = await Promise.all([
      supabase
        .from("client_crm_origin_groups")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("client_crm_origins")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    setOriginGroups((groupsRes.data || []) as ClientCRMOriginGroup[]);
    setOrigins((originsRes.data || []) as ClientCRMOrigin[]);
    setOriginOptions((originsRes.data || []).map((o: any) => ({ id: o.id, name: o.name })));
  }, [projectId]);

  const loadFilterOptions = useCallback(async () => {
    const [tagsRes, ownersRes] = await Promise.all([
      supabase.from("client_crm_tags").select("id, name, color").eq("project_id", projectId).eq("is_active", true),
      supabase.from("onboarding_users").select("id, name").eq("project_id", projectId).eq("is_active", true),
    ]);
    setTagOptions((tagsRes.data || []) as any[]);
    setOwnerOptions((ownersRes.data || []) as any[]);
  }, [projectId]);

  const loadStagesAndLeads = useCallback(async () => {
    if (!selectedPipeline) return;

    let effectiveOrigin = selectedOrigin;
    if (effectiveOrigin) {
      const { data: originData } = await supabase
        .from("client_crm_origins")
        .select("pipeline_id")
        .eq("id", effectiveOrigin)
        .single();
      if (originData && originData.pipeline_id !== selectedPipeline) {
        effectiveOrigin = null;
      }
    }

    if (!isRealtimeRefresh.current) setLoading(true);

    try {
      const { data: stagesData } = await supabase
        .from("client_crm_stages")
        .select("*")
        .eq("pipeline_id", selectedPipeline)
        .order("sort_order");
      setStages((stagesData || []) as ClientCRMStage[]);

      // Fetch leads with pagination
      const PAGE_SIZE = 500;
      const MAX_LEADS = 10000;
      let allLeads: ClientCRMLead[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore && allLeads.length < MAX_LEADS) {
        let query = supabase
          .from("client_crm_leads")
          .select(`
            id, name, company, phone, email, document, stage_id, origin_id, owner_id,
            opportunity_value, probability, last_activity_at, next_activity_at, urgency, notes, created_at, pipeline_id,
            origin:client_crm_origins(name),
            owner:onboarding_users!client_crm_leads_owner_id_fkey(name),
            tags:client_crm_lead_tags(tag:client_crm_tags(id, name, color))
          `)
          .eq("project_id", projectId)
          .eq("pipeline_id", selectedPipeline)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (effectiveOrigin) {
          query = query.eq("origin_id", effectiveOrigin);
        }

        const { data: leadsData, error } = await query;
        if (error) {
          console.error("Error loading leads:", error);
          return;
        }

        if (leadsData && leadsData.length > 0) {
          allLeads = allLeads.concat(leadsData as unknown as ClientCRMLead[]);
          from += PAGE_SIZE;
          hasMore = leadsData.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (allLeads.length > 0 || !isRealtimeRefresh.current) {
        setLeads(allLeads);
      }
    } catch (error) {
      console.error("Error loading pipeline data:", error);
    } finally {
      setLoading(false);
      isRealtimeRefresh.current = false;
    }
  }, [projectId, selectedPipeline, selectedOrigin]);

  useEffect(() => {
    loadFnRef.current = loadStagesAndLeads;
  }, [loadStagesAndLeads]);

  useEffect(() => {
    if (projectId) {
      loadPipelines();
      loadOrigins();
      loadFilterOptions();
    }
  }, [projectId]);

  useEffect(() => {
    loadStagesAndLeads();
  }, [loadStagesAndLeads]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedPipeline) return;
    const channel = supabase
      .channel(`client-crm-leads-${selectedPipeline}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "client_crm_leads",
        filter: `pipeline_id=eq.${selectedPipeline}`,
      }, () => {
        isRealtimeRefresh.current = true;
        loadFnRef.current?.();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedPipeline]);

  // Summary cards
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [negotiationData, setNegotiationData] = useState<any[]>([]);

  const loadSummaryCards = useCallback(async () => {
    try {
      const { data: forecastStages } = await supabase
        .from("client_crm_stages")
        .select("id")
        .in("pipeline_id", pipelines.map(p => p.id))
        .ilike("name", "%forecast%");

      if (forecastStages?.length) {
        let q = supabase.from("client_crm_leads")
          .select("id, opportunity_value, owner_id")
          .eq("project_id", projectId)
          .in("stage_id", forecastStages.map(s => s.id));
        if (selectedOrigin) q = q.eq("origin_id", selectedOrigin);
        const { data } = await q;
        setForecastData(data || []);
      } else {
        setForecastData([]);
      }

      const { data: negStages } = await supabase
        .from("client_crm_stages")
        .select("id")
        .in("pipeline_id", pipelines.map(p => p.id))
        .ilike("name", "%realizada%");

      if (negStages?.length) {
        let q = supabase.from("client_crm_leads")
          .select("id, opportunity_value, owner_id")
          .eq("project_id", projectId)
          .in("stage_id", negStages.map(s => s.id));
        if (selectedOrigin) q = q.eq("origin_id", selectedOrigin);
        const { data } = await q;
        setNegotiationData(data || []);
      } else {
        setNegotiationData([]);
      }
    } catch (error) {
      console.error("Error loading summary:", error);
    }
  }, [projectId, pipelines, selectedOrigin]);

  useEffect(() => {
    if (pipelines.length > 0) loadSummaryCards();
  }, [loadSummaryCards, pipelines]);

  // CRUD
  const createLead = async (lead: Partial<ClientCRMLead>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: onbUser } = await supabase
      .from("onboarding_users")
      .select("id")
      .eq("user_id", userData.user?.id || "")
      .eq("project_id", projectId)
      .maybeSingle();

    const firstStage = stages.find(s => !s.is_final);
    if (!firstStage) {
      toast.error("Configure etapas no pipeline primeiro");
      return;
    }

    const { error } = await supabase.from("client_crm_leads").insert({
      project_id: projectId,
      pipeline_id: lead.pipeline_id || selectedPipeline!,
      stage_id: lead.stage_id || firstStage.id,
      origin_id: lead.origin_id || selectedOrigin || null,
      owner_id: lead.owner_id || onbUser?.id || null,
      name: lead.name!,
      phone: lead.phone || null,
      email: lead.email || null,
      company: lead.company || null,
      document: lead.document || null,
      opportunity_value: lead.opportunity_value || 0,
      probability: lead.probability || 0,
      notes: lead.notes || null,
      created_by: onbUser?.id || null,
    });
    if (error) throw error;
    toast.success("Lead criado!");
    await loadStagesAndLeads();
  };

  const updateLead = async (id: string, updates: Partial<ClientCRMLead>) => {
    const { error } = await supabase
      .from("client_crm_leads")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await loadStagesAndLeads();
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("client_crm_leads").delete().eq("id", id);
    if (error) throw error;
    toast.success("Lead excluído");
    await loadStagesAndLeads();
  };

  const moveLeadToStage = async (leadId: string, stageId: string, note?: string) => {
    const stage = stages.find(s => s.id === stageId);
    const updates: any = { stage_id: stageId, updated_at: new Date().toISOString() };
    if (stage?.is_final) {
      updates.closed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("client_crm_leads").update(updates).eq("id", leadId);
    if (error) throw error;

    if (note?.trim()) {
      await supabase.from("client_crm_lead_history").insert({
        lead_id: leadId,
        action: "note_added",
        notes: note.trim(),
        field_changed: "stage_change_note",
        new_value: stage?.name || "",
      });
    }

    toast.success("Lead movido com sucesso");
    await loadStagesAndLeads();
  };

  return {
    pipelines,
    stages,
    leads,
    originGroups,
    origins,
    loading,
    selectedPipeline,
    setSelectedPipeline,
    selectedOrigin,
    setSelectedOrigin,
    tagOptions,
    ownerOptions,
    originOptions,
    forecastData,
    negotiationData,
    loadStagesAndLeads,
    loadOrigins,
    createLead,
    updateLead,
    deleteLead,
    moveLeadToStage,
  };
}
