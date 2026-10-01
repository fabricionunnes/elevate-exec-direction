// Fluxos do CRM (/crm/fluxos): automações desenhadas em blocos.
// Sem :id mostra a lista (criar do zero ou de um modelo, importar JSON, duplicar, ligar e
// desligar, excluir) e o histórico geral de execuções por lead. Com :id abre o editor visual.
// Motor: migrations 20261001020000/20261001020100 + edge crm-flow-dispatch.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Workflow, Plus, Upload, Copy, Trash2, Loader2, RefreshCw, Download, Activity, AlertTriangle } from "lucide-react";
import { FluxoEditor } from "@/components/crm/fluxos/FluxoEditor";
import { FluxoExecucoes } from "@/components/crm/fluxos/FluxoExecucoes";
import { MODELOS } from "@/components/crm/fluxos/modelos";
import { TRIGGERS, conferirImportado, triggerLabel, validarFluxo } from "@/components/crm/fluxos/catalogo";

interface Fluxo {
  id: string; name: string; description: string | null; is_active: boolean; trigger_type: string; nodes_n: number; updated_at: string;
  activated_at: string | null; created_by: string | null; runs_total: number; runs_running: number; runs_done: number; runs_failed: number;
  runs_dry: number; outbox_pending: number; last_run_at: string | null;
}
interface Motor {
  cron_active: boolean; last_tick_at: string | null; last_tick_status: string | null; active_flows: number; pending_events: number;
  waiting_runs: number; pending_outbox: number; failed_outbox_24h: number; dispatch_secret: boolean;
}
const dt = (s: string | null) => (s ? format(new Date(s), "dd/MM HH:mm", { locale: ptBR }) : "-");

