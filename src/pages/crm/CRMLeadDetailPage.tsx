import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { syncLeadToClint } from "@/hooks/useClintSync";
import { WhatsAppMessageDialog } from "@/components/onboarding-tasks/WhatsAppMessageDialog";
import { sendLoggedWhatsAppText } from "@/lib/whatsapp/sendLoggedWhatsAppText";
import { getDefaultWhatsAppInstance } from "@/utils/whatsapp-defaults";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Phone, 
  MessageSquare, 
  Mail,
  Calendar,
  StickyNote,
  Flag,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trophy,
  XCircle,
  X,
  Plus,
  Smile,
  Trash2,
  ArrowRightLeft,
  Copy,
  FileSignature,
  FileText,
  Building2,
  Activity,
  User,
  Briefcase,
  FileAudio,
  ClipboardList,
  Video,
  ScrollText,
  FolderOpen,
  History,
  Sparkles,
} from "lucide-react";
import { AddLeadNoteDialog } from "@/components/crm/lead-detail/AddLeadNoteDialog";
import { LeadSummaryTab } from "@/components/crm/lead-detail/lead-summary/LeadSummaryTab";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useCRMContext } from "./CRMLayout";
import { createStageActivities } from "@/hooks/useStageActions";
import { createProjectFromWonLead } from "@/hooks/useCreateProjectOnWon";
import { trackMeetingEventOnStageChange } from "@/hooks/useMeetingEventTracker";
import { sendWonLeadNotification } from "@/hooks/useSendWonNotification";
import {
  LeadActivitiesTab,
  LeadCustomFieldsTab,
  LeadFilesTab,
  LeadHistoryTab,
  LeadTranscriptionTab,
} from "@/components/crm/lead-detail";
import { LeadContractDataTab } from "@/components/crm/lead-detail/LeadContractDataTab";
import { LeadFormAnswersTab } from "@/components/crm/lead-detail/LeadFormAnswersTab";
import { LeadMeetingsPanel } from "@/components/crm/lead-detail/LeadMeetingsPanel";
import { OwnerSelector } from "@/components/crm/lead-detail/OwnerSelector";
import { SendContractButton } from "@/components/crm/SendContractButton";
import { ConvertLeadToCompanyDialog } from "@/components/crm/lead-detail/ConvertLeadToCompanyDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  company: string | null;
  role: string | null;
  city: string | null;
  state: string | null;
  origin: string | null;
  origin_id: string | null;
  owner_staff_id: string | null;
  closer_staff_id: string | null;
  sdr_staff_id: string | null;
  product_id: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  opportunity_value: number | null;
  probability: number | null;
  segment: string | null;
  employee_count: string | null;
  main_pain: string | null;
  urgency: string | null;
  fit_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  fbclid?: string | null;
  ad_name?: string | null;
  adset_name?: string | null;
  campaign_name?: string | null;
  stage?: { name: string; color: string; is_final: boolean; final_type: string | null };
  pipeline?: { name: string };
  owner?: { name: string; avatar_url?: string | null };
  origin_rel?: { name: string; group?: { name: string } | null };
  tags?: { tag: { id: string; name: string; color: string } }[];
}

interface Stage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  notes: string | null;
  responsible?: { name: string } | null;
  created_at: string;
  is_automation?: boolean;
  automation_config?: unknown;
}

