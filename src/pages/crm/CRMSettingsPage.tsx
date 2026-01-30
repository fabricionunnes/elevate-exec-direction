import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings,
  Plus,
  Trash2,
  GripVertical,
  Palette,
  Tag,
  XCircle,
  Kanban,
  Loader2,
  Edit2,
  Target,
  Folder,
  Copy,
  Zap,
  Users,
  TrendingUp
} from "lucide-react";
import { StageActionsDialog } from "@/components/crm/StageActionsDialog";
import { CRMPermissionsManager } from "@/components/crm/CRMPermissionsManager";
import { CRMGoalsTab } from "@/components/crm/settings/CRMGoalsTab";
import { toast } from "sonner";

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
  is_final: boolean;
  final_type: string | null;
  color: string;
}

interface LossReason {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface CRMTag {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

interface OriginGroup {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Origin {
  id: string;
  name: string;
  group_id: string | null;
  pipeline_id: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

export const CRMSettingsPage = () => {
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [tags, setTags] = useState<CRMTag[]>([]);
  const [originGroups, setOriginGroups] = useState<OriginGroup[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedOriginGroup, setSelectedOriginGroup] = useState<string>("");

  // Dialogs
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newStageOpen, setNewStageOpen] = useState(false);
  const [newReasonOpen, setNewReasonOpen] = useState(false);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [newOriginGroupOpen, setNewOriginGroupOpen] = useState(false);
  const [newOriginOpen, setNewOriginOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ type: string; id: string; name: string } | null>(null);
  
  // Edit dialogs
  const [editPipelineOpen, setEditPipelineOpen] = useState(false);
  const [editStageOpen, setEditStageOpen] = useState(false);
  const [editOriginGroupOpen, setEditOriginGroupOpen] = useState(false);
  const [editOriginOpen, setEditOriginOpen] = useState(false);
  const [stageActionsOpen, setStageActionsOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [editingOriginGroup, setEditingOriginGroup] = useState<OriginGroup | null>(null);
  const [editingOrigin, setEditingOrigin] = useState<Origin | null>(null);
  const [actionsStage, setActionsStage] = useState<Stage | null>(null);

  // Form states
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newPipelineDesc, setNewPipelineDesc] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6B7280");
  const [newStageIsFinal, setNewStageIsFinal] = useState(false);
  const [newStageFinalType, setNewStageFinalType] = useState<string | null>(null);
  const [newReasonName, setNewReasonName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [newOriginGroupName, setNewOriginGroupName] = useState("");
  const [newOriginGroupIcon, setNewOriginGroupIcon] = useState("target");
  const [newOriginName, setNewOriginName] = useState("");
  const [newOriginGroupId, setNewOriginGroupId] = useState<string>("");
  const [newOriginPipelineId, setNewOriginPipelineId] = useState<string>("");
  const [editPipelineOriginGroupId, setEditPipelineOriginGroupId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/crm");
      return;
    }
    loadData();
  }, [isAdmin, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pipelinesRes, stagesRes, reasonsRes, tagsRes, originGroupsRes, originsRes] = await Promise.all([
        supabase.from("crm_pipelines").select("*").order("is_default", { ascending: false }),
        supabase.from("crm_stages").select("*").order("sort_order"),
        supabase.from("crm_loss_reasons").select("*").order("sort_order"),
        supabase.from("crm_tags").select("*").order("name"),
        supabase.from("crm_origin_groups").select("*").order("sort_order"),
        supabase.from("crm_origins").select("*").order("sort_order"),
      ]);

      setPipelines(pipelinesRes.data || []);
      setStages(stagesRes.data || []);
      setLossReasons(reasonsRes.data || []);
      setTags(tagsRes.data || []);
      setOriginGroups(originGroupsRes.data || []);
      setOrigins(originsRes.data || []);

