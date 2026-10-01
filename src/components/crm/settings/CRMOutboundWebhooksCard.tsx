// Webhooks de saída do CRM (Configurações > API e Webhooks), 01/10/2026.
// O CRM faz um POST na URL cadastrada quando o evento acontece. Os gatilhos do banco só
// enfileiram em crm_outbound_webhook_deliveries; a edge crm-webhook-dispatch entrega
// (assinatura HMAC no header X-UNV-Signature, timeout de 10 s, 5 tentativas).
// Esta tela cadastra os webhooks, manda um teste e mostra o histórico com reenvio.
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/crm/traffic/SearchableSelect";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Send, Trash2, Webhook } from "lucide-react";

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  pipeline_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Delivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status: string;
  http_status: number | null;
  response: string | null;
  attempts: number;
  next_retry_at: string | null;
  is_test: boolean;
  created_at: string;
  last_attempt_at: string | null;
}

const EVENTOS = [
  { value: "lead.created", label: "Lead criado" },
  { value: "lead.stage_changed", label: "Lead mudou de etapa" },
  { value: "lead.won", label: "Lead ganho" },
  { value: "lead.lost", label: "Lead perdido" },
  { value: "lead.owner_changed", label: "Lead trocou de dono" },
  { value: "meeting.scheduled", label: "Reunião agendada" },
  { value: "meeting.realized", label: "Reunião realizada" },
  { value: "meeting.no_show", label: "Reunião com no-show" },
];
const rotuloEvento = (e: string) => (e === "test.ping" ? "Teste" : EVENTOS.find((x) => x.value === e)?.label || e);

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Na fila", className: "bg-muted text-muted-foreground" },
  sending: { label: "Enviando", className: "bg-muted text-muted-foreground" },
  retrying: { label: "Vai tentar de novo", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  delivered: { label: "Entregue", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive" },
};

const TODOS = "todos";
const dataHora = (iso: string) => format(new Date(iso), "dd/MM HH:mm:ss", { locale: ptBR });
const novoSegredo = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return "whsec_" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
};

const FORM_VAZIO = { name: "", url: "", events: [] as string[], pipeline: TODOS, is_active: true };

