import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  MessageSquare,
  Play,
  Info,
  Smartphone,
} from "lucide-react";

interface BillingRule {
  id: string;
  name: string;
  trigger_type: "before" | "on_due" | "after";
  days_offset: number;
  message_template: string;
  is_active: boolean;
  include_payment_link: boolean;
  include_interest_info: boolean;
  include_discount_info: boolean;
  whatsapp_instance_name: string | null;
  created_at: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  status: string | null;
  phone_number: string | null;
}

const TEMPLATE_VARIABLES = [
  { var: "{{nome_cliente}}", desc: "Nome da empresa/cliente" },
  { var: "{{valor}}", desc: "Valor original da fatura" },
  { var: "{{vencimento}}", desc: "Data de vencimento" },
  { var: "{{descricao}}", desc: "Descrição da fatura" },
  { var: "{{link_pagamento}}", desc: "Link de pagamento" },
  { var: "{{juros}}", desc: "Valor dos juros acumulados" },
  { var: "{{multa}}", desc: "Valor da multa" },
  { var: "{{total_atualizado}}", desc: "Valor total com juros/multa" },
  { var: "{{desconto}}", desc: "Valor do desconto para antecipação" },
  { var: "{{total_com_desconto}}", desc: "Valor com desconto aplicado" },
  { var: "{{parcela}}", desc: "Número da parcela (ex: 2/6)" },
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  before: `Olá {{nome_cliente}}! 👋

Lembramos que você tem uma fatura próxima do vencimento:

📄 *{{descricao}}*
💰 *Valor:* {{valor}}
📅 *Vencimento:* {{vencimento}}
💚 *Desconto:* {{desconto}} (pagando até o vencimento)
💵 *Total com desconto:* {{total_com_desconto}}

Acesse o link para pagar:
🔗 {{link_pagamento}}

Obrigado! ✨`,
  on_due: `Olá {{nome_cliente}}! 👋

Sua fatura vence *hoje*:

📄 *{{descricao}}*
💰 *Valor:* {{valor}}
📅 *Vencimento:* {{vencimento}}

Acesse o link para pagar:
🔗 {{link_pagamento}}

Obrigado! ✨`,
  after: `Olá {{nome_cliente}}! 👋

Identificamos uma fatura em atraso:

📄 *{{descricao}}*
💰 *Valor original:* {{valor}}
📅 *Vencimento:* {{vencimento}}
⚠️ *Multa:* {{multa}}
📈 *Juros:* {{juros}}
💵 *Total atualizado:* {{total_atualizado}}

Regularize agora:
🔗 {{link_pagamento}}

Obrigado! ✨`,
};

