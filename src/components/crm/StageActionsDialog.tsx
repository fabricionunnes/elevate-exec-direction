import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  MessageSquare,
  Video,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";

interface StageAction {
  id: string;
  stage_id: string;
  activity_type: string;
  activity_title: string;
  activity_description: string | null;
  days_offset: number;
  is_required: boolean;
  sort_order: number;
}

interface StageActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  stageName: string;
}

const ACTIVITY_TYPES = [
  { value: "call", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "meeting", label: "Reunião", icon: Calendar },
  { value: "task", label: "Tarefa", icon: FileText },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "video_call", label: "Videochamada", icon: Video },
];

export function StageActionsDialog({ 
  open, 
  onOpenChange, 
  stageId, 
  stageName 
}: StageActionsDialogProps) {
  const [actions, setActions] = useState<StageAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New action form
  const [newActionType, setNewActionType] = useState("call");
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDescription, setNewActionDescription] = useState("");
  const [newActionDaysOffset, setNewActionDaysOffset] = useState(0);
  const [newActionRequired, setNewActionRequired] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    if (open && stageId) {
      loadActions();
    }
  }, [open, stageId]);

  const loadActions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_stage_actions")
        .select("*")
        .eq("stage_id", stageId)
        .order("sort_order");

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error("Error loading actions:", error);
      toast.error("Erro ao carregar ações");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAction = async () => {
    if (!newActionTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const maxOrder = actions.length > 0 
        ? Math.max(...actions.map(a => a.sort_order)) + 1 
        : 0;

      const { error } = await supabase
        .from("crm_stage_actions")
        .insert({
          stage_id: stageId,
          activity_type: newActionType,
          activity_title: newActionTitle,
          activity_description: newActionDescription || null,
          days_offset: newActionDaysOffset,
          is_required: newActionRequired,
          sort_order: maxOrder,
        });

      if (error) throw error;
      
      toast.success("Ação adicionada");
      resetForm();
      loadActions();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar ação");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from("crm_stage_actions")
        .delete()
        .eq("id", actionId);

      if (error) throw error;
      
      toast.success("Ação removida");
      setActions(actions.filter(a => a.id !== actionId));
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover ação");
    }
  };

  const handleToggleRequired = async (action: StageAction) => {
    try {
      const { error } = await supabase
        .from("crm_stage_actions")
        .update({ is_required: !action.is_required })
        .eq("id", action.id);

      if (error) throw error;
      
      setActions(actions.map(a => 
        a.id === action.id ? { ...a, is_required: !a.is_required } : a
      ));
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar ação");
    }
  };

  const resetForm = () => {
    setNewActionType("call");
    setNewActionTitle("");
    setNewActionDescription("");
    setNewActionDaysOffset(0);
    setNewActionRequired(true);
    setShowNewForm(false);
  };

  const getActivityIcon = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.value === type);
    if (!activity) return FileText;
    return activity.icon;
  };

  const getActivityLabel = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.value === type);
    return activity?.label || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações da Etapa: {stageName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure as atividades que devem ser criadas automaticamente quando um lead entra nesta etapa.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Existing Actions */}
              <div className="space-y-2">
                {actions.length === 0 && !showNewForm ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    Nenhuma ação configurada para esta etapa
                  </p>
                ) : (
                  actions.map((action) => {
                    const Icon = getActivityIcon(action.activity_type);
                    return (
                      <div
                        key={action.id}
                        className="p-3 rounded-lg border border-border flex items-center gap-3"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{action.activity_title}</span>
                            <Badge variant="outline" className="text-xs">
                              {getActivityLabel(action.activity_type)}
                            </Badge>
                            {action.is_required && (
                              <Badge variant="secondary" className="text-xs">
                                Obrigatória
                              </Badge>
                            )}
                          </div>
                          {action.activity_description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {action.activity_description}
                            </p>
                          )}
                          {action.days_offset !== 0 && (
                            <p className="text-xs text-muted-foreground">
                              Prazo: {action.days_offset > 0 ? `+${action.days_offset}` : action.days_offset} dia(s)
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={action.is_required}
                            onCheckedChange={() => handleToggleRequired(action)}
                            title={action.is_required ? "Obrigatória" : "Opcional"}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteAction(action.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add New Action Form */}
              {showNewForm ? (
                <div className="p-4 rounded-lg border-2 border-dashed border-primary/50 bg-muted/30 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Atividade *</Label>
                      <Select value={newActionType} onValueChange={setNewActionType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prazo (dias)</Label>
                      <Input
                        type="number"
                        value={newActionDaysOffset}
                        onChange={(e) => setNewActionDaysOffset(parseInt(e.target.value) || 0)}
                        placeholder="0 = mesmo dia"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Título da Atividade *</Label>
                    <Input
                      value={newActionTitle}
                      onChange={(e) => setNewActionTitle(e.target.value)}
                      placeholder="Ex: Ligar para confirmar interesse"
                    />
                  </div>
                  
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Textarea
                      value={newActionDescription}
                      onChange={(e) => setNewActionDescription(e.target.value)}
                      placeholder="Instruções ou observações..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newActionRequired}
                      onCheckedChange={setNewActionRequired}
                    />
                    <Label>Atividade obrigatória</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddAction} 
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Adicionar Ação
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={resetForm}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={() => setShowNewForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Nova Ação
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
