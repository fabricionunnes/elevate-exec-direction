// Central de Execuções (Disparos > aba Execuções): tudo que roda em segundo plano no CRM.
// Importação e exportação de leads, impulsos, mesclagem e backfill de automação, cada um
// com progresso (total, feitos, falhas, pulados), quem iniciou, quando, estado, link pro
// resultado e botão de cancelar. Dados: crm_executions (ao vivo por realtime, com uma
// conferida a cada 10 s enquanto tem algo rodando, caso o realtime caia).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { baixarArquivoExecucao, type Execucao } from "@/lib/crm/execucoes";
import { Download, FileWarning, ListChecks, Loader2, RefreshCw, Search, XCircle } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  lead_import: "Importação de leads",
  lead_export: "Exportação de leads",
  impulso: "Impulso",
  merge: "Mesclagem",
  automation_backfill: "Backfill de automação",
};
const STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: "Na fila", cls: "bg-muted text-muted-foreground" },
  running: { label: "Rodando", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  paused: { label: "Pausado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  done: { label: "Concluído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  failed: { label: "Falhou", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
const ABERTO = ["queued", "running", "paused"];
const dt = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
const num = (v: number) => Number(v || 0).toLocaleString("pt-BR");

function duracao(e: Execucao) {
  const ini = e.started_at || e.created_at;
  if (!e.finished_at || !ini) return "";
  const seg = Math.max(0, Math.round((new Date(e.finished_at).getTime() - new Date(ini).getTime()) / 1000));
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.round(seg / 60)} min`;
  return `${(seg / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

interface Props {
  /** abre os itens do impulso na aba Impulsos */
  onAbrirImpulso: (impulsoId: string) => void;
}

export function ExecucoesTab({ onAbrirImpulso }: Props) {
  const [rows, setRows] = useState<Execucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("all");
  const [estado, setEstado] = useState("all");
  const [busca, setBusca] = useState("");
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await (supabase as any).from("crm_executions").select("*").order("created_at", { ascending: false }).limit(200);
    if (error && !silent) toast.error("Não consegui carregar as execuções");
    setRows((data || []) as Execucao[]);
    setAgora(Date.now());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ao vivo: qualquer mudança na tabela recarrega (com uma folga, o progresso vem em rajada)
  useEffect(() => {
    const channel = supabase
      .channel("crm-executions-central")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_executions" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => load(true), 800);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  // rede de segurança: enquanto tem execução aberta, confere a cada 10 s
  const temAberta = rows.some((r) => ABERTO.includes(r.status));
  useEffect(() => {
    if (!temAberta) return;
    const t = setInterval(() => load(true), 10000);
    return () => clearInterval(t);
  }, [temAberta, load]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) =>
      (tipo === "all" || r.kind === tipo) &&
      (estado === "all" || r.status === estado) &&
      (!q || `${r.title} ${r.started_by_name || ""}`.toLowerCase().includes(q)));
  }, [rows, tipo, estado, busca]);

  const cancelar = async (e: Execucao) => {
    if (!window.confirm(`Cancelar "${e.title}"? O que já foi feito continua feito; o que falta não roda.`)) return;
    setCancelando(e.id);
    const { error } = await (supabase as any).rpc("crm_execution_cancel", { p_id: e.id });
    setCancelando(null);
    if (error) { toast.error(error.message || "Não consegui cancelar"); return; }
    toast.success("Execução cancelada");
    load(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          Tudo que roda em segundo plano: importações, exportações e impulsos. A lista atualiza sozinha.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8 text-sm" placeholder="Buscar por título ou pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="w-[200px]">
            <SearchableSelect value={tipo} onValueChange={setTipo} className="h-9 text-sm"
              options={[{ value: "all", label: "Todos os tipos" }, ...Object.entries(KIND_LABEL).map(([k, v]) => ({ value: k, label: v }))]} />
          </div>
          <div className="w-[170px]">
            <SearchableSelect value={estado} onValueChange={setEstado} className="h-9 text-sm"
              options={[{ value: "all", label: "Todos os estados" }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Execução</th>
                <th className="text-left font-medium px-3 py-2 min-w-[220px]">Progresso</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="text-left font-medium px-3 py-2">Quem iniciou</th>
                <th className="text-left font-medium px-3 py-2">Quando</th>
                <th className="text-left font-medium px-3 py-2">Resultado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</td></tr>
              ) : !filtradas.length ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {rows.length ? "Nenhuma execução nesse filtro." : "Nenhuma execução ainda. Importar leads, exportar mais de 2.000 leads ou criar um impulso aparece aqui."}
                </td></tr>
              ) : filtradas.map((e) => {
                const feito = e.done + e.failed + e.skipped;
                const pct = e.total > 0 ? Math.min(100, Math.round((feito / e.total) * 100)) : e.status === "done" ? 100 : 0;
                const w = (v: number) => `${e.total > 0 ? Math.min(100, (v / e.total) * 100) : 0}%`;
                const semSinal = e.status === "running" && e.kind !== "impulso" && agora - new Date(e.updated_at).getTime() > 3 * 60_000;
                return (
                  <tr key={e.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-[11px] text-muted-foreground">{KIND_LABEL[e.kind] || e.kind}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: w(e.done) }} />
                        <div className="h-full bg-red-500" style={{ width: w(e.failed) }} />
                        <div className="h-full bg-muted-foreground/30" style={{ width: w(e.skipped) }} />
                      </div>
                      <div className="mt-1 text-xs tabular-nums">
                        <b>{pct}%</b> · {num(e.done)} de {num(e.total)} feitos
                        {e.failed > 0 && <span className="text-red-600 dark:text-red-400"> · {num(e.failed)} falhas</span>}
                        {e.skipped > 0 && <span className="text-muted-foreground"> · {num(e.skipped)} pulados</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS[e.status]?.cls || "bg-muted"}`}>
                        {e.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
                        {STATUS[e.status]?.label || e.status}
                      </span>
                      {e.error && <div className="mt-1 max-w-[260px] text-[11px] text-muted-foreground">{e.error}</div>}
                      {semSinal && (
                        <div className="mt-1 max-w-[260px] text-[11px] text-amber-700 dark:text-amber-400">
                          Sem sinal há {Math.round((agora - new Date(e.updated_at).getTime()) / 60_000)} min. Se a aba que rodava foi fechada, cancele.
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.started_by_name || "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {dt(e.started_at || e.created_at)}
                      {e.finished_at && <div className="text-[11px] text-muted-foreground">terminou {dt(e.finished_at)}{duracao(e) ? ` · ${duracao(e)}` : ""}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-start gap-1">
                        {e.result_path && (
                          <Button variant="link" size="sm" className="h-auto p-0 gap-1 text-xs" onClick={() => baixarArquivoExecucao(e.result_path!, e.result_name)}>
                            <Download className="h-3.5 w-3.5" /> Baixar arquivo
                          </Button>
                        )}
                        {e.errors_path && (
                          <Button variant="link" size="sm" className="h-auto p-0 gap-1 text-xs text-red-600 dark:text-red-400"
                            onClick={() => baixarArquivoExecucao(e.errors_path!, `erros-${e.id.slice(0, 8)}.csv`)}>
                            <FileWarning className="h-3.5 w-3.5" /> Lista de erros (CSV)
                          </Button>
                        )}
                        {e.kind === "impulso" && e.ref_id && (
                          <Button variant="link" size="sm" className="h-auto p-0 gap-1 text-xs" onClick={() => onAbrirImpulso(e.ref_id!)}>
                            <ListChecks className="h-3.5 w-3.5" /> Ver itens
                          </Button>
                        )}
                        {!e.result_path && !e.errors_path && e.kind !== "impulso" && <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {ABERTO.includes(e.status) && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-600 dark:text-red-400" onClick={() => cancelar(e)} disabled={cancelando === e.id}>
                          {cancelando === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