export function BillingRulesPanel() {
  const [rules, setRules] = useState<BillingRule[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BillingRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningManual, setRunningManual] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTriggerType, setFormTriggerType] = useState<string>("before");
  const [formDaysOffset, setFormDaysOffset] = useState(3);
  const [formMessage, setFormMessage] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formIncludeLink, setFormIncludeLink] = useState(true);
  const [formIncludeInterest, setFormIncludeInterest] = useState(true);
  const [formIncludeDiscount, setFormIncludeDiscount] = useState(true);
  const [formInstanceName, setFormInstanceName] = useState("fabricionunnes");

  // Global instance config
  const [globalInstance, setGlobalInstance] = useState<string>("fabricionunnes");
  const [savingGlobal, setSavingGlobal] = useState(false);

  useEffect(() => {
    fetchRules();
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, display_name, status, phone_number")
      .eq("status", "connected")
      .order("display_name");
    setInstances(data || []);
  };

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from("billing_notification_rules")
      .select("*")
      .order("trigger_type")
      .order("days_offset");

    if (error) {
      toast.error("Erro ao carregar regras");
    } else {
      const rules = (data || []) as BillingRule[];
      setRules(rules);
      // Set global instance from first rule if available
      if (rules.length > 0 && rules[0].whatsapp_instance_name) {
        setGlobalInstance(rules[0].whatsapp_instance_name);
      }
    }
    setLoading(false);
  };

  const handleSaveGlobalInstance = async () => {
    setSavingGlobal(true);
    // Update all rules with the selected instance
    const { error } = await supabase
      .from("billing_notification_rules")
      .update({ whatsapp_instance_name: globalInstance } as any)
      .neq("id", "00000000-0000-0000-0000-000000000000"); // update all
    
    if (error) {
      toast.error("Erro ao salvar instância");
    } else {
      toast.success("Instância de envio atualizada para todas as regras");
      fetchRules();
    }
    setSavingGlobal(false);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormName("");
    setFormTriggerType("before");
    setFormDaysOffset(3);
    setFormMessage(DEFAULT_TEMPLATES.before);
    setFormActive(true);
    setFormIncludeLink(true);
    setFormIncludeInterest(true);
    setFormIncludeDiscount(true);
    setFormInstanceName(globalInstance);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: BillingRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormTriggerType(rule.trigger_type);
    setFormDaysOffset(rule.days_offset);
    setFormMessage(rule.message_template);
    setFormActive(rule.is_active);
    setFormIncludeLink(rule.include_payment_link);
    setFormIncludeInterest(rule.include_interest_info);
    setFormIncludeDiscount(rule.include_discount_info);
    setFormInstanceName(rule.whatsapp_instance_name || globalInstance);
    setDialogOpen(true);
  };

  const handleTriggerTypeChange = (type: string) => {
    setFormTriggerType(type);
    if (!editingRule) {
      setFormMessage(DEFAULT_TEMPLATES[type] || "");
      if (type === "on_due") setFormDaysOffset(0);
      else if (type === "before") setFormDaysOffset(3);
      else setFormDaysOffset(1);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formMessage.trim()) {
      toast.error("Preencha nome e mensagem");
      return;
    }
    setSaving(true);

    const payload = {
      name: formName.trim(),
      trigger_type: formTriggerType,
      days_offset: formTriggerType === "on_due" ? 0 : formDaysOffset,
      message_template: formMessage,
      is_active: formActive,
      include_payment_link: formIncludeLink,
      include_interest_info: formIncludeInterest,
      include_discount_info: formIncludeDiscount,
      whatsapp_instance_name: formInstanceName,
    };

    if (editingRule) {
      const { error } = await supabase
        .from("billing_notification_rules")
        .update(payload as any)
        .eq("id", editingRule.id);
      if (error) toast.error("Erro ao atualizar regra");
      else toast.success("Regra atualizada");
    } else {
      const { error } = await supabase
        .from("billing_notification_rules")
        .insert(payload as any);
      if (error) toast.error("Erro ao criar regra");
      else toast.success("Regra criada");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta regra?")) return;
    const { error } = await supabase
      .from("billing_notification_rules")
      .delete()
      .eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Regra excluída");
      fetchRules();
    }
  };

  const handleToggleActive = async (rule: BillingRule) => {
    const { error } = await supabase
      .from("billing_notification_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    if (error) toast.error("Erro ao atualizar");
    else fetchRules();
  };

  const handleRunManual = async () => {
    if (!confirm("Executar a régua de cobranças agora? Isso enviará mensagens WhatsApp para todos os clientes com faturas que se encaixem nas regras ativas.")) return;
    setRunningManual(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-notifications", {
        body: { manual: true },
      });
      if (error) throw error;
      toast.success(`Régua executada! ${data?.sent || 0} mensagens enviadas.`);
    } catch (e: any) {
      toast.error("Erro ao executar: " + (e.message || "erro desconhecido"));
    }
    setRunningManual(false);
  };

  const getTriggerLabel = (type: string, days: number) => {
    if (type === "on_due") return "No dia do vencimento";
    if (type === "before") return `${days} dia${days > 1 ? "s" : ""} antes`;
    return `${days} dia${days > 1 ? "s" : ""} após`;
  };

  const getTriggerColor = (type: string) => {
    if (type === "before") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (type === "on_due") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure regras para enviar notificações automáticas via WhatsApp antes, no dia ou após o vencimento das faturas.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunManual}
            disabled={runningManual}
          >
            {runningManual ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Executar Agora
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* WhatsApp Instance Config */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium">Instância de envio</h3>
              <p className="text-xs text-muted-foreground">Selecione qual conexão WhatsApp será usada para enviar as cobranças</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Select value={globalInstance} onValueChange={setGlobalInstance}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.instance_name}>
                      <div className="flex items-center gap-2">
                        <span>{inst.display_name}</span>
                        {inst.phone_number && (
                          <span className="text-xs text-muted-foreground">({inst.phone_number})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleSaveGlobalInstance}
                disabled={savingGlobal}
              >
                {savingGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma regra configurada.</p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira regra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{rule.name}</h3>
                      <Badge variant="outline" className={getTriggerColor(rule.trigger_type)}>
                        <Clock className="h-3 w-3 mr-1" />
                        {getTriggerLabel(rule.trigger_type, rule.days_offset)}
                      </Badge>
                      {!rule.is_active && (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rule.include_payment_link && (
                        <Badge variant="outline" className="text-xs">🔗 Link de pagamento</Badge>
                      )}
                      {rule.include_interest_info && (
                        <Badge variant="outline" className="text-xs">📈 Juros/Multa</Badge>
                      )}
                      {rule.include_discount_info && (
                        <Badge variant="outline" className="text-xs">💚 Desconto</Badge>
                      )}
                    </div>
                    <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg max-h-32 overflow-y-auto">
                      {rule.message_template}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Cobrança"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <Label>Nome da regra</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Lembrete 3 dias antes"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quando enviar</Label>
                <Select value={formTriggerType} onValueChange={handleTriggerTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Antes do vencimento</SelectItem>
                    <SelectItem value="on_due">No dia do vencimento</SelectItem>
                    <SelectItem value="after">Após o vencimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formTriggerType !== "on_due" && (
                <div>
                  <Label>Dias</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={formDaysOffset}
                    onChange={(e) => setFormDaysOffset(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Incluir link de pagamento</Label>
                <Switch checked={formIncludeLink} onCheckedChange={setFormIncludeLink} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Incluir informações de juros/multa</Label>
                <Switch checked={formIncludeInterest} onCheckedChange={setFormIncludeInterest} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Incluir informações de desconto</Label>
                <Switch checked={formIncludeDiscount} onCheckedChange={setFormIncludeDiscount} />
              </div>
            </div>

            <Separator />

            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="Digite a mensagem..."
              />
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Variáveis disponíveis (clique para inserir):</p>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.var}
                      type="button"
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                      title={v.desc}
                      onClick={() => setFormMessage((prev) => prev + v.var)}
                    >
                      {v.var}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Regra ativa</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Salvar" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
