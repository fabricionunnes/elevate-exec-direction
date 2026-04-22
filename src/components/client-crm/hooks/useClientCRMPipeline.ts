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
  stage_entered_at: string | null;
  pipeline_id: string | null;
  origin?: { name: string } | null;
  owner?: { name: string } | null;
  tags?: { tag: { id: string; name: string; color: string } }[];
}

export interface ClientCRMStageData {
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

export interface ClientCRMOriginData {
  id: string;
  name: string;
  group_id: string | null;
  pipeline_id: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  lead_count?: number;
}

export interface ClientCRMPipelineInfo {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

// Helper to query new tables not yet in generated types
const db = supabase as any;

export function useClientCRMPipeline(projectId: string) {
  const [pipelines, setPipelines] = useState<ClientCRMPipelineInfo[]>([]);
  const [stages, setStages] = useState<ClientCRMStageData[]>([]);
  const [leads, setLeads] = useState<ClientCRMLead[]>([]);
  const [originGroups, setOriginGroups] = useState<ClientCRMOriginGroup[]>([]);
  const [origins, setOrigins] = useState<ClientCRMOriginData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const isRealtimeRefresh = useRef(false);
  const loadFnRef = useRef<() => Promise<void>>();

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

    const pipelinesData = (data || []) as ClientCRMPipelineInfo[];
    setPipelines(pipelinesData);
    if (pipelinesData.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelinesData[0].id);
    }
  }, [projectId, selectedPipeline]);

  const loadOrigins = useCallback(async () => {
    const groupsRes = await db
      .from("client_crm_origin_groups")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("sort_order");
    const originsRes = await db
      .from("client_crm_origins")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("sort_order");

    setOriginGroups((groupsRes.data || []) as ClientCRMOriginGroup[]);
    setOrigins((originsRes.data || []) as ClientCRMOriginData[]);
    setOriginOptions((originsRes.data || []).map((o: any) => ({ id: o.id, name: o.name })));
  }, [projectId]);

  const loadFilterOptions = useCallback(async () => {
    const tagsRes = await db.from("client_crm_tags").select("id, name, color").eq("project_id", projectId).eq("is_active", true);
    const ownersRes = await db.from("onboarding_users").select("id, name").eq("project_id", projectId).eq("is_active", true);
    setTagOptions((tagsRes.data || []) as any[]);
    setOwnerOptions((ownersRes.data || []) as any[]);
  }, [projectId]);

  const loadStagesAndLeads = useCallback(async () => {
    if (!selectedPipeline) return;

    // Resolve effective origin in parallel with initial data — don't block
    let effectiveOrigin = selectedOrigin;

    if (!isRealtimeRefresh.current) setLoading(true);

    try {
      // Run stages, leads first page, and origin check ALL in parallel
      const FIRST_PAGE = 200;

      const buildLeadQuery = (origin: string | null, from: number, size: number) => {
        let q = db
          .from("client_crm_leads")
          .select(`
            id, name, company, phone, email, document, stage_id, origin_id, owner_id,
            opportunity_value, probability, last_activity_at, next_activity_at, urgency, notes, created_at, stage_entered_at, pipeline_id,
            origin:client_crm_origins(name),
            owner:onboarding_users!client_crm_leads_owner_id_fkey(name),
            tags:client_crm_lead_tags(tag:client_crm_tags(id, name, color))
          `)
          .eq("project_id", projectId)
          .eq("pipeline_id", selectedPipeline)
          .order("created_at", { ascending: false })
          .range(from, from + size - 1);
        if (origin) q = q.eq("origin_id", origin);
        return q;
      };

      // Check origin compatibility only if needed
      const originCheckPromise = effectiveOrigin
        ? db.from("client_crm_origins").select("pipeline_id").eq("id", effectiveOrigin).single()
        : Promise.resolve({ data: null });

      const [stagesRes, originRes] = await Promise.all([
        supabase.from("client_crm_stages").select("*").eq("pipeline_id", selectedPipeline).order("sort_order"),
        originCheckPromise,
      ]);

      // Resolve origin compatibility
      if (originRes.data && originRes.data.pipeline_id !== selectedPipeline) {
        effectiveOrigin = null;
      }

      setStages((stagesRes.data || []) as ClientCRMStageData[]);

      // Now fetch first page of leads (fast due to composite index)
      const { data: firstPage, error: firstErr } = await buildLeadQuery(effectiveOrigin, 0, FIRST_PAGE);
      if (firstErr) {
        console.error("Error loading leads:", firstErr);
        return;
      }

      const firstBatch = (firstPage || []) as ClientCRMLead[];
      setLeads(firstBatch);
      setLoading(false);
      isRealtimeRefresh.current = false;

      // Load remaining pages in background without blocking UI
      if (firstBatch.length === FIRST_PAGE) {
        const PAGE_SIZE = 500;
        const MAX_LEADS = 10000;
        let allLeads = [...firstBatch];
        let from = FIRST_PAGE;
        let hasMore = true;

        while (hasMore && allLeads.length < MAX_LEADS) {
          const { data: pageData, error } = await buildLeadQuery(effectiveOrigin, from, PAGE_SIZE);
          if (error || !pageData || pageData.length === 0) break;
          allLeads = allLeads.concat(pageData as ClientCRMLead[]);
          from += PAGE_SIZE;
          hasMore = pageData.length === PAGE_SIZE;
        }

        setLeads(allLeads);
      }
    } catch (error) {
      console.error("Error loading pipeline data:", error);
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

  // Realtime
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
      const pipelineIds = pipelines.map(p => p.id);
      if (!pipelineIds.length) return;

      const { data: forecastStages } = await supabase
        .from("client_crm_stages")
        .select("id")
        .in("pipeline_id", pipelineIds)
        .ilike("name", "%forecast%");

      if (forecastStages?.length) {
        let q = db.from("client_crm_leads")
          .select("id, opportunity_value, owner_id")
          .eq("project_id", projectId)
          .in("stage_id", forecastStages.map((s: any) => s.id));
        if (selectedOrigin) q = q.eq("origin_id", selectedOrigin);
        const { data } = await q;
        setForecastData(data || []);
      } else {
        setForecastData([]);
      }

      const { data: negStages } = await supabase
        .from("client_crm_stages")
        .select("id")
        .in("pipeline_id", pipelineIds)
        .ilike("name", "%realizada%");

      if (negStages?.length) {
        let q = db.from("client_crm_leads")
          .select("id, opportunity_value, owner_id")
          .eq("project_id", projectId)
          .in("stage_id", negStages.map((s: any) => s.id));
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
    const { data: onbUser } = await db
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

    const { error } = await db.from("client_crm_leads").insert({
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
    const { error } = await db
      .from("client_crm_leads")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await loadStagesAndLeads();
  };

  const deleteLead = async (id: string) => {
    const { error } = await db.from("client_crm_leads").delete().eq("id", id);
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
    const { error } = await db.from("client_crm_leads").update(updates).eq("id", leadId);
    if (error) throw error;

    if (note?.trim()) {
      await db.from("client_crm_lead_history").insert({
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
