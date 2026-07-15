import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AIAgent } from "@/pages/crm/CRMAgentsPage";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Radio, MessageSquare, Instagram } from "lucide-react";
import { AgentKnowledgeManager } from "./AgentKnowledgeManager";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agent: AIAgent | null;
  staffId: string | null;
  tenantId: string | null;
  onSaved: () => void;
}

const MODELS = [
  { value: "claude-sonnet-5", label: "Claude Sonnet 5 (recomendado)" },
  { value: "claude-opus-4-8", label: "Claude Opus 4.8 (mais inteligente)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (mais rápido)" },
];

interface InstanceOpt { channel: string; id: string; label: string; sub: string; status?: string | null; }

const emptyForm = {
  name: "", description: "", objective: "", instructions: "", tone: "",
  greeting: "", model: "claude-sonnet-5", temperature: 0.4, reply_mode: "copilot",
  handoff_keywords: "", max_messages: "",
  scheduling_enabled: false, scheduling_staff_ids: [] as string[],
  schedule_hour_start: 8, schedule_hour_end: 19,
  meeting_duration_minutes: 60, can_move_stage: false,
  response_delay_seconds: 0,
  work_hours_enabled: false, work_hour_start: 8, work_hour_end: 20,
  work_days: [] as number[],
};

export function AgentEditorDialog({ open, onOpenChange, agent, staffId, tenantId, onSaved }: Props) {
  const [tab, setTab] = useState("config");
  const [saving, setSaving] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  // opções
  const [instances, setInstances] = useState<InstanceOpt[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string }[]>([]);
  // vínculos
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set()); // key = channel:id
  const [pipelineModes, setPipelineModes] = useState<Record<string, string>>({}); // pipeline_id -> off|auto|copilot

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Carrega opções de instâncias e funis uma vez
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [wa, waOff, ig, pi, st] = await Promise.all([
        supabase.from("whatsapp_instances").select("id, instance_name, display_name, phone_number, status"),
        supabase.from("whatsapp_official_instances").select("id, display_name, phone_number"),
        supabase.from("instagram_instances").select("id, instance_name, instagram_username, page_name, status"),
        supabase.from("crm_pipelines").select("id, name").order("name"),
        supabase.from("onboarding_staff").select("id, name, role").eq("is_active", true)
          .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]).order("name"),
      ]);
      const opts: InstanceOpt[] = [];
      (wa.data || []).forEach((i: any) => opts.push({ channel: "whatsapp", id: i.id, label: i.display_name || i.instance_name, sub: i.phone_number || "", status: i.status }));
      (waOff.data || []).forEach((i: any) => opts.push({ channel: "whatsapp_official", id: i.id, label: i.display_name || "WhatsApp Oficial", sub: i.phone_number || "" }));
      (ig.data || []).forEach((i: any) => opts.push({ channel: "instagram", id: i.id, label: i.page_name || i.instagram_username || i.instance_name, sub: i.instagram_username ? `@${i.instagram_username}` : "", status: i.status }));
      setInstances(opts);
      setPipelines((pi.data || []) as any);
      setStaffList((st.data || []) as any);
    })();
  }, [open]);

  // Inicializa o form ao abrir
  useEffect(() => {
    if (!open) return;
    if (agent) {
      setAgentId(agent.id);
      setForm({
        name: agent.name || "", description: agent.description || "", objective: agent.objective || "",
        instructions: agent.instructions || "", tone: agent.tone || "", greeting: agent.greeting || "",
        model: agent.model || "claude-sonnet-5", temperature: agent.temperature ?? 0.4,
        reply_mode: agent.reply_mode || "copilot",
        handoff_keywords: (agent.handoff_keywords || []).join(", "),
        max_messages: agent.max_messages != null ? String(agent.max_messages) : "",
        scheduling_enabled: !!agent.scheduling_enabled,
        scheduling_staff_ids: agent.scheduling_staff_ids || [],
        schedule_hour_start: agent.schedule_hour_start ?? 8,
        schedule_hour_end: agent.schedule_hour_end ?? 19,
        meeting_duration_minutes: agent.meeting_duration_minutes ?? 60,
        can_move_stage: !!agent.can_move_stage,
        response_delay_seconds: agent.response_delay_seconds ?? 0,
        work_hours_enabled: !!agent.work_hours_enabled,
        work_hour_start: agent.work_hour_start ?? 8,
        work_hour_end: agent.work_hour_end ?? 20,
        work_days: agent.work_days || [],
      });
    } else {
      setAgentId(null);
      setForm({ ...emptyForm });
      setSelectedChannels(new Set());
      setPipelineModes({});
    }
    setTab("config");
  }, [open, agent]);

  // Carrega vínculos quando há agentId
  const loadBindings = useCallback(async (id: string) => {
    const [ch, pi] = await Promise.all([
      supabase.from("crm_ai_agent_channels").select("channel, instance_id").eq("agent_id", id),
      supabase.from("crm_ai_agent_pipelines").select("pipeline_id, reply_mode").eq("agent_id", id),
    ]);
    setSelectedChannels(new Set((ch.data || []).map((r: any) => `${r.channel}:${r.instance_id}`)));
    const modes: Record<string, string> = {};
    (pi.data || []).forEach((r: any) => { modes[r.pipeline_id] = r.reply_mode; });
    setPipelineModes(modes);
  }, []);

  useEffect(() => {
    if (open && agentId) loadBindings(agentId);
  }, [open, agentId, loadBindings]);

  const saveConfig = async () => {
    if (!form.name.trim()) { toast.error("Dê um nome ao agente"); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description || null,
      objective: form.objective || null,
      instructions: form.instructions || null,
      tone: form.tone || null,
      greeting: form.greeting || null,
      model: form.model,
      temperature: form.temperature,
      reply_mode: form.reply_mode,
      handoff_keywords: form.handoff_keywords.trim()
        ? form.handoff_keywords.split(",").map((s) => s.trim()).filter(Boolean) : null,
      max_messages: form.max_messages.trim() ? parseInt(form.max_messages, 10) : null,
      scheduling_enabled: form.scheduling_enabled,
      scheduling_staff_ids: form.scheduling_staff_ids.length ? form.scheduling_staff_ids : null,
      schedule_hour_start: form.schedule_hour_start,
      schedule_hour_end: form.schedule_hour_end,
      meeting_duration_minutes: form.meeting_duration_minutes,
      can_move_stage: form.can_move_stage,
      response_delay_seconds: form.response_delay_seconds,
      work_hours_enabled: form.work_hours_enabled,
      work_hour_start: form.work_hour_start,
      work_hour_end: form.work_hour_end,
      work_days: form.work_days.length ? form.work_days : null,
      updated_at: new Date().toISOString(),
    };
    try {
      if (agentId) {
        const { error } = await supabase.from("crm_ai_agents").update(payload).eq("id", agentId);
        if (error) throw error;
        toast.success("Configuração salva");
      } else {
        payload.created_by = staffId;
        payload.tenant_id = tenantId;
        const { data, error } = await supabase.from("crm_ai_agents").insert(payload).select("id").single();
        if (error) throw error;
        setAgentId(data.id);
        toast.success("Agente criado. Agora vincule instâncias, funis e conhecimento.");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = async (opt: InstanceOpt) => {
    if (!agentId) { toast.error("Salve a configuração primeiro"); return; }
    const key = `${opt.channel}:${opt.id}`;
    const next = new Set(selectedChannels);
    if (next.has(key)) {
      next.delete(key);
      setSelectedChannels(next);
      await supabase.from("crm_ai_agent_channels").delete()
        .eq("agent_id", agentId).eq("channel", opt.channel).eq("instance_id", opt.id);
    } else {
      next.add(key);
      setSelectedChannels(next);
      await supabase.from("crm_ai_agent_channels").insert({ agent_id: agentId, channel: opt.channel, instance_id: opt.id });
    }
  };

  const setPipelineMode = async (pipelineId: string, mode: string) => {
    if (!agentId) { toast.error("Salve a configuração primeiro"); return; }
    setPipelineModes((m) => ({ ...m, [pipelineId]: mode }));
    if (mode === "off") {
      await supabase.from("crm_ai_agent_pipelines").delete().eq("agent_id", agentId).eq("pipeline_id", pipelineId);
    } else {
      await supabase.from("crm_ai_agent_pipelines")
        .upsert({ agent_id: agentId, pipeline_id: pipelineId, reply_mode: mode }, { onConflict: "agent_id,pipeline_id" });
    }
  };

  const channelIcon = (ch: string) => ch === "instagram"
    ? <Instagram className="h-3.5 w-3.5" />
    : <MessageSquare className="h-3.5 w-3.5" />;

  const needsSave = !agentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{agent ? "Editar agente" : "Novo agente"}</DialogTitle>
          <DialogDescription>Configure o cérebro do agente e onde ele atua.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-5 shrink-0">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="channels">Canais</TabsTrigger>
            <TabsTrigger value="pipelines">Funis</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="knowledge">Conhecimento</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1 mt-3">
            {/* CONFIG */}
            <TabsContent value="config" className="space-y-4 mt-0">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex: SDR Instagram" />
              </div>
              <div className="grid gap-2">
                <Label>Descrição curta</Label>
                <Input value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Aparece no card do agente" />
              </div>
              <div className="grid gap-2">
                <Label>Objetivo</Label>
                <Textarea rows={2} value={form.objective} onChange={(e) => set({ objective: e.target.value })} placeholder="O que esse agente precisa alcançar? Ex: qualificar o lead e agendar reunião." />
              </div>
              <div className="grid gap-2">
                <Label>Instruções / persona (cérebro do agente)</Label>
                <Textarea rows={6} value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} placeholder="Como ele fala, o que pode e não pode fazer, passo a passo do atendimento, regras..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Tom de voz</Label>
                  <Input value={form.tone} onChange={(e) => set({ tone: e.target.value })} placeholder="Direto, humano, sem emojis" />
                </div>
                <div className="grid gap-2">
                  <Label>Modelo</Label>
                  <Select value={form.model} onValueChange={(v) => set({ model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Mensagem de abertura (opcional)</Label>
                <Textarea rows={2} value={form.greeting} onChange={(e) => set({ greeting: e.target.value })} placeholder="Primeira mensagem quando o agente assume a conversa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Modo padrão</Label>
                  <Select value={form.reply_mode} onValueChange={(v) => set({ reply_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="copilot">Copiloto (humano aprova)</SelectItem>
                      <SelectItem value="auto">Auto-atende</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Criatividade ({form.temperature.toFixed(1)})</Label>
                  <input type="range" min={0} max={1} step={0.1} value={form.temperature}
                    onChange={(e) => set({ temperature: parseFloat(e.target.value) })} className="w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Palavras que devolvem pro humano</Label>
                  <Input value={form.handoff_keywords} onChange={(e) => set({ handoff_keywords: e.target.value })} placeholder="falar com humano, atendente, reclamação" />
                </div>
                <div className="grid gap-2">
                  <Label>Máx. mensagens por conversa</Label>
                  <Input type="number" value={form.max_messages} onChange={(e) => set({ max_messages: e.target.value })} placeholder="deixe vazio p/ ilimitado" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Tempo de resposta</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Quanto o agente espera antes de responder. Se o lead mandar várias mensagens seguidas, ele responde uma vez só, à conversa toda.
                </p>
                <Select value={String(form.response_delay_seconds)} onValueChange={(v) => set({ response_delay_seconds: parseInt(v, 10) })}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Imediato</SelectItem>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                    <SelectItem value="60">1 minuto</SelectItem>
                    <SelectItem value="120">2 minutos</SelectItem>
                    <SelectItem value="180">3 minutos</SelectItem>
                    <SelectItem value="300">5 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Horário de atendimento</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fora da janela o agente não responde. Desligado = atende 24h.
                    </p>
                  </div>
                  <Switch checked={form.work_hours_enabled} onCheckedChange={(v) => set({ work_hours_enabled: v })} />
                </div>
                {form.work_hours_enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label className="text-xs">Início</Label>
                        <Select value={String(form.work_hour_start)} onValueChange={(v) => set({ work_hour_start: parseInt(v, 10) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, h) => (
                              <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Fim</Label>
                        <Select value={String(form.work_hour_end)} onValueChange={(v) => set({ work_hour_end: parseInt(v, 10) })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                              <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Dias da semana (nenhum marcado = todos)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => {
                          const on = form.work_days.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => set({ work_days: on ? form.work_days.filter((x) => x !== i) : [...form.work_days, i] })}
                              className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {form.work_hour_end <= form.work_hour_start && (
                      <p className="text-xs text-destructive">O fim precisa ser maior que o início.</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={saveConfig} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {agentId ? "Salvar configuração" : "Criar agente"}
                </Button>
              </div>
            </TabsContent>

            {/* CHANNELS */}
            <TabsContent value="channels" className="space-y-3 mt-0">
              {needsSave ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Salve a configuração primeiro para vincular instâncias.</p>
              ) : instances.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma instância disponível.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Radio className="h-3 w-3" /> Marque em quais instâncias esse agente atua.</p>
                  {instances.map((opt) => {
                    const key = `${opt.channel}:${opt.id}`;
                    const active = selectedChannels.has(key);
                    return (
                      <div key={key} className="flex items-center justify-between rounded-md border p-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {channelIcon(opt.channel)}
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{opt.label}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {opt.channel === "instagram" ? "Instagram" : opt.channel === "whatsapp_official" ? "WhatsApp Oficial" : "WhatsApp"}
                              {opt.sub ? ` · ${opt.sub}` : ""}
                              {opt.status ? ` · ${opt.status === "connected" ? "conectado" : opt.status}` : ""}
                            </div>
                          </div>
                        </div>
                        <Switch checked={active} onCheckedChange={() => toggleChannel(opt)} />
                      </div>
                    );
                  })}
                </>
              )}
            </TabsContent>

            {/* PIPELINES */}
            <TabsContent value="pipelines" className="space-y-3 mt-0">
              {needsSave ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Salve a configuração primeiro para vincular funis.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Escolha o modo por funil. <Badge variant="outline" className="text-[10px]">Auto</Badge> responde sozinho,
                    <Badge variant="outline" className="text-[10px]">Copiloto</Badge> sugere, <Badge variant="outline" className="text-[10px]">Desligado</Badge> não atua.
                  </p>
                  {pipelines.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border p-2.5">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <Select value={pipelineModes[p.id] || "off"} onValueChange={(v) => setPipelineMode(p.id, v)}>
                        <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Desligado</SelectItem>
                          <SelectItem value="auto">Auto-atende</SelectItem>
                          <SelectItem value="copilot">Copiloto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </>
              )}
            </TabsContent>

            {/* AGENDA / FERRAMENTAS */}
            <TabsContent value="agenda" className="space-y-4 mt-0">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Agendamento na agenda do closer</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O agente consulta horários livres e agenda reuniões (Google Calendar) direto na conversa.
                  </p>
                </div>
                <Switch
                  checked={form.scheduling_enabled}
                  onCheckedChange={(v) => set({ scheduling_enabled: v })}
                />
              </div>

              {form.scheduling_enabled && (
                <>
                  <div className="grid gap-2">
                    <Label>Closers que ele pode agendar</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      A agenda consultada/usada é a do(s) closer(s) marcado(s). Precisa ter Google Calendar conectado.
                    </p>
                    <div className="rounded-md border divide-y max-h-52 overflow-y-auto">
                      {staffList.map((s) => {
                        const on = form.scheduling_staff_ids.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/50">
                            <span className="text-sm">{s.name} <span className="text-xs text-muted-foreground">({s.role})</span></span>
                            <Switch
                              checked={on}
                              onCheckedChange={(v) => set({
                                scheduling_staff_ids: v
                                  ? [...form.scheduling_staff_ids, s.id]
                                  : form.scheduling_staff_ids.filter((id) => id !== s.id),
                              })}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Horário mínimo</Label>
                      <Select value={String(form.schedule_hour_start)} onValueChange={(v) => set({ schedule_hour_start: parseInt(v, 10) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                            <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Horário máximo</Label>
                      <Select value={String(form.schedule_hour_end)} onValueChange={(v) => set({ schedule_hour_end: parseInt(v, 10) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 17 }, (_, i) => i + 7).map((h) => (
                            <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Duração (min)</Label>
                      <Select value={String(form.meeting_duration_minutes)} onValueChange={(v) => set({ meeting_duration_minutes: parseInt(v, 10) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[30, 45, 60, 90].map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.schedule_hour_end <= form.schedule_hour_start && (
                    <p className="text-xs text-destructive">O horário máximo precisa ser maior que o mínimo.</p>
                  )}
                </>
              )}

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Mover lead de etapa</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permite ao agente mover o negócio no funil (ex: ao qualificar ou agendar).
                  </p>
                </div>
                <Switch
                  checked={form.can_move_stage}
                  onCheckedChange={(v) => set({ can_move_stage: v })}
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={saveConfig} disabled={saving || (form.scheduling_enabled && form.schedule_hour_end <= form.schedule_hour_start)}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar agenda
                </Button>
              </div>
            </TabsContent>

            {/* KNOWLEDGE */}
            <TabsContent value="knowledge" className="mt-0">
              {needsSave ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Salve a configuração primeiro para adicionar conhecimento.</p>
              ) : (
                <AgentKnowledgeManager agentId={agentId!} staffId={staffId} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