      if (pipelinesRes.data && pipelinesRes.data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(pipelinesRes.data[0].id);
      }
      if (originGroupsRes.data && originGroupsRes.data.length > 0 && !selectedOriginGroup) {
        setSelectedOriginGroup(originGroupsRes.data[0].id);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_pipelines")
        .insert({ 
          name: newPipelineName, 
          description: newPipelineDesc || null,
          is_default: pipelines.length === 0 
        });
      
      if (error) throw error;
      toast.success("Pipeline criado");
      setNewPipelineOpen(false);
      setNewPipelineName("");
      setNewPipelineDesc("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar pipeline");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePipeline = async () => {
    if (!editingPipeline || !newPipelineName.trim()) return;
    setSaving(true);
    try {
      // Update pipeline basic info
      const { error } = await supabase
        .from("crm_pipelines")
        .update({ 
          name: newPipelineName, 
          description: newPipelineDesc || null,
        })
        .eq("id", editingPipeline.id);
      
      if (error) throw error;

      // Handle origin group association
      const existingOrigin = origins.find(o => o.pipeline_id === editingPipeline.id);
      
      if (editPipelineOriginGroupId) {
        if (existingOrigin) {
          // Update existing origin to new group
          const { error: originError } = await supabase
            .from("crm_origins")
            .update({ group_id: editPipelineOriginGroupId })
            .eq("id", existingOrigin.id);
          if (originError) throw originError;
        } else {
          // Create new origin linking pipeline to group
          const maxOrder = Math.max(0, ...origins.map(o => o.sort_order));
          const { error: originError } = await supabase
            .from("crm_origins")
            .insert({ 
              name: newPipelineName,
              pipeline_id: editingPipeline.id,
              group_id: editPipelineOriginGroupId,
              sort_order: maxOrder + 1
            });
          if (originError) throw originError;
        }
      } else if (existingOrigin) {
        // Remove origin group association (set to null)
        const { error: originError } = await supabase
          .from("crm_origins")
          .update({ group_id: null })
          .eq("id", existingOrigin.id);
        if (originError) throw originError;
      }

      toast.success("Pipeline atualizado");
      setEditPipelineOpen(false);
      setEditingPipeline(null);
      setNewPipelineName("");
      setNewPipelineDesc("");
      setEditPipelineOriginGroupId("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar pipeline");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStage = async () => {
    if (!newStageName.trim() || !selectedPipeline) return;
    setSaving(true);
    try {
      const maxOrder = Math.max(0, ...stages.filter(s => s.pipeline_id === selectedPipeline).map(s => s.sort_order));
      const { error } = await supabase
        .from("crm_stages")
        .insert({ 
          name: newStageName, 
          pipeline_id: selectedPipeline,
          color: newStageColor,
          sort_order: maxOrder + 1,
          is_final: newStageIsFinal,
          final_type: newStageIsFinal ? newStageFinalType : null,
        });
      
      if (error) throw error;
      toast.success("Etapa criada");
      setNewStageOpen(false);
      resetStageForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar etapa");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage || !newStageName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_stages")
        .update({ 
          name: newStageName, 
          color: newStageColor,
          is_final: newStageIsFinal,
          final_type: newStageIsFinal ? newStageFinalType : null,
        })
        .eq("id", editingStage.id);
      
      if (error) throw error;
      toast.success("Etapa atualizada");
      setEditStageOpen(false);
      setEditingStage(null);
      resetStageForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar etapa");
    } finally {
      setSaving(false);
    }
  };

  const resetStageForm = () => {
    setNewStageName("");
    setNewStageColor("#6B7280");
    setNewStageIsFinal(false);
    setNewStageFinalType(null);
  };

  const openEditPipeline = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setNewPipelineName(pipeline.name);
    setNewPipelineDesc(pipeline.description || "");
    // Find current origin group for this pipeline
    const originForPipeline = origins.find(o => o.pipeline_id === pipeline.id);
    setEditPipelineOriginGroupId(originForPipeline?.group_id || "");
    setEditPipelineOpen(true);
  };

  const openEditStage = (stage: Stage) => {
    setEditingStage(stage);
    setNewStageName(stage.name);
    setNewStageColor(stage.color);
    setNewStageIsFinal(stage.is_final);
    setNewStageFinalType(stage.final_type);
    setEditStageOpen(true);
  };

  const handleDuplicatePipeline = async (pipeline: Pipeline) => {
    setSaving(true);
    try {
      // 1. Create new pipeline with "Cópia de" prefix
      const { data: newPipeline, error: pipelineError } = await supabase
        .from("crm_pipelines")
        .insert({
          name: `Cópia de ${pipeline.name}`,
          description: pipeline.description,
          is_default: false,
          is_active: true,
        })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      // 2. Get stages from original pipeline
      const originalStages = stages.filter(s => s.pipeline_id === pipeline.id);

      // 3. Create stages for new pipeline
      if (originalStages.length > 0) {
        const newStages = originalStages.map(stage => ({
          pipeline_id: newPipeline.id,
          name: stage.name,
          sort_order: stage.sort_order,
          is_final: stage.is_final,
          final_type: stage.final_type,
          color: stage.color,
        }));

        const { error: stagesError } = await supabase
          .from("crm_stages")
          .insert(newStages);

        if (stagesError) throw stagesError;
      }

      toast.success(`Pipeline "${pipeline.name}" duplicado com sucesso`);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao duplicar pipeline");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReason = async () => {
    if (!newReasonName.trim()) return;
    setSaving(true);
    try {
      const maxOrder = Math.max(0, ...lossReasons.map(r => r.sort_order));
      const { error } = await supabase
        .from("crm_loss_reasons")
        .insert({ name: newReasonName, sort_order: maxOrder + 1 });
      
      if (error) throw error;
      toast.success("Motivo criado");
      setNewReasonOpen(false);
      setNewReasonName("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar motivo");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_tags")
        .insert({ name: newTagName, color: newTagColor });
      
      if (error) throw error;
      toast.success("Tag criada");
      setNewTagOpen(false);
      setNewTagName("");
      setNewTagColor("#3B82F6");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar tag");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      let error;
      switch (deleteDialog.type) {
        case "pipeline":
          ({ error } = await supabase.from("crm_pipelines").delete().eq("id", deleteDialog.id));
          break;
        case "stage":
          ({ error } = await supabase.from("crm_stages").delete().eq("id", deleteDialog.id));
          break;
        case "reason":
          ({ error } = await supabase.from("crm_loss_reasons").delete().eq("id", deleteDialog.id));
          break;
        case "tag":
          ({ error } = await supabase.from("crm_tags").delete().eq("id", deleteDialog.id));
          break;
        case "origin_group":
          ({ error } = await supabase.from("crm_origin_groups").delete().eq("id", deleteDialog.id));
          break;
        case "origin":
          ({ error } = await supabase.from("crm_origins").delete().eq("id", deleteDialog.id));
          break;
        default:
          throw new Error("Tipo inválido");
      }
      
      if (error) throw error;
      toast.success("Item excluído");
      setDeleteDialog(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    }
  };

  // Origin Group handlers
  const handleCreateOriginGroup = async () => {
    if (!newOriginGroupName.trim()) return;
    setSaving(true);
    try {
      const maxOrder = Math.max(0, ...originGroups.map(g => g.sort_order));
      const { error } = await supabase
        .from("crm_origin_groups")
        .insert({ 
          name: newOriginGroupName, 
          icon: newOriginGroupIcon,
          sort_order: maxOrder + 1 
        });
      
      if (error) throw error;
      toast.success("Grupo de origem criado");
      setNewOriginGroupOpen(false);
      setNewOriginGroupName("");
      setNewOriginGroupIcon("target");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar grupo de origem");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOriginGroup = async () => {
    if (!editingOriginGroup || !newOriginGroupName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_origin_groups")
        .update({ 
          name: newOriginGroupName,
          icon: newOriginGroupIcon,
        })
        .eq("id", editingOriginGroup.id);
      
      if (error) throw error;
      toast.success("Grupo de origem atualizado");
      setEditOriginGroupOpen(false);
      setEditingOriginGroup(null);
      setNewOriginGroupName("");
      setNewOriginGroupIcon("target");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar grupo de origem");
    } finally {
      setSaving(false);
    }
  };

  const openEditOriginGroup = (group: OriginGroup) => {
    setEditingOriginGroup(group);
    setNewOriginGroupName(group.name);
    setNewOriginGroupIcon(group.icon || "target");
    setEditOriginGroupOpen(true);
  };

  // Origin handlers
  const handleCreateOrigin = async () => {
    if (!newOriginName.trim()) return;
    setSaving(true);
    try {
      const maxOrder = Math.max(0, ...origins.filter(o => o.group_id === (newOriginGroupId || null)).map(o => o.sort_order));
      const { error } = await supabase
        .from("crm_origins")
        .insert({ 
          name: newOriginName, 
          group_id: newOriginGroupId || null,
          pipeline_id: newOriginPipelineId || null,
          sort_order: maxOrder + 1 
        });
      
      if (error) throw error;
      toast.success("Origem criada");
      setNewOriginOpen(false);
      setNewOriginName("");
      setNewOriginGroupId("");
      setNewOriginPipelineId("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar origem");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOrigin = async () => {
    if (!editingOrigin || !newOriginName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_origins")
        .update({ 
          name: newOriginName,
          group_id: newOriginGroupId || null,
          pipeline_id: newOriginPipelineId || null,
        })
        .eq("id", editingOrigin.id);
      
      if (error) throw error;
      toast.success("Origem atualizada");
      setEditOriginOpen(false);
      setEditingOrigin(null);
      setNewOriginName("");
      setNewOriginGroupId("");
      setNewOriginPipelineId("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar origem");
    } finally {
      setSaving(false);
    }
  };

  const openEditOrigin = (origin: Origin) => {
    setEditingOrigin(origin);
    setNewOriginName(origin.name);
    setNewOriginGroupId(origin.group_id || "");
    setNewOriginPipelineId(origin.pipeline_id || "");
    setEditOriginOpen(true);
  };

  const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);
  const groupOrigins = origins.filter(o => o.group_id === selectedOriginGroup);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configurações do CRM
        </h1>
        <p className="text-muted-foreground">
          Gerencie pipelines, origens, etapas, tags e motivos de perda
        </p>
      </div>

      <Tabs defaultValue="pipelines" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pipelines" className="gap-2">
            <Kanban className="h-4 w-4" />
            Pipelines
          </TabsTrigger>
          <TabsTrigger value="origins" className="gap-2">
            <Target className="h-4 w-4" />
            Origens
          </TabsTrigger>
          <TabsTrigger value="reasons" className="gap-2">
            <XCircle className="h-4 w-4" />
            Motivos de Perda
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Users className="h-4 w-4" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Metas
          </TabsTrigger>
        </TabsList>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pipelines</h2>
            <Dialog open={newPipelineOpen} onOpenChange={(open) => {
              setNewPipelineOpen(open);
              if (!open) {
                setNewPipelineName("");
                setNewPipelineDesc("");
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Pipeline
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Pipeline</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      placeholder="Ex: Inbound, Outbound..."
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={newPipelineDesc}
                      onChange={(e) => setNewPipelineDesc(e.target.value)}
                      placeholder="Descrição opcional..."
                    />
                  </div>
                  <Button onClick={handleCreatePipeline} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Pipeline Dialog */}
            <Dialog open={editPipelineOpen} onOpenChange={(open) => {
              setEditPipelineOpen(open);
              if (!open) {
                setEditingPipeline(null);
                setNewPipelineName("");
                setNewPipelineDesc("");
                setEditPipelineOriginGroupId("");
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Pipeline</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      placeholder="Nome do pipeline"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={newPipelineDesc}
                      onChange={(e) => setNewPipelineDesc(e.target.value)}
                      placeholder="Descrição opcional..."
                    />
                  </div>
                  <div>
                    <Label>Grupo de Origem</Label>
                    <Select
                      value={editPipelineOriginGroupId || "none"}
                      onValueChange={(val) => setEditPipelineOriginGroupId(val === "none" ? "" : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um grupo (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum grupo</SelectItem>
                        {originGroups.filter(g => g.is_active).map(group => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vincule este pipeline a um grupo de origens para organização
                    </p>
                  </div>
                  <Button onClick={handleUpdatePipeline} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Pipeline List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seus Pipelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pipelines.map(pipeline => (
                  <div
                    key={pipeline.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPipeline === pipeline.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setSelectedPipeline(pipeline.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{pipeline.name}</span>
                          {pipeline.is_default && (
                            <Badge variant="secondary" className="text-xs">Padrão</Badge>
                          )}
                        </div>
                        {pipeline.description && (
                          <p className="text-xs text-muted-foreground mt-1">{pipeline.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPipeline(pipeline);
                          }}
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicatePipeline(pipeline);
                          }}
                          disabled={saving}
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog({ type: "pipeline", id: pipeline.id, name: pipeline.name });
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Stages for selected pipeline */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Etapas do Pipeline</CardTitle>
                  <Dialog open={newStageOpen} onOpenChange={(open) => {
                    setNewStageOpen(open);
                    if (!open) resetStageForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Etapa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Etapa</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome *</Label>
                          <Input
                            value={newStageName}
                            onChange={(e) => setNewStageName(e.target.value)}
                            placeholder="Ex: Qualificação, Proposta..."
                          />
                        </div>
                        <div>
                          <Label>Cor</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={newStageColor}
                              onChange={(e) => setNewStageColor(e.target.value)}
                              className="w-16 h-10 p-1"
                            />
                            <Input
                              value={newStageColor}
                              onChange={(e) => setNewStageColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newStageIsFinal}
                            onCheckedChange={setNewStageIsFinal}
                          />
                          <Label>Etapa Final</Label>
                        </div>
                        {newStageIsFinal && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={newStageFinalType === "won" ? "default" : "outline"}
                              className={newStageFinalType === "won" ? "bg-green-600 hover:bg-green-700" : ""}
                              onClick={() => setNewStageFinalType("won")}
                            >
                              Ganho
                            </Button>
                            <Button
                              type="button"
                              variant={newStageFinalType === "lost" ? "default" : "outline"}
                              className={newStageFinalType === "lost" ? "bg-red-600 hover:bg-red-700" : ""}
                              onClick={() => setNewStageFinalType("lost")}
                            >
                              Perdido
                            </Button>
                          </div>
                        )}
                        <Button onClick={handleCreateStage} disabled={saving} className="w-full">
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Criar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Stage Dialog */}
                  <Dialog open={editStageOpen} onOpenChange={(open) => {
                    setEditStageOpen(open);
                    if (!open) {
                      setEditingStage(null);
                      resetStageForm();
                    }
                  }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Etapa</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome *</Label>
                          <Input
                            value={newStageName}
                            onChange={(e) => setNewStageName(e.target.value)}
                            placeholder="Nome da etapa"
                          />
                        </div>
                        <div>
                          <Label>Cor</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={newStageColor}
                              onChange={(e) => setNewStageColor(e.target.value)}
                              className="w-16 h-10 p-1"
                            />
                            <Input
                              value={newStageColor}
                              onChange={(e) => setNewStageColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newStageIsFinal}
                            onCheckedChange={setNewStageIsFinal}
                          />
                          <Label>Etapa Final</Label>
                        </div>
                        {newStageIsFinal && (
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={newStageFinalType === "won" ? "default" : "outline"}
                              className={newStageFinalType === "won" ? "bg-green-600 hover:bg-green-700" : ""}
                              onClick={() => setNewStageFinalType("won")}
                            >
                              Ganho
                            </Button>
                            <Button
                              type="button"
                              variant={newStageFinalType === "lost" ? "default" : "outline"}
                              className={newStageFinalType === "lost" ? "bg-red-600 hover:bg-red-700" : ""}
                              onClick={() => setNewStageFinalType("lost")}
                            >
                              Perdido
                            </Button>
                          </div>
                        )}
                        <Button onClick={handleUpdateStage} disabled={saving} className="w-full">
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Salvar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {pipelineStages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma etapa neste pipeline
                  </p>
                ) : (
                  pipelineStages.map(stage => (
                    <div
                      key={stage.id}
                      className="p-3 rounded-lg border border-border flex items-center gap-3 hover:bg-muted/50 transition-colors group"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing group-hover:text-foreground transition-colors" />
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="flex-1">{stage.name}</span>
                      {stage.is_final && (
                        <Badge variant={stage.final_type === "won" ? "default" : "destructive"}>
                          {stage.final_type === "won" ? "Ganho" : "Perdido"}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setActionsStage(stage);
                          setStageActionsOpen(true);
                        }}
                        title="Configurar ações automáticas"
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditStage(stage)}
                        title="Editar etapa"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteDialog({ type: "stage", id: stage.id, name: stage.name })}
                        title="Excluir etapa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Origins Tab */}
        <TabsContent value="origins" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Origens e Grupos</h2>
            <div className="flex gap-2">
              <Dialog open={newOriginGroupOpen} onOpenChange={(open) => {
                setNewOriginGroupOpen(open);
                if (!open) {
                  setNewOriginGroupName("");
                  setNewOriginGroupIcon("target");
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Folder className="h-4 w-4 mr-2" />
                    Novo Grupo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Grupo de Origem</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={newOriginGroupName}
                        onChange={(e) => setNewOriginGroupName(e.target.value)}
                        placeholder="Ex: Funis Comerciais, Marketing..."
                      />
                    </div>
                    <div>
                      <Label>Ícone</Label>
                      <Select value={newOriginGroupIcon} onValueChange={setNewOriginGroupIcon}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="target">🎯 Alvo</SelectItem>
                          <SelectItem value="megaphone">📢 Marketing</SelectItem>
                          <SelectItem value="shopping-cart">🛒 Vendas</SelectItem>
                          <SelectItem value="folder">📁 Pasta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateOriginGroup} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={newOriginOpen} onOpenChange={(open) => {
                setNewOriginOpen(open);
                if (!open) {
                  setNewOriginName("");
                  setNewOriginGroupId("");
                  setNewOriginPipelineId("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Origem
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Origem</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={newOriginName}
                        onChange={(e) => setNewOriginName(e.target.value)}
                        placeholder="Ex: Funil SE, Digital Influencer..."
                      />
                    </div>
                    <div>
                      <Label>Grupo</Label>
                      <Select value={newOriginGroupId} onValueChange={setNewOriginGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sem grupo</SelectItem>
                          {originGroups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Pipeline Associado</Label>
                      <Select value={newOriginPipelineId} onValueChange={setNewOriginPipelineId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pipeline (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhum pipeline específico</SelectItem>
                          {pipelines.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ao selecionar essa origem, o pipeline será automaticamente selecionado
                      </p>
                    </div>
                    <Button onClick={handleCreateOrigin} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Origin Group Dialog */}
              <Dialog open={editOriginGroupOpen} onOpenChange={(open) => {
                setEditOriginGroupOpen(open);
                if (!open) {
                  setEditingOriginGroup(null);
                  setNewOriginGroupName("");
                  setNewOriginGroupIcon("target");
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Grupo de Origem</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={newOriginGroupName}
                        onChange={(e) => setNewOriginGroupName(e.target.value)}
                        placeholder="Nome do grupo"
                      />
                    </div>
                    <div>
                      <Label>Ícone</Label>
                      <Select value={newOriginGroupIcon} onValueChange={setNewOriginGroupIcon}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="target">🎯 Alvo</SelectItem>
                          <SelectItem value="megaphone">📢 Marketing</SelectItem>
                          <SelectItem value="shopping-cart">🛒 Vendas</SelectItem>
                          <SelectItem value="folder">📁 Pasta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleUpdateOriginGroup} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Origin Dialog */}
              <Dialog open={editOriginOpen} onOpenChange={(open) => {
                setEditOriginOpen(open);
                if (!open) {
                  setEditingOrigin(null);
                  setNewOriginName("");
                  setNewOriginGroupId("");
                  setNewOriginPipelineId("");
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Origem</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={newOriginName}
                        onChange={(e) => setNewOriginName(e.target.value)}
                        placeholder="Nome da origem"
                      />
                    </div>
                    <div>
                      <Label>Grupo</Label>
                      <Select value={newOriginGroupId} onValueChange={setNewOriginGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sem grupo</SelectItem>
                          {originGroups.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Pipeline Associado</Label>
                      <Select value={newOriginPipelineId} onValueChange={setNewOriginPipelineId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um pipeline (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhum pipeline específico</SelectItem>
                          {pipelines.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleUpdateOrigin} disabled={saving} className="w-full">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Origin Groups List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grupos de Origem</CardTitle>
                <CardDescription>
                  Grupos organizam suas origens por categoria
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {originGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum grupo criado
                  </p>
                ) : (
                  originGroups.map(group => (
                    <div
                      key={group.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedOriginGroup === group.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:bg-muted"
                      }`}
                      onClick={() => setSelectedOriginGroup(group.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {group.icon === "target" ? "🎯" : 
                             group.icon === "megaphone" ? "📢" : 
                             group.icon === "shopping-cart" ? "🛒" : "📁"}
                          </span>
                          <span className="font-medium">{group.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {origins.filter(o => o.group_id === group.id).length} origens
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditOriginGroup(group);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({ type: "origin_group", id: group.id, name: group.name });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Origins in selected group */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Origens {selectedOriginGroup && originGroups.find(g => g.id === selectedOriginGroup)?.name ? 
                    `em "${originGroups.find(g => g.id === selectedOriginGroup)?.name}"` : ""}
                </CardTitle>
                <CardDescription>
                  Cada origem representa um canal ou funil de captação de leads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupOrigins.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {selectedOriginGroup ? "Nenhuma origem neste grupo" : "Selecione um grupo"}
                  </p>
                ) : (
                  groupOrigins.map(origin => (
                    <div
                      key={origin.id}
                      className="p-3 rounded-lg border border-border flex items-center gap-3"
                    >
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="font-medium">{origin.name}</span>
                        {origin.pipeline_id && (
                          <p className="text-xs text-muted-foreground">
                            Pipeline: {pipelines.find(p => p.id === origin.pipeline_id)?.name || "-"}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditOrigin(origin)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteDialog({ type: "origin", id: origin.id, name: origin.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Loss Reasons Tab */}
        <TabsContent value="reasons" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Motivos de Perda</CardTitle>
                  <CardDescription>
                    Configure os motivos disponíveis ao marcar um lead como perdido
                  </CardDescription>
                </div>
                <Dialog open={newReasonOpen} onOpenChange={setNewReasonOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Motivo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo Motivo de Perda</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={newReasonName}
                          onChange={(e) => setNewReasonName(e.target.value)}
                          placeholder="Ex: Preço, Concorrente..."
                        />
                      </div>
                      <Button onClick={handleCreateReason} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lossReasons.map(reason => (
                  <div
                    key={reason.id}
                    className="p-3 rounded-lg border border-border flex items-center justify-between"
                  >
                    <span>{reason.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteDialog({ type: "reason", id: reason.id, name: reason.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tags</CardTitle>
                  <CardDescription>
                    Crie tags para categorizar seus leads
                  </CardDescription>
                </div>
                <Dialog open={newTagOpen} onOpenChange={setNewTagOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Tag
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Tag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Ex: Hot, Indicação..."
                        />
                      </div>
                      <div>
                        <Label>Cor</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="w-16 h-10 p-1"
                          />
                          <Input
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <Button onClick={handleCreateTag} disabled={saving} className="w-full">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="px-3 py-1 text-sm"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                    <button
                      className="ml-2 hover:text-destructive"
                      onClick={() => setDeleteDialog({ type: "tag", id: tag.id, name: tag.name })}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Tab */}
        <TabsContent value="access" className="mt-6">
          <CRMPermissionsManager />
        </TabsContent>

        {/* Goals Tab */}
        <TabsContent value="goals" className="mt-6">
          <CRMGoalsTab />
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteDialog?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Actions Dialog */}
      {actionsStage && (
        <StageActionsDialog
          open={stageActionsOpen}
          onOpenChange={(open) => {
            setStageActionsOpen(open);
            if (!open) setActionsStage(null);
          }}
          stageId={actionsStage.id}
          stageName={actionsStage.name}
        />
      )}
    </div>
  );
};
