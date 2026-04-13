import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Plus, Trash2, Edit2, Loader2, Zap, Clock, MessageSquare, ChevronDown, ChevronUp, Send
} from "lucide-react";
import { toast } from "sonner";

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  sort_order: number;
}

interface NotificationRule {
  id: string;
  name: string;
  trigger_type: string;
  pipeline_id: string | null;
  stage_id: string | null;
  whatsapp_instance_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface RuleMessage {
  id: string;
  rule_id: string;
  message_template: string;
  delay_minutes: number;
  sort_order: number;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  status: string;
}

const TRIGGER_OPTIONS = [
  { value: "lead_created", label: "Lead criado" },
  { value: "stage_changed", label: "Lead mudou de etapa" },
  { value: "lead_won", label: "Lead ganho" },
  { value: "lead_lost", label: "Lead perdido" },
  { value: "lead_inactive", label: "Lead inativo" },
  { value: "meeting_scheduled", label: "Reunião agendada" },
];

const DELAY_OPTIONS = [
  { value: 0, label: "Imediato" },
  { value: 5, label: "5 minutos" },
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 360, label: "6 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "24 horas" },
  { value: 2880, label: "48 horas" },
  { value: 4320, label: "72 horas" },
  { value: 10080, label: "7 dias" },
];

const TEMPLATE_VARIABLES = [
  { var: "{lead_name}", desc: "Nome do lead" },
  { var: "{lead_phone}", desc: "Telefone do lead" },
  { var: "{lead_email}", desc: "Email do lead" },
  { var: "{company_name}", desc: "Empresa do lead" },
  { var: "{pipeline_name}", desc: "Nome do funil" },
  { var: "{stage_name}", desc: "Nome da etapa" },
  { var: "{primeiro_nome}", desc: "Primeiro nome do lead" },
];

interface CRMMessageRulesTabProps {
  pipelines: Pipeline[];
  stages: Stage[];
}

export const CRMMessageRulesTab = ({ pipelines, stages }: CRMMessageRulesTabProps) => {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [messages, setMessages] = useState<RuleMessage[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formPipeline, setFormPipeline] = useState<string>("all");
  const [formStage, setFormStage] = useState<string>("all");
  const [formInstance, setFormInstance] = useState<string>("");
  const [formMessages, setFormMessages] = useState<{ message_template: string; delay_minutes: number }[]>([
    { message_template: "", delay_minutes: 0 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, messagesRes, instancesRes] = await Promise.all([
        supabase
          .from("crm_notification_rules")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("crm_notification_rule_messages")
          .select("*")
          .order("sort_order"),
        supabase
          .from("whatsapp_instances")
          .select("id, instance_name, status")
          .eq("status", "connected"),
      ]);

      setRules(rulesRes.data || []);
      setMessages(messagesRes.data || []);
      setInstances(instancesRes.data || []);
    } catch (error) {
      console.error("Error loading message rules:", error);
      toast.error("Erro ao carregar réguas de mensagens");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormTrigger("");
    setFormPipeline("all");
    setFormStage("all");
    setFormInstance("");
    setFormMessages([{ message_template: "", delay_minutes: 0 }]);
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = async (rule: NotificationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormTrigger(rule.trigger_type);
    setFormPipeline(rule.pipeline_id || "all");
    setFormStage(rule.stage_id || "all");
    setFormInstance(rule.whatsapp_instance_id || "");

    const ruleMessages = messages
      .filter((m) => m.rule_id === rule.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    setFormMessages(
      ruleMessages.length > 0
        ? ruleMessages.map((m) => ({ message_template: m.message_template, delay_minutes: m.delay_minutes }))
        : [{ message_template: "", delay_minutes: 0 }]
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formTrigger || !formInstance) {
      toast.error("Preencha nome, gatilho e instância");
      return;
    }
    if (formMessages.some((m) => !m.message_template.trim())) {
      toast.error("Todas as mensagens devem ter conteúdo");
      return;
    }

    setSaving(true);
    try {
      const ruleData = {
        name: formName.trim(),
        trigger_type: formTrigger,
        pipeline_id: formPipeline === "all" ? null : formPipeline,
        stage_id: formStage === "all" ? null : formStage,
        whatsapp_instance_id: formInstance,
      };

      let ruleId: string;

      if (editingRule) {
        const { error } = await supabase
          .from("crm_notification_rules")
          .update(ruleData)
          .eq("id", editingRule.id);
        if (error) throw error;
        ruleId = editingRule.id;

        // Delete old messages
        await supabase
          .from("crm_notification_rule_messages")
          .delete()
          .eq("rule_id", ruleId);
      } else {
        const { data, error } = await supabase
          .from("crm_notification_rules")
          .insert(ruleData)
          .select("id")
          .single();
        if (error) throw error;
        ruleId = data.id;
      }

      // Insert messages
      const messageInserts = formMessages.map((m, i) => ({
        rule_id: ruleId,
        message_template: m.message_template.trim(),
        delay_minutes: m.delay_minutes,
        sort_order: i,
      }));

      const { error: msgError } = await supabase
        .from("crm_notification_rule_messages")
        .insert(messageInserts);
      if (msgError) throw msgError;

      toast.success(editingRule ? "Régua atualizada" : "Régua criada");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("crm_notification_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Régua excluída");
      setDeleteDialog(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      const { error } = await supabase
        .from("crm_notification_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast.error("Erro ao atualizar status");
    }
  };

  const addMessage = () => {
    setFormMessages((prev) => [...prev, { message_template: "", delay_minutes: 1440 }]);
  };

  const removeMessage = (index: number) => {
    if (formMessages.length <= 1) return;
    setFormMessages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMessage = (index: number, field: string, value: any) => {
    setFormMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const filteredStages = formPipeline && formPipeline !== "all"
    ? stages.filter((s) => s.pipeline_id === formPipeline)
    : [];

  const getTriggerLabel = (type: string) =>
    TRIGGER_OPTIONS.find((t) => t.value === type)?.label || type;

  const getDelayLabel = (minutes: number) => {
    const opt = DELAY_OPTIONS.find((d) => d.value === minutes);
    if (opt) return opt.label;
    if (minutes < 60) return `${minutes} minutos`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} horas`;
    return `${Math.round(minutes / 1440)} dias`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Régua de Mensagens
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure sequências automáticas de mensagens WhatsApp para seus leads
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Régua
        </Button>
      </div>

      {/* Variables reference */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Variáveis disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <Badge key={v.var} variant="outline" className="text-xs font-mono">
                {v.var} <span className="text-muted-foreground ml-1">= {v.desc}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma régua de mensagens configurada</p>
            <p className="text-sm mt-1">Crie uma régua para enviar mensagens automáticas aos seus leads</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const ruleMessages = messages
              .filter((m) => m.rule_id === rule.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const pipelineName = pipelines.find((p) => p.id === rule.pipeline_id)?.name;
            const stageName = stages.find((s) => s.id === rule.stage_id)?.name;
            const instanceName = instances.find((i) => i.id === rule.whatsapp_instance_id)?.instance_name;
            const isExpanded = expandedRule === rule.id;

            return (
              <Card key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{rule.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {getTriggerLabel(rule.trigger_type)}
                        </Badge>
                        {pipelineName && (
                          <Badge variant="outline" className="text-xs">
                            {pipelineName}
                          </Badge>
                        )}
                        {stageName && (
                          <Badge variant="outline" className="text-xs">
                            {stageName}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {ruleMessages.length} msg{ruleMessages.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      {instanceName && (
                        <p className="text-xs text-muted-foreground mt-1 ml-6">
                          Via: {instanceName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteDialog(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && ruleMessages.length > 0 && (
                    <div className="mt-4 ml-6 space-y-2 border-l-2 border-muted pl-4">
                      {ruleMessages.map((msg, i) => (
                        <div key={msg.id} className="flex items-start gap-3">
                          <div className="flex items-center gap-1.5 min-w-[100px]">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {getDelayLabel(msg.delay_minutes)}
                            </span>
                          </div>
                          <div className="flex-1 bg-muted/50 rounded-lg p-3">
                            <p className="text-sm whitespace-pre-wrap">{msg.message_template}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Régua de Mensagens" : "Nova Régua de Mensagens"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome da régua *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Boas-vindas funil principal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gatilho *</Label>
                <Select value={formTrigger} onValueChange={setFormTrigger}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Instância WhatsApp *</Label>
                <Select value={formInstance} onValueChange={setFormInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.instance_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pipeline</Label>
                <Select value={formPipeline} onValueChange={(v) => { setFormPipeline(v); setFormStage("all"); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os funis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os funis</SelectItem>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Etapa</Label>
                <Select
                  value={formStage}
                  onValueChange={setFormStage}
                  disabled={formPipeline === "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {filteredStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variables reference inside dialog */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Variáveis disponíveis (clique para copiar):</p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.var}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-mono hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(v.var);
                      toast({ title: `${v.var} copiado!`, duration: 1500 });
                    }}
                    title={v.desc}
                  >
                    {v.var}
                    <span className="text-muted-foreground font-sans">= {v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Messages sequence */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Sequência de mensagens</Label>
                <Button variant="outline" size="sm" onClick={addMessage} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar mensagem
                </Button>
              </div>

              <div className="space-y-4">
                {formMessages.map((msg, index) => (
                  <Card key={index} className="border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Mensagem {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <Select
                              value={String(msg.delay_minutes)}
                              onValueChange={(v) => updateMessage(index, "delay_minutes", parseInt(v))}
                            >
                              <SelectTrigger className="w-[150px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DELAY_OPTIONS.map((d) => (
                                  <SelectItem key={d.value} value={String(d.value)}>
                                    {d.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {formMessages.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeMessage(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Textarea
                        value={msg.message_template}
                        onChange={(e) => updateMessage(index, "message_template", e.target.value)}
                        placeholder="Digite a mensagem... Use variáveis como {lead_name}, {pipeline_name}"
                        rows={4}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {editingRule ? "Salvar alterações" : "Criar régua"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir régua de mensagens?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todas as mensagens configuradas nesta régua serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
