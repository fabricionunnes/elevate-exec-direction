// Checkup diário do produto (30/09/2026). Rotina de segunda a sexta em blocos:
// cada bloco já abre o que precisa de atenção hoje (calculado na hora pela edge
// function produto-checkup). A pessoa trata, anota e marca o bloco como feito.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, ChevronRight, ClipboardCheck, ExternalLink, Loader2, RefreshCw, Send, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  key: string; bloco: string; company_id: string | null; staff_id: string | null; project_id: string | null;
  empresa: string | null; consultor: string | null; consultant_id: string | null;
  gravidade: "alta" | "media" | "baixa"; titulo: string; detalhe: string | null;
  tratado: boolean; nota: string | null; tarefa_id: string | null; anterior: { dia: string; nota: string | null } | null;
};
type Bloco = { key: string; titulo: string; descricao: string; feito: boolean; feito_em: string | null; nota: string | null; pendencias: number; tratadas: number; itens: Item[] };
type Dados = { dia: string; grupos_ok: boolean; blocos: Bloco[] };
type DiaHist = { dia: string; feitos: number; total: number; pendencias: number; tratadas: number; quem: string[] };

const GRAV = {
  alta: { rotulo: "Grave", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20", ponto: "bg-rose-500" },
  media: { rotulo: "Atenção", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", ponto: "bg-amber-500" },
  baixa: { rotulo: "Leve", cls: "bg-slate-500/10 text-slate-600 border-slate-500/20", ponto: "bg-slate-400" },
} as const;

const dataBR = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const diaCurto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

// supabase.functions.invoke esconde a mensagem real em error.context quando a função responde não-2xx
async function chamar(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("produto-checkup", { body });
  if (error) {
    let msg = "Não consegui falar com o servidor.";
    try { const j = await (error as any).context?.json?.(); if (j?.erro) msg = j.erro; } catch { /* mantém a genérica */ }
    throw new Error(msg);
  }
  if (data && data.ok === false) throw new Error(data.erro || "Erro no checkup.");
  return data;
}

export default function ProdutoCheckupPage() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<Dados | null>(null);
  const [hist, setHist] = useState<DiaHist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"hoje" | "historico">("hoje");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [consultor, setConsultor] = useState("todos");
  const [soAbertas, setSoAbertas] = useState(true);
  const [grav, setGrav] = useState<"todas" | "alta" | "alta_media">("todas");
  const [editando, setEditando] = useState<{ key: string; modo: "tratar" | "cobrar" } | null>(null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const buscar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const [d, h] = await Promise.all([chamar({ action: "get" }), chamar({ action: "historico" })]);
      setDados(d as Dados);
      setHist((h?.dias || []) as DiaHist[]);
      setErro(null);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar o checkup.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  const consultores = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of dados?.blocos || []) for (const i of b.itens) if (i.consultant_id && i.consultor) m.set(i.consultant_id, i.consultor);
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [dados]);

  const filtra = useCallback((i: Item) =>
    (consultor === "todos" || i.consultant_id === consultor || (i.bloco === "consultores" && i.staff_id === consultor))
    && (!soAbertas || !i.tratado)
    && (grav === "todas" || i.gravidade === "alta" || (grav === "alta_media" && i.gravidade === "media")),
  [consultor, soAbertas, grav]);

  // filtro ativo: abre os blocos que têm resultado, pra mudança aparecer na hora
  const filtroAtivo = consultor !== "todos" || grav !== "todas";
  useEffect(() => {
    if (!dados || !filtroAtivo) return;
    setAbertos(new Set(dados.blocos.filter((b) => b.itens.some(filtra)).map((b) => b.key)));
  }, [dados, filtroAtivo, filtra]);

  // prioridades: o que é grave, em todos os blocos, respeitando o filtro de consultor
  const prioridades = useMemo(() => {
    if (!dados) return [] as (Item & { blocoTitulo: string })[];
    return dados.blocos.flatMap((b) => b.itens.filter((i) => i.gravidade === "alta" && (consultor === "todos" || i.consultant_id === consultor || (i.bloco === "consultores" && i.staff_id === consultor)) && (!soAbertas || !i.tratado)).map((i) => ({ ...i, blocoTitulo: b.titulo })));
  }, [dados, consultor, soAbertas]);
  const [verTodasPrio, setVerTodasPrio] = useState(false);

  const feitos = dados?.blocos.filter((b) => b.feito).length || 0;
  const totalBlocos = dados?.blocos.length || 0;
  const abertasTotal = dados?.blocos.reduce((a, b) => a + (b.pendencias - b.tratadas), 0) || 0;

  const semana = useMemo(() => {
    if (!dados) return null;
    const hoje = new Date(`${dados.dia}T12:00:00`);
    const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
    let dias = 0, feitosSem = 0;
    for (let d = new Date(seg); d <= hoje; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      dias++;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      feitosSem += iso === dados.dia ? feitos : (hist.find((h) => h.dia === iso)?.feitos || 0);
    }
    return dias ? Math.round((feitosSem / (dias * Math.max(1, totalBlocos))) * 100) : null;
  }, [dados, hist, feitos, totalBlocos]);

  const alternar = (k: string) => setAbertos((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const marcarBloco = async (b: Bloco) => {
    setOcupado(`bloco:${b.key}`);
    try {
      await chamar({ action: "bloco", bloco: b.key, feito: !b.feito });
      toast.success(b.feito ? "Bloco reaberto." : `${b.titulo}: feito.`);
      await buscar(true);
    } catch (e: any) { toast.error(e.message); } finally { setOcupado(null); }
  };

  const confirmarItem = async (i: Item, modo: "tratar" | "cobrar") => {
    setOcupado(i.key);
    try {
      if (modo === "cobrar") {
        await chamar({ action: "cobrar", item: i.key, descricao: nota || undefined, nota: nota ? `Tarefa criada para o consultor: ${nota}` : undefined });
        toast.success(`Tarefa criada para ${i.consultor || "o consultor"}.`);
      } else {
        await chamar({ action: "item", item: i.key, tratado: true, nota: nota || null });
        toast.success("Marcado como tratado.");
      }
      setEditando(null); setNota("");
      await buscar(true);
    } catch (e: any) { toast.error(e.message); } finally { setOcupado(null); }
  };

  const desfazerItem = async (i: Item) => {
    setOcupado(i.key);
    try { await chamar({ action: "item", item: i.key, tratado: false }); await buscar(true); }
    catch (e: any) { toast.error(e.message); } finally { setOcupado(null); }
  };

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (erro || !dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground max-w-md">{erro || "Não consegui carregar o checkup."}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/onboarding-tasks")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
          <Button onClick={() => buscar()}><RefreshCw className="h-4 w-4 mr-2" />Tentar de novo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2"><ClipboardCheck className="h-6 w-6 text-primary" />Checkup do produto</h1>
              <p className="text-sm text-muted-foreground capitalize">{dataBR(dados.dia)}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => buscar(true)}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Rotina de hoje</p>
            <p className="text-2xl font-semibold">{feitos} de {totalBlocos} blocos</p>
            <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${totalBlocos ? (feitos / totalBlocos) * 100 : 0}%` }} /></div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendências abertas</p>
            <p className="text-2xl font-semibold">{abertasTotal}</p>
            <p className="text-xs text-muted-foreground mt-1">somando todos os blocos</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aderência na semana</p>
            <p className="text-2xl font-semibold">{semana === null ? "sem dias úteis" : `${semana}%`}</p>
            <p className="text-xs text-muted-foreground mt-1">blocos feitos de segunda até hoje</p>
          </CardContent></Card>
        </div>

        <div className="flex items-center gap-2 flex-wrap border-b border-border">
          {(["hoje", "historico"] as const).map((a) => (
            <button key={a} onClick={() => setAba(a)} className={cn("px-3 py-2 text-sm border-b-2 -mb-px", aba === a ? "border-primary font-medium" : "border-transparent text-muted-foreground")}>
              {a === "hoje" ? "Hoje" : "Histórico"}
            </button>
          ))}
        </div>

        {aba === "hoje" && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-[260px]">
                <SearchableSelect
                  value={consultor}
                  onValueChange={(v) => setConsultor(v || "todos")}
                  options={[{ value: "todos", label: "Todos os consultores" }, ...consultores]}
                  placeholder="Digite pra buscar…"
                  emptyMessage="Nenhum consultor encontrado"
                />
              </div>
              <div className="w-[210px]">
                <SearchableSelect
                  value={grav}
                  onValueChange={(v) => setGrav((v as any) || "todas")}
                  options={[{ value: "todas", label: "Todas as gravidades" }, { value: "alta", label: "Só graves" }, { value: "alta_media", label: "Graves e atenção" }]}
                  placeholder="Gravidade"
                  emptyMessage="Sem opção"
                />
              </div>
              <Button variant={soAbertas ? "default" : "outline"} size="sm" onClick={() => setSoAbertas((v) => !v)}>
                {soAbertas ? "Só abertas" : "Abertas e tratadas"}
              </Button>
              {!dados.grupos_ok && <Badge variant="outline" className="text-amber-600 border-amber-500/30">Não consegui ler os grupos agora</Badge>}
            </div>

            <Card className="border-rose-500/30">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-medium">Prioridades de hoje <span className="text-xs text-muted-foreground font-normal">o que é grave, em todos os blocos</span></p>
                  <Badge variant="outline" className={prioridades.length ? "text-rose-600 border-rose-500/30" : "text-emerald-600 border-emerald-500/30"}>{prioridades.length} graves</Badge>
                </div>
                {prioridades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nada grave em aberto{consultor !== "todos" ? " para esse consultor" : ""}.</p>
                ) : (
                  <div className="divide-y divide-border rounded-md border">
                    {(verTodasPrio ? prioridades : prioridades.slice(0, 8)).map((i) => {
                      const emEdicao = editando?.key === i.key;
                      return (
                        <div key={`prio-${i.key}`} className="p-3 space-y-2">
                          <div className="flex items-start gap-3">
                            <span className="mt-1.5 h-2 w-2 rounded-full bg-rose-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">{i.blocoTitulo}</Badge>
                                {i.empresa && (i.project_id
                                  ? <button className="font-medium text-sm hover:underline inline-flex items-center gap-1" onClick={() => navigate(`/onboarding-tasks/${i.project_id}`)}>{i.empresa}<ExternalLink className="h-3 w-3 text-muted-foreground" /></button>
                                  : <span className="font-medium text-sm">{i.empresa}</span>)}
                                {i.consultor && i.bloco !== "consultores" && <span className="text-[11px] text-muted-foreground">{i.consultor}</span>}
                              </div>
                              <p className="text-sm mt-0.5">{i.titulo}</p>
                              {i.detalhe && <p className="text-xs text-muted-foreground mt-0.5 break-words">{i.detalhe}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {i.tratado ? (
                                <Button variant="ghost" size="sm" onClick={() => desfazerItem(i)} disabled={ocupado === i.key}><Undo2 className="h-3.5 w-3.5 mr-1" />Desfazer</Button>
                              ) : (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => { setEditando({ key: i.key, modo: "tratar" }); setNota(""); }}><Check className="h-3.5 w-3.5 mr-1" />Tratado</Button>
                                  {i.project_id && (i.staff_id || i.consultant_id) && (
                                    <Button variant="ghost" size="sm" onClick={() => { setEditando({ key: i.key, modo: "cobrar" }); setNota(""); }}><Send className="h-3.5 w-3.5 mr-1" />Cobrar</Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {emEdicao && (
                            <div className="flex items-center gap-2 pl-5">
                              <Input autoFocus value={nota} onChange={(e) => setNota(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") confirmarItem(i, editando!.modo); if (e.key === "Escape") setEditando(null); }}
                                placeholder={editando!.modo === "cobrar" ? `O que ${i.consultor || "o consultor"} precisa fazer (opcional)` : "O que foi feito (opcional)"} />
                              <Button size="sm" onClick={() => confirmarItem(i, editando!.modo)} disabled={ocupado === i.key}>
                                {ocupado === i.key && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                                {editando!.modo === "cobrar" ? "Criar tarefa" : "Confirmar"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {prioridades.length > 8 && (
                  <Button variant="ghost" size="sm" onClick={() => setVerTodasPrio((v) => !v)}>{verTodasPrio ? "Mostrar menos" : `Ver todas as ${prioridades.length}`}</Button>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {dados.blocos.map((b) => {
                const visiveis = b.itens.filter(filtra);
                const aberto = abertos.has(b.key);
                const abertas = filtroAtivo ? visiveis.filter((i) => !i.tratado).length : b.pendencias - b.tratadas;
                const totalMostrado = filtroAtivo ? visiveis.length : b.pendencias;
                return (
                  <Card key={b.key} className={cn(b.feito && "border-emerald-500/40")}>
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 p-4">
                        <button
                          onClick={() => marcarBloco(b)}
                          disabled={ocupado === `bloco:${b.key}`}
                          title={b.feito ? "Reabrir bloco" : "Marcar bloco como feito"}
                          className={cn("h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                            b.feito ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary")}
                        >
                          {ocupado === `bloco:${b.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : b.feito ? <Check className="h-4 w-4" /> : null}
                        </button>
                        <button className="flex-1 min-w-0 text-left" onClick={() => alternar(b.key)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-medium", b.feito && "text-muted-foreground")}>{b.titulo}</span>
                            {totalMostrado === 0
                              ? <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">{filtroAtivo ? "nada com esse filtro" : "nada hoje"}</Badge>
                              : <Badge variant="outline" className={abertas > 0 ? "" : "text-emerald-600 border-emerald-500/30"}>{abertas} abertas de {totalMostrado}{filtroAtivo ? " no filtro" : ""}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.descricao}</p>
                        </button>
                        <button onClick={() => alternar(b.key)} className="text-muted-foreground">{aberto ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</button>
                      </div>

                      {aberto && (
                        <div className="border-t border-border divide-y divide-border">
                          {visiveis.length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground">{b.pendencias === 0 ? "Nenhuma pendência neste bloco hoje." : "Nada para mostrar com esse filtro."}</p>
                          )}
                          {visiveis.map((i) => {
                            const g = GRAV[i.gravidade];
                            const emEdicao = editando?.key === i.key;
                            return (
                              <div key={i.key} className={cn("p-4 space-y-2", i.tratado && "bg-muted/40")}>
                                <div className="flex items-start gap-3">
                                  <span className={cn("mt-1.5 h-2 w-2 rounded-full flex-shrink-0", g.ponto)} title={g.rotulo} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {i.empresa && (
                                        i.project_id
                                          ? <button className="font-medium text-sm hover:underline inline-flex items-center gap-1" onClick={() => navigate(`/onboarding-tasks/${i.project_id}`)}>{i.empresa}<ExternalLink className="h-3 w-3 text-muted-foreground" /></button>
                                          : <span className="font-medium text-sm">{i.empresa}</span>
                                      )}
                                      <Badge variant="outline" className={cn("text-[10px]", g.cls)}>{g.rotulo}</Badge>
                                      {i.consultor && b.key !== "consultores" && <span className="text-[11px] text-muted-foreground">{i.consultor}</span>}
                                    </div>
                                    <p className="text-sm mt-0.5">{i.titulo}</p>
                                    {i.detalhe && <p className="text-xs text-muted-foreground mt-0.5 break-words">{i.detalhe}</p>}
                                    {i.tratado && <p className="text-xs text-emerald-700 mt-1">Tratado hoje{i.nota ? `: ${i.nota}` : ""}</p>}
                                    {!i.tratado && i.anterior && (
                                      <p className="text-xs text-muted-foreground mt-1">Já tratada em {diaCurto(i.anterior.dia)}{i.anterior.nota ? `: ${i.anterior.nota}` : ""}, e continua aberta.</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {i.tratado ? (
                                      <Button variant="ghost" size="sm" onClick={() => desfazerItem(i)} disabled={ocupado === i.key}><Undo2 className="h-3.5 w-3.5 mr-1" />Desfazer</Button>
                                    ) : (
                                      <>
                                        <Button variant="outline" size="sm" onClick={() => { setEditando({ key: i.key, modo: "tratar" }); setNota(""); }}><Check className="h-3.5 w-3.5 mr-1" />Tratado</Button>
                                        {i.project_id && (i.staff_id || i.consultant_id) && (
                                          <Button variant="ghost" size="sm" onClick={() => { setEditando({ key: i.key, modo: "cobrar" }); setNota(""); }}><Send className="h-3.5 w-3.5 mr-1" />Cobrar</Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                                {emEdicao && (
                                  <div className="flex items-center gap-2 pl-5">
                                    <Input
                                      autoFocus
                                      value={nota}
                                      onChange={(e) => setNota(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") confirmarItem(i, editando!.modo); if (e.key === "Escape") setEditando(null); }}
                                      placeholder={editando!.modo === "cobrar" ? `O que ${i.consultor || "o consultor"} precisa fazer (opcional)` : "O que foi feito (opcional)"}
                                    />
                                    <Button size="sm" onClick={() => confirmarItem(i, editando!.modo)} disabled={ocupado === i.key}>
                                      {ocupado === i.key && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                                      {editando!.modo === "cobrar" ? "Criar tarefa" : "Confirmar"}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>Cancelar</Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {aba === "historico" && (
          <Card><CardContent className="p-0">
            {hist.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Ainda não há dias registrados. O histórico começa quando o primeiro bloco for marcado como feito.</p>
            ) : (
              <div className="divide-y divide-border">
                {hist.map((h) => (
                  <div key={h.dia} className="p-4 flex items-center gap-4 flex-wrap">
                    <span className="w-28 text-sm font-medium capitalize">{diaCurto(h.dia)}</span>
                    <div className="flex-1 min-w-[160px]">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full", h.feitos >= h.total ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${(h.feitos / Math.max(1, h.total)) * 100}%` }} /></div>
                    </div>
                    <span className="text-sm tabular-nums">{h.feitos} de {h.total} blocos</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{h.tratadas} tratadas de {h.pendencias}</span>
                    <span className="text-xs text-muted-foreground">{h.quem.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
