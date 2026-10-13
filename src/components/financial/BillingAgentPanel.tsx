import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Loader2, Play, Bot, Pause, RotateCcw, StickyNote } from "lucide-react";

// As tabelas do agente ainda não estão nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AgentConfig {
  enabled: boolean;
  dry_run: boolean;
  instance_id: string | null;
  owner_phone: string;
  hour_start: number;
  hour_end: number;
  max_promise_days: number;
  max_days_overdue: number;
  extra_instructions: string | null;
}

interface AgentCase {
  company_id: string;
  phone: string | null;
  status: string;
  paused_until: string | null;
  pause_reason: string | null;
  promise_date: string | null;
  promises_broken: number;
  unanswered: number;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  owner_instruction: string | null;
  manual_note: string | null;
  context_summary: string | null;
  context_flag: boolean;
}

interface AgentMessage {
  id: string;
  company_id: string | null;
  direction: string;
  kind: string;
  status: string;
  content: string | null;
  tier: string | null;
  days_overdue: number | null;
  error: string | null;
  created_at: string;
}

interface SimulatedMessage {
  empresa: string;
  telefone?: string;
  faixa: string;
  dias: number;
  motivos?: string[];
  texto?: string;
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Cobrando",
  promessa: "Promessa de pagamento",
  aguardando_decisao: "Aguardando sua decisão",
  humano: "Com uma pessoa",
  pausado: "Não cobrar",
};

const FAIXA_LABEL: Record<string, string> = {
  leve: "Leve",
  firme: "Firme",
  duro: "Duro",
  ultimo_aviso: "Último aviso",
  segurado: "Segurado",
};

