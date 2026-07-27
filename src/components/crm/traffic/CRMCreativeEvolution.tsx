import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart as LineIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { SearchableSelect } from "./SearchableSelect";
import type { CRMMetaAd } from "./useCRMTrafficData";

// Evolução dia a dia POR CRIATIVO sem poluir o dashboard: um card só, com um
// seletor de criativo (ordenado por investimento) e 4 mini-gráficos (CPM, CPL,
// CTR, Frequência). Cada métrica ganha um selo comparando a 1ª metade do
// período com a 2ª (melhorou/piorou), ciente da direção boa de cada métrica.

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface DayPoint { d: string; cpm: number | null; cpl: number | null; ctr: number | null; freq: number | null; }

const METRICS = [
  { key: "cpm" as const, label: "CPM", color: "#8b5cf6", fmt: (v: number) => brl(v), goodDown: true, hint: "custo por mil impressões" },
  { key: "cpl" as const, label: "CPL", color: "#f59e0b", fmt: (v: number) => brl(v), goodDown: true, hint: "custo por lead" },
  { key: "ctr" as const, label: "CTR", color: "#10b981", fmt: (v: number) => `${v.toFixed(2)}%`, goodDown: false, hint: "taxa de clique" },
  { key: "freq" as const, label: "Frequência", color: "#60a5fa", fmt: (v: number) => v.toFixed(2), goodDown: true, hint: "repetição por pessoa (fadiga)" },
];

export const CRMCreativeEvolution = ({ ads }: { ads: CRMMetaAd[] }) => {
  // agrupa por criativo (ad_id), ordenado por investimento no período filtrado
  const creatives = useMemo(() => {
    const map = new Map<string, { adId: string; name: string; campaign: string; spend: number; thumb: string | null }>();
    ads.forEach((a: any) => {
      const e = map.get(a.ad_id) || { adId: a.ad_id, name: a.ad_name || a.ad_id, campaign: a.campaign_name || "", spend: 0, thumb: null };
      e.spend += Number(a.spend) || 0;
      if (!e.thumb && a.creative_thumbnail_url) e.thumb = a.creative_thumbnail_url;
      map.set(a.ad_id, e);
    });
    return [...map.values()].sort((x, y) => y.spend - x.spend);
  }, [ads]);

  const [selectedId, setSelectedId] = useState<string>("");
  const current = creatives.find(c => c.adId === (selectedId || creatives[0]?.adId)) || null;

  const series: DayPoint[] = useMemo(() => {
    if (!current) return [];
    return ads
      .filter((a: any) => a.ad_id === current.adId && a.date_start)
      .sort((x: any, y: any) => String(x.date_start).localeCompare(String(y.date_start)))
      .map((a: any) => {
        const spend = Number(a.spend) || 0;
        const imp = Number(a.impressions) || 0;
        const clicks = Number(a.clicks) || 0;
        const leads = Number(a.leads) || 0;
        const [, m, d] = String(a.date_start).split("-");
        return {
          d: `${d}/${m}`,
          cpm: imp > 0 ? (spend / imp) * 1000 : null,
          cpl: leads > 0 ? spend / leads : null,
          ctr: imp > 0 ? (clicks / imp) * 100 : null,
          freq: a.frequency != null ? Number(a.frequency) : null,
        };
      });
  }, [ads, current]);

  // tendência: média da 1ª metade vs 2ª metade (só dias com dado)
  const trend = (key: keyof Omit<DayPoint, "d">, goodDown: boolean) => {
    const vals = series.map(s => s[key]).filter((v): v is number => v != null && isFinite(v));
    if (vals.length < 4) return null;
    const mid = Math.floor(vals.length / 2);
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const a = avg(vals.slice(0, mid)), b = avg(vals.slice(mid));
    if (a === 0) return null;
    const pct = ((b - a) / a) * 100;
    const improved = goodDown ? pct < 0 : pct > 0;
    return { pct, improved };
  };

  if (creatives.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LineIcon className="h-4 w-4 text-primary" /> Evolução por Criativo
          </CardTitle>
          <div className="w-full sm:w-[380px]">
            <SearchableSelect
              value={current?.adId || ""}
              onChange={setSelectedId}
              options={creatives.map(c => ({ value: c.adId, label: `${c.name} · ${brl(c.spend)}` }))}
              placeholder="Escolha o criativo"
            />
          </div>
          {current?.thumb && <img src={current.thumb} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />}
          <span className="ml-auto text-[11px] text-muted-foreground">{series.length} dia(s) no período · selo compara 1ª × 2ª metade</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {METRICS.map(m => {
            const t = trend(m.key, m.goodDown);
            return (
              <div key={m.key} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold" style={{ color: m.color }}>{m.label}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{m.hint}</span>
                  {t && (
                    <Badge className={`ml-auto gap-1 text-[10px] border-0 ${t.improved ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>
                      {t.pct === 0 ? <Minus className="h-3 w-3" /> : t.pct < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {`${t.pct > 0 ? "+" : ""}${t.pct.toFixed(0)}% ${t.improved ? "melhorou" : "piorou"}`}
                    </Badge>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="d" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={42}
                      tickFormatter={(v: number) => m.key === "ctr" ? `${v.toFixed(1)}%` : m.key === "freq" ? v.toFixed(1) : `R$${v >= 100 ? Math.round(v) : v.toFixed(0)}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number) => [m.fmt(v), m.label]} labelFormatter={(l) => `Dia ${l}`} />
                    <Line type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
