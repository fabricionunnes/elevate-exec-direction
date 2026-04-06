import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit2, GripVertical, Palette, Kanban, Copy } from "lucide-react";
import { toast } from "sonner";
import type { ClientPipeline, ClientStage } from "./hooks/useClientCRM";

interface Props {
  projectId: string;
  pipelines: ClientPipeline[];
  stages: ClientStage[];
  activePipelineId: string | null;
  setActivePipelineId: (id: string | null) => void;
  onRefresh: () => void;
}

export const ClientCRMSettings = ({ projectId, pipelines, stages, activePipelineId, setActivePipelineId, onRefresh }: Props) => {
  const [selectedPipeline, setSelectedPipeline] = useState(activePipelineId || pipelines[0]?.id || "");
  const [saving, setSaving] = useState(false);

  // Pipeline form
  const [pipelineDialog, setPipelineDialog] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<ClientPipeline | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDesc, setPipelineDesc] = useState("");

  // Stage form
  const [stageDialog, setStageDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<ClientStage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageColor, setStageColor] = useState("#6366f1");
  const [stageIsFinal, setStageIsFinal] = useState(false);
  const [stageFinalType, setStageFinalType] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#f59e0b", "#22c55e", "#14b8a6", "#3b82f6", "#6b7280"];

  // Pipeline CRUD
  const openNewPipeline = () => {
    setEditingPipeline(null);
    setPipelineName("");
    setPipelineDesc("");
    setPipelineDialog(true);
  };

  const openEditPipeline = (p: ClientPipeline) => {
    setEditingPipeline(p);
    setPipelineName(p.name);
    setPipelineDesc(p.description || "");
    setPipelineDialog(true);
  };

  const savePipeline = async () => {
    if (!pipelineName.trim()) return;
    setSaving(true);
    try {
      if (editingPipeline) {
        await supabase.from("client_crm_pipelines").update({ name: pipelineName, description: pipelineDesc || null }).eq("id", editingPipeline.id);
        toast.success("Pipeline atualizado");
      } else {
        const { data } = await supabase.from("client_crm_pipelines").insert({
          project_id: projectId,
          name: pipelineName,
          description: pipelineDesc || null,
          is_default: pipelines.length === 0,
        }).select("id").single();
        if (data) {
          // Create default stages
          await supabase.from("client_crm_stages").insert([
            { pipeline_id: data.id, name: "Novo Lead", color: "#6366f1", sort_order: 0 },
            { pipeline_id: data.id, name: "Qualificação", color: "#8b5cf6", sort_order: 1 },
            { pipeline_id: data.id, name: "Proposta", color: "#f59e0b", sort_order: 2 },
            { pipeline_id: data.id, name: "Negociação", color: "#f97316", sort_order: 3 },
            { pipeline_id: data.id, name: "Ganho", color: "#22c55e", sort_order: 4, is_final: true, final_type: "won" },
            { pipeline_id: data.id, name: "Perdido", color: "#ef4444", sort_order: 5, is_final: true, final_type: "lost" },
          ]);
          setSelectedPipeline(data.id);
        }
        toast.success("Pipeline criado com etapas padrão");
      }
      setPipelineDialog(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const duplicatePipeline = async (p: ClientPipeline) => {
    setSaving(true);
    try {
      // 1. Create new pipeline
      const { data: newP } = await supabase.from("client_crm_pipelines").insert({
        project_id: projectId,
        name: `Cópia de ${p.name}`,
        description: p.description,
        is_default: false,
      }).select("id").single();

      if (!newP) throw new Error("Erro ao criar pipeline");

      // 2. Duplicate stages and build old→new ID map
      const pStages = stages.filter(s => s.pipeline_id === p.id);
      const stageIdMap: Record<string, string> = {};

      if (pStages.length > 0) {
        const { data: newStages } = await supabase.from("client_crm_stages").insert(
          pStages.map(s => ({
            pipeline_id: newP.id,
            name: s.name,
            color: s.color,
            sort_order: s.sort_order,
            is_final: s.is_final,
            final_type: s.final_type,
          }))
        ).select("id, sort_order");

        if (newStages) {
          const sortedOld = [...pStages].sort((a, b) => a.sort_order - b.sort_order);
          const sortedNew = [...newStages].sort((a, b) => a.sort_order - b.sort_order);
          sortedOld.forEach((oldS, i) => {
            if (sortedNew[i]) stageIdMap[oldS.id] = sortedNew[i].id;
          });
        }
      }

      // 3. Duplicate activities from deals in the old pipeline (as pending tasks)
      const { data: oldDeals } = await supabase
        .from("client_crm_deals")
        .select("id")
        .eq("pipeline_id", p.id)
        .eq("project_id", projectId);

      if (oldDeals && oldDeals.length > 0) {
        const dealIds = oldDeals.map(d => d.id);
        const { data: oldActivities } = await supabase
          .from("client_crm_activities")
          .select("*")
          .in("deal_id", dealIds);

        if (oldActivities && oldActivities.length > 0) {
          await supabase.from("client_crm_activities").insert(
            oldActivities.map(a => ({
              project_id: projectId,
              deal_id: null,
              contact_id: a.contact_id,
              type: a.type,
              title: a.title,
              description: a.description,
              scheduled_at: a.scheduled_at,
              status: "pending",
              created_by: a.created_by,
              assigned_to: a.assigned_to,
            }))
          );
        }
      }

      // 4. Duplicate automation rules that reference the old pipeline
      const { data: allRules } = await supabase
        .from("automation_rules")
        .select("*");

      if (allRules) {
        const oldPipelineId = p.id;
        const relatedRules = allRules.filter(r => {
          const configStr = JSON.stringify(r.trigger_config) + JSON.stringify(r.conditions) + JSON.stringify(r.action_config);
          return configStr.includes(oldPipelineId);
        });

        if (relatedRules.length > 0) {
          const replaceIds = (obj: any): any => {
            let str = JSON.stringify(obj);
            str = str.replaceAll(oldPipelineId, newP.id);
            Object.entries(stageIdMap).forEach(([oldId, newId]) => {
              str = str.replaceAll(oldId, newId);
            });
            return JSON.parse(str);
          };

          await supabase.from("automation_rules").insert(
            relatedRules.map(r => ({
              name: `${r.name} (cópia)`,
              description: r.description,
              trigger_type: r.trigger_type,
              trigger_config: replaceIds(r.trigger_config),
              conditions: replaceIds(r.conditions),
              action_type: r.action_type,
              action_config: replaceIds(r.action_config),
              is_active: r.is_active,
              created_by: r.created_by,
            }))
          );
        }
      }

      setSelectedPipeline(newP.id);
      toast.success("Pipeline duplicado com tarefas e automações");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao duplicar");
    } finally {
      setSaving(false);
    }
  };

  // Stage CRUD
  const openNewStage = () => {
    setEditingStage(null);
    setStageName("");
    setStageColor("#6366f1");
    setStageIsFinal(false);
    setStageFinalType(null);
    setStageDialog(true);
  };

  const openEditStage = (s: ClientStage) => {
    setEditingStage(s);
    setStageName(s.name);
    setStageColor(s.color);
    setStageIsFinal(s.is_final);
    setStageFinalType(s.final_type);
    setStageDialog(true);
  };

  const saveStage = async () => {
    if (!stageName.trim()) return;
    setSaving(true);
    try {
      if (editingStage) {
        await supabase.from("client_crm_stages").update({
          name: stageName,
          color: stageColor,
          is_final: stageIsFinal,
          final_type: stageIsFinal ? stageFinalType : null,
        }).eq("id", editingStage.id);
        toast.success("Etapa atualizada");
      } else {
        const maxOrder = Math.max(0, ...pipelineStages.map(s => s.sort_order));
        await supabase.from("client_crm_stages").insert({
          pipeline_id: selectedPipeline,
          name: stageName,
          color: stageColor,
          sort_order: maxOrder + 1,
          is_final: stageIsFinal,
          final_type: stageIsFinal ? stageFinalType : null,
        });
        toast.success("Etapa criada");
      }
      setStageDialog(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.type === "pipeline") {
        await supabase.from("client_crm_pipelines").update({ is_active: false }).eq("id", deleteTarget.id);
        if (selectedPipeline === deleteTarget.id) {
          const remaining = pipelines.filter(p => p.id !== deleteTarget.id);
          setSelectedPipeline(remaining[0]?.id || "");
        }
      } else if (deleteTarget.type === "stage") {
        await supabase.from("client_crm_stages").delete().eq("id", deleteTarget.id);
      }
      toast.success("Excluído com sucesso");
      setDeleteTarget(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pipelines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Kanban className="h-4 w-4" /> Pipelines
          </CardTitle>
          <Button size="sm" className="gap-1" onClick={openNewPipeline}>
            <Plus className="h-4 w-4" /> Novo Pipeline
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {pipelines.map(p => (
            <div
              key={p.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedPipeline === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => setSelectedPipeline(p.id)}
            >
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                {p.is_default && <Badge variant="secondary" className="text-[10px] mt-1">Padrão</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); duplicatePipeline(p); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditPipeline(p); }}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                {!p.is_default && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "pipeline", id: p.id, name: p.name }); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stages for selected pipeline */}
      {selectedPipeline && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Etapas do Pipeline</CardTitle>
            <Button size="sm" className="gap-1" onClick={openNewStage}>
              <Plus className="h-4 w-4" /> Nova Etapa
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {pipelineStages.sort((a, b) => a.sort_order - b.sort_order).map(stage => (
              <div key={stage.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{stage.name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {stage.is_final && (
                      <Badge variant="outline" className="text-[10px]">
                        {stage.final_type === "won" ? "✅ Ganho" : "❌ Perdido"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStage(stage)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ type: "stage", id: stage.id, name: stage.name })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {pipelineStages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma etapa criada</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pipeline Dialog */}
      <Dialog open={pipelineDialog} onOpenChange={setPipelineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPipeline ? "Editar Pipeline" : "Novo Pipeline"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="Ex: Pipeline de Vendas" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={pipelineDesc} onChange={(e) => setPipelineDesc(e.target.value)} placeholder="Descrição opcional" />
            </div>
            <Button onClick={savePipeline} disabled={saving || !pipelineName.trim()} className="w-full">
              {saving ? "Salvando..." : editingPipeline ? "Salvar" : "Criar Pipeline"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Ex: Qualificação" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {colors.map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${stageColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setStageColor(c)}
                  />
                ))}
                <Input type="color" value={stageColor} onChange={(e) => setStageColor(e.target.value)} className="w-8 h-8 p-0 border-0 cursor-pointer" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={stageIsFinal} onCheckedChange={setStageIsFinal} />
              <Label>Etapa final (encerra o negócio)</Label>
            </div>
            {stageIsFinal && (
              <div>
                <Label>Tipo</Label>
                <Select value={stageFinalType || ""} onValueChange={setStageFinalType}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">Ganho ✅</SelectItem>
                    <SelectItem value="lost">Perdido ❌</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={saveStage} disabled={saving || !stageName.trim()} className="w-full">
              {saving ? "Salvando..." : editingStage ? "Salvar" : "Criar Etapa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.type === "pipeline" ? "Pipeline" : "Etapa"}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