function Lista({ canEdit }: { canEdit: boolean }) {
  const navigate = useNavigate();
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [motor, setMotor] = useState<Motor | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [modelo, setModelo] = useState("vazio");
  const [criando, setCriando] = useState(false);
  const [statusRuns, setStatusRuns] = useState("all");
  const [aba, setAba] = useState("fluxos");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [p, m] = await Promise.all([(supabase as any).rpc("crm_flows_painel"), (supabase as any).rpc("crm_flow_engine_status")]);
    if (p.error) toast.error("Erro ao carregar os fluxos: " + p.error.message);
    setFluxos((p.data || []) as Fluxo[]);
    if (!m.error) setMotor(m.data as Motor);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!fluxos.some((f) => f.runs_running > 0 || f.is_active)) return;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [fluxos, load]);

  const criar = async (payload: Record<string, any>) => {
    setCriando(true);
    // is_active é ignorado no insert: o banco força todo fluxo novo a nascer desligado
    const { data, error } = await (supabase as any).from("crm_flows").insert(payload).select("id").single();
    setCriando(false);
    if (error) { toast.error("Não consegui criar o fluxo: " + error.message); return; }
    setNovo(false); navigate(`/crm/fluxos/${data.id}`);
  };
  const criarDoModelo = () => {
    const m = MODELOS.find((x) => x.key === modelo) || MODELOS[0];
    const b = m.build();
    criar({ name: nome.trim() || (m.key === "vazio" ? "Fluxo novo" : m.label), description: m.key === "vazio" ? null : m.desc, trigger_type: b.trigger_type, trigger_config: b.trigger_config, filters: {}, nodes: b.nodes, edges: b.edges });
  };
  const importar = async (file: File) => {
    try {
      const r = conferirImportado(JSON.parse(await file.text()));
      if (!r.ok || !r.fluxo) { toast.error(r.erro || "Arquivo inválido"); return; }
      const { versao: _v, ...fluxo } = r.fluxo;
      await criar(fluxo);
      toast.success("Fluxo importado, desligado. Etapas, etiquetas, pessoas e números de outro ambiente precisam ser escolhidos de novo.");
    } catch { toast.error("Não consegui ler o arquivo. Ele precisa ser um JSON exportado de um fluxo."); }
  };
  const lerFluxo = async (id: string) => {
    const { data, error } = await (supabase as any).from("crm_flows").select("*").eq("id", id).single();
    if (error) toast.error(error.message);
    return data;
  };
  const duplicar = async (f: Fluxo) => {
    const d = await lerFluxo(f.id);
    if (d) await criar({ name: `${d.name} (cópia)`, description: d.description, trigger_type: d.trigger_type, trigger_config: d.trigger_config, filters: d.filters, nodes: d.nodes, edges: d.edges });
  };
  const exportar = async (f: Fluxo) => {
    const d = await lerFluxo(f.id);
    if (!d) return;
    const blob = new Blob([JSON.stringify({ versao: 1, name: d.name, description: d.description, trigger_type: d.trigger_type, trigger_config: d.trigger_config, filters: d.filters, nodes: d.nodes, edges: d.edges }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `fluxo-${String(d.name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "sem-nome"}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const alternar = async (f: Fluxo, v: boolean) => {
    if (v) {
      // ativar passa pelo editor: lá estão as pendências, a simulação e a confirmação
      const d = await lerFluxo(f.id);
      if (!d) return;
      const erros = validarFluxo(d.nodes || [], d.edges || [], d.trigger_type);
      if (erros.length || d.trigger_type === "manual" || (d.nodes || []).some((n: any) => n.type === "send_whatsapp")) {
        toast.info(erros.length ? `Falta acertar: ${erros[0]}` : d.trigger_type === "manual" ? "Fluxo manual não precisa ser ativado." : "Este fluxo manda WhatsApp: confira e ative pelo editor.");
        navigate(`/crm/fluxos/${f.id}`);
        return;
      }
      if (!window.confirm(`Ativar "${f.name}"? Todo caso de "${triggerLabel(f.trigger_type)}" que passar pelos filtros entra no fluxo sozinho.`)) return;
    }
    const { error } = await (supabase as any).from("crm_flows").update({ is_active: v }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    setFluxos((fs) => fs.map((x) => (x.id === f.id ? { ...x, is_active: v } : x)));
    toast.success(v ? "Fluxo ativo" : "Fluxo desligado: ninguém novo entra e nada sai da fila de envio");
  };
  const excluir = async (f: Fluxo) => {
    if (!window.confirm(`Excluir "${f.name}"? As execuções em andamento param e o histórico dele é apagado. Não dá pra desfazer.`)) return;
    const { error } = await (supabase as any).from("crm_flows").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo excluído"); load(true);
  };

  const filtrados = fluxos.filter((f) => !busca.trim() || `${f.name} ${f.description || ""} ${triggerLabel(f.trigger_type)}`.toLowerCase().includes(busca.trim().toLowerCase()));
  const tickAtrasado = motor?.last_tick_at ? Date.now() - new Date(motor.last_tick_at).getTime() > 5 * 60000 : true;
  const motorOk = !!motor?.cron_active && !tickAtrasado && motor?.last_tick_status !== "failed" && !!motor?.dispatch_secret;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center gap-2">
        <Workflow className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Fluxos</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load()} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
          {canEdit && (<>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Importar JSON</Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setNome(""); setModelo("vazio"); setNovo(true); }}><Plus className="h-3.5 w-3.5" /> Novo fluxo</Button>
          </>)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Automações desenhadas em blocos: gatilho, condição, espera, A/B, tarefa, etapa, responsável, etiqueta, WhatsApp, aviso, cadência e webhook. Todo fluxo novo nasce desligado.
      </p>

      {/* saúde do motor */}
      {motor && (
        <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border px-3 py-2 text-xs ${motorOk ? "border-border bg-muted/30" : "border-amber-500/50 bg-amber-500/10"}`}>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {motorOk ? <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            {motorOk ? "Motor rodando" : !motor.cron_active ? "Motor parado (cron desligado)" : !motor.dispatch_secret ? "Motor sem o segredo de envio" : "Motor atrasado"}
          </span>
          <span className="text-muted-foreground">último ciclo {motor.last_tick_at ? formatDistanceToNow(new Date(motor.last_tick_at), { locale: ptBR, addSuffix: true }) : "nunca"}</span>
          <span className="text-muted-foreground tabular-nums">{motor.active_flows} fluxo{motor.active_flows === 1 ? "" : "s"} ativo{motor.active_flows === 1 ? "" : "s"}</span>
          <span className="text-muted-foreground tabular-nums">{motor.waiting_runs} execuç{motor.waiting_runs === 1 ? "ão" : "ões"} aguardando</span>
          <span className="text-muted-foreground tabular-nums">{motor.pending_outbox} na fila de envio</span>
          {motor.failed_outbox_24h > 0 && (
            <button type="button" className="text-destructive hover:underline tabular-nums" onClick={() => { setAba("execucoes"); setStatusRuns("all"); }}>
              {motor.failed_outbox_24h} envio{motor.failed_outbox_24h === 1 ? "" : "s"} com falha em 24 h
            </button>
          )}
        </div>
      )}

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="fluxos">Fluxos <Badge variant="secondary" className="ml-1.5 text-[10px]">{fluxos.length}</Badge></TabsTrigger>
          <TabsTrigger value="execucoes">Execuções por lead</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos" className="space-y-3 mt-4">
          {fluxos.length > 4 && <Input className="h-8 max-w-xs text-sm" placeholder="Buscar fluxo" value={busca} onChange={(e) => setBusca(e.target.value)} />}
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>
          ) : !fluxos.length ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhum fluxo ainda.{canEdit ? " Clique em Novo fluxo e escolha um modelo pra começar: SLA 15 min, escalada, lead parado, tarefa atrasada, boas-vindas ou no-show." : " Quem cria é master, admin ou head comercial."}
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filtrados.map((f) => (
                <Card key={f.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/crm/fluxos/${f.id}`)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground hover:underline">{f.name}</span>
                        <Badge variant={f.is_active ? "default" : "outline"} className="text-[10px]">{f.is_active ? "Ativo" : f.trigger_type === "manual" ? "Manual" : "Desligado"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{triggerLabel(f.trigger_type)}</Badge>
                        {f.runs_running > 0 && <Badge className="text-[10px] bg-emerald-600 text-white">{f.runs_running} em andamento</Badge>}
                        {f.outbox_pending > 0 && <Badge variant="secondary" className="text-[10px]">{f.outbox_pending} na fila de envio</Badge>}
                      </div>
                      {f.description && <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {f.nodes_n} bloco{f.nodes_n === 1 ? "" : "s"} · {f.runs_total} execuç{f.runs_total === 1 ? "ão" : "ões"}
                        {f.runs_total > 0 && <> · {f.runs_done} concluída{f.runs_done === 1 ? "" : "s"}{f.runs_failed > 0 && <> · <span className="text-destructive">{f.runs_failed} com falha</span></>}</>}
                        {f.runs_dry > 0 && <> · {f.runs_dry} simulaç{f.runs_dry === 1 ? "ão" : "ões"}</>}
                        {f.last_run_at && <> · última {dt(f.last_run_at)}</>}
                        {f.created_by && <> · por {f.created_by}</>} · editado {dt(f.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canEdit && f.trigger_type !== "manual" && (
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer mr-2 text-foreground"><Switch checked={f.is_active} onCheckedChange={(v) => alternar(f, v)} /> {f.is_active ? "Ativo" : "Desligado"}</label>
                      )}
                      <Button size="sm" variant="outline" onClick={() => navigate(`/crm/fluxos/${f.id}`)}>Abrir</Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/crm/fluxos/${f.id}?tab=execucoes`)}>Execuções</Button>
                      <Button size="sm" variant="ghost" title="Exportar JSON" onClick={() => exportar(f)}><Download className="h-3.5 w-3.5" /></Button>
                      {canEdit && <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicar(f)}><Copy className="h-3.5 w-3.5" /></Button>}
                      {canEdit && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Excluir" onClick={() => excluir(f)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!filtrados.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum fluxo com esse nome.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="execucoes" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">O que cada fluxo fez com cada lead: busque pelo nome, telefone ou empresa e abra a linha pra ver o passo a passo.</p>
          <FluxoExecucoes status={statusRuns} onStatus={setStatusRuns} canEdit={canEdit} onChanged={() => load(true)} />
        </TabsContent>
      </Tabs>

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo fluxo</DialogTitle>
            <DialogDescription>Comece em branco ou de um modelo. Ele nasce desligado e tudo pode ser mudado no editor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={MODELOS.find((m) => m.key === modelo)?.label} /></div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto pr-1">
              {MODELOS.map((m) => {
                const gat = m.key === "vazio" ? null : TRIGGERS.find((t) => t.value === m.build().trigger_type)?.label;
                return (
                  <button key={m.key} type="button" onClick={() => setModelo(m.key)} className={`rounded-lg border border-border p-3 text-left hover:bg-muted/40 ${modelo === m.key ? "ring-2 ring-primary" : ""}`}>
                    <p className="text-sm font-medium text-foreground">{m.label}</p>
                    {gat && <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Gatilho: {gat}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button onClick={criarDoModelo} disabled={criando} className="gap-1.5">{criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar e abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CRMFluxosPage() {
  const { id } = useParams();
  const ctx = useOutletContext<{ canSettings?: boolean } | null>();
  const canEdit = !!ctx?.canSettings;
  return id ? <FluxoEditor id={id} canEdit={canEdit} /> : <Lista canEdit={canEdit} />;
}
