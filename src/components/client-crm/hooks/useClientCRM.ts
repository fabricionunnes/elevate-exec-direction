import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClientPipeline {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface ClientStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
}

export interface ClientContact {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  document: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface ClientDeal {
  id: string;
  project_id: string;
  pipeline_id: string;
  stage_id: string | null;
  contact_id: string | null;
  title: string;
  value: number;
  notes: string | null;
  probability: number;
  expected_close_date: string | null;
  closed_at: string | null;
  loss_reason: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  contact?: ClientContact;
  stage?: ClientStage;
}

export interface ClientActivity {
  id: string;
  project_id: string;
  deal_id: string | null;
  contact_id: string | null;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  created_at: string;
  // joined
  deal?: { title: string } | null;
  contact?: { name: string } | null;
}

export function useClientCRM(projectId: string) {
  const [pipelines, setPipelines] = useState<ClientPipeline[]>([]);
  const [stages, setStages] = useState<ClientStage[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [deals, setDeals] = useState<ClientDeal[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  const ensureDefaultPipeline = useCallback(async () => {
    const { data } = await supabase.rpc("create_default_client_crm_pipeline", {
      p_project_id: projectId,
    });
    return data as string;
  }, [projectId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Ensure pipeline exists
      await ensureDefaultPipeline();

      const [pipelinesRes, contactsRes, activitiesRes] = await Promise.all([
        supabase
          .from("client_crm_pipelines")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("created_at"),
        supabase
          .from("client_crm_contacts")
          .select("*")
          .eq("project_id", projectId)
          .order("name"),
        supabase
          .from("client_crm_activities")
          .select("*, deal:client_crm_deals(title), contact:client_crm_contacts(name)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
      ]);

      const pipelinesData = (pipelinesRes.data || []) as ClientPipeline[];
      setPipelines(pipelinesData);
      setContacts((contactsRes.data || []) as ClientContact[]);
      setActivities((activitiesRes.data || []) as ClientActivity[]);

      const defaultPipeline = pipelinesData.find((p) => p.is_default) || pipelinesData[0];
      const pipelineId = activePipelineId || defaultPipeline?.id;
      if (pipelineId) {
        setActivePipelineId(pipelineId);
        await fetchPipelineData(pipelineId);
      }
    } catch (error) {
      console.error("Error fetching CRM data:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, activePipelineId]);

  const fetchPipelineData = async (pipelineId: string) => {
    const [stagesRes, dealsRes] = await Promise.all([
      supabase
        .from("client_crm_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("sort_order"),
      supabase
        .from("client_crm_deals")
        .select("*, contact:client_crm_contacts(id, name, phone, email, company), stage:client_crm_stages(id, name, color)")
        .eq("project_id", projectId)
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false }),
    ]);

    setStages((stagesRes.data || []) as ClientStage[]);
    setDeals((dealsRes.data || []) as ClientDeal[]);
  };

  useEffect(() => {
    if (projectId) fetchAll();
  }, [projectId]);

  // CRUD operations
  const createDeal = async (deal: Partial<ClientDeal>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: onbUser } = await supabase
      .from("onboarding_users")
      .select("id")
      .eq("user_id", userData.user?.id || "")
      .eq("project_id", projectId)
      .maybeSingle();

    const { error } = await supabase.from("client_crm_deals").insert({
      project_id: projectId,
      pipeline_id: deal.pipeline_id || activePipelineId!,
      stage_id: deal.stage_id || stages.find((s) => !s.is_final)?.id,
      contact_id: deal.contact_id || null,
      title: deal.title!,
      value: deal.value || 0,
      notes: deal.notes || null,
      probability: deal.probability || 50,
      expected_close_date: deal.expected_close_date || null,
      created_by: onbUser?.id || null,
      owner_id: onbUser?.id || null,
    });
    if (error) throw error;
    toast.success("Negócio criado!");
    await fetchAll();
  };

  const updateDeal = async (id: string, updates: Partial<ClientDeal>) => {
    const { error } = await supabase
      .from("client_crm_deals")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await fetchAll();
  };

  const deleteDeal = async (id: string) => {
    const { error } = await supabase.from("client_crm_deals").delete().eq("id", id);
    if (error) throw error;
    toast.success("Negócio excluído");
    await fetchAll();
  };

  const createContact = async (contact: Partial<ClientContact>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: onbUser } = await supabase
      .from("onboarding_users")
      .select("id")
      .eq("user_id", userData.user?.id || "")
      .eq("project_id", projectId)
      .maybeSingle();

    const { error } = await supabase.from("client_crm_contacts").insert({
      project_id: projectId,
      name: contact.name!,
      email: contact.email || null,
      phone: contact.phone || null,
      company: contact.company || null,
      role: contact.role || null,
      document: contact.document || null,
      notes: contact.notes || null,
      created_by: onbUser?.id || null,
    });
    if (error) throw error;
    toast.success("Contato criado!");
    await fetchAll();
  };

  const updateContact = async (id: string, updates: Partial<ClientContact>) => {
    const { error } = await supabase
      .from("client_crm_contacts")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await fetchAll();
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("client_crm_contacts").delete().eq("id", id);
    if (error) throw error;
    toast.success("Contato excluído");
    await fetchAll();
  };

  const createActivity = async (activity: Partial<ClientActivity>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: onbUser } = await supabase
      .from("onboarding_users")
      .select("id")
      .eq("user_id", userData.user?.id || "")
      .eq("project_id", projectId)
      .maybeSingle();

    const { error } = await supabase.from("client_crm_activities").insert({
      project_id: projectId,
      deal_id: activity.deal_id || null,
      contact_id: activity.contact_id || null,
      type: activity.type || "task",
      title: activity.title!,
      description: activity.description || null,
      scheduled_at: activity.scheduled_at || null,
      status: "pending",
      created_by: onbUser?.id || null,
      assigned_to: onbUser?.id || null,
    });
    if (error) throw error;
    toast.success("Atividade criada!");
    await fetchAll();
  };

  const completeActivity = async (id: string) => {
    const { error } = await supabase
      .from("client_crm_activities")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    toast.success("Atividade concluída!");
    await fetchAll();
  };

  const deleteActivity = async (id: string) => {
    const { error } = await supabase.from("client_crm_activities").delete().eq("id", id);
    if (error) throw error;
    toast.success("Atividade excluída");
    await fetchAll();
  };

  const moveDealToStage = async (dealId: string, stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    const updates: any = { stage_id: stageId, updated_at: new Date().toISOString() };
    if (stage?.is_final) {
      updates.closed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("client_crm_deals").update(updates).eq("id", dealId);
    if (error) throw error;
    await fetchAll();
  };

  return {
    pipelines,
    stages,
    contacts,
    deals,
    activities,
    loading,
    activePipelineId,
    setActivePipelineId,
    fetchAll,
    createDeal,
    updateDeal,
    deleteDeal,
    moveDealToStage,
    createContact,
    updateContact,
    deleteContact,
    createActivity,
    completeActivity,
    deleteActivity,
  };
}
