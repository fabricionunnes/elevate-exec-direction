// Faturamento dos leads que entram no funil (25/09/2026). Responde "quem está chegando
// aqui fatura quanto", com corte por funil, origem e faixa.
//
// O campo é texto livre no lead ("600000", "R$ 0 a R$ 50 mil", "100 mil na baixa temporada"),
// então quem traduz para número é a função crm_faturamento_num no banco. Por isso a tela
// sempre mostra o texto original ao lado do valor: dá para conferir a leitura.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Dados = {
  leads: number; informaram: number; media: number | null; mediana: number | null;
  total: number | null; maior: number | null;
  faixas: { faixa: string; n: number; ordem: number }[];
  por_funil: { nome: string; leads: number; informaram: number; media: number | null; mediana: number | null }[];
  por_etapa: { nome: string; leads: number; informaram: number; mediana: number | null }[];
  por_origem: { nome: string; leads: number; informaram: number; media: number | null }[];
  por_segmento: { nome: string; leads: number; media: number | null }[];
  por_mes: { mes: string; leads: number; informaram: number; media: number | null }[];
  top: { id: string; nome: string; empresa: string | null; valor: number; texto: string; funil: string | null; etapa: string | null; dono: string | null; quando: string }[];
};

type Icp = {
  corte: number; total: number; dentro: number; fora: number; sem_info: number;
  icp_ganho: number; icp_perdido: number; icp_aberto: number; icp_valor_perdido: number | null;
  motivos: { motivo: string; n: number; valor: number | null }[];
  motivos_fora: { motivo: string; n: number }[];
  por_funil: { nome: string; total: number; dentro: number; fora: number; sem_info: number; icp_perdido: number }[];
  por_dono: { nome: string; icp: number; ganho: number; perdido: number; aberto: number }[];
  perdidos: { id: string; nome: string; empresa: string | null; valor: number; texto: string; motivo: string; funil: string | null; etapa: string | null; dono: string | null; quando: string }[];
};