const KIND_LABEL: Record<string, string> = {
  cobranca: "Cobrança",
  resposta: "Resposta",
  cliente: "Cliente",
  aviso_dono: "Aviso pra direção",
  decisao_dono: "Decisão da direção",
  baixa: "Baixa",
  sem_contato: "Sem telefone",
  sem_link: "Sem link de pagamento",
  paga_no_asaas: "Paga no Asaas",
};

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export function BillingAgentPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [instances, setInstances] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [cases, setCases] = useState<AgentCase[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [simulated, setSimulated] = useState<SimulatedMessage[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [noteCase, setNoteCase] = useState<AgentCase | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    const [cfgRes, instRes, casesRes, msgRes] = await Promise.all([
      db.from("billing_agent_config").select("*").eq("id", true).maybeSingle(),
      supabase.from("whatsapp_instances").select("id, display_name, instance_name, phone_number, status").order("display_name"),
      db.from("billing_agent_cases").select("*").order("updated_at", { ascending: false }).limit(200),
      db.from("billing_agent_messages").select("id, company_id, direction, kind, status, content, tier, days_overdue, error, created_at").order("created_at", { ascending: false }).limit(60),
    ]);
    if (cfgRes.error) {
      toast.error("Não foi possível carregar o agente de cobrança: " + cfgRes.error.message);
      setLoading(false);
      return;
    }
    setConfig(cfgRes.data as AgentConfig);
    setInstances(
      (instRes.data || []).map((i) => ({
        value: i.id,
        label: i.display_name || i.instance_name,
        hint: [i.phone_number, i.status === "connected" ? "conectado" : "desconectado"].filter(Boolean).join(" · "),
      })),
    );
    const caseRows = (casesRes.data || []) as AgentCase[];
    const msgRows = (msgRes.data || []) as AgentMessage[];
    setCases(caseRows);
    setMessages(msgRows);
    const ids = [...new Set([...caseRows.map((c) => c.company_id), ...msgRows.map((m) => m.company_id)].filter(Boolean))] as string[];
    if (ids.length) {
      const { data: companies } = await supabase.from("onboarding_companies").select("id, name").in("id", ids);
      setCompanyNames(Object.fromEntries((companies || []).map((c) => [c.id, c.name])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchConfig = async (patch: Partial<AgentConfig>) => {
    if (!config) return;
    const next = { ...config, ...patch };
    if (next.enabled && !next.instance_id) {
      toast.error("Escolha o número do financeiro antes de ligar o agente.");
      return;
    }
    setSaving(true);
    const { error } = await db.from("billing_agent_config").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setConfig(next);
    toast.success("Salvo");
  };

  const simulate = async () => {
    setSimulating(true);
    setSimulated(null);
    try {
      const { data, error } = await supabase.functions.invoke("billing-agent", { body: { action: "simulate", limit: 8 } });
      if (error) throw error;
      setSimulated((data?.mensagens || []) as SimulatedMessage[]);
      setSkipped((data?.pulados || []) as string[]);
      if (!data?.mensagens?.length) toast.info("Nenhuma mensagem seria enviada agora. Veja os motivos abaixo.");
    } catch (e) {
      toast.error("Erro na simulação: " + ((e as Error).message || "erro desconhecido"));
    }
    setSimulating(false);
    load();
  };

  const updateCase = async (companyId: string, patch: Partial<AgentCase>, okMessage: string) => {
    const { error } = await db.from("billing_agent_cases").update({ ...patch, updated_at: new Date().toISOString() }).eq("company_id", companyId);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
      return;
    }
    toast.success(okMessage);
    load();
  };

  const saveNote = async () => {
    if (!noteCase) return;
    await updateCase(noteCase.company_id, { manual_note: noteText.trim() || null }, "Anotação salva");
    setNoteCase(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!config) return null;

  const estado = !config.enabled ? "Desligado" : config.dry_run ? "Ligado em simulação (não envia)" : "Ligado, enviando";

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Agente de Cobrança</p>
                <p className="text-sm text-muted-foreground">
                  Conversa com o cliente em atraso, lê o histórico, cobra todo dia útil e ajusta o tom pelos dias de atraso.
                </p>
              </div>
            </div>
            <Badge variant="outline" className={config.enabled && !config.dry_run ? "border-emerald-500/30 text-emerald-600" : ""}>
              {estado}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Agente ligado</Label>
                <p className="text-xs text-muted-foreground">Desligado, ele não cobra nem responde ninguém.</p>
              </div>
              <Switch checked={config.enabled} disabled={saving} onCheckedChange={(v) => patchConfig({ enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Só simular</Label>
                <p className="text-xs text-muted-foreground">Escreve e registra as mensagens, mas não envia.</p>
              </div>
              <Switch checked={config.dry_run} disabled={saving} onCheckedChange={(v) => patchConfig({ dry_run: v })} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Número do financeiro</Label>
              <SearchableSelect
                value={config.instance_id || ""}
                onValueChange={(v) => patchConfig({ instance_id: v || null })}
                options={instances}
                placeholder="Escolha o WhatsApp de cobrança"
                allowNone
                noneLabel="Nenhum"
              />
              <p className="text-xs text-muted-foreground">Use um número só de cobrança. Tudo que chegar nele é tratado pelo agente.</p>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp que decide os pedidos</Label>
              <Input
                defaultValue={config.owner_phone}
                onBlur={(e) => e.target.value !== config.owner_phone && patchConfig({ owner_phone: e.target.value.replace(/\D/g, "") })}
              />
              <p className="text-xs text-muted-foreground">Pedido de tirar juros, desconto e confirmação de baixa chegam aqui. A resposta volta pro agente.</p>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Cobra a partir das</Label>
              <Input type="number" min={0} max={23} defaultValue={config.hour_start} onBlur={(e) => Number(e.target.value) !== config.hour_start && patchConfig({ hour_start: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Até as</Label>
              <Input type="number" min={1} max={24} defaultValue={config.hour_end} onBlur={(e) => Number(e.target.value) !== config.hour_end && patchConfig({ hour_end: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Promessa até (dias)</Label>
              <Input type="number" min={1} max={30} defaultValue={config.max_promise_days} onBlur={(e) => Number(e.target.value) !== config.max_promise_days && patchConfig({ max_promise_days: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Para de cobrar com (dias)</Label>
              <Input type="number" min={15} max={365} defaultValue={config.max_days_overdue} onBlur={(e) => Number(e.target.value) !== config.max_days_overdue && patchConfig({ max_days_overdue: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Orientações extras pro agente</Label>
            <Textarea
              rows={3}
              defaultValue={config.extra_instructions || ""}
              placeholder="Ex.: nunca cobrar na primeira semana do mês quem é de varejo."
              onBlur={(e) => (e.target.value || "") !== (config.extra_instructions || "") && patchConfig({ extra_instructions: e.target.value.trim() || null })}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={simulate} disabled={simulating}>
              {simulating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Simular cobrança de hoje
            </Button>
            <p className="text-xs text-muted-foreground">Mostra o que o agente mandaria agora. Não envia nada.</p>
          </div>

          {simulated && (
            <div className="space-y-3">
              {simulated.map((m, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{m.empresa}</span>
                    <Badge variant="outline">{FAIXA_LABEL[m.faixa] || m.faixa}</Badge>
                    <span className="text-xs text-muted-foreground">{m.dias} dia(s) de atraso</span>
                  </div>
                  {m.motivos?.length ? <p className="text-xs text-muted-foreground">{m.motivos.join(" · ")}</p> : null}
                  <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                </div>
              ))}
              {skipped.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium mb-1">Não receberiam mensagem</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {skipped.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <p className="font-medium">Clientes em cobrança</p>
          {cases.length === 0 && <p className="text-sm text-muted-foreground">O agente ainda não cobrou ninguém.</p>}
          {cases.map((c) => (
            <div key={c.company_id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{companyNames[c.company_id] || "Empresa"}</span>
                  <Badge variant="outline">{STATUS_LABEL[c.status] || c.status}</Badge>
                  {c.context_flag && <Badge variant="outline" className="border-amber-500/30 text-amber-600">Combinado fora do padrão</Badge>}
                  {c.promise_date && <span className="text-xs text-muted-foreground">paga em {c.promise_date.split("-").reverse().join("/")}</span>}
                  {c.unanswered >= 3 && <span className="text-xs text-muted-foreground">{c.unanswered} sem resposta</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setNoteCase(c); setNoteText(c.manual_note || ""); }}>
                    <StickyNote className="h-4 w-4 mr-1" /> Anotação
                  </Button>
                  {c.status === "ativo" || c.status === "promessa" ? (
                    <Button size="sm" variant="ghost" onClick={() => updateCase(c.company_id, { status: "pausado", pause_reason: "pausado na tela" }, "Cobrança pausada")}>
                      <Pause className="h-4 w-4 mr-1" /> Não cobrar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => updateCase(c.company_id, { status: "ativo", paused_until: null, pause_reason: null }, "Agente religado")}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Voltar a cobrar
                    </Button>
                  )}
                </div>
              </div>
              {c.manual_note && <p className="text-xs"><span className="text-muted-foreground">Anotação: </span>{c.manual_note}</p>}
              {c.owner_instruction && <p className="text-xs"><span className="text-muted-foreground">Sua decisão: </span>{c.owner_instruction}</p>}
              {c.context_summary && <p className="text-xs text-muted-foreground">{c.context_summary}</p>}
              {c.pause_reason && c.status !== "ativo" && <p className="text-xs text-muted-foreground">Motivo: {c.pause_reason}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <p className="font-medium">Últimos registros</p>
          {messages.length === 0 && <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>}
          {messages.map((m) => (
            <div key={m.id} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDateTime(m.created_at)}</span>
                <span className="text-foreground font-medium">{(m.company_id && companyNames[m.company_id]) || "Direção"}</span>
                <span>{KIND_LABEL[m.kind] || m.kind}</span>
                {m.tier && <span>{FAIXA_LABEL[m.tier] || m.tier}</span>}
                {m.status === "dry_run" && <Badge variant="outline">simulação</Badge>}
                {m.status === "failed" && <Badge variant="outline" className="border-destructive/30 text-destructive">falhou</Badge>}
                {m.status === "skipped" && <Badge variant="outline">não enviado</Badge>}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words mt-1">{m.content}</p>
              {m.error && <p className="text-xs text-destructive mt-1">{m.error}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!noteCase} onOpenChange={(o) => !o && setNoteCase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anotação pro agente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O que estiver aqui vale acima do que o agente leu nas conversas. Ex.: parcela em permuta, paga com consórcio, não mandar link.
          </p>
          <Textarea rows={5} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteCase(null)}>Cancelar</Button>
            <Button onClick={saveNote}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
