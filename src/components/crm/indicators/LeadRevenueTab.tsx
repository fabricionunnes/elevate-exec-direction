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
import { RefreshCw, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Dados = {
  leads: number; informaram: number; media: number | null; mediana: number | null;
  total: number | null; maior: number | null;
  faixas: { faixa: string; n: number; ordem: number }[];
  por_funil: { nome: string; leads: number; informaram: number; media: number | null; mediana: number | null }[];
  por_origem: { nome: string; leads: number; informaram: number; media: number | null }[];
  por_segmento: { nome: string; leads: number; media: number | null }[];
  por_mes: { mes: string; leads: number; informaram: number; media: number | null }[];
  top: { id: string; nome: string; empresa: string | null; valor: number; texto: string; funil: string | null; etapa: string | null; dono: string | null; quando: string }[];
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
  const [funil, setFunil] = useState("");
  const [origem, setOrigem] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [funis, setFunis] = useState<{ value: string; label: string }[]>([]);
  const [origens, setOrigens] = useState<{ value: string; label: string }[]>([]);
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: o }] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").order("name"),
        supabase.from("crm_origins").select("id, name").order("name"),
      ]);
      setFunis((p || []).map((x: any) => ({ value: x.id, label: x.name })));
      setOrigens((o || []).map((x: any) => ({ value: x.id, label: x.name })));
    })();
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const ate = new Date();
    const de = new Date(ate.getTime() - (dias - 1) * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const num = (s: string) => { const v = Number(String(s).replace(/\./g, "").replace(",", ".")); return v > 0 ? v : null; };
    const { data, error } = await (supabase as any).rpc("crm_leads_faturamento", {
      p_de: iso(de), p_ate: iso(ate),
      p_pipelines: funil && funil !== "none" ? [funil] : null,
      p_origens: origem && origem !== "none" ? [origem] : null,
      p_min: num(min), p_max: num(max),
    });
    if (error) { toast.error("Não consegui carregar o faturamento dos leads"); setCarregando(false); return; }
    setDados(data as Dados);
    setCarregando(false);
  }, [dias, funil, origem, min, max]);

  useEffect(() => { buscar(); }, [buscar]);

  const pctInformou = useMemo(() => {
    if (!dados?.leads) return 0;
    return Math.round((dados.informaram / dados.leads) * 100);
  }, [dados]);

  const limpar = () => { setFunil(""); setOrigem(""); setMin(""); setMax(""); };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {PERIODOS.map((p) => (
          <Button key={p.d} size="sm" variant={dias === p.d ? "default" : "outline"} onClick={() => setDias(p.d)}>
            {p.r}
          </Button>
        ))}
        <div className="w-52">
          <SearchableSelect value={funil} onValueChange={setFunil} options={funis}
            placeholder="Todos os funis" allowNone noneLabel="Todos os funis" />
        </div>
        <div className="w-52">
          <SearchableSelect value={origem} onValueChange={setOrigem} options={origens}
            placeholder="Todas as origens" allowNone noneLabel="Todas as origens" />
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { rot: "Leads no período", v: dados?.leads ?? 0, texto: `${pctInformou}% informaram o faturamento` },
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
            <div key={l.id} className="flex items-start justify-between gap-3 border-b border-border/40 last:border-0 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {l.nome}
                  {l.empresa ? <span className="font-normal text-muted-foreground"> · {l.empresa}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {l.funil || "Sem funil"}{l.etapa ? ` · ${l.etapa}` : ""}{l.dono ? ` · ${l.dono}` : ""} · {l.quando}
                </p>
                <p className="text-[11px] text-muted-foreground/80 truncate italic">"{l.texto}"</p>
              </div>
              <span className="text-sm font-bold shrink-0">{real(l.valor)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