const CORES = ["#2a78d6", "#1baf7a", "#4a3aa7", "#eda100", "#eb6834", "#d4321c"];
const real = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const curto = (n: number | null | undefined) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace(".", ",")} mi`;
  if (v >= 1000) return `R$ ${Math.round(v / 1000)} mil`;
  return `R$ ${v}`;
};
const mesBR = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;

const PERIODOS = [
  { r: "30 dias", d: 30 }, { r: "90 dias", d: 90 }, { r: "6 meses", d: 180 }, { r: "12 meses", d: 365 },
];

export function LeadRevenueTab() {
  const [dias, setDias] = useState(90);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [funil, setFunil] = useState("");
  const [origem, setOrigem] = useState("");
  const [etapa, setEtapa] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [funis, setFunis] = useState<{ value: string; label: string }[]>([]);
  const [origens, setOrigens] = useState<{ value: string; label: string }[]>([]);
  const [etapas, setEtapas] = useState<{ value: string; label: string; pipeline_id: string | null }[]>([]);
  const [dados, setDados] = useState<Dados | null>(null);
  const [icp, setIcp] = useState<Icp | null>(null);
  const [corte, setCorte] = useState("50000");
  const [visao, setVisao] = useState<"faturamento" | "icp">("faturamento");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: o }, { data: st }] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").order("name"),
        supabase.from("crm_origins").select("id, name").order("name"),
        supabase.from("crm_stages").select("id, name, pipeline_id").order("position"),
      ]);
      setFunis((p || []).map((x: any) => ({ value: x.id, label: x.name })));
      setOrigens((o || []).map((x: any) => ({ value: x.id, label: x.name })));
      setEtapas((st || []).map((x: any) => ({ value: x.id, label: x.name, pipeline_id: x.pipeline_id })));
    })();
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    // data escolhida na mão manda; senão vale o período dos botões
    const fim = ate || iso(new Date());
    const inicio = de || iso(new Date(new Date(fim).getTime() - (dias - 1) * 86400000));
    const num = (s: string) => { const v = Number(String(s).replace(/\./g, "").replace(",", ".")); return v > 0 ? v : null; };
    const { data, error } = await (supabase as any).rpc("crm_leads_faturamento", {
      p_de: inicio, p_ate: fim,
      p_pipelines: funil && funil !== "none" ? [funil] : null,
      p_origens: origem && origem !== "none" ? [origem] : null,
      p_stages: etapa && etapa !== "none" ? [etapa] : null,
      p_min: num(min), p_max: num(max),
    });
    if (error) { toast.error("Não consegui carregar o faturamento dos leads"); setCarregando(false); return; }
    setDados(data as Dados);

    const { data: dataIcp, error: erroIcp } = await (supabase as any).rpc("crm_leads_icp", {
      p_de: inicio, p_ate: fim,
      p_corte: num(corte) ?? 50000,
      p_pipelines: funil && funil !== "none" ? [funil] : null,
      p_origens: origem && origem !== "none" ? [origem] : null,
      p_stages: etapa && etapa !== "none" ? [etapa] : null,
    });
    if (!erroIcp) setIcp(dataIcp as Icp);
    setCarregando(false);
  }, [dias, de, ate, funil, origem, etapa, min, max, corte]);

  useEffect(() => { buscar(); }, [buscar]);

  const pctInformou = useMemo(() => {
    if (!dados?.leads) return 0;
    return Math.round((dados.informaram / dados.leads) * 100);
  }, [dados]);

  const limpar = () => { setFunil(""); setOrigem(""); setEtapa(""); setMin(""); setMax(""); setDe(""); setAte(""); };
  // etapa só faz sentido dentro do funil escolhido; sem funil, mostra todas com o nome do funil junto
  const etapasVisiveis = useMemo(() => {
    if (funil && funil !== "none") return etapas.filter((e) => e.pipeline_id === funil);
    const nomeFunil = new Map(funis.map((f) => [f.value, f.label]));
    return etapas.map((e) => ({ ...e, label: `${e.label} · ${nomeFunil.get(e.pipeline_id || "") || "sem funil"}` }));
  }, [etapas, funil, funis]);
  const periodoLivre = !!(de || ate);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {PERIODOS.map((p) => (
          <Button key={p.d} size="sm" variant={dias === p.d && !periodoLivre ? "default" : "outline"}
            onClick={() => { setDias(p.d); setDe(""); setAte(""); }}>
            {p.r}
          </Button>
        ))}
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">De</p>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-[150px] h-9" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Até</p>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-[150px] h-9" />
        </div>
        <div className="w-52">
          <SearchableSelect value={funil} onValueChange={setFunil} options={funis}
            placeholder="Todos os funis" allowNone noneLabel="Todos os funis" />
        </div>
        <div className="w-52">
          <SearchableSelect value={origem} onValueChange={setOrigem} options={origens}
            placeholder="Todas as origens" allowNone noneLabel="Todas as origens" />
        </div>
        <div className="w-56">
          <SearchableSelect value={etapa} onValueChange={setEtapa} options={etapasVisiveis}
            placeholder="Todas as etapas" allowNone noneLabel="Todas as etapas" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Fatura de</p>
          <Input value={min} onChange={(e) => setMin(e.target.value)} placeholder="mínimo" className="w-28 h-9" inputMode="numeric" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">até</p>
          <Input value={max} onChange={(e) => setMax(e.target.value)} placeholder="máximo" className="w-28 h-9" inputMode="numeric" />
        </div>
        <Button size="sm" variant="ghost" onClick={limpar}>Limpar</Button>
        <Button size="sm" variant="outline" onClick={buscar} disabled={carregando}>
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={visao} onValueChange={(v) => setVisao(v as any)}>
          <TabsList>
            <TabsTrigger value="faturamento" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Faturamento
            </TabsTrigger>
            <TabsTrigger value="icp" className="gap-1.5">
              <Target className="h-3.5 w-3.5" /> Dentro do ICP
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {visao === "icp" && (
          <div className="flex items-end gap-2">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Está no ICP quem fatura a partir de</p>
              <Input value={corte} onChange={(e) => setCorte(e.target.value)} className="w-32 h-9" inputMode="numeric" />
            </div>
          </div>
        )}
      </div>

      {visao === "faturamento" && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { rot: periodoLivre ? "Leads no intervalo" : "Leads no período", v: dados?.leads ?? 0, texto: `${pctInformou}% informaram o faturamento` },
          { rot: "Faturamento mediano", v: dados?.mediana, moeda: true, texto: "metade fatura mais, metade menos" },
          { rot: "Faturamento médio", v: dados?.media, moeda: true, texto: "sobe com um cliente grande no meio" },
          { rot: "Maior faturamento", v: dados?.maior, moeda: true, texto: "o maior lead do período" },
          { rot: "Informaram", v: dados?.informaram ?? 0, texto: "base de todos os números ao lado" },
        ].map((c) => (
          <Card key={c.rot}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.rot}</p>
              <p className="text-xl font-bold">
                {c.moeda ? real(c.v as number) : Number(c.v || 0).toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.texto}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {dados && dados.informaram === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum lead desse recorte informou o faturamento. Esse campo é preenchido na qualificação,
            então o número só aparece depois que alguém pergunta e registra.
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quantos leads em cada faixa</CardTitle></CardHeader>
          <CardContent>
            {!dados?.faixas?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dados.faixas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="faixa" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(v: any) => [`${v} leads`, "Quantidade"]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="n" radius={[4, 4, 0, 0]}>
                    {dados.faixas.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por funil</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!dados?.por_funil?.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {(dados?.por_funil || []).map((f, i) => (
              <div key={f.nome + i} className="flex items-center justify-between gap-3 border-b border-border/40 last:border-0 py-1.5">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CORES[i % CORES.length] }} />
                  <span className="text-sm truncate">{f.nome}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{f.informaram} de {f.leads}</Badge>
                </span>
                <span className="text-right shrink-0">
                  <span className="text-sm font-semibold">{curto(f.mediana)}</span>
                  <span className="block text-[11px] text-muted-foreground">média {curto(f.media)}</span>
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">O valor em destaque é a mediana do funil.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por etapa</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!dados?.por_etapa?.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {(dados?.por_etapa || []).map((e, i) => (
              <div key={e.nome + i} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 last:border-0 py-1.5">
                <span className="truncate">{e.nome} <span className="text-[11px] text-muted-foreground">({e.informaram} de {e.leads})</span></span>
                <span className="font-semibold shrink-0">{curto(e.mediana)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por origem</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!dados?.por_origem?.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {(dados?.por_origem || []).slice(0, 12).map((o, i) => (
              <div key={o.nome + i} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 last:border-0 py-1.5">
                <span className="truncate">{o.nome} <span className="text-[11px] text-muted-foreground">({o.informaram} de {o.leads})</span></span>
                <span className="font-semibold shrink-0">{curto(o.media)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Mês a mês</CardTitle></CardHeader>
          <CardContent>
            {!dados?.por_mes?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dados.por_mes.map((m) => ({ ...m, label: mesBR(m.mes) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => curto(v)} />
                  <Tooltip
                    formatter={(v: any, n: any) => n === "media" ? [real(Number(v)), "Faturamento médio"] : [v, n]}
                    labelFormatter={(l) => `Mês ${l}`}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="media" fill="#2a78d6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Maiores faturamentos do período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!dados?.top?.length && <p className="text-sm text-muted-foreground">Nenhum lead com faturamento informado.</p>}
          {(dados?.top || []).map((l) => (
            <a
              key={l.id}
              href={`${window.location.origin}/#/crm/leads/${l.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-3 border-b border-border/40 last:border-0 py-2 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate group-hover:underline">
                  {l.nome}
                  {l.empresa ? <span className="font-normal text-muted-foreground"> · {l.empresa}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {l.funil || "Sem funil"}{l.etapa ? ` · ${l.etapa}` : ""}{l.dono ? ` · ${l.dono}` : ""} · {l.quando}
                </p>
                <p className="text-[11px] text-muted-foreground/80 truncate italic">"{l.texto}"</p>
              </div>
              <span className="text-sm font-bold shrink-0 flex items-center gap-1">
                {real(l.valor)}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </span>
            </a>
          ))}
          {!!dados?.top?.length && (
            <p className="text-[11px] text-muted-foreground pt-1">Clique em um lead para abrir o card dele em outra aba.</p>
          )}
        </CardContent>
      </Card>
      </>
      )}

      {visao === "icp" && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { rot: "Dentro do ICP", v: icp?.dentro ?? 0, sub: `fatura ${real(icp?.corte ?? 50000)} ou mais`, cor: "text-emerald-600" },
          { rot: "Fora do ICP", v: icp?.fora ?? 0, sub: "fatura menos que o corte", cor: "text-destructive" },
          { rot: "Sem informação", v: icp?.sem_info ?? 0, sub: "ninguém perguntou o faturamento" },
          { rot: "ICP que não fechou", v: icp?.icp_perdido ?? 0, sub: `${real(icp?.icp_valor_perdido)} de faturamento`, cor: "text-amber-600" },
        ].map((c) => (
          <Card key={c.rot}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.rot}</p>
              <p className={`text-xl font-bold ${c.cor || ""}`}>{Number(c.v).toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">O que aconteceu com quem estava no ICP</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { rot: "Ganhos", v: icp?.icp_ganho ?? 0, cor: "#1baf7a" },
              { rot: "Perdidos", v: icp?.icp_perdido ?? 0, cor: "#d4321c" },
              { rot: "Em aberto", v: icp?.icp_aberto ?? 0, cor: "#2a78d6" },
            ].map((x) => (
              <div key={x.rot} className="rounded-lg border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">{x.rot}</p>
                <p className="text-lg font-bold" style={{ color: x.cor }}>{x.v}</p>
              </div>
            ))}
          </div>
          {!!(icp && (icp.icp_ganho + icp.icp_perdido) > 0) && (
            <p className="text-xs text-muted-foreground mt-3">
              Entre os que já decidiram, {Math.round((icp.icp_ganho / (icp.icp_ganho + icp.icp_perdido)) * 100)}% fecharam.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Por que o ICP não fechou</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!icp?.motivos?.length && <p className="text-sm text-muted-foreground">Nenhum lead do ICP perdido no período.</p>}
            {(icp?.motivos || []).map((m, i) => {
              const pct = icp?.icp_perdido ? (m.n / icp.icp_perdido) * 100 : 0;
              return (
                <div key={m.motivo + i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{m.motivo}</span>
                    <span className="shrink-0">
                      <span className="font-semibold">{m.n}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">{curto(m.valor)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.max(3, pct)}%`, background: CORES[i % CORES.length] }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">ICP por responsável</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!icp?.por_dono?.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {(icp?.por_dono || []).map((d, i) => (
              <div key={d.nome + i} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 last:border-0 py-1.5">
                <span className="truncate">{d.nome}</span>
                <span className="shrink-0 text-[11px] flex gap-3">
                  <span className="text-emerald-600 font-semibold">{d.ganho} ganhos</span>
                  <span className="text-destructive font-semibold">{d.perdido} perdidos</span>
                  <span className="text-muted-foreground">{d.aberto} em aberto</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">ICP por funil</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!icp?.por_funil?.length && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          {(icp?.por_funil || []).map((f, i) => (
            <div key={f.nome + i} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 last:border-0 py-1.5">
              <span className="truncate">{f.nome} <span className="text-[11px] text-muted-foreground">({f.total} leads)</span></span>
              <span className="shrink-0 text-[11px] flex gap-3">
                <span className="text-emerald-600 font-semibold">{f.dentro} no ICP</span>
                <span className="text-destructive">{f.fora} fora</span>
                <span className="text-muted-foreground">{f.sem_info} sem informação</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Leads do ICP que não fecharam
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!icp?.perdidos?.length && <p className="text-sm text-muted-foreground">Nenhum no período.</p>}
          {(icp?.perdidos || []).map((l) => (
            <a
              key={l.id}
              href={`${window.location.origin}/#/crm/leads/${l.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-3 border-b border-border/40 last:border-0 py-2 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {l.nome}
                  {l.empresa ? <span className="font-normal text-muted-foreground"> · {l.empresa}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {l.motivo} · {l.funil || "Sem funil"}{l.etapa ? ` · ${l.etapa}` : ""}{l.dono ? ` · ${l.dono}` : ""} · {l.quando}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0 flex items-center gap-1">
                {real(l.valor)}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </span>
            </a>
          ))}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
