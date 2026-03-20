import { useState, useEffect } from "react";
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
import { Loader2, ArrowRight } from "lucide-react";
import {
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  TRIGGER_MODULES,
  getTriggerDefinition,
  getActionDefinition,
} from "./triggerConfig";

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

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setDescription(editingRule.description || "");
      setTriggerType(editingRule.trigger_type);
      setActionType(editingRule.action_type);
      // Parse conditions array to object
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
  }, [editingRule, open]);

  const trigger = getTriggerDefinition(triggerType);
  const action = getActionDefinition(actionType);

  const handleSave = async () => {
    if (!name || !triggerType || !actionType) {
      toast.error("Preencha nome, trigger e ação");
      return;
    }

    setSaving(true);

    // Convert conditions object to array format
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

    const payload = {
      name,
      description: description || null,
      trigger_type: triggerType,
      trigger_config: {},
      conditions: conditionsArray,
      action_type: actionType,
      action_config: actionConfig,
    };

    let error;
    if (editingRule) {
      ({ error } = await supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", editingRule.id));
    } else {
      // Get staff id for created_by
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

          {/* Action Config */}
          {action && action.configFields.length > 0 && (
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
          )

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingRule ? "Salvar alterações" : "Criar automação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
