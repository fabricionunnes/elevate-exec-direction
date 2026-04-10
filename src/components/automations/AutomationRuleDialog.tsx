import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowRight, Search } from "lucide-react";
import {
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  TRIGGER_MODULES,
  getTriggerDefinition,
  getActionDefinition,
} from "./triggerConfig";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  status: string | null;
}

interface WhatsAppGroup {
  id: string;
  subject: string;
}

interface Pipeline {
  id: string;
  name: string;
}

interface AutomationRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: any | null;
  onSaved: () => void;
}

export function AutomationRuleDialog({
  open,
  onOpenChange,
  editingRule,
  onSaved,
}: AutomationRuleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [actionType, setActionType] = useState("");
  const [conditions, setConditions] = useState<Record<string, any>>({});
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});

  // WhatsApp dynamic data
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  // Pipelines for CRM triggers
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || "");
      setTriggerType(editingRule.trigger_type);
      setActionType(editingRule.action_type);
      const condObj: Record<string, any> = {};
      (editingRule.conditions || []).forEach((c: any) => {
        condObj[c.field] = c.value;
      });
      setConditions(condObj);
      setActionConfig(editingRule.action_config || {});
    } else {
      setName("");
      setDescription("");
      setTriggerType("");
      setActionType("");
      setConditions({});
      setActionConfig({});
    }
    setGroups([]);
    setGroupSearch("");
  }, [editingRule, open]);

  // Load pipelines on open
  useEffect(() => {
    if (open) {
      supabase.from("crm_pipelines").select("id, name").order("name").then(({ data }) => {
        setPipelines(data || []);
      });
    }
  }, [open]);

  // Load instances when action is send_whatsapp
  useEffect(() => {
    if (actionType === "send_whatsapp" && open) {
      loadInstances();
    }
  }, [actionType, open]);

  // Load groups when instance changes and target is group
  useEffect(() => {
    if (actionConfig.instance_id && actionConfig.target_type === "group") {
      loadGroups(actionConfig.instance_id);
    } else {
      setGroups([]);
    }
  }, [actionConfig.instance_id, actionConfig.target_type]);

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, display_name, status")
        .order("display_name");
      setInstances(data || []);
    } catch (e) {
      console.error("Error loading instances:", e);
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadGroups = async (instanceId: string) => {
    setLoadingGroups(true);
    setGroups([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke("evolution-api", {
        body: { action: "fetchGroups", instanceId },
      });

      if (response.error) {
        console.error("Error fetching groups:", response.error);
        toast.error("Erro ao buscar grupos da instância");
        return;
      }

      const rawGroups = response.data;
      console.log("[AutomationRuleDialog] Raw groups response:", JSON.stringify(rawGroups)?.substring(0, 500));
      
      // Evolution API returns different formats, normalize
      let parsed: WhatsAppGroup[] = [];
      
      // Handle various response shapes
      let groupArray: any[] = [];
      if (Array.isArray(rawGroups)) {
        groupArray = rawGroups;
      } else if (rawGroups && typeof rawGroups === 'object') {
        // Could be nested in a property like { data: [...] } or { groups: [...] }
        const possibleArrays = Object.values(rawGroups).filter(v => Array.isArray(v));
        if (possibleArrays.length > 0) {
          groupArray = possibleArrays[0] as any[];
        }
      }
      
      parsed = groupArray.map((g: any) => ({
        id: g.id || g.jid || g.groupJid || "",
        subject: g.subject || g.name || g.groupName || g.id || "",
      })).filter((g: WhatsAppGroup) => g.id);
      
      console.log("[AutomationRuleDialog] Parsed groups:", parsed.length);
      setGroups(parsed);
    } catch (e) {
      console.error("Error loading groups:", e);
    } finally {
      setLoadingGroups(false);
    }
  };

  const trigger = getTriggerDefinition(triggerType);
  const action = getActionDefinition(actionType);

  const handleSave = async () => {
    if (!name || !triggerType || !actionType) {
      toast.error("Preencha nome, trigger e ação");
      return;
    }

    setSaving(true);

    const conditionsArray = Object.entries(conditions)
      .filter(([_, v]) => v !== "" && v !== undefined)
      .map(([field, value]) => {
        const condField = trigger?.conditionFields.find((f) => f.key === field);
        return {
          field,
          operator: condField?.type === "number" ? "lte" : "eq",
          value: condField?.type === "number" ? Number(value) : value,
        };
      });

    // Build final action config - resolve instance_name from instance_id
    const finalActionConfig = { ...actionConfig };
    if (actionType === "send_whatsapp" && actionConfig.instance_id) {
      const inst = instances.find(i => i.id === actionConfig.instance_id);
      if (inst) {
        finalActionConfig.instance_name = inst.instance_name;
      }
    }

    const payload = {
      name,
      description: description || null,
      trigger_type: triggerType,
      trigger_config: {},
      conditions: conditionsArray,
      action_type: actionType,
      action_config: finalActionConfig,
    };

    let error;
    if (editingRule) {
      ({ error } = await supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", editingRule.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user?.id || "")
        .eq("is_active", true)
        .maybeSingle();

      ({ error } = await supabase
        .from("automation_rules")
        .insert({ ...payload, created_by: staff?.id || null }));
    }

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar regra");
      console.error(error);
    } else {
      toast.success(editingRule ? "Regra atualizada" : "Regra criada");
      onOpenChange(false);
      onSaved();
    }
  };

  const selectedInstance = instances.find(i => i.id === actionConfig.instance_id);
  const filteredGroups = groupSearch
    ? groups.filter(g => g.subject.toLowerCase().includes(groupSearch.toLowerCase()))
    : groups;

  // Render WhatsApp-specific config instead of generic fields
  const renderWhatsAppConfig = () => {
    const targetType = actionConfig.target_type || "";

    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Configuração da ação</Label>

        {/* Target type */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Enviar para</Label>
          <Select
            value={targetType}
            onValueChange={(v) => setActionConfig(prev => ({ ...prev, target_type: v, target_phone: "", group_jid: "" }))}
          >
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lead_phone">Telefone do lead (cadastrado)</SelectItem>
              <SelectItem value="phone">Número de telefone</SelectItem>
              <SelectItem value="group">Grupo do WhatsApp</SelectItem>
              <SelectItem value="cs_responsible">CS Responsável</SelectItem>
              <SelectItem value="consultant_responsible">Consultor Responsável</SelectItem>
              <SelectItem value="client_phone">Telefone do cliente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Instance selector (always shown for phone/group/lead_phone) */}
        {(targetType === "phone" || targetType === "group" || targetType === "lead_phone") && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Instância WhatsApp</Label>
            {loadingInstances ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando instâncias...
              </div>
            ) : (
              <Select
                value={actionConfig.instance_id || ""}
                onValueChange={(v) => setActionConfig(prev => ({ ...prev, instance_id: v, group_jid: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${inst.status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        {inst.display_name || inst.instance_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Phone number input */}
        {targetType === "phone" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Número de telefone</Label>
            <Input
              value={actionConfig.target_phone || ""}
              onChange={(e) => setActionConfig(prev => ({ ...prev, target_phone: e.target.value }))}
              placeholder="Ex: 5531999999999"
            />
          </div>
        )}

        {/* Group selector */}
        {targetType === "group" && actionConfig.instance_id && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Grupo</Label>
            {loadingGroups ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando grupos da instância...
              </div>
            ) : groups.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">
                Nenhum grupo encontrado nesta instância
              </div>
            ) : (
              <div className="space-y-2">
                {/* Search filter */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Buscar grupo pelo nome..."
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                {actionConfig.group_jid && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted text-sm">
                    <span className="truncate font-medium">{actionConfig.group_name || actionConfig.group_jid}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-auto shrink-0"
                      onClick={() => setActionConfig(prev => ({ ...prev, group_jid: "", target_phone: "", group_name: "" }))}
                    >
                      ×
                    </Button>
                  </div>
                )}
                <div className="border rounded-md max-h-[180px] overflow-y-auto">
                  {filteredGroups.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-3">
                      Nenhum grupo encontrado
                    </div>
                  ) : (
                    filteredGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${actionConfig.group_jid === g.id ? 'bg-accent font-medium' : ''}`}
                        onClick={() => {
                          setActionConfig(prev => ({
                            ...prev,
                            group_jid: g.id,
                            target_phone: g.id,
                            group_name: g.subject,
                          }));
                        }}
                      >
                        {g.subject}
                      </button>
                    ))
                  )}
                </div>
                {actionConfig.group_jid && (
                  <p className="text-[10px] text-muted-foreground font-mono break-all">
                    JID: {actionConfig.group_jid}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Instance selector for cs/consultant/client_phone */}
        {(targetType === "cs_responsible" || targetType === "consultant_responsible" || targetType === "client_phone") && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Instância WhatsApp</Label>
            <Select
              value={actionConfig.instance_id || ""}
              onValueChange={(v) => setActionConfig(prev => ({ ...prev, instance_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância..." />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${inst.status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      {inst.display_name || inst.instance_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Message */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mensagem</Label>
          <Textarea
            value={actionConfig.message || ""}
            onChange={(e) => setActionConfig(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Use variáveis como {job_title}, {candidate_name}..."
            rows={3}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? "Editar Automação" : "Nova Automação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome da regra</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alertar CS quando NPS baixo"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="O que essa automação faz?"
              rows={2}
            />
          </div>

          {/* Trigger */}
          <div className="space-y-2">
            <Label>Quando (Trigger)</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o evento..." />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_MODULES.map((mod) => {
                  const triggers = TRIGGER_DEFINITIONS.filter(
                    (t) => t.module === mod.key
                  );
                  return (
                    <div key={mod.key}>
                      <div className="px-2 py-1.5">
                        <Badge variant="outline" className={mod.color}>
                          {mod.label}
                        </Badge>
                      </div>
                      {triggers.map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Conditions */}
          {trigger && trigger.conditionFields.length > 0 && (
            <div className="space-y-2">
              <Label>Condições</Label>
              {trigger.conditionFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {field.label}
                  </Label>
                  {field.type === "pipeline_select" ? (
                    <Select
                      value={conditions[field.key] || ""}
                      onValueChange={(v) => setConditions(prev => ({ ...prev, [field.key]: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Todos os pipelines" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Todos os pipelines</SelectItem>
                        {pipelines.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "select" ? (
                    <Select
                      value={conditions[field.key] || ""}
                      onValueChange={(v) => setConditions(prev => ({ ...prev, [field.key]: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : "text"}
                      value={conditions[field.key] ?? ""}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.label}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Visual separator */}
          {triggerType && (
            <div className="flex items-center justify-center py-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Action */}
          <div className="space-y-2">
            <Label>Faça (Ação)</Label>
            <Select value={actionType} onValueChange={(v) => { setActionType(v); setActionConfig({}); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a ação..." />
              </SelectTrigger>
              <SelectContent>
                {ACTION_DEFINITIONS.map((a) => (
                  <SelectItem key={a.type} value={a.type}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Config - WhatsApp gets custom UI */}
          {actionType === "send_whatsapp" ? (
            renderWhatsAppConfig()
          ) : (
            action && action.configFields.length > 0 && (
              <div className="space-y-2">
                <Label>Configuração da ação</Label>
                {action.configFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {field.label}
                    </Label>
                    {field.type === "select" ? (
                      <Select
                        value={actionConfig[field.key] || ""}
                        onValueChange={(v) =>
                          setActionConfig((prev) => ({ ...prev, [field.key]: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === "textarea" ? (
                      <Textarea
                        value={actionConfig[field.key] || ""}
                        onChange={(e) =>
                          setActionConfig((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        placeholder={field.placeholder}
                        rows={2}
                      />
                    ) : (
                      <Input
                        value={actionConfig[field.key] || ""}
                        onChange={(e) =>
                          setActionConfig((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Available variables hint */}
          {trigger && trigger.variables && trigger.variables.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-1">
                {trigger.variables.map((v) => (
                  <Badge key={v} variant="secondary" className="text-[10px] font-mono cursor-pointer" onClick={() => {
                    const currentMsg = actionConfig.message || "";
                    setActionConfig(prev => ({ ...prev, message: currentMsg + `{${v}}` }));
                  }}>
                    {`{${v}}`}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Clique para inserir na mensagem</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingRule ? "Salvar alterações" : "Criar automação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
