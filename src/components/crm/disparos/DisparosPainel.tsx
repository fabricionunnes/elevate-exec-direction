// Mais > Disparos API > aba "Painel" (pedido do Fabrício, 24/09/2026): o dashboard
// completo, com filtros por template, agente de IA, funil e quem enviou, e os gráficos
// da operação. Os números vêm de uma consulta só: official_dashboard(...).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Filter, X, TrendingUp, MessageSquare, AlertTriangle } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";

// Paleta validada pro daltonismo (skill dataviz: ΔE mínimo 9,1 entre vizinhas)
const C = {
  enviados: "#2a78d6",   // azul
  entregues: "#1baf7a",  // verde-água
  lidos: "#4a3aa7",      // violeta
  responderam: "#eda100",// amarelo
  falhas: "#d4321c",     // vermelho (status)
  vendas: "#eb6834",     // laranja
};
const SERIES = [C.enviados, C.entregues, C.lidos, C.responderam, C.vendas, "#e87ba4", "#008300", "#666"];

const n = (v: unknown) => Number(v || 0);
const pctNum = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const tplLabel = (s: string) => (s || "").replace(/_/g, " ");
const diaCurto = (s: string) => { const [, m, d] = s.split("-"); return `${d}/${m}`; };

const ERRO_LABEL: Record<string, string> = {
  "131026": "Número não recebe",
  "131049": "Meta segurou (marketing)",
  "131048": "Limite por spam",
  "131042": "Pagamento da conta",
  "141006": "Pagamento da conta",
  "130472": "Teste da Meta",
  "131050": "Bloqueou marketing",
  "131009": "Valor de variável recusado",
  outro: "Outros",
};

type Opt = { value: string; label: string };

