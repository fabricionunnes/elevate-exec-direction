import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useCRMContext } from "./CRMLayout";
import { createStageActivities } from "@/hooks/useStageActions";
import { createProjectFromWonLead } from "@/hooks/useCreateProjectOnWon";
import {
  LeadActivitiesTab,
  LeadCustomFieldsTab,
  LeadFilesTab,
  LeadHistoryTab,
} from "@/components/crm/lead-detail";
import { OwnerSelector } from "@/components/crm/lead-detail/OwnerSelector";
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
  stage?: { name: string; color: string; is_final: boolean; final_type: string | null };
  pipeline?: { name: string };
  owner?: { name: string };
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
  const { isAdmin } = useCRMContext();
  
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

  const loadLead = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("crm_leads")
        .select(`
          *,
          stage:crm_stages(name, color, is_final, final_type),
          pipeline:crm_pipelines(name),
          owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
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

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  const handleStageChange = async (stageId: string) => {
    if (!lead) return;

    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage_id: stageId })
        .eq("id", lead.id);

      if (error) throw error;

      // Create automatic activities for this stage
      await createStageActivities(lead.id, stageId);

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
      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          stage_id: wonStage.id,
          closed_at: new Date().toISOString()
        })
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

          const closerId = lead.closer_staff_id || lead.owner_staff_id;
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
      // Get the first stage of the new pipeline
      const { data: firstStage } = await supabase
        .from("crm_stages")
        .select("id")
        .eq("pipeline_id", selectedPipelineId)
        .eq("is_final", false)
        .order("sort_order")
        .limit(1)
        .single();

      if (!firstStage) {
        toast.error("Nenhuma etapa encontrada no funil selecionado");
        return;
      }

      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          pipeline_id: selectedPipelineId,
          stage_id: firstStage.id
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Lead movido para outro funil!");
      setChangePipelineDialogOpen(false);
      setSelectedPipelineId("");
      loadLead();
    } catch (error) {
      console.error("Error changing pipeline:", error);
      toast.error("Erro ao mudar de funil");
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
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 text-sm">
        <Link to="/crm/pipeline" className="text-muted-foreground hover:text-foreground">
          {originGroupName}
        </Link>
        <span className="text-muted-foreground">{">"}</span>
        <Link to="/crm/pipeline" className="text-muted-foreground hover:text-foreground">
          {originName}
        </Link>
        <span className="text-muted-foreground">{">"}</span>
        <span className="font-medium">{lead.name}</span>
      </div>

      {/* Lead Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-lg">
                {lead.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                {lead.company && (
                  <span className="text-xs text-muted-foreground uppercase">
                    {lead.company}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold">{lead.name}</h1>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 ml-4">
              {lead.phone && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
              {lead.email && (
                <Button variant="ghost" size="icon" asChild>
                  <a href={`mailto:${lead.email}`}>
                    <Mail className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="icon">
                <Calendar className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Smile className="h-5 w-5" />
            </Button>
            <OwnerSelector
              leadId={lead.id}
              currentOwnerId={lead.owner_staff_id}
              currentOwnerName={lead.owner?.name}
              onOwnerChange={loadLead}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
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
            <Button variant="ghost" size="icon" className="ml-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-5 w-5" />
            </Button>
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
          <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground">
            <Plus className="h-3 w-3" />
          </Button>

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="h-auto p-0 bg-transparent border-b border-border rounded-none px-6">
          <TabsTrigger
            value="activities"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Atividades
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Contato
          </TabsTrigger>
          <TabsTrigger
            value="company"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Empresa
          </TabsTrigger>
          <TabsTrigger
            value="deal"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Negócio
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Arquivos
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
          >
            Histórico
          </TabsTrigger>
        </TabsList>

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
    </div>
  );
};
