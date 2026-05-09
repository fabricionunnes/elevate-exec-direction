import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
  TrendingUp,
  ListChecks,
  Bell,
  Link2,
  FileText
} from "lucide-react";
import { StageActionsDialog } from "@/components/crm/StageActionsDialog";
import { StageChecklistDialog } from "@/components/crm/StageChecklistDialog";
import { CRMPermissionsManager } from "@/components/crm/CRMPermissionsManager";
import { CRMGoalsTab } from "@/components/crm/settings/CRMGoalsTab";
import { WonNotificationSettings } from "@/components/crm/settings/WonNotificationSettings";
import { LeadNotificationSettings } from "@/components/crm/settings/LeadNotificationSettings";
import { ClintIntegrationTab } from "@/components/crm/settings/ClintIntegrationTab";
import { PipelineFormsManager } from "@/components/crm/PipelineFormsManager";
import { CRMMessageRulesTab } from "@/components/crm/settings/CRMMessageRulesTab";
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
  const [pipelineGroupFilter, setPipelineGroupFilter] = useState<string>("all");
  const [draggedPipelineId, setDraggedPipelineId] = useState<string | null>(null);
  const [dragOverPipelineId, setDragOverPipelineId] = useState<string | null>(null);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

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
  const [editReasonOpen, setEditReasonOpen] = useState(false);
  const [stageActionsOpen, setStageActionsOpen] = useState(false);
  const [stageChecklistOpen, setStageChecklistOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [editingOriginGroup, setEditingOriginGroup] = useState<OriginGroup | null>(null);
  const [editingOrigin, setEditingOrigin] = useState<Origin | null>(null);
  const [editingReason, setEditingReason] = useState<LossReason | null>(null);
  const [actionsStage, setActionsStage] = useState<Stage | null>(null);
  const [checklistStage, setChecklistStage] = useState<Stage | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTargetStage, setCopyTargetStage] = useState<Stage | null>(null);
  const [copySourcePipeline, setCopySourcePipeline] = useState("");
  const [copySourceStage, setCopySourceStage] = useState("");
  const [copyChecklist, setCopyChecklist] = useState(true);
  const [copyActions, setCopyActions] = useState(true);
  const [copying, setCopying] = useState(false);

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
        supabase.from("crm_pipelines").select("*").order("sort_order", { ascending: true }).order("is_default", { ascending: false }),
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

  // Drag-and-drop reorder for pipelines
  const handlePipelineDragStart = (id: string) => {
    setDraggedPipelineId(id);
  };
  const handlePipelineDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedPipelineId && draggedPipelineId !== id) {
      setDragOverPipelineId(id);
    }
  };
  const handlePipelineDragEnd = () => {
    setDraggedPipelineId(null);
    setDragOverPipelineId(null);
  };
  const handlePipelineDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedPipelineId;
    setDraggedPipelineId(null);
    setDragOverPipelineId(null);
    if (!sourceId || sourceId === targetId) return;

    const ordered = [...pipelines].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const fromIdx = ordered.findIndex(p => p.id === sourceId);
    const toIdx = ordered.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);

    // Optimistic update
    const updated = ordered.map((p, idx) => ({ ...p, sort_order: idx } as any));
    setPipelines(updated);

    // Also reorder crm_origins.sort_order within each group, mirroring the new pipeline order
    // so the sidebar (grouped by origin) reflects the same sequence the user defined here.
    const pipelineOrderIndex = new Map<string, number>(updated.map((p: any, idx: number) => [p.id, idx]));
    const originsByGroup = new Map<string, Origin[]>();
    origins.forEach((o) => {
      if (!o.pipeline_id || !o.group_id) return;
      const arr = originsByGroup.get(o.group_id) || [];
      arr.push(o);
      originsByGroup.set(o.group_id, arr);
    });

    const updatedOrigins: Origin[] = [...origins];
    const originUpdates: { id: string; sort_order: number }[] = [];
    originsByGroup.forEach((groupOrigins) => {
      const sorted = [...groupOrigins].sort((a, b) => {
        const ai = pipelineOrderIndex.get(a.pipeline_id!) ?? Number.MAX_SAFE_INTEGER;
        const bi = pipelineOrderIndex.get(b.pipeline_id!) ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
      sorted.forEach((o, idx) => {
        if (o.sort_order !== idx) {
          originUpdates.push({ id: o.id, sort_order: idx });
          const target = updatedOrigins.find((u) => u.id === o.id);
          if (target) target.sort_order = idx;
        }
      });
    });
    setOrigins(updatedOrigins);

    try {
      await Promise.all([
        ...updated.map((p: any) =>
          supabase.from("crm_pipelines").update({ sort_order: p.sort_order }).eq("id", p.id)
        ),
        ...originUpdates.map((o) =>
          supabase.from("crm_origins").update({ sort_order: o.sort_order }).eq("id", o.id)
        ),
      ]);
    } catch (err) {
      console.error("Erro ao reordenar pipelines", err);
      toast.error("Erro ao salvar nova ordem");
      loadData();
    }
  };

  // Drag-and-drop reorder for stages within a pipeline
  const handleStageDragStart = (id: string) => setDraggedStageId(id);
  const handleStageDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedStageId && draggedStageId !== id) setDragOverStageId(id);
  };
  const handleStageDragEnd = () => {
    setDraggedStageId(null);
    setDragOverStageId(null);
  };
  const handleStageDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedStageId;
    setDraggedStageId(null);
    setDragOverStageId(null);
    if (!sourceId || sourceId === targetId) return;

    const pipelineStagesList = stages
      .filter(s => s.pipeline_id === selectedPipeline)
      .sort((a, b) => a.sort_order - b.sort_order);
    const fromIdx = pipelineStagesList.findIndex(s => s.id === sourceId);
    const toIdx = pipelineStagesList.findIndex(s => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = pipelineStagesList.splice(fromIdx, 1);
    pipelineStagesList.splice(toIdx, 0, moved);

    const updatedStages = stages.map(s => {
      if (s.pipeline_id !== selectedPipeline) return s;
      const idx = pipelineStagesList.findIndex(ps => ps.id === s.id);
      return idx === -1 ? s : { ...s, sort_order: idx };
    });
    setStages(updatedStages);

    try {
      await Promise.all(
        pipelineStagesList.map((s, idx) =>
          supabase.from("crm_stages").update({ sort_order: idx }).eq("id", s.id)
        )
      );
    } catch (err) {
      console.error("Erro ao reordenar etapas", err);
      toast.error("Erro ao salvar nova ordem das etapas");
      loadData();
    }
  };

  const handleTogglePipelineActive = async (pipeline: Pipeline) => {
    const newActive = !((pipeline as any).is_active ?? true);
    // Optimistic update
    setPipelines((prev) =>
      prev.map((p) => (p.id === pipeline.id ? ({ ...p, is_active: newActive } as any) : p))
    );
    try {
      // Toggle pipeline + linked origin so it disappears from the "Negócios" sidebar
      const linkedOrigin = origins.find((o) => o.pipeline_id === pipeline.id);
      const ops: any[] = [
        supabase.from("crm_pipelines").update({ is_active: newActive }).eq("id", pipeline.id).then((r: any) => r),
      ];
      if (linkedOrigin) {
        ops.push(
          supabase.from("crm_origins").update({ is_active: newActive }).eq("id", linkedOrigin.id).then((r: any) => r)
        );
        setOrigins((prev) =>
          prev.map((o) => (o.id === linkedOrigin.id ? { ...o, is_active: newActive } : o))
        );
      }
      const results = await Promise.all(ops);
      const firstError = results.find((r: any) => r?.error);
      if (firstError?.error) throw firstError.error;
      toast.success(newActive ? "Pipeline ativado" : "Pipeline inativado");
    } catch (err: any) {
      console.error("Erro ao alternar status do pipeline", err);
      toast.error(err?.message || "Erro ao atualizar status");
      loadData();
    }
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

      // 3. Create stages for new pipeline and map old IDs to new IDs
      if (originalStages.length > 0) {
        const stageIdMapping: Record<string, string> = {};

        // Insert stages one by one to get the new IDs
        for (const stage of originalStages) {
          const { data: newStage, error: stageError } = await supabase
            .from("crm_stages")
            .insert({
              pipeline_id: newPipeline.id,
              name: stage.name,
              sort_order: stage.sort_order,
              is_final: stage.is_final,
              final_type: stage.final_type,
              color: stage.color,
            })
            .select()
            .single();

          if (stageError) throw stageError;
          stageIdMapping[stage.id] = newStage.id;
        }

        // 4. Copy stage actions (automations) for each stage
        const oldStageIds = originalStages.map(s => s.id);
        const [actionsRes, checklistsRes] = await Promise.all([
          supabase.from("crm_stage_actions").select("*").in("stage_id", oldStageIds),
          supabase.from("crm_stage_checklists").select("*").in("stage_id", oldStageIds).eq("is_active", true),
        ]);

        if (actionsRes.error) throw actionsRes.error;
        if (checklistsRes.error) throw checklistsRes.error;

        if (actionsRes.data && actionsRes.data.length > 0) {
          const newActions = actionsRes.data.map(action => ({
            stage_id: stageIdMapping[action.stage_id],
            activity_type: action.activity_type,
            activity_title: action.activity_title,
            activity_description: action.activity_description,
            days_offset: action.days_offset,
            is_required: action.is_required,
            sort_order: action.sort_order,
            action_mode: action.action_mode,
            whatsapp_template: action.whatsapp_template,
            meeting_staff_id: action.meeting_staff_id,
            meeting_duration_minutes: action.meeting_duration_minutes,
          }));

          const { error: insertActionsError } = await supabase
            .from("crm_stage_actions")
            .insert(newActions);

          if (insertActionsError) throw insertActionsError;
        }

        // 5. Copy stage checklists for each stage
        if (checklistsRes.data && checklistsRes.data.length > 0) {
          const newChecklists = checklistsRes.data.map(item => ({
            stage_id: stageIdMapping[item.stage_id],
            title: item.title,
            description: item.description,
            sort_order: item.sort_order,
            is_active: true,
            item_type: item.item_type,
            whatsapp_template: item.whatsapp_template,
            whatsapp_attachments: item.whatsapp_attachments,
          }));

          const { error: insertChecklistError } = await supabase
            .from("crm_stage_checklists")
            .insert(newChecklists);

          if (insertChecklistError) throw insertChecklistError;
        }
      }

      toast.success(`Pipeline "${pipeline.name}" duplicado com todas as etapas e automações`);
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

  const handleUpdateReason = async () => {
    if (!editingReason || !newReasonName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("crm_loss_reasons")
        .update({ name: newReasonName })
        .eq("id", editingReason.id);
      
      if (error) throw error;
      toast.success("Motivo atualizado");
      setEditReasonOpen(false);
      setEditingReason(null);
      setNewReasonName("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar motivo");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReasonActive = async (reason: LossReason) => {
    try {
      const { error } = await supabase
        .from("crm_loss_reasons")
        .update({ is_active: !reason.is_active })
        .eq("id", reason.id);
      
      if (error) throw error;
      toast.success(reason.is_active ? "Motivo desativado" : "Motivo ativado");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar motivo");
    }
  };

  const openEditReason = (reason: LossReason) => {
    setEditingReason(reason);
    setNewReasonName(reason.name);
    setEditReasonOpen(true);
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

  const handleCopyStageConfig = async () => {
    if (!copySourceStage || !copyTargetStage) return;
    if (copySourceStage === copyTargetStage.id) {
      toast.error("Selecione uma etapa de origem diferente da etapa de destino");
      return;
    }
    if (!copyChecklist && !copyActions) {
      toast.error("Selecione pelo menos uma opção para copiar");
      return;
    }

    setCopying(true);
    try {
      const [checklistsRes, actionsRes] = await Promise.all([
        copyChecklist
          ? supabase
              .from("crm_stage_checklists")
              .select("title, description, sort_order, is_active, item_type, whatsapp_template, whatsapp_attachments")
              .eq("stage_id", copySourceStage)
              .order("sort_order")
          : Promise.resolve({ data: [], error: null }),
        copyActions
          ? supabase
              .from("crm_stage_actions")
              .select("activity_type, activity_title, activity_description, days_offset, is_required, sort_order, action_mode, whatsapp_template, meeting_staff_id, meeting_duration_minutes")
              .eq("stage_id", copySourceStage)
              .order("sort_order")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (checklistsRes.error) throw checklistsRes.error;
      if (actionsRes.error) throw actionsRes.error;

      const sourceChecklists = checklistsRes.data || [];
      const sourceActions = actionsRes.data || [];

      if ((copyChecklist && sourceChecklists.length === 0) && (copyActions && sourceActions.length === 0)) {
        toast.info("A etapa de origem não possui checklist nem automações para copiar.");
        return;
      }

      if (copyChecklist) {
        const { error: deleteChecklistError } = await supabase
          .from("crm_stage_checklists")
          .delete()
          .eq("stage_id", copyTargetStage.id);

        if (deleteChecklistError) throw deleteChecklistError;

        if (sourceChecklists.length > 0) {
          const newChecklists = sourceChecklists.map((item, index) => ({
            stage_id: copyTargetStage.id,
            title: item.title,
            description: item.description,
            sort_order: index,
            is_active: item.is_active ?? true,
            item_type: item.item_type,
            whatsapp_template: item.whatsapp_template,
            whatsapp_attachments: Array.isArray(item.whatsapp_attachments) ? item.whatsapp_attachments : [],
          }));

          const { error: insertChecklistError } = await supabase
            .from("crm_stage_checklists")
            .insert(newChecklists as any);

          if (insertChecklistError) throw insertChecklistError;
        }
      }

      if (copyActions) {
        const { error: deleteActionsError } = await supabase
          .from("crm_stage_actions")
          .delete()
          .eq("stage_id", copyTargetStage.id);

        if (deleteActionsError) throw deleteActionsError;

        if (sourceActions.length > 0) {
          const newActions = sourceActions.map((item, index) => ({
            stage_id: copyTargetStage.id,
            activity_type: item.activity_type,
            activity_title: item.activity_title,
            activity_description: item.activity_description,
            days_offset: item.days_offset,
            is_required: item.is_required ?? true,
            sort_order: index,
            action_mode: item.action_mode,
            whatsapp_template: item.whatsapp_template,
            meeting_staff_id: item.meeting_staff_id,
            meeting_duration_minutes: item.meeting_duration_minutes,
          }));

          const { error: insertActionsError } = await supabase
            .from("crm_stage_actions")
            .insert(newActions);

          if (insertActionsError) throw insertActionsError;
        }
      }

      const [targetChecklistCountRes, targetActionsCountRes] = await Promise.all([
        copyChecklist
          ? supabase
              .from("crm_stage_checklists")
              .select("id", { count: "exact", head: true })
              .eq("stage_id", copyTargetStage.id)
          : Promise.resolve({ count: 0, error: null }),
        copyActions
          ? supabase
              .from("crm_stage_actions")
              .select("id", { count: "exact", head: true })
              .eq("stage_id", copyTargetStage.id)
          : Promise.resolve({ count: 0, error: null }),
      ]);

      if (targetChecklistCountRes.error) throw targetChecklistCountRes.error;
      if (targetActionsCountRes.error) throw targetActionsCountRes.error;

      const copiedChecklistCount = targetChecklistCountRes.count || 0;
      const copiedActionsCount = targetActionsCountRes.count || 0;

      const parts = [];
      if (copiedChecklistCount > 0) parts.push(`${copiedChecklistCount} itens de checklist`);
      if (copiedActionsCount > 0) parts.push(`${copiedActionsCount} automações`);
      
      if (parts.length === 0) {
        toast.info("A etapa de destino foi limpa porque a origem não tinha itens desse tipo.");
      } else {
        toast.success(`${parts.join(" e ")} copiado(s) para "${copyTargetStage.name}".`);
      }
      
      setCopyDialogOpen(false);
      setCopyTargetStage(null);
      setCopySourcePipeline("");
      setCopySourceStage("");
      await loadData();
    } catch (error: any) {
      console.error("Error copying stage config:", error);
      toast.error("Erro ao copiar configuração");
    } finally {
      setCopying(false);
    }
  };

  const copySourceStages = stages.filter(s => s.pipeline_id === copySourcePipeline);

  const pipelineStages = stages
    .filter(s => s.pipeline_id === selectedPipeline)
    .sort((a, b) => a.sort_order - b.sort_order);
  const groupOrigins = origins.filter(o => o.group_id === selectedOriginGroup);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
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
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full justify-start overflow-x-auto">
          <TabsTrigger value="pipelines" className="gap-1.5 text-xs sm:text-sm">
            <Kanban className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Pipelines</span>
            <span className="sm:hidden">Pipes</span>
          </TabsTrigger>
          <TabsTrigger value="origins" className="gap-1.5 text-xs sm:text-sm">
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Origens
          </TabsTrigger>
          <TabsTrigger value="reasons" className="gap-1.5 text-xs sm:text-sm">
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Motivos de Perda</span>
            <span className="sm:hidden">Perdas</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5 text-xs sm:text-sm">
            <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Acessos
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm">
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Notificações</span>
            <span className="sm:hidden">Notif.</span>
          </TabsTrigger>
          <TabsTrigger value="message-rules" className="gap-1.5 text-xs sm:text-sm">
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Régua de Mensagens</span>
            <span className="sm:hidden">Régua</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5 text-xs sm:text-sm">
            <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Integrações</span>
            <span className="sm:hidden">Integ.</span>
          </TabsTrigger>
          <TabsTrigger value="forms" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Formulários
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
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Seus Pipelines</CardTitle>
                  <div className="w-56">
                    <Select value={pipelineGroupFilter} onValueChange={setPipelineGroupFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Filtrar por grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os grupos</SelectItem>
                        <SelectItem value="none">Sem grupo</SelectItem>
                        {originGroups.filter(g => g.is_active).map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Arraste os pipelines para reorganizar a ordem.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {pipelines
                  .filter(pipeline => {
                    if (pipelineGroupFilter === "all") return true;
                    const originForPipeline = origins.find(o => o.pipeline_id === pipeline.id);
                    if (pipelineGroupFilter === "none") return !originForPipeline?.group_id;
                    return originForPipeline?.group_id === pipelineGroupFilter;
                  })
                  .map(pipeline => {
                    const originForPipeline = origins.find(o => o.pipeline_id === pipeline.id);
                    const group = originGroups.find(g => g.id === originForPipeline?.group_id);
                    const isDragging = draggedPipelineId === pipeline.id;
                    const isDragOver = dragOverPipelineId === pipeline.id;
                    return (
                      <div
                        key={pipeline.id}
                        draggable
                        onDragStart={() => handlePipelineDragStart(pipeline.id)}
                        onDragOver={(e) => handlePipelineDragOver(e, pipeline.id)}
                        onDragLeave={() => setDragOverPipelineId(null)}
                        onDrop={(e) => handlePipelineDrop(e, pipeline.id)}
                        onDragEnd={handlePipelineDragEnd}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPipeline === pipeline.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        } ${isDragging ? "opacity-50" : ""} ${isDragOver ? "border-primary border-2" : ""}`}
                        onClick={() => setSelectedPipeline(pipeline.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{pipeline.name}</span>
                                {pipeline.is_default && (
                                  <Badge variant="secondary" className="text-xs">Padrão</Badge>
                                )}
                                {group && (
                                  <Badge variant="outline" className="text-xs">{group.name}</Badge>
                                )}
                              </div>
                              {pipeline.description && (
                                <p className="text-xs text-muted-foreground mt-1">{pipeline.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div
                              className="flex items-center gap-1.5 mr-1"
                              onClick={(e) => e.stopPropagation()}
                              title={(pipeline as any).is_active === false ? "Inativo (oculto no menu Negócios)" : "Ativo"}
                            >
                              <Switch
                                checked={(pipeline as any).is_active !== false}
                                onCheckedChange={() => handleTogglePipelineActive(pipeline)}
                              />
                            </div>
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
                    );
                  })}
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
                      draggable
                      onDragStart={() => handleStageDragStart(stage.id)}
                      onDragOver={(e) => handleStageDragOver(e, stage.id)}
                      onDragEnd={handleStageDragEnd}
                      onDrop={(e) => handleStageDrop(e, stage.id)}
                      className={cn(
                        "p-3 rounded-lg border border-border flex items-center gap-3 hover:bg-muted/50 transition-colors group",
                        draggedStageId === stage.id && "opacity-50",
                        dragOverStageId === stage.id && "border-primary border-2"
                      )}
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
                          setCopyTargetStage(stage);
                          setCopySourcePipeline("");
                          setCopySourceStage("");
                          setCopyChecklist(true);
                          setCopyActions(true);
                          setCopyDialogOpen(true);
                        }}
                        title="Copiar checklist/automações de outra etapa"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setChecklistStage(stage);
                          setStageChecklistOpen(true);
                        }}
                        title="Configurar checklist"
                      >
                        <ListChecks className="h-4 w-4" />
                      </Button>
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
                    className={`p-3 rounded-lg border border-border flex items-center justify-between ${!reason.is_active ? 'opacity-50 bg-muted/50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={!reason.is_active ? 'line-through' : ''}>{reason.name}</span>
                      {!reason.is_active && (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={reason.is_active}
                        onCheckedChange={() => handleToggleReasonActive(reason)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditReason(reason)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteDialog({ type: "reason", id: reason.id, name: reason.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Edit Reason Dialog */}
          <Dialog open={editReasonOpen} onOpenChange={setEditReasonOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Motivo de Perda</DialogTitle>
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
                <Button onClick={handleUpdateReason} disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <div className="space-y-8">
            <LeadNotificationSettings />
            <WonNotificationSettings />
          </div>
        </TabsContent>

        {/* Message Rules Tab */}
        <TabsContent value="message-rules" className="mt-6">
          <CRMMessageRulesTab pipelines={pipelines} stages={stages} />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="mt-6">
          <ClintIntegrationTab />
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="mt-6">
          <PipelineFormsManager />
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

      {/* Stage Checklist Dialog */}
      {checklistStage && (
        <StageChecklistDialog
          open={stageChecklistOpen}
          onOpenChange={(open) => {
            setStageChecklistOpen(open);
            if (!open) setChecklistStage(null);
          }}
          stageId={checklistStage.id}
          stageName={checklistStage.name}
        />
      )}

      {/* Copy Stage Config Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={(open) => {
        setCopyDialogOpen(open);
        if (!open) {
          setCopyTargetStage(null);
          setCopySourcePipeline("");
          setCopySourceStage("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Copiar configuração para "{copyTargetStage?.name}"
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pipeline de origem</Label>
              <Select value={copySourcePipeline} onValueChange={(v) => { setCopySourcePipeline(v); setCopySourceStage(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {copySourcePipeline && (
              <div>
                <Label>Etapa de origem</Label>
                <Select value={copySourceStage} onValueChange={setCopySourceStage}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {copySourceStages
                      .filter(s => s.id !== copyTargetStage?.id)
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t">
              <Label>O que copiar?</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={copyChecklist} onCheckedChange={setCopyChecklist} id="copy-checklist" />
                  <Label htmlFor="copy-checklist" className="flex items-center gap-1.5 cursor-pointer">
                    <ListChecks className="h-4 w-4" />
                    Checklist
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={copyActions} onCheckedChange={setCopyActions} id="copy-actions" />
                  <Label htmlFor="copy-actions" className="flex items-center gap-1.5 cursor-pointer">
                    <Zap className="h-4 w-4" />
                    Automações
                  </Label>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCopyStageConfig} 
              disabled={copying || !copySourceStage || (!copyChecklist && !copyActions)} 
              className="w-full"
            >
              {copying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Copiar Configuração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
