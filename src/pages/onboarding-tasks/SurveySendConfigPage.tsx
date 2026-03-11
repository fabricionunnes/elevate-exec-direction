import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Send, Bell,
  MessageSquare, BarChart3, RefreshCw, CheckCircle2, Clock,
  AlertTriangle, ExternalLink, Loader2, Settings, Pencil, FlaskConical, Search,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SurveyConfig {
  id: string;
  survey_type: "nps" | "csat";
  is_active: boolean;
  whatsapp_instance_name: string | null;
  nps_frequency_days: number | null;
  max_follow_ups: number | null;
}

interface SurveyRule {
  id: string;
  config_id: string;
  day_offset: number;
  message_template: string;
  is_active: boolean;
  sort_order: number;
}

interface SendLog {
  id: string;
  project_id: string;
  company_id: string | null;
  survey_type: string;
  phone: string;
  contact_name: string | null;
  survey_link: string | null;
  meeting_subject: string | null;
  status: string;
  attempt_number: number;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string | null;
  status: string;
}

export default function SurveySendConfigPage() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<SurveyConfig[]>([]);
  const [rules, setRules] = useState<SurveyRule[]>([]);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("nps");
  const [editingRule, setEditingRule] = useState<SurveyRule | null>(null);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ day_offset: 0, message_template: "", is_active: true });
  const [logsTab, setLogsTab] = useState<"nps" | "csat">("nps");
  const [runningManual, setRunningManual] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testSurveyType, setTestSurveyType] = useState<"nps" | "csat">("nps");
  const [testCompanies, setTestCompanies] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [testSelectedCompany, setTestSelectedCompany] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, rulesRes, instancesRes, logsRes] = await Promise.all([
        supabase.from("survey_send_configs").select("*").order("survey_type"),
        supabase.from("survey_send_rules").select("*").order("sort_order"),
        supabase.from("whatsapp_instances").select("id, instance_name, display_name, status"),
        supabase.from("survey_send_log").select("*").order("created_at", { ascending: false }).limit(100),
      ]);

      setConfigs((configRes.data as any[]) || []);
      setRules((rulesRes.data as any[]) || []);
      setInstances((instancesRes.data as any[]) || []);
      setLogs((logsRes.data as any[]) || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getConfig = (type: "nps" | "csat") => configs.find(c => c.survey_type === type);
  const getRules = (configId: string) => rules.filter(r => r.config_id === configId).sort((a, b) => a.sort_order - b.sort_order);

  const updateConfig = async (configId: string, updates: Partial<SurveyConfig>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("survey_send_configs")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", configId);
      if (error) throw error;
      toast.success("Configuração salva!");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const openAddRule = (configId: string) => {
    const configRules = getRules(configId);
    setEditingRule(null);
    setRuleForm({
      day_offset: configRules.length > 0 ? Math.max(...configRules.map(r => r.day_offset)) + 3 : 0,
      message_template: "",
      is_active: true,
    });
    setShowRuleDialog(true);
  };

  const openEditRule = (rule: SurveyRule) => {
    setEditingRule(rule);
    setRuleForm({
      day_offset: rule.day_offset,
      message_template: rule.message_template,
      is_active: rule.is_active,
    });
    setShowRuleDialog(true);
  };

  const saveRule = async () => {
    const config = getConfig(activeTab as "nps" | "csat");
    if (!config) return;
    setSaving(true);
    try {
      if (editingRule) {
        const { error } = await supabase
          .from("survey_send_rules")
          .update({
            day_offset: ruleForm.day_offset,
            message_template: ruleForm.message_template,
            is_active: ruleForm.is_active,
          })
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const configRules = getRules(config.id);
        const { error } = await supabase
          .from("survey_send_rules")
          .insert({
            config_id: config.id,
            day_offset: ruleForm.day_offset,
            message_template: ruleForm.message_template,
            is_active: ruleForm.is_active,
            sort_order: configRules.length,
          });
        if (error) throw error;
      }
      toast.success(editingRule ? "Regra atualizada!" : "Regra adicionada!");
      setShowRuleDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar regra");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Excluir esta regra?")) return;
    try {
      const { error } = await supabase.from("survey_send_rules").delete().eq("id", ruleId);
      if (error) throw error;
      toast.success("Regra excluída!");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const handleRunManual = async (type: "nps" | "csat") => {
    if (!confirm(`Executar o envio de ${type.toUpperCase()} agora? Mensagens serão enviadas para todos os projetos elegíveis.`)) return;
    setRunningManual(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/survey-sender`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ type, manual: true }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      toast.success(`Envio executado! ${result.sent || 0} mensagens enviadas.`);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao executar envio");
    } finally {
      setRunningManual(false);
    }
  };

  const openTestDialog = async (type: "nps" | "csat") => {
    setTestSurveyType(type);
    setTestSelectedCompany(null);
    setTestSearch("");
    setShowTestDialog(true);
    setLoadingCompanies(true);
    try {
      const { data } = await supabase
        .from("onboarding_companies")
        .select("id, name, phone")
        .eq("status", "active")
        .order("name")
        .limit(200);
      setTestCompanies((data || []) as any[]);
    } catch {
      toast.error("Erro ao carregar empresas");
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSendTest = async () => {
    if (!testSelectedCompany) return;
    const company = testCompanies.find(c => c.id === testSelectedCompany);
    if (!company) return;

    setSendingTest(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/survey-sender`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            type: testSurveyType,
            manual: true,
            test: true,
            test_company_id: testSelectedCompany,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.sent > 0) {
        toast.success(`Teste enviado para ${company.name}!`);
      } else {
        toast.warning(`Nenhuma mensagem enviada. Verifique se a empresa tem telefone e projeto ativo.`);
      }
      setShowTestDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar teste");
    } finally {
      setSendingTest(false);
    }
  };

  const filteredTestCompanies = testCompanies.filter(c =>
    c.name.toLowerCase().includes(testSearch.toLowerCase())
  );

  const templateVars = {
    nps: [
      { var: "{nome}", desc: "Nome da empresa/contato" },
      { var: "{link}", desc: "Link da pesquisa NPS" },
      { var: "{empresa}", desc: "Nome da empresa" },
    ],
    csat: [
      { var: "{nome}", desc: "Nome da empresa/contato" },
      { var: "{link}", desc: "Link da pesquisa CSAT" },
      { var: "{assunto_reuniao}", desc: "Assunto da reunião" },
      { var: "{data_reuniao}", desc: "Data da reunião" },
      { var: "{empresa}", desc: "Nome da empresa" },
    ],
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "responded":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Respondido</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><Send className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case "stopped":
        return <Badge variant="secondary">Parado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderConfigPanel = (type: "nps" | "csat") => {
    const config = getConfig(type);
    if (!config) return <p className="text-muted-foreground text-sm">Configuração não encontrada.</p>;

    const configRules = getRules(config.id);

    return (
      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações Gerais - {type.toUpperCase()}
            </CardTitle>
            <CardDescription>
              {type === "nps" 
                ? "Configure a frequência e instância para envio automático de pesquisas NPS"
                : "Configure o envio automático de CSAT após reuniões finalizadas"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Envio Automático</Label>
                <p className="text-xs text-muted-foreground">
                  {type === "nps" ? "Enviar NPS periodicamente para todos os projetos ativos" : "Enviar CSAT automaticamente ao finalizar reuniões"}
                </p>
              </div>
              <Switch
                checked={config.is_active}
                onCheckedChange={(checked) => updateConfig(config.id, { is_active: checked })}
              />
            </div>

            {type === "nps" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Frequência (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={config.nps_frequency_days || 30}
                    onChange={(e) => updateConfig(config.id, { nps_frequency_days: parseInt(e.target.value) || 30 })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Intervalo entre ciclos de NPS (ex: 30 = mensal, 90 = trimestral)
                  </p>
                </div>
                <div>
                  <Label>Máximo de Follow-ups</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={config.max_follow_ups || 5}
                    onChange={(e) => updateConfig(config.id, { max_follow_ups: parseInt(e.target.value) || 5 })}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Após N envios sem resposta, para de enviar
                  </p>
                </div>
              </div>
            )}

            {type === "csat" && (
              <div>
                <Label>Máximo de Follow-ups</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={config.max_follow_ups || 3}
                  onChange={(e) => updateConfig(config.id, { max_follow_ups: parseInt(e.target.value) || 3 })}
                  className="mt-1 max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Após N envios sem resposta para a mesma reunião, para de enviar
                </p>
              </div>
            )}

            <div>
              <Label>Instância WhatsApp</Label>
              <Select
                value={config.whatsapp_instance_name || "default"}
                onValueChange={(v) => updateConfig(config.id, { whatsapp_instance_name: v === "default" ? null : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Instância padrão do sistema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Instância padrão do sistema</SelectItem>
                  {instances.filter(i => i.status === "connected").map(inst => (
                    <SelectItem key={inst.id} value={inst.instance_name}>
                      {inst.display_name || inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleRunManual(type)}
                disabled={runningManual || !config.is_active}
              >
                {runningManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Executar Agora
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openTestDialog(type)}
              >
                <FlaskConical className="h-4 w-4" />
                Envio de Teste
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rules (Régua) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Régua de Envio
                </CardTitle>
                <CardDescription>
                  Configure a sequência de mensagens e os dias de envio. O dia 0 é o primeiro envio.
                </CardDescription>
              </div>
              <Button size="sm" className="gap-2" onClick={() => openAddRule(config.id)}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {configRules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma regra configurada. Adicione a primeira regra de envio.
              </p>
            ) : (
              <div className="space-y-3">
                {configRules.map((rule, idx) => (
                  <motion.div
                    key={rule.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "border rounded-lg p-4 space-y-2 transition-colors",
                      !rule.is_active && "opacity-50 bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                          rule.day_offset === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          D{rule.day_offset}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {rule.day_offset === 0 ? "Primeiro envio" : `${rule.day_offset} dia${rule.day_offset > 1 ? "s" : ""} depois`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rule.is_active ? "Ativo" : "Desativado"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(rule)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {rule.message_template.length > 200
                          ? rule.message_template.slice(0, 200) + "..."
                          : rule.message_template}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Template variables help */}
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-dashed">
              <p className="text-xs font-medium text-muted-foreground mb-2">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {templateVars[type].map(v => (
                  <Badge key={v.var} variant="outline" className="text-xs font-mono">
                    {v.var} <span className="font-normal ml-1 text-muted-foreground">= {v.desc}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderLogsPanel = () => {
    const filteredLogs = logs.filter(l => l.survey_type === logsTab);
    const respondedCount = filteredLogs.filter(l => l.status === "responded").length;
    const sentCount = filteredLogs.filter(l => l.status === "sent").length;
    const pendingCount = filteredLogs.filter(l => l.status === "pending").length;
    const failedCount = filteredLogs.filter(l => l.status === "failed").length;

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={logsTab === "nps" ? "default" : "outline"}
            size="sm"
            onClick={() => setLogsTab("nps")}
          >
            NPS
          </Button>
          <Button
            variant={logsTab === "csat" ? "default" : "outline"}
            size="sm"
            onClick={() => setLogsTab("csat")}
          >
            CSAT
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Enviados", value: sentCount, color: "text-blue-600" },
            { label: "Respondidos", value: respondedCount, color: "text-green-600" },
            { label: "Pendentes", value: pendingCount, color: "text-yellow-600" },
            { label: "Falhas", value: failedCount, color: "text-red-600" },
          ].map(s => (
            <Card key={s.label} className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Logs table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    {logsTab === "csat" && <TableHead>Assunto</TableHead>}
                    <TableHead className="text-center">Tentativa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={logsTab === "csat" ? 6 : 5} className="text-center py-8 text-muted-foreground">
                        Nenhum envio registrado ainda
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm font-medium">{log.contact_name || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.phone}</TableCell>
                        {logsTab === "csat" && (
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {log.meeting_subject || "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs font-mono">{log.attempt_number}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.sent_at ? format(parseISO(log.sent_at), "dd/MM/yyyy HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Régua de Pesquisas (NPS / CSAT)
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure envio automático de pesquisas de satisfação via WhatsApp
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="nps" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            NPS
          </TabsTrigger>
          <TabsTrigger value="csat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            CSAT
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nps" className="mt-4">
          {renderConfigPanel("nps")}
        </TabsContent>
        <TabsContent value="csat" className="mt-4">
          {renderConfigPanel("csat")}
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          {renderLogsPanel()}
        </TabsContent>
      </Tabs>

      {/* Rule Edit Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Envio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dia de envio (offset)</Label>
                <Input
                  type="number"
                  min={0}
                  value={ruleForm.day_offset}
                  onChange={(e) => setRuleForm(f => ({ ...f, day_offset: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  0 = primeiro envio, 3 = 3 dias depois
                </p>
              </div>
              <div className="flex items-end pb-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ruleForm.is_active}
                    onCheckedChange={(checked) => setRuleForm(f => ({ ...f, is_active: checked }))}
                  />
                  <Label className="text-sm">Ativo</Label>
                </div>
              </div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                rows={8}
                value={ruleForm.message_template}
                onChange={(e) => setRuleForm(f => ({ ...f, message_template: e.target.value }))}
                placeholder="Olá {nome}! Gostaríamos de saber sua opinião..."
                className="mt-1 font-mono text-sm"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {templateVars[activeTab as "nps" | "csat"]?.map(v => (
                  <Button
                    key={v.var}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs font-mono"
                    onClick={() => setRuleForm(f => ({ ...f, message_template: f.message_template + v.var }))}
                  >
                    {v.var}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancelar</Button>
            <Button onClick={saveRule} disabled={saving || !ruleForm.message_template.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Envio de Teste - {testSurveyType.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione uma empresa para enviar uma mensagem de teste. Será enviada a primeira mensagem da régua.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="max-h-[250px] border rounded-lg">
              {loadingCompanies ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTestCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma empresa encontrada</p>
              ) : (
                <div className="p-1">
                  {filteredTestCompanies.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setTestSelectedCompany(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between",
                        testSelectedCompany === c.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className={cn(
                        "text-xs",
                        testSelectedCompany === c.id ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {c.phone || "Sem telefone"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSendTest}
              disabled={!testSelectedCompany || sendingTest}
              className="gap-2"
            >
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
