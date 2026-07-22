import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Zap, Bot, Trash2, Loader2, MessageSquare, Instagram } from "lucide-react";

interface Agent {
  id: string; name: string; objective: string | null; greeting: string | null;
  instructions: string | null; tone: string | null; reply_mode: string | null;
  is_active: boolean; can_move_stage: boolean; model: string | null;
  trigger_keywords: string[] | null; trigger_match_type: string | null; trigger_channels: string[] | null;
}
interface Rule {
  id: string; name: string; keywords: string[]; match_type: string; channels: string[];
  listen_dm: boolean; listen_comment: boolean; pipeline_id: string | null;
  agent_id: string | null; comment_public_reply: string | null; comment_dm_text: string | null;
  is_active: boolean; priority: number;
}

const MATCH_LABELS: Record<string, string> = { contains: "Contém", exact: "Exata", starts: "Começa com" };

export default function CRMAutomationsPage() {
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState<Rule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ruleDialog, setRuleDialog] = useState(false);
  const [editRule, setEditRule] = useState<Partial<Rule> | null>(null);
  const [keywordsText, setKeywordsText] = useState("");

  const [agentDialog, setAgentDialog] = useState(false);
  const [editAgent, setEditAgent] = useState<Partial<Agent> | null>(null);
  const [agentKwText, setAgentKwText] = useState("");

  const load = async () => {
    setLoading(true);
    const [r, a, p] = await Promise.all([
      supabase.from("crm_keyword_triggers").select("*").order("priority", { ascending: false }),
      supabase.from("crm_ai_agents").select("id, name, objective, greeting, instructions, tone, reply_mode, is_active, can_move_stage, model, trigger_keywords, trigger_match_type, trigger_channels").order("created_at"),
      supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("sort_order"),
    ]);
    setRules(r.data || []);
    setAgents(a.data || []);
    setPipelines(p.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const agentName = (id: string | null) => agents.find((x) => x.id === id)?.name || "—";

  const openNewRule = () => {
    setEditRule({ name: "", keywords: [], match_type: "contains", channels: ["whatsapp", "instagram"], listen_dm: true, listen_comment: false, pipeline_id: null, agent_id: agents[0]?.id || null, is_active: true, priority: 0 });
    setKeywordsText("");
    setRuleDialog(true);
  };
  const openEditRule = (rule: Rule) => {
    setEditRule({ ...rule });
    setKeywordsText((rule.keywords || []).join(", "));
    setRuleDialog(true);
  };
  const saveRule = async () => {
    if (!editRule?.name?.trim()) { toast.error("Dê um nome à regra"); return; }
    const kws = keywordsText.split(",").map((k) => k.trim()).filter(Boolean);
    if (kws.length === 0) { toast.error("Adicione ao menos uma palavra-chave"); return; }
    if (!editRule.agent_id) { toast.error("Escolha o agente qualificador"); return; }
    setSaving(true);
    const payload = {
      name: editRule.name.trim(), keywords: kws, match_type: editRule.match_type || "contains",
      channels: editRule.channels || [], listen_dm: editRule.listen_dm ?? true, listen_comment: editRule.listen_comment ?? false,
      pipeline_id: editRule.pipeline_id || null, agent_id: editRule.agent_id,
      comment_public_reply: editRule.comment_public_reply || null, comment_dm_text: editRule.comment_dm_text || null,
      is_active: editRule.is_active ?? true, priority: editRule.priority ?? 0,
    };
    const { error } = editRule.id
      ? await supabase.from("crm_keyword_triggers").update(payload).eq("id", editRule.id)
      : await supabase.from("crm_keyword_triggers").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Regra salva");
    setRuleDialog(false); load();
  };
  const toggleRule = async (rule: Rule) => {
    await supabase.from("crm_keyword_triggers").update({ is_active: !rule.is_active }).eq("id", rule.id);
    load();
  };
  const deleteRule = async (id: string) => {
    if (!confirm("Excluir esta regra?")) return;
    await supabase.from("crm_keyword_triggers").delete().eq("id", id);
    load();
  };

  const openNewAgent = () => {
    setEditAgent({ name: "", objective: "", greeting: "", instructions: "", tone: "consultivo e direto", reply_mode: "auto", is_active: false, can_move_stage: false, model: "claude-sonnet-5", trigger_match_type: "contains", trigger_channels: ["whatsapp", "instagram"] });
    setAgentKwText("");
    setAgentDialog(true);
  };
  const openEditAgent = (a: Agent) => { setEditAgent({ ...a }); setAgentKwText((a.trigger_keywords || []).join(", ")); setAgentDialog(true); };
  const saveAgent = async () => {
    if (!editAgent?.name?.trim()) { toast.error("Dê um nome ao agente"); return; }
    setSaving(true);
    const payload = {
      name: editAgent.name.trim(), objective: editAgent.objective || null, greeting: editAgent.greeting || null,
      instructions: editAgent.instructions || null, tone: editAgent.tone || null, reply_mode: editAgent.reply_mode || "copilot",
      is_active: editAgent.is_active ?? false, can_move_stage: editAgent.can_move_stage ?? false, model: editAgent.model || "claude-sonnet-5",
      trigger_keywords: agentKwText.split(",").map((k) => k.trim()).filter(Boolean),
      trigger_match_type: editAgent.trigger_match_type || "contains",
      trigger_channels: editAgent.trigger_channels || ["whatsapp", "instagram"],
    };
    const { error } = editAgent.id
      ? await supabase.from("crm_ai_agents").update(payload).eq("id", editAgent.id)
      : await supabase.from("crm_ai_agents").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Agente salvo");
    setAgentDialog(false); load();
  };

  return (
    <div className="max-w-5xl mx-auto p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Automações por palavra-chave</h1>
          <p className="text-sm text-muted-foreground">Quando o lead responder uma palavra-chave, um agente entra qualificando sozinho — no WhatsApp e no Instagram.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rules"><Zap className="h-4 w-4 mr-1.5" />Palavras-chave</TabsTrigger>
          <TabsTrigger value="agents"><Bot className="h-4 w-4 mr-1.5" />Agentes qualificadores</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={openNewRule}><Plus className="h-4 w-4 mr-1.5" />Nova regra</Button>
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            : rules.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma regra ainda. Crie a primeira.</CardContent></Card>
            : rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{rule.name}</span>
                      <Badge variant="outline" className="text-[10px]">{MATCH_LABELS[rule.match_type]}</Badge>
                      {rule.channels?.includes("whatsapp") && <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />}
                      {rule.channels?.includes("instagram") && <Instagram className="h-3.5 w-3.5 text-pink-500" />}
                      {rule.listen_comment && <Badge variant="secondary" className="text-[10px]">comentário</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {(rule.keywords || []).slice(0, 8).map((k) => <Badge key={k} variant="secondary" className="text-[11px]">{k}</Badge>)}
                    </div>
                    <p className="text-xs text-muted-foreground">Agente: {agentName(rule.agent_id)}{rule.pipeline_id ? ` · funil: ${pipelines.find(p => p.id === rule.pipeline_id)?.name || ""}` : " · todos os funis"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule)} />
                    <Button size="sm" variant="ghost" onClick={() => openEditRule(rule)}>Editar</Button>
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => deleteRule(rule.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="agents" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={openNewAgent}><Plus className="h-4 w-4 mr-1.5" />Novo agente</Button>
          </div>
          {agents.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{a.name}</span>
                    {a.is_active ? <Badge className="text-[10px] bg-emerald-500">ativo</Badge> : <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.objective || "Sem objetivo definido"}</p>
                  {(a.trigger_keywords || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" /></span>
                      {(a.trigger_keywords || []).slice(0, 6).map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => openEditAgent(a)}>Configurar</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Dialog Regra */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editRule?.id ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
          {editRule && (
            <div className="space-y-3">
              <div><Label>Nome da regra</Label><Input value={editRule.name || ""} onChange={(e) => setEditRule({ ...editRule, name: e.target.value })} placeholder="Ex: Interessados em preço" /></div>
              <div><Label>Palavras-chave (separadas por vírgula)</Label><Input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="preço, valor, quanto custa" /></div>
              <div><Label>Tipo de correspondência</Label>
                <Select value={editRule.match_type} onValueChange={(v) => setEditRule({ ...editRule, match_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém (recomendado)</SelectItem>
                    <SelectItem value="starts">Começa com</SelectItem>
                    <SelectItem value="exact">Exata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editRule.channels?.includes("whatsapp")} onChange={(e) => setEditRule({ ...editRule, channels: e.target.checked ? [...(editRule.channels || []), "whatsapp"] : (editRule.channels || []).filter((c) => c !== "whatsapp") })} />WhatsApp</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editRule.channels?.includes("instagram")} onChange={(e) => setEditRule({ ...editRule, channels: e.target.checked ? [...(editRule.channels || []), "instagram"] : (editRule.channels || []).filter((c) => c !== "instagram") })} />Instagram</label>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div><p className="text-sm font-medium">Disparar em mensagem no direct</p><p className="text-xs text-muted-foreground">Quando a pessoa responde no chat</p></div>
                <Switch checked={editRule.listen_dm ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, listen_dm: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div><p className="text-sm font-medium">Disparar em comentário (Instagram)</p><p className="text-xs text-muted-foreground">Comentou no post/reel → chama no direct. Requer config da Meta.</p></div>
                <Switch checked={editRule.listen_comment ?? false} onCheckedChange={(v) => setEditRule({ ...editRule, listen_comment: v })} />
              </div>
              {editRule.listen_comment && (
                <>
                  <div><Label>Mensagem enviada no direct (resposta ao comentário)</Label><Textarea rows={2} value={editRule.comment_dm_text || ""} onChange={(e) => setEditRule({ ...editRule, comment_dm_text: e.target.value })} placeholder="Oi! Vi seu comentário, me conta rapidinho..." /></div>
                  <div><Label>Resposta pública ao comentário (opcional)</Label><Input value={editRule.comment_public_reply || ""} onChange={(e) => setEditRule({ ...editRule, comment_public_reply: e.target.value })} placeholder="Te chamei no direct! 📩" /></div>
                </>
              )}
              <div><Label>Funil (opcional)</Label>
                <Select value={editRule.pipeline_id || "all"} onValueChange={(v) => setEditRule({ ...editRule, pipeline_id: v === "all" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os funis</SelectItem>
                    {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Agente qualificador</Label>
                <Select value={editRule.agent_id || ""} onValueChange={(v) => setEditRule({ ...editRule, agent_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolha um agente" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{!a.is_active ? " (inativo)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                {editRule.agent_id && !agents.find((a) => a.id === editRule.agent_id)?.is_active && (
                  <p className="text-[11px] text-amber-600 mt-1">Este agente está inativo — ative-o na aba "Agentes" pra a regra funcionar.</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label>Regra ativa</Label>
                <Switch checked={editRule.is_active ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)}>Cancelar</Button>
            <Button onClick={saveRule} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Agente */}
      <Dialog open={agentDialog} onOpenChange={setAgentDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editAgent?.id ? "Configurar agente" : "Novo agente"}</DialogTitle>
            <CardDescription>Configure as informações que o agente usa pra qualificar o lead.</CardDescription>
          </DialogHeader>
          {editAgent && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editAgent.name || ""} onChange={(e) => setEditAgent({ ...editAgent, name: e.target.value })} placeholder="Ex: Qualificador de tráfego" /></div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <Label className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" />Palavras-chave que ativam este agente</Label>
                <Input value={agentKwText} onChange={(e) => setAgentKwText(e.target.value)} placeholder="crescer, quero, preço (separadas por vírgula)" />
                <p className="text-[11px] text-muted-foreground">Se a pessoa mandar uma dessas no direct, o agente entra e começa a qualificar. Deixe vazio se este agente não deve ser ativado por palavra-chave.</p>
                <div className="flex items-center gap-3">
                  <Select value={editAgent.trigger_match_type || "contains"} onValueChange={(v) => setEditAgent({ ...editAgent, trigger_match_type: v })}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="starts">Começa com</SelectItem>
                      <SelectItem value="exact">Exata</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={(editAgent.trigger_channels || []).includes("whatsapp")} onChange={(e) => setEditAgent({ ...editAgent, trigger_channels: e.target.checked ? [...(editAgent.trigger_channels || []), "whatsapp"] : (editAgent.trigger_channels || []).filter((c) => c !== "whatsapp") })} />WhatsApp</label>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={(editAgent.trigger_channels || []).includes("instagram")} onChange={(e) => setEditAgent({ ...editAgent, trigger_channels: e.target.checked ? [...(editAgent.trigger_channels || []), "instagram"] : (editAgent.trigger_channels || []).filter((c) => c !== "instagram") })} />Instagram</label>
                </div>
              </div>
              <div><Label>Objetivo</Label><Textarea rows={2} value={editAgent.objective || ""} onChange={(e) => setEditAgent({ ...editAgent, objective: e.target.value })} placeholder="O que ele deve alcançar (ex: qualificar por BANT)" /></div>
              <div><Label>Saudação (primeira mensagem)</Label><Textarea rows={2} value={editAgent.greeting || ""} onChange={(e) => setEditAgent({ ...editAgent, greeting: e.target.value })} placeholder="Oi! Que bom seu interesse..." /></div>
              <div><Label>Instruções / o que perguntar</Label><Textarea rows={5} value={editAgent.instructions || ""} onChange={(e) => setEditAgent({ ...editAgent, instructions: e.target.value })} placeholder="Uma pergunta por vez. Descubra necessidade, urgência, orçamento e se é quem decide..." /></div>
              <div><Label>Tom de voz</Label><Input value={editAgent.tone || ""} onChange={(e) => setEditAgent({ ...editAgent, tone: e.target.value })} placeholder="consultivo e direto, sem emojis" /></div>
              <div><Label>Modo de resposta</Label>
                <Select value={editAgent.reply_mode || "copilot"} onValueChange={(v) => setEditAgent({ ...editAgent, reply_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (responde sozinho)</SelectItem>
                    <SelectItem value="copilot">Copiloto (sugere, você aprova)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div><p className="text-sm font-medium">Pode mover o lead de etapa</p><p className="text-xs text-muted-foreground">Ao qualificar, avança no funil</p></div>
                <Switch checked={editAgent.can_move_stage ?? false} onCheckedChange={(v) => setEditAgent({ ...editAgent, can_move_stage: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div><p className="text-sm font-medium">Agente ativo</p><p className="text-xs text-muted-foreground">Precisa estar ativo pra as regras usarem</p></div>
                <Switch checked={editAgent.is_active ?? false} onCheckedChange={(v) => setEditAgent({ ...editAgent, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialog(false)}>Cancelar</Button>
            <Button onClick={saveAgent} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
