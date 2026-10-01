// Disparos > aba Impulsos: cada execução em massa com progresso, lote, ritmo, janela,
// pausar / retomar / cancelar e a lista de itens com o status de cada um (na fila,
// enviando, enviado, entregue, lido, falhou com motivo, pulado).
// Dados: crm_impulsos_painel e crm_impulso_itens (paginado no servidor). Atualiza sozinho
// a cada 15 s enquanto tem impulso rodando. Portado do UNV Sales (CRMImpulsosPage).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { montarCsv } from "@/lib/crm/execucoes";
import { ACTION_LABEL, CreateImpulsoDialog, type ImpulsoAction } from "@/components/crm/disparos/CreateImpulsoDialog";
import { Download, Info, ListChecks, Loader2, Pause, Play, RefreshCw, Search, XCircle, Zap } from "lucide-react";

interface Impulso {
  id: string; name: string; action: ImpulsoAction; config: any; source: string; source_label: string | null; status: string;
  batch_size: number; interval_seconds: number; window_start: string | null; window_end: string | null; window_weekdays: number[] | null;
  daily_cap: number | null; total: number; sent: number; failed: number; skipped: number; batches: number;
  pending: number; sending: number; delivered: number; read: number;
  next_batch_at: string | null; last_batch_at: string | null; started_at: string | null; finished_at: string | null;
  pause_reason: string | null; campaign_id: string | null; created_at: string; created_by_name: string | null;
}
interface Item {
  id: string; lead_id: string | null; name: string | null; phone: string | null; company: string | null; status: string;
  batch_no: number | null; error: string | null; at: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  running: { label: "Rodando", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  paused: { label: "Pausado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  done: { label: "Concluído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Na fila", cls: "bg-muted text-muted-foreground" },
  sending: { label: "Enviando", cls: "bg-primary/10 text-primary" },
  sent: { label: "Enviado", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  delivered: { label: "Entregue", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  read: { label: "Lido", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Falhou", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  skipped: { label: "Pulado", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
const DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const POR_PAGINA = 100;
const isMsg = (a: string) => a === "whatsapp_text" || a === "official_template";
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");
const dt = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
const hhmm = (t: string | null) => (t || "").slice(0, 5);
const Pill = ({ m }: { m?: { label: string; cls: string } }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${m?.cls || "bg-muted"}`}>{m?.label || "-"}</span>
);

function resumoAcao(i: Impulso) {
  const c = i.config || {};
  if (i.action === "whatsapp_text") {
    const m = String(c.message || "");
    return `"${m.slice(0, 90)}${m.length > 90 ? "…" : ""}"`;
  }
  if (i.action === "official_template") return `template ${String(c.template_name || "").replace(/_/g, " ")}`;
  if (i.action === "move_stage") return `pra etapa ${c.stage_name || ""}${c.pipeline_name ? ` (${c.pipeline_name})` : ""}`;
  if (i.action === "add_tag") return `etiqueta ${c.tag_name || ""}`;
  if (i.action === "assign_owner") return `responsável ${c.owner_name || ""}`;
  return `cadência ${c.cadence_name || ""}`;
}
function resumoRitmo(i: Impulso) {
  const seg = i.interval_seconds;
  const cada = seg % 3600 === 0 ? `${seg / 3600} h` : seg % 60 === 0 ? `${seg / 60} min` : `${seg} s`;
  const partes = [`${i.batch_size} por lote a cada ${cada}`];
  if (i.window_start && i.window_end) {
    const dias = i.window_weekdays?.length && i.window_weekdays.length < 7 ? `, ${i.window_weekdays.map((d) => DIA[d]).join(" ")}` : "";
    partes.push(`das ${hhmm(i.window_start)} às ${hhmm(i.window_end)}${dias}`);
  }
  if (i.daily_cap) partes.push(`teto de ${num(i.daily_cap)} por dia`);
  return partes.join(" · ");
}

interface Props {
  /** impulso pra abrir os itens assim que carregar (vindo da Central de Execuções) */
  abrirId?: string | null;
  onAbriu?: () => void;
}

export function ImpulsosTab({ abrirId, onAbriu }: Props) {
  const [impulsos, setImpulsos] = useState<Impulso[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);
  const [filtro, setFiltro] = useState("all");

  const [detalhe, setDetalhe] = useState<Impulso | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [resumo, setResumo] = useState<Record<string, number>>({});
  const [totalItens, setTotalItens] = useState(0);
  const [itensLoading, setItensLoading] = useState(false);
  const [filtroItem, setFiltroItem] = useState("all");
  const [buscaItem, setBuscaItem] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [baixando, setBaixando] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await (supabase as any).rpc("crm_impulsos_painel");
    if (error && !silent) toast.error("Não consegui carregar os impulsos");
    setImpulsos((data || []) as Impulso[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // impulso rodando: atualiza sozinho a cada 15 s
  const temRodando = impulsos.some((i) => i.status === "running");
  useEffect(() => {
    if (!temRodando) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [temRodando, load]);

  // criou um impulso (por aqui ou pelo kanban): recarrega
  useEffect(() => {
    const h = () => load(true);
    window.addEventListener("crm-impulso-criado", h);
    return () => window.removeEventListener("crm-impulso-criado", h);
  }, [load]);

  const carregarItens = useCallback(async (id: string, status: string, busca: string, pg: number) => {
    setItensLoading(true);
    const { data, error } = await (supabase as any).rpc("crm_impulso_itens", {
      p_id: id, p_status: status === "all" ? null : status, p_search: busca || null, p_limit: POR_PAGINA, p_offset: (pg - 1) * POR_PAGINA,
    });
    if (error) toast.error("Não consegui carregar os itens");
    setItens((data?.items || []) as Item[]);
    setResumo((data?.resumo || {}) as Record<string, number>);
    setTotalItens(Number(data?.total || 0));
    setItensLoading(false);
  }, []);

  const abrirItens = (i: Impulso) => {
    setDetalhe(i); setFiltroItem("all"); setBuscaItem(""); setBuscaAplicada(""); setPagina(1);
  };
  useEffect(() => {
    if (detalhe) carregarItens(detalhe.id, filtroItem, buscaAplicada, pagina);
  }, [detalhe, filtroItem, buscaAplicada, pagina, carregarItens]);
  // busca com folga pra não consultar a cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setBuscaAplicada(buscaItem.trim()); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [buscaItem]);

  // veio da Central de Execuções com um impulso pra abrir
  useEffect(() => {
    if (!abrirId || !impulsos.length) return;
    const alvo = impulsos.find((i) => i.id === abrirId);
    if (alvo) abrirItens(alvo);
    onAbriu?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId, impulsos]);

  const mudar = async (i: Impulso, status: "running" | "paused" | "cancelled") => {
    if (status === "cancelled" && !window.confirm(`Cancelar "${i.name}"? Quem ainda está na fila fica de fora. O que já saiu não volta.`)) return;
    if (status === "running" && i.status === "draft" &&
      !window.confirm(`Iniciar "${i.name}" pra ${num(i.pending)} item(ns)? O primeiro lote sai em até 1 minuto.`)) return;
    const { error } = await (supabase as any).rpc("crm_impulso_set_status", { p_id: i.id, p_status: status });
    if (error) { toast.error(error.message); return; }
    toast.success(status === "running" ? "Impulso rodando" : status === "paused" ? "Impulso pausado" : "Impulso cancelado");
    load(true);
  };

  const baixarItens = async () => {
    if (!detalhe) return;
    setBaixando(true);
    const linhas: (string | number | null)[][] = [["Nome", "Telefone", "Empresa", "Status", "Motivo", "Lote", "Quando"]];
    for (let off = 0; off < 200_000; off += 5000) {
      const { data, error } = await (supabase as any).rpc("crm_impulso_itens", {
        p_id: detalhe.id, p_status: filtroItem === "all" ? null : filtroItem, p_search: buscaAplicada || null, p_limit: 5000, p_offset: off,
      });
      if (error) { toast.error("Não consegui baixar a lista"); setBaixando(false); return; }
      const lote = (data?.items || []) as Item[];
      for (const x of lote) linhas.push([x.name, x.phone, x.company, ITEM_STATUS[x.status]?.label || x.status, x.error, x.batch_no, dt(x.at)]);
      if (lote.length < 5000) break;
    }
    const url = URL.createObjectURL(new Blob([montarCsv(linhas)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `impulso-${detalhe.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}${filtroItem === "all" ? "" : `-${filtroItem}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBaixando(false);
  };

  const lista = useMemo(() => impulsos.filter((i) => filtro === "all" || i.status === filtro), [impulsos, filtro]);
  const paginas = Math.max(1, Math.ceil(totalItens / POR_PAGINA));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Impulso é uma ação em massa por lotes, com ritmo. Dá pra criar por aqui ou marcando leads no kanban e clicando em "Criar impulso".
        </p>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-[170px]">
            <SearchableSelect value={filtro} onValueChange={setFiltro} className="h-9 text-sm"
              options={[{ value: "all", label: "Todos os estados" }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setNovoOpen(true)}><Zap className="h-3.5 w-3.5" /> Novo impulso</Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>
      ) : !lista.length ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {impulsos.length ? "Nenhum impulso nesse estado." : "Nenhum impulso ainda. Clique em \"Novo impulso\" ou marque leads no kanban e use \"Criar impulso\"."}
        </CardContent></Card>
      ) : lista.map((i) => {
        const w = (v: number) => `${i.total ? Math.min(100, (v / i.total) * 100) : 0}%`;
        const pct = i.total ? Math.round(((i.sent + i.failed + i.skipped) / i.total) * 100) : 0;
        const feito = isMsg(i.action) ? "enviados" : "feitos";
        return (
          <Card key={i.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" className="font-semibold hover:underline text-left" onClick={() => abrirItens(i)}>{i.name}</button>
                    <Pill m={STATUS[i.status]} />
                    <Badge variant="outline" className="text-[10px]">{ACTION_LABEL[i.action] || i.action}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {resumoAcao(i)} · {resumoRitmo(i)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {i.source_label || i.source}{i.created_by_name ? ` · por ${i.created_by_name}` : ""} · {dt(i.created_at)}
                    {i.campaign_id && <> · <Link to={`/crm/disparos/${i.campaign_id}`} className="underline hover:text-foreground">ver disparo oficial</Link></>}
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-emerald-500" style={{ width: w(i.sent) }} />
                    <div className="h-full bg-red-500" style={{ width: w(i.failed) }} />
                    <div className="h-full bg-muted-foreground/30" style={{ width: w(i.skipped) }} />
                  </div>
                  <p className="text-xs mt-1 tabular-nums">
                    <b>{pct}%</b> · {num(i.sent)} {feito}
                    {isMsg(i.action) && i.sent > 0 && <> ({num(i.delivered)} entregues, {num(i.read)} lidos)</>}
                    {" · "}{num(i.failed)} falhas · {num(i.skipped)} pulados · {num(i.pending)} na fila
                    {i.sending > 0 && <> · {num(i.sending)} enviando</>} · lote {i.batches}
                    {i.status === "running" && i.next_batch_at && <span className="text-muted-foreground"> · próximo lote {dt(i.next_batch_at)}</span>}
                    {i.finished_at && <span className="text-muted-foreground"> · terminou {dt(i.finished_at)}</span>}
                  </p>
                  {i.status === "paused" && i.pause_reason && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{i.pause_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(i.status === "draft" || i.status === "paused") && (
                    <Button size="sm" className="gap-1" onClick={() => mudar(i, "running")}><Play className="h-3.5 w-3.5" /> {i.status === "draft" ? "Iniciar" : "Retomar"}</Button>
                  )}
                  {i.status === "running" && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => mudar(i, "paused")}><Pause className="h-3.5 w-3.5" /> Pausar</Button>
                  )}
                  {["draft", "running", "paused"].includes(i.status) && (
                    <Button size="sm" variant="ghost" className="gap-1 text-red-600 dark:text-red-400" onClick={() => mudar(i, "cancelled")}><XCircle className="h-3.5 w-3.5" /> Cancelar</Button>
                  )}
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => abrirItens(i)}><ListChecks className="h-3.5 w-3.5" /> Itens</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <CreateImpulsoDialog open={novoOpen} onOpenChange={setNovoOpen} />

      <Dialog open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> {detalhe?.name}</DialogTitle>
            <DialogDescription>
              {detalhe ? `${num(detalhe.total)} item(ns) · ${Object.entries(resumo).map(([k, v]) => `${num(v)} ${(ITEM_STATUS[k]?.label || k).toLowerCase()}`).join(" · ")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[170px]">
              <SearchableSelect value={filtroItem} onValueChange={(v) => { setFiltroItem(v); setPagina(1); }} className="h-9 text-sm"
                options={[{ value: "all", label: "Todos os status" }, ...Object.entries(ITEM_STATUS).map(([k, v]) => ({ value: k, label: `${v.label}${resumo[k] ? ` (${num(resumo[k])})` : ""}` }))]} />
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pl-8 text-sm" placeholder="Buscar nome ou telefone" value={buscaItem} onChange={(e) => setBuscaItem(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={baixarItens} disabled={baixando || !totalItens}>
              {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Baixar CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => detalhe && carregarItens(detalhe.id, filtroItem, buscaAplicada, pagina)}>
              <RefreshCw className={`h-3.5 w-3.5 ${itensLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            {itensLoading && !itens.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted text-[11px] uppercase tracking-wide text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Lead</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                    <th className="text-right font-medium px-3 py-2">Lote</th>
                    <th className="text-left font-medium px-3 py-2">Quando</th>
                    <th className="text-left font-medium px-3 py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((x) => (
                    <tr key={x.id} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        {x.lead_id ? <Link to={`/crm/leads/${x.lead_id}`} className="hover:underline">{x.name || "Lead"}</Link> : (x.name || "Sem lead no CRM")}
                        <div className="text-[11px] text-muted-foreground tabular-nums">{x.phone || ""}</div>
                      </td>
                      <td className="px-3 py-1.5"><Pill m={ITEM_STATUS[x.status]} /></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{x.batch_no ?? "-"}</td>
                      <td className="px-3 py-1.5 text-xs whitespace-nowrap">{dt(x.at)}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground max-w-[280px]" title={x.error || ""}>{x.error || ""}</td>
                    </tr>
                  ))}
                  {!itens.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhum item nesse filtro.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          {totalItens > POR_PAGINA && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{num((pagina - 1) * POR_PAGINA + 1)} a {num(Math.min(pagina * POR_PAGINA, totalItens))} de {num(totalItens)}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                <span className="px-2 tabular-nums">{pagina} de {paginas}</span>
                <Button variant="outline" size="sm" className="h-8" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