export function CRMOutboundWebhooksCard({ pipelines }: { pipelines: { id: string; name: string }[] }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [entregas, setEntregas] = useState<Delivery[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoEntregas, setCarregandoEntregas] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<WebhookRow | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [verSegredo, setVerSegredo] = useState(false);
  const [excluir, setExcluir] = useState<WebhookRow | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [filtroWebhook, setFiltroWebhook] = useState(TODOS);
  const [filtroStatus, setFiltroStatus] = useState(TODOS);
  const [expandida, setExpandida] = useState<string | null>(null);

  const carregarWebhooks = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("crm_outbound_webhooks")
      .select("id, name, url, secret, events, pipeline_id, is_active, created_at")
      .order("created_at", { ascending: true });
    if (error) toast.error(`Não consegui carregar os webhooks: ${error.message}`);
    setWebhooks((data as WebhookRow[]) || []);
    setCarregando(false);
  }, []);

  const carregarEntregas = useCallback(async () => {
    setCarregandoEntregas(true);
    let q = (supabase as any)
      .from("crm_outbound_webhook_deliveries")
      .select("id, webhook_id, event, payload, status, http_status, response, attempts, next_retry_at, is_test, created_at, last_attempt_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (filtroWebhook !== TODOS) q = q.eq("webhook_id", filtroWebhook);
    if (filtroStatus !== TODOS) q = q.eq("status", filtroStatus);
    const { data, error } = await q;
    if (error) toast.error(`Não consegui carregar as entregas: ${error.message}`);
    setEntregas((data as Delivery[]) || []);
    setCarregandoEntregas(false);
  }, [filtroWebhook, filtroStatus]);

  useEffect(() => { carregarWebhooks(); }, [carregarWebhooks]);
  useEffect(() => { carregarEntregas(); }, [carregarEntregas]);

  const nomeWebhook = useMemo(() => Object.fromEntries(webhooks.map((w) => [w.id, w.name])), [webhooks]);
  const nomeFunil = (id: string | null) => (id ? pipelines.find((p) => p.id === id)?.name || "funil removido" : "Todos os funis");

  const abrirNovo = () => { setEditando(null); setForm(FORM_VAZIO); setVerSegredo(false); setAberto(true); };
  const abrirEdicao = (w: WebhookRow) => {
    setEditando(w);
    setForm({ name: w.name, url: w.url, events: w.events || [], pipeline: w.pipeline_id || TODOS, is_active: w.is_active });
    setVerSegredo(false);
    setAberto(true);
  };

  const salvar = async () => {
    const nome = form.name.trim();
    const url = form.url.trim();
    if (!nome) { toast.error("Dê um nome pro webhook"); return; }
    if (!/^https?:\/\/.+/i.test(url)) { toast.error("A URL precisa começar com https:// (ou http://)"); return; }
    if (!form.events.length) { toast.error("Escolha pelo menos um evento"); return; }
    const dados = { name: nome, url, events: form.events, pipeline_id: form.pipeline === TODOS ? null : form.pipeline, is_active: form.is_active };
    setOcupado(true);
    let erro: any = null;
    if (editando) {
      const r = await (supabase as any).from("crm_outbound_webhooks").update(dados).eq("id", editando.id).select("id");
      erro = r.error || (!(r.data || []).length ? { message: "sem permissão pra alterar" } : null);
    } else {
      const { data: staffId } = await (supabase as any).rpc("get_current_staff_id");
      const r = await (supabase as any).from("crm_outbound_webhooks").insert({ ...dados, created_by: staffId || null });
      erro = r.error;
    }
    setOcupado(false);
    if (erro) { toast.error(`Erro ao salvar: ${erro.message}`); return; }
    toast.success(editando ? "Webhook atualizado" : "Webhook criado");
    setAberto(false);
    carregarWebhooks();
  };

  const alternar = async (w: WebhookRow) => {
    const r = await (supabase as any).from("crm_outbound_webhooks").update({ is_active: !w.is_active }).eq("id", w.id).select("id");
    if (r.error || !(r.data || []).length) { toast.error(`Não consegui alterar: ${r.error?.message || "sem permissão"}`); return; }
    carregarWebhooks();
  };

  const trocarSegredo = async () => {
    if (!editando) return;
    setOcupado(true);
    const segredo = novoSegredo();
    const r = await (supabase as any).from("crm_outbound_webhooks").update({ secret: segredo }).eq("id", editando.id).select("id");
    setOcupado(false);
    if (r.error || !(r.data || []).length) { toast.error(`Não consegui trocar o segredo: ${r.error?.message || "sem permissão"}`); return; }
    setEditando({ ...editando, secret: segredo });
    setVerSegredo(true);
    toast.success("Segredo novo gerado. Atualize no sistema que recebe.");
    carregarWebhooks();
  };

  const copiar = async (texto: string, oQue: string) => {
    try { await navigator.clipboard.writeText(texto); toast.success(`${oQue} copiado`); }
    catch { toast.error("Não consegui copiar"); }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setOcupado(true);
    const { error } = await (supabase as any).from("crm_outbound_webhooks").delete().eq("id", excluir.id);
    setOcupado(false);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    toast.success("Webhook excluído");
    setExcluir(null);
    carregarWebhooks();
    carregarEntregas();
  };

  // A function responde 200 também quando o destino recusou: o resultado vem no corpo.
  const chamarDispatch = async (body: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke("crm-webhook-dispatch", { body });
    if (error) {
      let msg = error.message;
      try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* mantém a mensagem genérica */ }
      return { erro: msg as string, data: null as any };
    }
    return { erro: null as string | null, data };
  };

  const enviarTeste = async (w: WebhookRow) => {
    setTestando(w.id);
    const { erro, data } = await chamarDispatch({ action: "test", webhook_id: w.id });
    setTestando(null);
    if (erro) toast.error(`Teste não saiu: ${erro}`);
    else if (data?.ok) toast.success(`Teste entregue (HTTP ${data.http_status})`);
    else toast.error(`O destino não aceitou o teste${data?.http_status ? ` (HTTP ${data.http_status})` : ""}: ${data?.response || "sem resposta"}`);
    carregarEntregas();
  };

  const reenviar = async (d: Delivery) => {
    setReenviando(d.id);
    const { erro, data } = await chamarDispatch({ action: "retry", delivery_id: d.id });
    setReenviando(null);
    if (erro) toast.error(`Reenvio não saiu: ${erro}`);
    else if (data?.ok) toast.success(`Reenviado e entregue (HTTP ${data.http_status})`);
    else toast.error(`O destino recusou de novo${data?.http_status ? ` (HTTP ${data.http_status})` : ""}`);
    carregarEntregas();
  };

  const alternarEvento = (ev: string, marcado: boolean) =>
    setForm((f) => ({ ...f, events: marcado ? [...new Set([...f.events, ev])] : f.events.filter((e) => e !== ev) }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" />Webhooks de saída</CardTitle>
            <CardDescription>
              O CRM avisa outro sistema por POST quando o evento acontece. Cada envio leva o header X-UNV-Signature
              com o HMAC-SHA256 (hex) do corpo, calculado com o segredo do webhook.
            </CardDescription>
          </div>
          <Button size="sm" onClick={abrirNovo} className="shrink-0"><Plus className="h-4 w-4 mr-1" />Novo webhook</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {carregando ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum webhook cadastrado ainda.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {webhooks.map((w) => (
                <div key={w.id} className="flex flex-col lg:flex-row lg:items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${w.is_active ? "" : "text-muted-foreground"}`}>{w.name}</span>
                      {!w.is_active && <Badge variant="outline" className="text-[10px]">desligado</Badge>}
                      <span className="text-xs text-muted-foreground">{nomeFunil(w.pipeline_id)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{w.url}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(w.events || []).map((e) => <Badge key={e} variant="outline" className="text-[10px] font-normal">{rotuloEvento(e)}</Badge>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={w.is_active} onCheckedChange={() => alternar(w)} title={w.is_active ? "Desligar" : "Ligar"} />
                    <Button size="sm" variant="outline" onClick={() => enviarTeste(w)} disabled={testando === w.id}>
                      {testando === w.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      Enviar teste
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(w)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setExcluir(w)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Resposta fora de 2xx ou sem resposta em 10 segundos conta como falha. São 5 tentativas (espera de 1 min, 5 min, 30 min e 2 h entre elas).
            O teste manda um lead de exemplo, sem dado real.
          </p>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimas entregas</CardTitle>
          <CardDescription>As 50 mais recentes. O histórico guarda 30 dias.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchableSelect
              className="sm:w-64"
              value={filtroWebhook}
              onChange={setFiltroWebhook}
              options={[{ value: TODOS, label: "Todos os webhooks" }, ...webhooks.map((w) => ({ value: w.id, label: w.name }))]}
            />
            <SearchableSelect
              className="sm:w-56"
              value={filtroStatus}
              onChange={setFiltroStatus}
              options={[{ value: TODOS, label: "Todos os status" }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]}
            />
            <Button size="sm" variant="outline" className="h-9" onClick={carregarEntregas} disabled={carregandoEntregas}>
              <RefreshCw className={`h-4 w-4 mr-1 ${carregandoEntregas ? "animate-spin" : ""}`} />Atualizar
            </Button>
          </div>

          {entregas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{carregandoEntregas ? "Carregando..." : "Nenhuma entrega por aqui."}</p>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {entregas.map((d) => {
                const st = STATUS[d.status] || STATUS.pending;
                const abertaAgora = expandida === d.id;
                return (
                  <div key={d.id} className="px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => setExpandida(abertaAgora ? null : d.id)} title="Ver detalhes">
                        {abertaAgora ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <span className="text-xs tabular-nums text-muted-foreground w-28 shrink-0">{dataHora(d.created_at)}</span>
                      <span className="text-sm font-medium">{rotuloEvento(d.event)}</span>
                      <span className="text-xs text-muted-foreground truncate">{nomeWebhook[d.webhook_id] || "webhook removido"}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${st.className}`}>{st.label}</span>
                      {d.http_status != null && <span className="text-xs tabular-nums text-muted-foreground">HTTP {d.http_status}</span>}
                      <span className="text-xs text-muted-foreground">{d.attempts} {d.attempts === 1 ? "tentativa" : "tentativas"}</span>
                      {d.status === "retrying" && d.next_retry_at && <span className="text-xs text-muted-foreground">próxima às {format(new Date(d.next_retry_at), "HH:mm", { locale: ptBR })}</span>}
                      <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => reenviar(d)} disabled={reenviando === d.id || d.status === "sending"}>
                        {reenviando === d.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                        Reenviar
                      </Button>
                    </div>
                    {abertaAgora && (
                      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Dados enviados</p>
                          <pre className="text-xs font-mono bg-muted rounded p-2 overflow-x-auto max-h-56">{JSON.stringify(d.payload, null, 2)}</pre>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground mb-1">Resposta do destino (trecho)</p>
                          <pre className="text-xs font-mono bg-muted rounded p-2 overflow-x-auto max-h-56 whitespace-pre-wrap break-all">{d.response || "sem resposta registrada"}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Criar / editar */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar webhook" : "Novo webhook"}</DialogTitle>
            <DialogDescription>O CRM faz um POST em JSON nesta URL a cada evento escolhido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input className="mt-1" autoFocus placeholder="Ex.: ERP, planilha de vendas, n8n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>URL de destino</Label>
              <Input className="mt-1 font-mono text-xs" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Eventos</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EVENTOS.map((e) => (
                  <label key={e.value} className="flex items-start gap-2 cursor-pointer">
                    <Checkbox className="mt-0.5" checked={form.events.includes(e.value)} onCheckedChange={(v) => alternarEvento(e.value, v === true)} />
                    <span className="text-sm">
                      {e.label}
                      <span className="block text-[11px] text-muted-foreground font-mono">{e.value}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Funil</Label>
              <SearchableSelect
                className="mt-1"
                value={form.pipeline}
                onChange={(v) => setForm({ ...form, pipeline: v })}
                options={[{ value: TODOS, label: "Todos os funis" }, ...pipelines.map((p) => ({ value: p.id, label: p.name }))]}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="webhook-ativo" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label htmlFor="webhook-ativo" className="cursor-pointer">Ligado</Label>
            </div>
            {editando ? (
              <div>
                <Label>Segredo da assinatura</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                    {verSegredo ? editando.secret : "•".repeat(32)}
                  </code>
                  <Button size="icon" variant="outline" onClick={() => setVerSegredo(!verSegredo)} title={verSegredo ? "Esconder" : "Mostrar"}>
                    {verSegredo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => copiar(editando.secret, "Segredo")} title="Copiar"><Copy className="h-4 w-4" /></Button>
                </div>
                <Button size="sm" variant="link" className="px-0 h-auto mt-1 text-xs" onClick={trocarSegredo} disabled={ocupado}>Gerar segredo novo</Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">O segredo da assinatura é gerado ao salvar. Abra o webhook em Editar pra copiar.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o webhook "{excluir?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>O histórico de entregas dele sai junto. Se a ideia é só parar os envios, desligue em vez de excluir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