export const CRMLeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isMaster, staffId } = useCRMContext();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedProject, setLinkedProject] = useState<{ id: string; product_name: string | null } | null>(null);
  const [wonDialogOpen, setWonDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [changePipelineDialogOpen, setChangePipelineDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [selectedLossReason, setSelectedLossReason] = useState("");
  const [activeTab, setActiveTab] = useState("activities");
  const [addNoteDialogOpen, setAddNoteDialogOpen] = useState(false);
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [siblingLeadIds, setSiblingLeadIds] = useState<string[]>([]);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [authorizedInstances, setAuthorizedInstances] = useState<
    Array<{ id: string; instance_name: string; display_name?: string | null }>
  >([]);

  // Load WhatsApp instances the current user is authorized to send from
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isMaster || isAdmin) {
          const { data } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_name, display_name, status")
            .order("instance_name");
          if (!cancelled) {
            setAuthorizedInstances(
              (data || [])
                .filter((i: any) => i.status === "connected" || i.status === "open")
                .map((i: any) => ({
                  id: i.id,
                  instance_name: i.instance_name,
                  display_name: i.display_name,
                }))
            );
          }
        } else if (staffId) {
          const { data } = await supabase
            .from("whatsapp_instance_access")
            .select("instance:whatsapp_instances(id, instance_name, display_name, status)")
            .eq("staff_id", staffId)
            .eq("can_send", true);
          if (!cancelled) {
            const list = (data || [])
              .map((a: any) => a.instance)
              .filter((i: any) => i && (i.status === "connected" || i.status === "open"))
              .map((i: any) => ({
                id: i.id,
                instance_name: i.instance_name,
                display_name: i.display_name,
              }));
            setAuthorizedInstances(list);
          }
        }
      } catch (err) {
        console.error("Error loading authorized instances:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMaster, isAdmin, staffId]);

  const loadLead = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("crm_leads")
        .select(`
          *,
          stage:crm_stages(name, color, is_final, final_type),
          pipeline:crm_pipelines(name),
          owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name, avatar_url),
          origin_rel:crm_origins(name, group:crm_origin_groups(name)),
          tags:crm_lead_tags(tag:crm_tags(id, name, color))
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setLead(data);

      // Backfill: se o lead já está GANHO e não existe venda registrada,
      // cria um registro em crm_sales para refletir faturamento/receita no dashboard.
      try {
        if (data?.stage?.final_type === "won") {
          const { data: existingSale, error: existingSaleError } = await supabase
            .from("crm_sales")
            .select("id")
            .eq("lead_id", data.id)
            .limit(1)
            .maybeSingle();

          if (existingSaleError) throw existingSaleError;

          if (!existingSale?.id) {
            const closerId = (data as any).closer_staff_id || data.owner_staff_id;
            const sdrId = (data as any).sdr_staff_id || null;
            const value = (data as any).opportunity_value || 0;
            const closedAt = (data as any).closed_at ? new Date((data as any).closed_at) : new Date();
            const saleDateStr = closedAt.toISOString().slice(0, 10);

            await supabase.from("crm_sales").insert({
              lead_id: data.id,
              closer_staff_id: closerId,
              sdr_staff_id: sdrId,
              pipeline_id: data.pipeline_id,
              // product_id pode estar inconsistente; não bloquear a criação da venda
              product_id: null,
              billing_value: value,
              revenue_value: value,
              sale_date: saleDateStr,
              payment_status: "pending",
            });
          }
        }
      } catch (e) {
        // Não bloquear carregamento do lead
        console.warn("Backfill de venda falhou:", e);
      }

        // If the lead is won, try to find the operational project created for this company
        // (The automation creates onboarding_projects but CRM didn't have a place to display it.)
        try {
          if (data?.stage?.final_type === "won" && data.company) {
            const { data: company } = await supabase
              .from("onboarding_companies")
              .select("id")
              .eq("name", data.company)
              .maybeSingle();

            if (company?.id) {
              const { data: project } = await supabase
                .from("onboarding_projects")
                .select("id, product_name")
                .eq("onboarding_company_id", company.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              setLinkedProject(project ? { id: project.id, product_name: project.product_name } : null);
            } else {
              setLinkedProject(null);
            }
          } else {
            setLinkedProject(null);
          }
        } catch (e) {
          // Non-blocking
          setLinkedProject(null);
        }

      // Load stages for this pipeline
      if (data.pipeline_id) {
        const { data: stagesData } = await supabase
          .from("crm_stages")
          .select("*")
          .eq("pipeline_id", data.pipeline_id)
          .order("sort_order");
        setStages(stagesData || []);
      }

      // Load activities
      const { data: activitiesData } = await supabase
        .from("crm_activities")
        .select(`
          *,
          responsible:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
        `)
        .eq("lead_id", id)
        .order("scheduled_at", { ascending: true });
      setActivities(activitiesData || []);

      // Load loss reasons
      const { data: reasonsData } = await supabase
        .from("crm_loss_reasons")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setLossReasons(reasonsData || []);

      // Load all pipelines for pipeline change
      const { data: pipelinesData } = await supabase
        .from("crm_pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPipelines(pipelinesData || []);

    } catch (error) {
      console.error("Error loading lead:", error);
      toast.error("Erro ao carregar lead");
      navigate("/crm/leads");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // Load sibling leads in the same stage for navigation
  const loadSiblingLeads = useCallback(async () => {
    if (!lead?.stage_id) return;
    const { data } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("stage_id", lead.stage_id)
      .order("created_at", { ascending: false });
    setSiblingLeadIds((data || []).map(l => l.id));
  }, [lead?.stage_id]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    loadSiblingLeads();
  }, [loadSiblingLeads]);

  const currentIndexInStage = siblingLeadIds.indexOf(id || "");
  const prevLeadId = currentIndexInStage > 0 ? siblingLeadIds[currentIndexInStage - 1] : null;
  const nextLeadId = currentIndexInStage >= 0 && currentIndexInStage < siblingLeadIds.length - 1 ? siblingLeadIds[currentIndexInStage + 1] : null;

  // Load all available tags
  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase
        .from("crm_tags")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name");
      setAllTags(data || []);
    };
    loadTags();
  }, []);

  const handleAddTag = async (tagId: string) => {
    if (!lead) return;
    try {
      const { error } = await supabase
        .from("crm_lead_tags")
        .insert({ lead_id: lead.id, tag_id: tagId });
      if (error) throw error;
      toast.success("Etiqueta adicionada");
      setTagPopoverOpen(false);
      loadLead();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.info("Etiqueta já adicionada");
      } else {
        toast.error("Erro ao adicionar etiqueta");
      }
    }
  };

  const handleStageChange = async (stageId: string) => {
    if (!lead) return;

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage_id: stageId })
        .eq("id", lead.id);

      if (error) throw error;

      // Sync stage change to Clint in background
      syncLeadToClint(lead.id, "stage_change");

      // Create automatic activities for this stage
      await createStageActivities(lead.id, stageId);
      
      // Track meeting events (scheduled/realized) for CRM metrics
      const targetStage = stages.find(s => s.id === stageId);
      if (staffId && lead.pipeline_id && targetStage) {
        await trackMeetingEventOnStageChange(
          lead.id,
          lead.pipeline_id,
          stageId,
          targetStage.name,
          staffId
        );
      }

      toast.success("Etapa atualizada");
      loadLead();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar etapa");
    }
  };

  const handleActivityComplete = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activityId);

      if (error) throw error;
      toast.success("Atividade concluída");
      loadLead();
    } catch (error) {
      console.error("Error completing activity:", error);
      toast.error("Erro ao concluir atividade");
    }
  };

  const handleMarkWon = async () => {
    if (!lead) return;

    const wonStage = stages.find(s => s.final_type === "won");
    if (!wonStage) {
      toast.error("Etapa 'Ganho' não encontrada");
      return;
    }

    try {
      // Definir o closer como o usuário logado que está dando ganho
      // (sobrescreve qualquer closer anterior — quem clica em "Ganho" é o vendedor responsável)
      const effectiveCloserId = staffId || lead.closer_staff_id || lead.owner_staff_id || null;

      const updatePayload: Record<string, any> = {
        stage_id: wonStage.id,
        closed_at: new Date().toISOString(),
      };
      if (staffId) {
        updatePayload.closer_staff_id = staffId;
      }

      const { error } = await supabase
        .from("crm_leads")
        .update(updatePayload)
        .eq("id", lead.id);

      if (error) throw error;

      // Registrar a venda para aparecer em indicadores (Pré-vendas / receita por closer)
      // (idempotente: se já existir venda para o lead, não cria outra)
      try {
        const { data: existingSale, error: existingSaleError } = await supabase
          .from("crm_sales")
          .select("id")
          .eq("lead_id", lead.id)
          .limit(1)
          .maybeSingle();

        if (existingSaleError) throw existingSaleError;

        if (!existingSale?.id) {
          const saleDate = new Date();
          const saleDateStr = saleDate.toISOString().slice(0, 10); // yyyy-mm-dd

          const closerId = effectiveCloserId;
          const sdrId = lead.sdr_staff_id || null;
          const value = lead.opportunity_value || 0;

          const { error: insertSaleError } = await supabase
            .from("crm_sales")
            .insert({
              lead_id: lead.id,
              closer_staff_id: closerId,
              sdr_staff_id: sdrId,
              pipeline_id: lead.pipeline_id,
              // product_id pode estar inconsistente; não bloquear a criação da venda
              product_id: null,
              billing_value: value,
              revenue_value: value,
              sale_date: saleDateStr,
              payment_status: "pending",
            });

          if (insertSaleError) throw insertSaleError;
        }
      } catch (e) {
        console.warn("Não foi possível registrar a venda automaticamente:", e);
      }

      // Criar projeto automaticamente
      const projectResult = await createProjectFromWonLead(lead.id);
      if (projectResult.success) {
        toast.success("🎉 Lead marcado como GANHO e projeto criado!");
        // Force refresh of the linked project badge
        setLinkedProject(projectResult.projectId ? { id: projectResult.projectId, product_name: null } : null);
      } else {
        toast.success("🎉 Lead marcado como GANHO!");
        if (projectResult.error && !projectResult.error.includes("não tem")) {
          console.warn("Projeto não criado:", projectResult.error);
        }
      }

      // Enviar notificação para o grupo de WhatsApp (não bloqueia o fluxo principal)
      sendWonLeadNotification(lead.id)
        .then((result) => {
          console.log("[WON NOTIFICATION] Result:", JSON.stringify(result));
          if (result.success) {
            toast.success("📱 Notificação enviada para o grupo!");
          } else if (result.error && result.error !== "Notificações desativadas" && result.error !== "Configuração incompleta") {
            console.error("[WON NOTIFICATION] Falha:", result.error);
            toast.error("Erro ao enviar notificação: " + result.error);
          }
        })
        .catch((e) => {
          console.error("[WON NOTIFICATION] Exception:", e);
          toast.error("Erro ao enviar notificação para o grupo");
        });

      setWonDialogOpen(false);
      loadLead();
    } catch (error) {
      console.error("Error marking as won:", error);
      toast.error("Erro ao marcar como ganho");
    }
  };

  const handleMarkLost = async () => {
    if (!lead || !selectedLossReason) {
      toast.error("Selecione um motivo de perda");
      return;
    }

    const lostStage = stages.find(s => s.final_type === "lost");
    if (!lostStage) {
      toast.error("Etapa 'Perdido' não encontrada");
      return;
    }

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          stage_id: lostStage.id,
          loss_reason_id: selectedLossReason,
          closed_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead marcado como perdido");
      setLostDialogOpen(false);
      loadLead();
    } catch (error) {
      console.error("Error marking as lost:", error);
      toast.error("Erro ao marcar como perdido");
    }
  };

  const handleReopenLead = async () => {
    if (!lead) return;

    // Encontrar a primeira etapa do pipeline (que não seja final)
    const firstStage = stages
      .filter(s => !s.is_final)
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    
    if (!firstStage) {
      toast.error("Nenhuma etapa inicial encontrada");
      return;
    }

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          stage_id: firstStage.id,
          closed_at: null,
          loss_reason_id: null
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead reaberto com sucesso!");
      setReopenDialogOpen(false);
      loadLead();
    } catch (error) {
      console.error("Error reopening lead:", error);
      toast.error("Erro ao reabrir lead");
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;

    try {
      // Delete all related records first to avoid foreign key violations
      const leadIdTables = [
        "crm_lead_tags", "crm_lead_history", "crm_activities", "crm_attachments",
        "crm_lead_files", "crm_custom_field_values", "crm_scheduled_calls",
        "crm_sales", "crm_forecasts", "crm_meeting_events", "crm_activity_history",
        "crm_lead_form_answers", "crm_transcriptions",
        "crm_whatsapp_conversations", "crm_whatsapp_contacts", "instagram_conversations",
      ];

      for (const table of leadIdTables) {
        await supabase.from(table as any).delete().eq("lead_id", lead.id);
      }

      // Clean references with different column names
      await supabase.from("crm_clint_sync_log" as any).delete().eq("crm_lead_id", lead.id);
      await supabase.from("onboarding_projects").update({ crm_lead_id: null } as any).eq("crm_lead_id", lead.id);

      const { error } = await supabase
        .from("crm_leads")
        .delete()
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead excluído com sucesso");
      setDeleteDialogOpen(false);
      navigate("/crm/pipeline");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Erro ao excluir lead");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!lead) return;
    try {
      const { error } = await supabase
        .from("crm_lead_tags")
        .delete()
        .eq("lead_id", lead.id)
        .eq("tag_id", tagId);

      if (error) throw error;
      loadLead();
    } catch (error) {
      console.error("Error removing tag:", error);
    }
  };

  const handleChangePipeline = async () => {
    if (!lead || !selectedPipelineId) {
      toast.error("Selecione um funil");
      return;
    }

    try {
      // When changing pipeline we also need to ensure the lead's origin belongs
      // to the same pipeline, otherwise it will be hidden when filtering by origin.
      const { data: targetOrigin } = await supabase
        .from("crm_origins")
        .select("id")
        .eq("is_active", true)
        .eq("pipeline_id", selectedPipelineId)
        .order("sort_order")
        .limit(1)
        .maybeSingle();

      // Get the first stage of the new pipeline (use maybeSingle to avoid throwing when empty)
      const { data: firstStage, error: stageError } = await supabase
        .from("crm_stages")
        .select("id")
        .eq("pipeline_id", selectedPipelineId)
        .eq("is_final", false)
        .order("sort_order")
        .limit(1)
        .maybeSingle();

      if (stageError) throw stageError;

      if (!firstStage) {
        toast.error("Este funil não possui etapas configuradas. Configure as etapas antes de mover leads para ele.");
        return;
      }

      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          pipeline_id: selectedPipelineId,
          stage_id: firstStage.id,
          // Align origin with the new pipeline (best-effort)
          origin_id: targetOrigin?.id ?? null,
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead movido para outro funil!");
      setChangePipelineDialogOpen(false);
      setSelectedPipelineId("");
      loadLead();
    } catch (error: any) {
      console.error("Error changing pipeline:", error);
      toast.error(`Erro ao mudar de funil: ${error?.message || "erro desconhecido"}`);
    }
  };

  const handleDuplicateLead = async () => {
    if (!lead) return;

    setDuplicating(true);
    try {
      // Get first stage of the pipeline
      const { data: firstStage } = await supabase
        .from("crm_stages")
        .select("id")
        .eq("pipeline_id", lead.pipeline_id)
        .eq("is_final", false)
        .order("sort_order")
        .limit(1)
        .single();

      const { data: newLead, error } = await supabase
        .from("crm_leads")
        .insert({
          name: `${lead.name} (cópia)`,
          phone: lead.phone,
          email: lead.email,
          document: lead.document,
          company: lead.company,
          role: lead.role,
          city: lead.city,
          state: lead.state,
          origin: lead.origin,
          origin_id: lead.origin_id,
          owner_staff_id: lead.owner_staff_id,
          pipeline_id: lead.pipeline_id,
          stage_id: firstStage?.id || lead.stage_id,
          opportunity_value: lead.opportunity_value,
          probability: lead.probability,
          segment: lead.segment,
          employee_count: lead.employee_count,
          main_pain: lead.main_pain,
          urgency: lead.urgency,
          fit_score: lead.fit_score,
          notes: lead.notes,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Copy tags
      if (lead.tags && lead.tags.length > 0 && newLead) {
        const tagInserts = lead.tags.map(t => ({
          lead_id: newLead.id,
          tag_id: t.tag.id
        }));
        await supabase.from("crm_lead_tags").insert(tagInserts);
      }

      toast.success("Lead duplicado com sucesso!");
      setDuplicateDialogOpen(false);
      
      // Navigate to the new lead
      if (newLead) {
        navigate(`/crm/leads/${newLead.id}`);
      }
    } catch (error) {
      console.error("Error duplicating lead:", error);
      toast.error("Erro ao duplicar lead");
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Lead não encontrado</p>
      </div>
    );
  }

  const isClosed = lead.stage?.is_final;
  const originGroupName = lead.origin_rel?.group?.name || "Funis comerciais";
  const originName = lead.origin_rel?.name || lead.origin || "Funil";

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Header */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-border flex items-center gap-1.5 text-sm min-w-0 overflow-hidden">
        <Link to="/crm/pipeline" className="text-muted-foreground hover:text-foreground truncate shrink-0 max-w-[180px]">
          {originGroupName}
        </Link>
        <span className="text-muted-foreground shrink-0">›</span>
        <Link to="/crm/pipeline" className="text-muted-foreground hover:text-foreground truncate shrink-0 max-w-[180px]">
          {originName}
        </Link>
        <span className="text-muted-foreground shrink-0">›</span>
        <span className="font-medium truncate">{lead.name}</span>
      </div>

      {/* Lead Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        {/* Row 1: Avatar + Name + Menu */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 ring-2 ring-primary/20">
            <AvatarFallback 
              className="text-sm sm:text-base font-semibold text-primary-foreground"
              style={{ 
                backgroundColor: lead.stage?.color || 'hsl(var(--primary))',
              }}
            >
              {lead.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            {lead.company && (
              <span className="text-[10px] sm:text-[11px] text-primary/70 uppercase tracking-wide block truncate font-medium">
                {lead.company}
              </span>
            )}
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">{lead.name}</h1>
          </div>

          {/* Nav arrows: previous/next lead in same stage */}
          <div className="hidden sm:flex items-center border-l border-border ml-1 pl-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!prevLeadId}
              onClick={() => prevLeadId && navigate(`/crm/leads/${prevLeadId}`)}
              title="Lead anterior na etapa"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!nextLeadId}
              onClick={() => nextLeadId && navigate(`/crm/leads/${nextLeadId}`)}
              title="Próximo lead na etapa"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: Quick Actions (scrollable on mobile) */}
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
          {/* Quick action icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {lead.phone && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ligar">
                <a href={`tel:${lead.phone}`}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            )}
            {lead.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="WhatsApp"
                onClick={() => setWhatsappDialogOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            {lead.email && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Email">
                <a href={`mailto:${lead.email}`}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Agendar">
              <Calendar className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setAddNoteDialogOpen(true)}
              title="Adicionar nota"
            >
              <StickyNote className="h-4 w-4" />
            </Button>
          </div>

          {/* Contract + extras */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <SendContractButton
              leadId={lead.id}
              variant="full"
              onSuccess={loadLead}
            />

            <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" title="Emoji">
              <Smile className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate(`/contratos?lead_id=${lead.id}`)}
              title="Contratos"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <OwnerSelector
              leadId={lead.id}
              currentOwnerId={lead.owner_staff_id}
              currentOwnerName={lead.owner?.name}
              currentOwnerAvatarUrl={lead.owner?.avatar_url}
              onOwnerChange={loadLead}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem 
                  onClick={() => setWonDialogOpen(true)}
                  disabled={lead.stage?.final_type === 'won'}
                >
                  <Trophy className="h-4 w-4 mr-2 text-green-500" />
                  Marcar como Ganho
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setLostDialogOpen(true)}
                  disabled={lead.stage?.final_type === 'lost'}
                >
                  <XCircle className="h-4 w-4 mr-2 text-red-500" />
                  Marcar como Perdido
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setReopenDialogOpen(true)}
                  disabled={!isClosed}
                >
                  <Flag className="h-4 w-4 mr-2 text-blue-500" />
                  Marcar como em Aberto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setChangePipelineDialogOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Mudar de Funil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConvertDialogOpen(true)}>
                  <Building2 className="h-4 w-4 mr-2 text-emerald-500" />
                  Converter em Empresa
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Lead
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 mt-3">
          {lead.tags?.map(t => (
            <Badge
              key={t.tag.id}
              variant="secondary"
              className="gap-1 pr-1"
              style={{ backgroundColor: t.tag.color + "20", color: t.tag.color, borderColor: t.tag.color }}
            >
              {t.tag.name}
              <button
                onClick={() => handleRemoveTag(t.tag.id)}
                className="ml-1 hover:bg-black/10 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Popover open={tagPopoverOpen} onOpenChange={(open) => { setTagPopoverOpen(open); if (!open) setTagSearch(""); }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground">
                <Plus className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Adicionar etiqueta</p>
              <Input
                placeholder="Buscar etiqueta..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="h-7 text-xs mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {allTags
                  .filter(tag => !lead.tags?.some(t => t.tag.id === tag.id))
                  .filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase()))
                  .map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}
                {allTags.filter(tag => !lead.tags?.some(t => t.tag.id === tag.id)).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Todas etiquetas já aplicadas</p>
                )}
              </div>
              <div className="border-t mt-2 pt-2">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const nameInput = form.elements.namedItem("newTagName") as HTMLInputElement;
                    const colorInput = form.elements.namedItem("newTagColor") as HTMLInputElement;
                    const name = nameInput.value.trim();
                    const color = colorInput.value;
                    if (!name) return;
                    try {
                      const { data, error } = await supabase
                        .from("crm_tags")
                        .insert({ name, color })
                        .select("id, name, color")
                        .single();
                      if (error) throw error;
                      setAllTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
                      await handleAddTag(data.id);
                      nameInput.value = "";
                    } catch (err: any) {
                      toast.error("Erro ao criar etiqueta");
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="color"
                    name="newTagColor"
                    defaultValue="#6366f1"
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                  />
                  <Input
                    name="newTagName"
                    placeholder="Nova etiqueta..."
                    className="h-7 text-xs flex-1"
                  />
                  <Button type="submit" size="sm" variant="ghost" className="h-7 px-2">
                    <Plus className="h-3 w-3" />
                  </Button>
                </form>
              </div>
            </PopoverContent>
          </Popover>

        {lead.stage?.final_type === "won" && linkedProject?.id && (
          <Link
            to={`/onboarding/projects/${linkedProject.id}`}
            className="ml-auto"
            title="Abrir projeto"
          >
            <Badge variant="secondary" className="gap-1">
              Projeto
              <span className="text-muted-foreground">
                {linkedProject.product_name ? `• ${linkedProject.product_name}` : "• abrir"}
              </span>
            </Badge>
          </Link>
        )}
        </div>
      </div>

      {/* Observações */}
      {lead.notes && (
        <div className="px-4 sm:px-6 py-2">
          <div className="rounded-lg border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20 p-3">
            <p className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium mb-1 flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              Observações
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{lead.notes}</p>
          </div>
        </div>
      )}

      {/* Rastreamento Meta Ads */}
      {(lead.utm_source || lead.utm_medium || lead.utm_campaign || lead.utm_content || lead.fbclid || lead.ad_name || lead.adset_name || lead.campaign_name) && (
        <div className="px-4 sm:px-6 py-2">
          <div className="rounded-lg border border-blue-200/50 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/20 p-3">
            <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-medium mb-2 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Rastreamento de Origem
            </p>
            <div className="flex flex-wrap gap-2">
              {lead.campaign_name && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  📢 Campanha: {lead.campaign_name}
                </Badge>
              )}
              {lead.adset_name && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  🎯 Conjunto: {lead.adset_name}
                </Badge>
              )}
              {lead.ad_name && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  📋 Anúncio: {lead.ad_name}
                </Badge>
              )}
              {lead.utm_source && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  Source: {lead.utm_source}
                </Badge>
              )}
              {lead.utm_medium && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  Medium: {lead.utm_medium}
                </Badge>
              )}
              {lead.utm_campaign && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  Campaign: {lead.utm_campaign}
                </Badge>
              )}
              {lead.utm_content && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background">
                  Content: {lead.utm_content}
                </Badge>
              )}
              {lead.fbclid && (
                <Badge variant="outline" className="text-[10px] gap-1 bg-background text-muted-foreground">
                  FBCLID: {lead.fbclid.slice(0, 12)}...
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto border-b border-border px-4 sm:px-6">
          <TabsList className="h-auto p-0 bg-transparent rounded-none inline-flex w-auto min-w-full">
            {[
              { value: "summary", label: "Resumo", icon: Sparkles, color: "text-purple-500" },
              { value: "activities", label: "Atividades", icon: Activity, color: "text-blue-500" },
              { value: "contact", label: "Contato", icon: User, color: "text-violet-500" },
              { value: "company", label: "Empresa", icon: Building2, color: "text-emerald-500" },
              { value: "deal", label: "Negócio", icon: Briefcase, color: "text-amber-500" },
              { value: "transcription", label: "Transcrição", icon: FileAudio, color: "text-pink-500" },
              { value: "form_answers", label: "Respostas", icon: ClipboardList, color: "text-cyan-500" },
              { value: "meetings", label: "Reuniões", icon: Video, color: "text-indigo-500" },
              { value: "contract_data", label: "Dados Contratuais", icon: ScrollText, color: "text-orange-500" },
              { value: "files", label: "Arquivos", icon: FolderOpen, color: "text-teal-500" },
              { value: "history", label: "Histórico", icon: History, color: "text-rose-500" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap flex-shrink-0 gap-1.5"
              >
                <tab.icon className={`h-3.5 w-3.5 ${tab.color}`} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="summary" className="flex-1 mt-0 overflow-hidden">
          <LeadSummaryTab leadId={lead.id} leadName={lead.name} />
        </TabsContent>

        <TabsContent value="activities" className="flex-1 mt-0 overflow-hidden">
          <LeadActivitiesTab
            leadId={lead.id}
            leadName={lead.name}
            leadEmail={lead.email}
            leadPhone={lead.phone}
            leadCompany={lead.company}
            stages={stages}
            currentStageId={lead.stage_id}
            stageName={lead.stage?.name}
            pipelineName={lead.pipeline?.name}
            ownerId={lead.owner_staff_id}
            ownerName={lead.owner?.name}
            activities={activities}
            onActivityComplete={handleActivityComplete}
            onStageChange={handleStageChange}
            onRefresh={loadLead}
          />
        </TabsContent>

        <TabsContent value="meetings" className="flex-1 mt-0 overflow-hidden">
          <LeadMeetingsPanel leadId={lead.id} leadName={lead.name} />
        </TabsContent>

        <TabsContent value="contract_data" className="flex-1 mt-0 overflow-hidden">
          <LeadContractDataTab leadId={lead.id} onUpdate={loadLead} />
        </TabsContent>

        <TabsContent value="form_answers" className="flex-1 mt-0 overflow-auto">
          <LeadFormAnswersTab leadId={lead.id} />
        </TabsContent>

        <TabsContent value="contact" className="flex-1 mt-0 overflow-auto">
          <LeadCustomFieldsTab
            leadId={lead.id}
            context="contact"
            leadData={lead}
            onUpdate={loadLead}
          />
        </TabsContent>

        <TabsContent value="company" className="flex-1 mt-0 overflow-auto">
          <LeadCustomFieldsTab
            leadId={lead.id}
            context="company"
            leadData={lead}
            onUpdate={loadLead}
          />
        </TabsContent>

        <TabsContent value="deal" className="flex-1 mt-0 overflow-auto">
          <LeadCustomFieldsTab
            leadId={lead.id}
            context="deal"
            leadData={lead}
            onUpdate={loadLead}
          />
        </TabsContent>

        <TabsContent value="files" className="flex-1 mt-0 overflow-hidden">
          <LeadFilesTab leadId={lead.id} />
        </TabsContent>

        <TabsContent value="transcription" className="flex-1 mt-0 overflow-hidden">
          <LeadTranscriptionTab
            leadId={lead.id}
            leadName={lead.name}
            companyName={lead.company}
            onBriefingGenerated={loadLead}
          />
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-0 overflow-hidden">
          <LeadHistoryTab
            leadId={lead.id}
            originName={originName}
            pipelineName={lead.pipeline?.name}
          />
        </TabsContent>
      </Tabs>

      {/* Won Dialog */}
      <AlertDialog open={wonDialogOpen} onOpenChange={setWonDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Ganho?</AlertDialogTitle>
            <AlertDialogDescription>
              Este lead será marcado como ganho e movido para a etapa final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkWon} className="bg-green-600 hover:bg-green-700">
              Confirmar Ganho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lost Dialog */}
      <AlertDialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Perdido</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o motivo da perda deste lead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Motivo da perda</Label>
            <Select value={selectedLossReason} onValueChange={setSelectedLossReason}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione um motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map(reason => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkLost} className="bg-red-600 hover:bg-red-700">
              Confirmar Perda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen Dialog */}
      <AlertDialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Este lead será reaberto e movido para a primeira etapa do funil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopenLead} className="bg-blue-600 hover:bg-blue-700">
              Reabrir Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead "{lead.name}"? Esta ação não pode ser desfeita e todas as atividades, arquivos e histórico serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLead} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Pipeline Dialog */}
      <AlertDialog open={changePipelineDialogOpen} onOpenChange={setChangePipelineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mudar de Funil</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o funil para onde deseja mover este lead. Ele será colocado na primeira etapa do novo funil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Novo Funil</Label>
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines
                  .filter(p => p.id !== lead.pipeline_id)
                  .map(pipeline => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPipelineId("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangePipeline}>
              Mover Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Uma cópia deste lead será criada com todas as informações (exceto atividades e histórico). O novo lead começará na primeira etapa do funil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicateLead} disabled={duplicating}>
              {duplicating ? "Duplicando..." : "Duplicar Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Note Dialog */}
      <AddLeadNoteDialog
        open={addNoteDialogOpen}
        onOpenChange={setAddNoteDialogOpen}
        leadId={lead.id}
        onSuccess={loadLead}
      />

      {/* WhatsApp Dialog */}
      {whatsappDialogOpen && lead.phone && (
        <WhatsAppMessageDialog
          phone={lead.phone}
          recipientName={lead.name}
          onClose={() => setWhatsappDialogOpen(false)}
          leadContext={{
            name: lead.name,
            company: lead.company || undefined,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            ownerName: lead.owner?.name || undefined,
          }}
          sending={sendingWhatsapp}
          instances={authorizedInstances}
          onSend={async (message, chosenInstanceId) => {
            setSendingWhatsapp(true);
            try {
              let instanceId = chosenInstanceId;

              // Fallback: resolve default instance by name (only if no list provided)
              if (!instanceId) {
                const instanceName = await getDefaultWhatsAppInstance();
                const { data: instance, error: instErr } = await supabase
                  .from("whatsapp_instances")
                  .select("id")
                  .eq("instance_name", instanceName)
                  .limit(1)
                  .maybeSingle();

                if (instErr) throw instErr;
                if (!instance) throw new Error("Instância WhatsApp não encontrada");
                instanceId = instance.id;
              }

              await sendLoggedWhatsAppText({
                instanceId,
                phoneRaw: lead.phone!,
                message,
                leadId: lead.id,
                leadName: lead.name,
                staffId: staffId || undefined,
              });
              toast.success("Mensagem enviada com sucesso!");
              setWhatsappDialogOpen(false);
            } catch (error: any) {
              toast.error(error.message || "Erro ao enviar mensagem");
            } finally {
              setSendingWhatsapp(false);
            }
          }}
        />
      )}

      {lead && (
        <ConvertLeadToCompanyDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          lead={lead}
          onSuccess={loadLead}
        />
      )}
    </div>
  );
};