/** Filtro de múltipla escolha, sempre pesquisável (regra do Fabrício). */
function MultiFiltro({ titulo, opcoes, valor, onChange }: { titulo: string; opcoes: Opt[]; valor: string[]; onChange: (v: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const marcados = opcoes.filter((o) => valor.includes(o.value));
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          {titulo}
          {marcados.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5">{marcados.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${titulo.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => (
                <CommandItem key={o.value} onSelect={() => onChange(valor.includes(o.value) ? valor.filter((x) => x !== o.value) : [...valor, o.value])}>
                  <Checkbox checked={valor.includes(o.value)} className="mr-2" />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {marcados.length > 0 && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange([])}>Limpar</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Kpi({ label, valor, sub, cor, destaque }: { label: string; valor: string; sub?: string; cor: string; destaque?: boolean }) {
  return (
    <Card className="overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${cor}, ${cor}55)` }} />
      <CardContent className="p-3 pt-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`font-semibold ${destaque ? "text-2xl" : "text-xl"}`} style={{ color: cor }}>{valor}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Grafico({ titulo, subtitulo, children, altura = 260 }: { titulo: string; subtitulo?: string; children: React.ReactElement; altura?: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium">{titulo}</p>
        {subtitulo && <p className="text-xs text-muted-foreground mb-2">{subtitulo}</p>}
        <div style={{ height: altura }} className="mt-2">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const tipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" };

export function DisparosPainel({ from, to, periodoTexto, custoPorMensagem = 0 }: { from: Date; to: Date; periodoTexto: string; custoPorMensagem?: number }) {
  const [dados, setDados] = useState<any>(null);
  const [filtros, setFiltros] = useState<any>({ templates: [], senders: [], agentes: [], funis: [] });
  const [carregando, setCarregando] = useState(true);
  const [selTpl, setSelTpl] = useState<string[]>([]);
  const [selAge, setSelAge] = useState<string[]>([]);
  const [selFun, setSelFun] = useState<string[]>([]);
  const [selEnv, setSelEnv] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const args = {
      p_from: from.toISOString(), p_to: to.toISOString(),
      p_templates: selTpl.length ? selTpl : null,
      p_agents: selAge.length ? selAge : null,
      p_pipelines: selFun.length ? selFun : null,
      p_senders: selEnv.length ? selEnv : null,
    };
    const [d, f] = await Promise.all([
      supabase.rpc("official_dashboard" as any, args),
      supabase.rpc("official_dashboard_filtros" as any, { p_from: args.p_from, p_to: args.p_to }),
    ]);
    setDados(d.data || null);
    if (f.data) setFiltros(f.data);
    setCarregando(false);
  }, [from, to, selTpl, selAge, selFun, selEnv]);
  useEffect(() => { carregar(); }, [carregar]);

  const k = dados?.kpis || {};
  const enviados = n(k.enviados), entregues = n(k.entregues), lidos = n(k.lidos), responderam = n(k.responderam);
  const agendadas = n(k.agendadas), realizadas = n(k.realizadas), vendas = n(k.vendas);
  // custo estimado: cobráveis × valor por mensagem entregue (a Meta não devolve custo por API)
  const custo = n(k.cobraveis) * custoPorMensagem;

  const porDia = useMemo(() => (dados?.por_dia || []).map((d: any) => ({
    dia: diaCurto(d.dia), enviados: n(d.enviados), entregues: n(d.entregues), lidos: n(d.lidos), responderam: n(d.responderam), falhas: n(d.falhas),
  })), [dados]);

  const funilEtapas = useMemo(() => ([
    { etapa: "Enviados", valor: enviados, cor: C.enviados },
    { etapa: "Entregues", valor: entregues, cor: C.entregues },
    { etapa: "Lidos", valor: lidos, cor: C.lidos },
    { etapa: "Responderam", valor: responderam, cor: C.responderam },
    { etapa: "Reuniões", valor: n(k.agendadas), cor: C.vendas },
    { etapa: "Vendas", valor: n(k.vendas), cor: "#008300" },
  ]), [enviados, entregues, lidos, responderam, k]);

  const porTemplate = useMemo(() => (dados?.por_template || []).map((t: any) => ({
    nome: tplLabel(t.nome), enviados: n(t.enviados), entregues: n(t.entregues), responderam: n(t.responderam),
    taxa: Math.round(pctNum(n(t.responderam), n(t.entregues))),
  })), [dados]);

  const porFunil = useMemo(() => (dados?.por_funil || []).slice(0, 8).map((t: any) => ({
    nome: t.nome, enviados: n(t.enviados), responderam: n(t.responderam),
    taxa: Math.round(pctNum(n(t.responderam), n(t.entregues))),
  })), [dados]);

  const porHora = useMemo(() => {
    const m = new Map<number, { hora: number; enviados: number; responderam: number }>();
    for (let h = 7; h <= 21; h++) m.set(h, { hora: h, enviados: 0, responderam: 0 });
    (dados?.por_hora || []).forEach((x: any) => {
      const h = n(x.hora); if (!m.has(h)) m.set(h, { hora: h, enviados: 0, responderam: 0 });
      m.get(h)!.enviados = n(x.enviados); m.get(h)!.responderam = n(x.responderam);
    });
    return [...m.values()].sort((a, b) => a.hora - b.hora).map((x) => ({ ...x, label: `${String(x.hora).padStart(2, "0")}h`, taxa: Math.round(pctNum(x.responderam, x.enviados)) }));
  }, [dados]);

  const erros = useMemo(() => (dados?.erros || []).map((e: any) => ({
    nome: ERRO_LABEL[e.codigo] || e.codigo, codigo: e.codigo, n: n(e.n),
  })), [dados]);

  const porAgente = useMemo(() => (dados?.por_agente || []).map((a: any) => ({
    nome: a.nome, enviados: n(a.enviados), responderam: n(a.responderam), agendadas: n(a.agendadas), vendas: n(a.vendas),
    taxa: Math.round(pctNum(n(a.responderam), n(a.enviados))),
  })), [dados]);

  const temFiltro = selTpl.length + selAge.length + selFun.length + selEnv.length > 0;

  return (
    <div className="space-y-4">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiFiltro titulo="Template" valor={selTpl} onChange={setSelTpl}
          opcoes={(filtros.templates || []).map((t: string) => ({ value: t, label: tplLabel(t) }))} />
        <MultiFiltro titulo="Agente de IA" valor={selAge} onChange={setSelAge}
          opcoes={(filtros.agentes || []).map((a: any) => ({ value: a.id, label: a.nome }))} />
        <MultiFiltro titulo="Funil" valor={selFun} onChange={setSelFun}
          opcoes={(filtros.funis || []).map((f: any) => ({ value: f.id, label: f.nome }))} />
        <MultiFiltro titulo="Quem enviou" valor={selEnv} onChange={setSelEnv}
          opcoes={(filtros.senders || []).map((s: string) => ({ value: s, label: s }))} />
        {temFiltro && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setSelTpl([]); setSelAge([]); setSelFun([]); setSelEnv([]); }}>
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{periodoTexto}</span>
      </div>

      {carregando && !dados ? (
        <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando o painel...</div>
      ) : !enviados ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum disparo com esses filtros.</CardContent></Card>
      ) : (
        <>
          {/* o que saiu */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Kpi label="Disparos" valor={n(k.disparos).toLocaleString("pt-BR")} sub={`${n(k.pulados)} lead(s) pulados`} cor="#666" />
            <Kpi label="Enviados" valor={enviados.toLocaleString("pt-BR")} cor={C.enviados} destaque />
            <Kpi label="Entregues" valor={entregues.toLocaleString("pt-BR")} sub={pct(entregues, enviados)} cor={C.entregues} />
            <Kpi label="Lidos" valor={lidos.toLocaleString("pt-BR")} sub={pct(lidos, entregues)} cor={C.lidos} />
            <Kpi label="Responderam" valor={responderam.toLocaleString("pt-BR")} sub={pct(responderam, entregues)} cor={C.responderam} destaque />
            <Kpi label="Falhas" valor={n(k.falhas).toLocaleString("pt-BR")} sub={`${pct(n(k.falhas), enviados)} do enviado`} cor={C.falhas} />
          </div>

          {/* o que voltou */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Reuniões agendadas" valor={agendadas.toLocaleString("pt-BR")} sub={`${pct(agendadas, responderam)} de quem respondeu`} cor={C.enviados} destaque />
            <Kpi label="Reuniões realizadas" valor={realizadas.toLocaleString("pt-BR")} sub={agendadas ? `${pct(realizadas, agendadas)} das agendadas` : undefined} cor={C.entregues} destaque />
            <Kpi label="No-show" valor={n(k.no_show).toLocaleString("pt-BR")} sub={realizadas + n(k.no_show) ? `${pct(n(k.no_show), realizadas + n(k.no_show))} das reuniões` : undefined} cor={C.responderam} />
            <Kpi label="Vendas" valor={vendas.toLocaleString("pt-BR")} sub={brl(Number(k.valor_vendas || 0))} cor="#008300" destaque />
          </div>

          {/* quanto custou */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Custo total" valor={brl(custo)} sub={`${n(k.cobraveis).toLocaleString("pt-BR")} mensagem(ns) cobrada(s)`} cor={C.vendas} destaque />
            <Kpi label="Custo por reunião agendada" valor={agendadas ? brl(custo / agendadas) : "—"} sub="custo ÷ agendadas" cor={C.vendas} />
            <Kpi label="Custo por reunião realizada" valor={realizadas ? brl(custo / realizadas) : "—"} sub="custo ÷ realizadas" cor={C.vendas} />
            <Kpi label="CAC" valor={vendas ? brl(custo / vendas) : "—"}
              sub={vendas && custo > 0 ? `retorno de ${(Number(k.valor_vendas || 0) / custo).toFixed(1).replace(".", ",")}x` : "ainda sem venda"}
              cor="#008300" destaque />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Grafico titulo="Dia a dia" subtitulo="Quanto saiu e quanto voltou em cada dia" altura={280}>
                <AreaChart data={porDia} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    {Object.entries({ enviados: C.enviados, entregues: C.entregues, lidos: C.lidos, responderam: C.responderam }).map(([k2, cor]) => (
                      <linearGradient key={k2} id={`g-${k2}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cor} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={cor} stopOpacity={0.04} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                  <RTooltip contentStyle={tipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="enviados" name="Enviados" stroke={C.enviados} strokeWidth={2} fill="url(#g-enviados)" />
                  <Area type="monotone" dataKey="entregues" name="Entregues" stroke={C.entregues} strokeWidth={2} fill="url(#g-entregues)" />
                  <Area type="monotone" dataKey="lidos" name="Lidos" stroke={C.lidos} strokeWidth={2} fill="url(#g-lidos)" />
                  <Area type="monotone" dataKey="responderam" name="Responderam" stroke={C.responderam} strokeWidth={2} fill="url(#g-responderam)" />
                </AreaChart>
              </Grafico>
            </div>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Do envio à venda</p>
                <p className="text-xs text-muted-foreground mb-3">Quanto sobra em cada passo</p>
                <div className="space-y-2">
                  {funilEtapas.map((e, i) => {
                    const base = funilEtapas[0].valor || 1;
                    const largura = Math.max(3, (e.valor / base) * 100);
                    const anterior = i > 0 ? funilEtapas[i - 1].valor : null;
                    return (
                      <div key={e.etapa}>
                        <div className="flex items-baseline justify-between text-xs mb-0.5">
                          <span className="font-medium">{e.etapa}</span>
                          <span className="text-muted-foreground">
                            {e.valor.toLocaleString("pt-BR")}
                            {anterior !== null && anterior > 0 && <span className="ml-1.5 text-[10px]">({Math.round(pctNum(e.valor, anterior))}% do passo anterior)</span>}
                          </span>
                        </div>
                        <div className="h-6 rounded-md bg-muted/60 overflow-hidden">
                          <div className="h-full rounded-md transition-all" style={{ width: `${largura}%`, background: `linear-gradient(90deg, ${e.cor}, ${e.cor}bb)`, boxShadow: `inset 0 -6px 10px -6px rgba(0,0,0,.35)` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Grafico titulo="Por template" subtitulo="Quem responde mais">
              <BarChart data={porTemplate} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-bar-tpl" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={C.entregues} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={C.enviados} stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tipStyle} formatter={(v: any, nome: any, p: any) => [v, nome === "responderam" ? `Responderam (${p.payload.taxa}%)` : nome]} />
                <Bar dataKey="entregues" name="Entregues" fill="url(#g-bar-tpl)" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="responderam" name="Responderam" fill={C.responderam} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </Grafico>

            <Grafico titulo="Por funil" subtitulo="De onde vêm os leads que respondem">
              <BarChart data={porFunil} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tipStyle} />
                <Bar dataKey="enviados" name="Enviados" fill={C.enviados} radius={[0, 4, 4, 0]} barSize={14} fillOpacity={0.55} />
                <Bar dataKey="responderam" name="Responderam" fill={C.responderam} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </Grafico>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Grafico titulo="Melhor horário" subtitulo="Hora do envio e quantos responderam">
              <BarChart data={porHora} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-hora" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.enviados} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={C.enviados} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <RTooltip contentStyle={tipStyle} formatter={(v: any, nome: any, p: any) => [nome === "responderam" ? `${v} (${p.payload.taxa}%)` : v, nome === "responderam" ? "Responderam" : "Enviados"]} />
                <Bar dataKey="enviados" name="Enviados" fill="url(#g-hora)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="responderam" name="Responderam" fill={C.responderam} radius={[4, 4, 0, 0]} />
              </BarChart>
            </Grafico>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-destructive" />Por que falhou</p>
                <p className="text-xs text-muted-foreground mb-2">{n(k.falhas).toLocaleString("pt-BR")} falhas no período</p>
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={erros} dataKey="n" nameKey="nome" innerRadius={45} outerRadius={78} paddingAngle={2} stroke="hsl(var(--background))" strokeWidth={2}>
                          {erros.map((_e: any, i: number) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                        </Pie>
                        <RTooltip contentStyle={tipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1">
                    {erros.slice(0, 7).map((e: any, i: number) => (
                      <div key={e.codigo} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
                        <span className="truncate flex-1">{e.nome}</span>
                        <span className="text-muted-foreground tabular-nums">{e.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {porAgente.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="h-4 w-4" />Por agente de IA</p>
                <p className="text-xs text-muted-foreground mb-3">Quem atendeu quem respondeu ao disparo</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="text-left font-medium py-1.5">Agente</th>
                        <th className="text-right font-medium">Enviados</th>
                        <th className="text-right font-medium">Responderam</th>
                        <th className="text-right font-medium">Taxa</th>
                        <th className="text-right font-medium">Reuniões</th>
                        <th className="text-right font-medium">Vendas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porAgente.map((a: any) => (
                        <tr key={a.nome} className="border-b last:border-0">
                          <td className="py-1.5">{a.nome}</td>
                          <td className="text-right tabular-nums">{a.enviados.toLocaleString("pt-BR")}</td>
                          <td className="text-right tabular-nums" style={{ color: C.responderam }}>{a.responderam}</td>
                          <td className="text-right tabular-nums">{a.taxa}%</td>
                          <td className="text-right tabular-nums">{a.agendadas}</td>
                          <td className="text-right tabular-nums" style={{ color: "#008300" }}>{a.vendas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
