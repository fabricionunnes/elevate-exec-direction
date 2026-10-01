// Histórico de execuções: o que rodou, quando e com que resultado, lead por lead.
// Serve pra um fluxo (aba Execuções do editor), pra todos os fluxos (aba Execuções da lista)
// e pra um lead só (leadId). Contagem e filtro são feitos no banco (crm_flow_runs_search).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, XCircle, ChevronDown, ChevronRight, Search, Eye, FlaskConical, Loader2 } from "lucide-react";
import { CATALOGO, LISTAS_VAZIAS, triggerLabel, type NodeType, type Listas } from "./catalogo";

export interface Passo { node_id: string | null; type: string; status: string; detail: any; at: string }
export interface Run {
  id: string; flow_id: string; flow: string; lead_id: string | null; lead: string | null; lead_phone: string | null; status: string;
  current_node_id: string | null; wait_kind: string | null; resume_at: string | null; trigger_type: string | null; steps: number;
  error: string | null; is_dry: boolean; started_at: string; finished_at: string | null; started_by: string | null; passos: Passo[];
}

export const dt = (s: string | null | undefined) => (s ? format(new Date(s), "dd/MM HH:mm:ss", { locale: ptBR }) : "-");
export const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  running: { label: "Rodando", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  waiting: { label: "Aguardando", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  done: { label: "Concluído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  failed: { label: "Falhou", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
const STEP_COR: Record<string, string> = { ok: "bg-emerald-500", wait: "bg-sky-500", skip: "bg-muted-foreground/40", error: "bg-red-500" };
const WAIT_LABEL: Record<string, string> = { delay: "esperando o tempo", reply: "esperando o lead responder", webhook: "esperando o webhook responder" };
const Pill = ({ m }: { m?: { label: string; cls: string } }) => <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${m?.cls || "bg-muted text-muted-foreground"}`}>{m?.label || "-"}</span>;

// Traduz o detalhe técnico de um passo pra uma frase
export function detalheTexto(p: Passo | undefined, listas: Listas): string {
  if (!p) return "";
  const d = p.detail || {};
  const sim = d.simulado ? "Simulação: " : "";
  const pessoa = (id: string) => listas.staff.find((s) => s.id === id)?.name || "pessoa";
  if (d.envio) {
    const alvo = [d.para, d.numero ? `pelo número ${d.numero}` : "", d.http ? `HTTP ${d.http}` : ""].filter(Boolean).join(" ");
    if (d.envio === "enviado") return `Enviado${alvo ? ` (${alvo})` : ""}`;
    return `${d.envio === "cancelado" ? "Não enviado" : "Envio falhou"}: ${d.erro || "sem motivo informado"}${alvo ? ` (${alvo})` : ""}`;
  }
  if (d.erro) return `Erro: ${d.erro}`;
  switch (p.type) {
    case "trigger": return "Fluxo começou";
    case "condition": return `Resultado: ${d.resultado}`;
    case "split": return `Caiu no lado ${d.lado}`;
    case "wait": return d.resultado ? String(d.resultado) : `${sim}espera até ${dt(d.ate)}`;
    case "wait_reply": return d.resultado === "respondeu" ? `Lead respondeu em ${dt(d.em)}` : d.resultado === "estourou o prazo" ? "Prazo estourou sem resposta" : d.simulado ? `Simulação: esperaria resposta até ${dt(d.estoura_em)} e seguiu por Não respondeu` : `Aguardando resposta até ${dt(d.estoura_em)}`;
    case "send_whatsapp": return `${sim}${d.simulado ? "enviaria" : "Na fila de envio"}${d.envio_em ? ` (sai ${dt(d.envio_em)})` : ""}: "${String(d.mensagem || "").slice(0, 140)}"`;
    case "create_task": return `${sim}tarefa "${d.tarefa}" pra ${(d.pessoas || []).filter(Boolean).map(pessoa).join(", ") || "ninguém (lead sem responsável)"}`;
    case "notify": return `${sim}aviso pra ${(d.pessoas || []).map(pessoa).join(", ") || "ninguém (sem responsável ativo)"}: "${String(d.mensagem || "").slice(0, 120)}"`;
    case "move_stage": return `${sim}etapa: ${listas.stages.find((s) => s.value === d.etapa)?.label || d.etapa || "não encontrada"}`;
    case "add_tag": case "remove_tag": return `${sim}etiqueta: ${listas.tags.find((t) => t.value === d.tag)?.label || d.tag}`;
    case "assign_owner": return `${sim}novo responsável: ${d.dono ? pessoa(d.dono) : "ninguém"}`;
    case "set_field": return `${sim}${d.campo} = "${d.valor}"`;
    case "formula": return `${d.a} e ${d.b} deram ${d.resultado}`;
    case "webhook": return d.http !== undefined ? `Resposta HTTP ${d.http}` : d.simulado ? `Simulação: chamaria ${d.metodo} ${d.url}` : d.resultado || "";
    case "enroll_cadence": return `${sim}cadência ${listas.cadences.find((c) => c.value === d.cadencia)?.label || ""}${d.resultado ? `: ${d.resultado}` : ""}`;
    case "stop_cadence": return `${sim}${d.resultado || ""}`;
    case "start_flow": return `Iniciou o fluxo ${listas.flows.find((f) => f.value === d.fluxo)?.label || d.fluxo}`;
    case "cancel": return d.resultado || "Cancelado";
    case "end": return "Fim do fluxo";
    default: return d.resultado ? String(d.resultado) : "";
  }
}

const FILTROS = [["all", "Todas"], ["running", "Rodando"], ["waiting", "Aguardando"], ["done", "Concluídas"], ["failed", "Falharam"], ["cancelled", "Canceladas"]] as const;
const POR_PAGINA = 50;

interface Props {
  flowId?: string; leadId?: string;
  listas?: Listas;
  status: string; onStatus: (s: string) => void;
  nodeFilter?: string | null; onClearNode?: () => void;
  nomeBloco?: (nodeId: string | null) => string;
  onVerBloco?: (nodeId: string) => void;
  counts?: Record<string, number> | null;       // contadores por situação (vêm do banco)
  canEdit: boolean;
  refreshKey?: number;
  onChanged?: () => void;
}

export function FluxoExecucoes({ flowId, leadId, listas = LISTAS_VAZIAS, status, onStatus, nodeFilter, onClearNode, nomeBloco, onVerBloco, counts, canEdit, refreshKey, onChanged }: Props) {
  const [rows, setRows] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  useEffect(() => { const t = setTimeout(() => { setBuscaAplicada(busca.trim()); setPagina(0); }, 350); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { setPagina(0); }, [status, nodeFilter, flowId, leadId]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await (supabase as any).rpc("crm_flow_runs_search", {
      p_flow_id: flowId || null, p_lead_id: leadId || null, p_status: status === "all" ? null : status, p_node: nodeFilter || null,
      p_search: buscaAplicada || null, p_limit: POR_PAGINA, p_offset: pagina * POR_PAGINA,
    });
    if (error) toast.error("Erro ao carregar execuções: " + error.message);
    setRows((data?.rows || []) as Run[]);
    setTotal(Number(data?.total || 0));
    setLoading(false);
  }, [flowId, leadId, status, nodeFilter, buscaAplicada, pagina]);
  useEffect(() => { load(); }, [load, refreshKey]);
  // enquanto houver execução em andamento na página, atualiza sozinho
  useEffect(() => {
    if (!rows.some((r) => r.status === "running" || r.status === "waiting")) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [rows, load]);

  const cancelar = async (r: Run) => {
    if (!window.confirm(`Cancelar a execução de ${r.lead || "lead"}? O que ainda estava na fila de envio dela não sai.`)) return;
    const { error } = await (supabase as any).rpc("crm_flow_run_cancel", { p_run_id: r.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Execução cancelada"); load(true); onChanged?.();
  };
  const bloco = (nid: string | null, tipo?: string) => (nomeBloco ? nomeBloco(nid) : CATALOGO[tipo as NodeType]?.label || tipo || "-");
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-4">
      {counts && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {FILTROS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => onStatus(k)} className={`rounded-lg border border-border p-3 text-left hover:bg-muted/40 transition ${status === k ? "ring-2 ring-primary" : ""}`}>
              <p className="text-2xl font-bold tabular-nums text-foreground">{k === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[k] || 0}</p>
              <p className="text-[11px] text-muted-foreground">{l}</p>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!leadId && (
          <div className="relative w-[280px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8 text-sm" placeholder="Buscar lead por nome, telefone ou empresa" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}
        {!counts && (
          <div className="flex flex-wrap gap-1">
            {FILTROS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => onStatus(k)} className={`rounded-full border border-border px-2.5 py-1 text-[11px] ${status === k ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50"}`}>{l}</button>
            ))}
          </div>
        )}
        {nodeFilter && <Badge variant="secondary" className="gap-1 font-normal">passaram por "{bloco(nodeFilter)}" <button type="button" onClick={onClearNode}><XCircle className="h-3 w-3" /></button></Badge>}
        <span className="text-xs text-muted-foreground tabular-nums">{total} execuç{total === 1 ? "ão" : "ões"}</span>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => load()} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        {loading && !rows.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</p>}
        {rows.map((r) => {
          const open = !!aberto[r.id];
          return (
            <div key={r.id}>
              <button type="button" onClick={() => setAberto((a) => ({ ...a, [r.id]: !open }))} className="w-full flex flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-muted/30">
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium text-sm text-foreground min-w-[160px]">{r.lead || "Lead apagado"}</span>
                {!flowId && <Badge variant="outline" className="text-[10px] font-normal">{r.flow}</Badge>}
                <Pill m={RUN_STATUS[r.status]} />
                {r.is_dry && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"><FlaskConical className="h-3 w-3" /> Simulação</span>}
                <span className="text-xs text-muted-foreground">{triggerLabel(r.trigger_type || "manual")}</span>
                <span className="text-xs text-muted-foreground">· {r.steps} passo{r.steps === 1 ? "" : "s"}</span>
                {r.status === "waiting" && <span className="text-xs text-sky-700 dark:text-sky-400">· {WAIT_LABEL[r.wait_kind || ""] || "aguardando"} em "{bloco(r.current_node_id)}"{r.resume_at ? ` até ${dt(r.resume_at)}` : ""}</span>}
                {r.error && <span className="text-xs text-destructive truncate max-w-[300px]" title={r.error}>· {r.error}</span>}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{dt(r.started_at)}{r.finished_at ? ` até ${dt(r.finished_at)}` : ""}</span>
              </button>
              {open && (
                <div className="px-4 pb-3 pt-1 bg-muted/20">
                  <div className="flex flex-wrap items-center gap-3 mb-2 text-xs">
                    {r.lead_id && <Link to={`/crm/leads/${r.lead_id}`} className="text-primary hover:underline flex items-center gap-1"><Eye className="h-3 w-3" /> Abrir o lead</Link>}
                    {!flowId && <Link to={`/crm/fluxos/${r.flow_id}?tab=execucoes`} className="text-primary hover:underline">Abrir o fluxo</Link>}
                    {canEdit && (r.status === "running" || r.status === "waiting") && <button type="button" className="text-destructive hover:underline flex items-center gap-1" onClick={() => cancelar(r)}><XCircle className="h-3 w-3" /> Cancelar esta execução</button>}
                    {r.started_by && <span className="text-muted-foreground">Iniciada por {r.started_by}</span>}
                    <span className="text-muted-foreground">Execução {r.id.slice(0, 8)}</span>
                  </div>
                  <ol className="relative border-l border-border ml-2 space-y-2">
                    {(r.passos || []).map((p, i) => (
                      <li key={i} className="ml-4 relative">
                        <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${STEP_COR[p.status] || "bg-muted"}`} />
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {onVerBloco && p.node_id
                            ? <button type="button" className="text-xs font-medium text-foreground hover:underline" onClick={() => onVerBloco(p.node_id!)} title="Ver o bloco no canvas">{bloco(p.node_id, p.type)}</button>
                            : <span className="text-xs font-medium text-foreground">{bloco(p.node_id, p.type)}</span>}
                          <span className="text-[11px] text-muted-foreground">{CATALOGO[p.type as NodeType]?.label || ""}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">{dt(p.at)}</span>
                        </div>
                        <p className={`text-xs ${p.status === "error" ? "text-destructive" : "text-foreground/80"}`}>{detalheTexto(p, listas)}</p>
                      </li>
                    ))}
                    {r.status === "waiting" && <li className="ml-4 text-xs text-sky-700 dark:text-sky-400">Parado em "{bloco(r.current_node_id)}": {WAIT_LABEL[r.wait_kind || ""] || "aguardando"}{r.resume_at ? `, volta ${dt(r.resume_at)}` : ""}</li>}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
        {!loading && !rows.length && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {total === 0 && status === "all" && !buscaAplicada && !nodeFilter ? "Nenhuma execução ainda." : "Nenhuma execução nesse filtro."}
          </p>
        )}
      </div>
      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span className="tabular-nums">Página {pagina + 1} de {paginas}</span>
          <Button variant="outline" size="sm" disabled={pagina + 1 >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}
