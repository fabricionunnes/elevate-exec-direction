import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
  X, 
  ArrowRight, 
  Trash2, 
  UserPlus, 
  Loader2,
  CheckSquare,
  FolderInput
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createStageActivities } from "@/hooks/useStageActions";

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface Owner {
  id: string;
  name: string;
}

interface Pipeline {
  id: string;
  name: string;
}

interface KanbanBulkActionsProps {
  selectedLeads: string[];
  onClearSelection: () => void;
  stages: Stage[];
  owners: Owner[];
  onSuccess: () => void;
  isMaster: boolean;
  currentPipelineId?: string;
}

export const KanbanBulkActions = ({
  selectedLeads,
  onClearSelection,
  stages,
  owners,
  onSuccess,
  isMaster,
  currentPipelineId,
}: KanbanBulkActionsProps) => {
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moveToStage, setMoveToStage] = useState<string>("");
  const [assignToOwner, setAssignToOwner] = useState<string>("");
  const [moveToPipeline, setMoveToPipeline] = useState<string>("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  useEffect(() => {
    const loadPipelines = async () => {
      const { data } = await supabase
        .from("crm_pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      
      // Filter out current pipeline
      const filtered = (data || []).filter(p => p.id !== currentPipelineId);
      setPipelines(filtered);
    };
    
    if (selectedLeads.length > 0) {
      loadPipelines();
    }
  }, [selectedLeads.length, currentPipelineId]);

  const handleBulkMove = async () => {
    if (!moveToStage || selectedLeads.length === 0) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ stage_id: moveToStage })
        .in("id", selectedLeads);

      if (error) throw error;

      for (const leadId of selectedLeads) {
        await createStageActivities(leadId, moveToStage);
      }

      toast.success(`${selectedLeads.length} leads movidos com sucesso`);
      setMoveToStage("");
      onClearSelection();
      onSuccess();
    } catch (error) {
      console.error("Error moving leads:", error);
      toast.error("Erro ao mover leads");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkChangePipeline = async () => {
    if (!moveToPipeline || selectedLeads.length === 0) return;
    
    setLoading(true);
    try {
      // Get the first stage of the target pipeline
      const { data: targetStages, error: stagesError } = await supabase
        .from("crm_stages")
        .select("id")
        .eq("pipeline_id", moveToPipeline)
        .eq("is_final", false)
        .order("sort_order")
        .limit(1);

      if (stagesError) throw stagesError;
      if (!targetStages || targetStages.length === 0) {
        toast.error("O funil de destino não possui etapas disponíveis");
        return;
      }

      const targetStageId = targetStages[0].id;

      // Get the first origin of the target pipeline to sync origin_id
      const { data: targetOrigins } = await supabase
        .from("crm_origins")
        .select("id")
        .eq("pipeline_id", moveToPipeline)
        .eq("is_active", true)
        .limit(1);

      const targetOriginId = targetOrigins?.[0]?.id || null;

      // Update all leads
      const { error } = await supabase
        .from("crm_leads")
        .update({ 
          stage_id: targetStageId,
          origin_id: targetOriginId 
        })
        .in("id", selectedLeads);

      if (error) throw error;

      // Create stage activities for each lead
      for (const leadId of selectedLeads) {
        await createStageActivities(leadId, targetStageId);
      }

      toast.success(`${selectedLeads.length} leads movidos para outro funil`);
      setMoveToPipeline("");
      onClearSelection();
      onSuccess();
    } catch (error) {
      console.error("Error changing pipeline:", error);
      toast.error("Erro ao mudar funil");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!assignToOwner || selectedLeads.length === 0) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("crm_leads")
        .update({ owner_staff_id: assignToOwner })
        .in("id", selectedLeads);

      if (error) throw error;

      toast.success(`${selectedLeads.length} leads atribuídos com sucesso`);
      setAssignToOwner("");
      onClearSelection();
      onSuccess();
    } catch (error) {
      console.error("Error assigning leads:", error);
      toast.error("Erro ao atribuir leads");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    
    setLoading(true);
    try {
      await supabase.from("crm_lead_tags").delete().in("lead_id", selectedLeads);
      await supabase.from("crm_lead_history").delete().in("lead_id", selectedLeads);
      await supabase.from("crm_activities").delete().in("lead_id", selectedLeads);
      
      const { error } = await supabase
        .from("crm_leads")
        .delete()
        .in("id", selectedLeads);

      if (error) throw error;

      toast.success(`${selectedLeads.length} leads excluídos com sucesso`);
      setDeleteConfirmOpen(false);
      onClearSelection();
      onSuccess();
    } catch (error) {
      console.error("Error deleting leads:", error);
      toast.error("Erro ao excluir leads");
    } finally {
      setLoading(false);
    }
  };

  if (selectedLeads.length === 0 || !isMaster) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex flex-wrap items-center gap-3 animate-in slide-in-from-bottom-4 max-w-[95vw]">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          <Badge variant="secondary" className="text-sm">
            {selectedLeads.length} selecionado(s)
          </Badge>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Move to Stage */}
        <div className="flex items-center gap-2">
          <Select value={moveToStage} onValueChange={setMoveToStage}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <ArrowRight className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Mover para..." />
            </SelectTrigger>
            <SelectContent>
              {stages.map(stage => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {moveToStage && (
            <Button size="sm" onClick={handleBulkMove} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mover"}
            </Button>
          )}
        </div>

        {/* Change Pipeline */}
        {pipelines.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={moveToPipeline} onValueChange={setMoveToPipeline}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <FolderInput className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Mudar funil..." />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(pipeline => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {moveToPipeline && (
              <Button size="sm" onClick={handleBulkChangePipeline} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mover"}
              </Button>
            )}
          </div>
        )}

        {/* Assign Owner */}
        <div className="flex items-center gap-2">
          <Select value={assignToOwner} onValueChange={setAssignToOwner}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <UserPlus className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Atribuir a..." />
            </SelectTrigger>
            <SelectContent>
              {owners.map(owner => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignToOwner && (
            <Button size="sm" onClick={handleBulkAssign} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Atribuir"}
            </Button>
          )}
        </div>

        {/* Delete */}
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={loading}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Excluir
        </Button>

        {/* Clear Selection */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClearSelection}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedLeads.length} leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os leads selecionados e seus históricos serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir {selectedLeads.length} leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
