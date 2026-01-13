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
  Settings,
  Plus,
  Trash2,
  GripVertical,
  Palette,
  Tag,
  XCircle,
  Kanban,
  Loader2,
  Edit2
} from "lucide-react";
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

export const CRMSettingsPage = () => {
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [tags, setTags] = useState<CRMTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");

  // Dialogs
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newStageOpen, setNewStageOpen] = useState(false);
  const [newReasonOpen, setNewReasonOpen] = useState(false);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ type: string; id: string; name: string } | null>(null);

  // Form states
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6B7280");
  const [newReasonName, setNewReasonName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
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
      const [pipelinesRes, stagesRes, reasonsRes, tagsRes] = await Promise.all([
        supabase.from("crm_pipelines").select("*").order("is_default", { ascending: false }),
        supabase.from("crm_stages").select("*").order("sort_order"),
        supabase.from("crm_loss_reasons").select("*").order("sort_order"),
        supabase.from("crm_tags").select("*").order("name"),
      ]);

      setPipelines(pipelinesRes.data || []);
      setStages(stagesRes.data || []);
      setLossReasons(reasonsRes.data || []);
      setTags(tagsRes.data || []);

      if (pipelinesRes.data && pipelinesRes.data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(pipelinesRes.data[0].id);
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
        .insert({ name: newPipelineName, is_default: pipelines.length === 0 });
      
      if (error) throw error;
      toast.success("Pipeline criado");
      setNewPipelineOpen(false);
      setNewPipelineName("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar pipeline");
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
        });
      
      if (error) throw error;
      toast.success("Etapa criada");
      setNewStageOpen(false);
      setNewStageName("");
      setNewStageColor("#6B7280");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar etapa");
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
      const table = deleteDialog.type === "pipeline" ? "crm_pipelines" :
                    deleteDialog.type === "stage" ? "crm_stages" :
                    deleteDialog.type === "reason" ? "crm_loss_reasons" : "crm_tags";
      
      const { error } = await supabase.from(table).delete().eq("id", deleteDialog.id);
      
      if (error) throw error;
      toast.success("Item excluído");
      setDeleteDialog(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const pipelineStages = stages.filter(s => s.pipeline_id === selectedPipeline);

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
          Gerencie pipelines, etapas, tags e motivos de perda
        </p>
      </div>

      <Tabs defaultValue="pipelines" className="w-full">
        <TabsList>
          <TabsTrigger value="pipelines" className="gap-2">
            <Kanban className="h-4 w-4" />
            Pipelines
          </TabsTrigger>
          <TabsTrigger value="reasons" className="gap-2">
            <XCircle className="h-4 w-4" />
            Motivos de Perda
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </TabsTrigger>
        </TabsList>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pipelines</h2>
            <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
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
                    <Label>Nome</Label>
                    <Input
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      placeholder="Ex: Inbound, Outbound..."
                    />
                  </div>
                  <Button onClick={handleCreatePipeline} disabled={saving} className="w-full">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pipeline.name}</span>
                        {pipeline.is_default && (
                          <Badge variant="secondary" className="text-xs">Padrão</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDialog({ type: "pipeline", id: pipeline.id, name: pipeline.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                  <Dialog open={newStageOpen} onOpenChange={setNewStageOpen}>
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
                          <Label>Nome</Label>
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
                        <Button onClick={handleCreateStage} disabled={saving} className="w-full">
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Criar
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
                      className="p-3 rounded-lg border border-border flex items-center gap-3"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
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
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteDialog({ type: "stage", id: stage.id, name: stage.name })}
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
    </div>
  );
};
