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
  GripVertical,
  Send,
  Info
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { X, ShieldCheck } from "lucide-react";
import { LEAD_FIELD_CATALOG, loadCustomFieldDefs, isCustomKey, customIdOf } from "@/lib/crm/stageGate";

interface StageAction {
  id: string;
  stage_id: string;
  activity_type: string;
  activity_title: string;
  activity_description: string | null;
  days_offset: number;
  offset_unit: string;
  is_required: boolean;
  sort_order: number;
  action_mode: string;
  whatsapp_template: string | null;
  meeting_staff_id: string | null;
  meeting_duration_minutes: number | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
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

const ACTION_MODES = [
  { value: "task", label: "Tarefa Normal", description: "Atividade padrão do dia a dia" },
  { value: "whatsapp_send", label: "Enviar WhatsApp", description: "Botão para enviar mensagem automática" },
  { value: "schedule_meeting", label: "Agendar Reunião", description: "Botão para agendar no Google Calendar" },
];

const TEMPLATE_VARIABLES = [
  { var: "{nome}", desc: "Nome do lead" },
  { var: "{empresa}", desc: "Empresa do lead" },
  { var: "{email}", desc: "Email do lead" },
  { var: "{telefone}", desc: "Telefone do lead" },
  { var: "{etapa}", desc: "Nome da etapa atual" },
  { var: "{funil}", desc: "Nome do funil" },
];

export function StageActionsDialog({ 
  open, 
  onOpenChange, 
  stageId, 
  stageName 
}: StageActionsDialogProps) {
  const [actions, setActions] = useState<StageAction[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New action form
  const [newActionType, setNewActionType] = useState("whatsapp");
  const [newActionMode, setNewActionMode] = useState("task");
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDescription, setNewActionDescription] = useState("");
  const [newActionDaysOffset, setNewActionDaysOffset] = useState(0);
  const [newActionOffsetUnit, setNewActionOffsetUnit] = useState("days");
  const [newActionRequired, setNewActionRequired] = useState(true);
  const [newWhatsappTemplate, setNewWhatsappTemplate] = useState("");
  const [newMeetingStaffId, setNewMeetingStaffId] = useState<string>("");
  const [newMeetingDuration, setNewMeetingDuration] = useState(60);
  const [showNewForm, setShowNewForm] = useState(false);

  // Campos exigidos pra ENTRAR na etapa (crm_stages.required_fields)
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [fieldChoices, setFieldChoices] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [newRequiredField, setNewRequiredField] = useState("");

  useEffect(() => {
    if (open && stageId) {
      loadActions();
      loadStaffMembers();
      loadRequiredFields();
    }
  }, [open, stageId]);

  const loadRequiredFields = async () => {
    try {
      const [{ data: st }, customs] = await Promise.all([
        supabase.from("crm_stages").select("required_fields").eq("id", stageId).maybeSingle(),
        loadCustomFieldDefs(),
      ]);
      setRequiredFields(((st as any)?.required_fields as string[] | null) || []);
      setFieldChoices([
        ...LEAD_FIELD_CATALOG.map((f) => ({ value: f.key, label: f.label })),
        ...customs.map((c) => ({ value: `custom:${c.id}`, label: c.label, hint: "adicional" })),
      ]);
    } catch (e) {
      console.error("loadRequiredFields:", e);
    }
  };

  const saveRequiredFields = async (keys: string[]) => {
    const before = requiredFields;
    setRequiredFields(keys);
    const { error } = await supabase.from("crm_stages").update({ required_fields: keys }).eq("id", stageId);
    if (error) {
      setRequiredFields(before);
      toast.error(error.message || "Erro ao salvar campos obrigatórios");
      return;
    }
    toast.success("Campos obrigatórios da etapa salvos");
  };

  const fieldLabelOf = (key: string) => {
    const c = fieldChoices.find((f) => f.value === key);
    if (c) return c.label;
    if (isCustomKey(key)) return `campo adicional ${customIdOf(key).slice(0, 8)}`;
    return key;
  };

  // Update activity type based on action mode
  useEffect(() => {
    if (newActionMode === "whatsapp_send") {
      setNewActionType("whatsapp");
    } else if (newActionMode === "schedule_meeting") {
      setNewActionType("meeting");
    }
  }, [newActionMode]);

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

  const loadStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .eq("is_active", true)
        .in("role", ["master", "admin", "head_comercial", "closer", "sdr", "cs", "consultant"]);

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error("Error loading staff:", error);
    }
  };

  const handleAddAction = async () => {
    if (!newActionTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (newActionMode === "whatsapp_send" && !newWhatsappTemplate.trim()) {
      toast.error("Template do WhatsApp é obrigatório");
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
          offset_unit: newActionOffsetUnit,
          is_required: newActionRequired,
          sort_order: maxOrder,
          action_mode: newActionMode,
          whatsapp_template: newActionMode === "whatsapp_send" ? newWhatsappTemplate : null,
          meeting_staff_id: newActionMode === "schedule_meeting" && newMeetingStaffId ? newMeetingStaffId : null,
          meeting_duration_minutes: newActionMode === "schedule_meeting" ? newMeetingDuration : null,
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
    setNewActionType("whatsapp");
    setNewActionMode("task");
    setNewActionTitle("");
    setNewActionDescription("");
    setNewActionDaysOffset(0);
    setNewActionOffsetUnit("days");
    setNewActionRequired(true);
    setNewWhatsappTemplate("");
    setNewMeetingStaffId("");
    setNewMeetingDuration(60);
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

  const getActionModeLabel = (mode: string) => {
    const actionMode = ACTION_MODES.find(m => m.value === mode);
    return actionMode?.label || "Tarefa";
  };

  const getActionModeBadgeVariant = (mode: string) => {
    switch (mode) {
      case "whatsapp_send": return "default";
      case "schedule_meeting": return "secondary";
      default: return "outline";
    }
  };

  const insertVariable = (variable: string) => {
    setNewWhatsappTemplate(prev => prev + variable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações da Etapa: {stageName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Condições pra ENTRAR na etapa */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Campos obrigatórios pra entrar nesta etapa</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao mover um lead pra cá, esses campos precisam estar preenchidos. Se faltar algum, quem move
              preenche na hora no diálogo de pendências. Master e admin podem passar por cima (fica no histórico).
            </p>
            {requiredFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {requiredFields.map((key) => (
                  <Badge key={key} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                    {fieldLabelOf(key)}
                    <button
                      type="button"
                      onClick={() => saveRequiredFields(requiredFields.filter((k) => k !== key))}
                      className="rounded hover:bg-muted p-0.5"
                      title="Deixar de exigir"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableSelect
                  value={newRequiredField}
                  onValueChange={setNewRequiredField}
                  options={fieldChoices.filter((c) => !requiredFields.includes(c.value))}
                  placeholder="Adicionar campo exigido..."
                  emptyMessage="Nenhum campo com esse nome."
                  className="h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={!newRequiredField}
                onClick={() => {
                  if (!newRequiredField) return;
                  saveRequiredFields([...requiredFields, newRequiredField]);
                  setNewRequiredField("");
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Exigir
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Configure as atividades que devem ser criadas automaticamente quando um lead entra nesta etapa.
            As marcadas como <strong>obrigatórias</strong> travam a saída da etapa enquanto estiverem pendentes.
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{action.activity_title}</span>
                            <Badge variant={getActionModeBadgeVariant(action.action_mode)} className="text-xs">
                              {getActionModeLabel(action.action_mode)}
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
                          {action.whatsapp_template && (
                            <p className="text-xs text-green-600 truncate">
                              📝 {action.whatsapp_template.substring(0, 50)}...
                            </p>
                          )}
                          {action.meeting_duration_minutes && (
                            <p className="text-xs text-blue-600">
                              ⏱️ Duração: {action.meeting_duration_minutes} min
                            </p>
                          )}
                          {action.days_offset !== 0 && (
                            <p className="text-xs text-muted-foreground">
                              Prazo: {action.days_offset > 0 ? `+${action.days_offset}` : action.days_offset}{" "}
                              {(action.offset_unit === "minutes" ? "min" : action.offset_unit === "hours" ? "hora(s)" : "dia(s)")}
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
                  {/* Action Mode */}
                  <div>
                    <Label className="flex items-center gap-1">
                      Modo da Ação *
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p><strong>Tarefa Normal:</strong> Atividade padrão</p>
                            <p><strong>Enviar WhatsApp:</strong> Botão de envio rápido</p>
                            <p><strong>Agendar Reunião:</strong> Botão para agendar</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select value={newActionMode} onValueChange={setNewActionMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            <div className="flex flex-col">
                              <span>{mode.label}</span>
                              <span className="text-xs text-muted-foreground">{mode.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Atividade *</Label>
                      <Select 
                        value={newActionType} 
                        onValueChange={setNewActionType}
                        disabled={newActionMode !== "task"}
                      >
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
                      <Label>Prazo</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          className="flex-1"
                          value={newActionDaysOffset}
                          onChange={(e) => setNewActionDaysOffset(parseInt(e.target.value) || 0)}
                          placeholder="0 = imediato"
                        />
                        <Select value={newActionOffsetUnit} onValueChange={setNewActionOffsetUnit}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutos</SelectItem>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="days">Dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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

                  {/* WhatsApp Template Section */}
                  {newActionMode === "whatsapp_send" && (
                    <div className="space-y-2">
                      <Label>Mensagem do WhatsApp *</Label>
                      <Textarea
                        value={newWhatsappTemplate}
                        onChange={(e) => setNewWhatsappTemplate(e.target.value)}
                        placeholder="Olá {nome}! 👋 Bem-vindo à nossa equipe..."
                        rows={4}
                        className="resize-none"
                      />
                      <div className="flex flex-wrap gap-1">
                        {TEMPLATE_VARIABLES.map((v) => (
                          <TooltipProvider key={v.var}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => insertVariable(v.var)}
                                >
                                  {v.var}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{v.desc}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meeting Configuration Section */}
                  {newActionMode === "schedule_meeting" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Staff padrão (opcional)</Label>
                        <Select value={newMeetingStaffId} onValueChange={setNewMeetingStaffId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolher na hora" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Escolher na hora</SelectItem>
                            {staffMembers.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id}>
                                {staff.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Duração (minutos)</Label>
                        <Select 
                          value={newMeetingDuration.toString()} 
                          onValueChange={(v) => setNewMeetingDuration(parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="90">1h30</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
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
