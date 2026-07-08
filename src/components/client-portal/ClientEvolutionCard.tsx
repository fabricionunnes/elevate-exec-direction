import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Trophy, Loader2 } from "lucide-react";

interface EvoPoint { month: string; faturamento: number; vendas: number; ticket: number; conversao: number; }
interface BenchStat { you: number; median: number; percentile: number | null; }
interface BenchmarkData { segment: string; sample: number; ticket: BenchStat | null; conversao: BenchStat | null; }
interface BenchmarkResponse {
  ok: boolean;
  contract_start: string | null;
  evolution: EvoPoint[];
  benchmark: BenchmarkData | null;
  benchmark_reason: string | null;
}

const brl = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(".", ",")} mil` : `R$ ${n.toLocaleString("pt-BR")}`;
const monthLabel = (mk: string) => {
  const [, m] = mk.split("-");
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1] || mk;
};

export const ClientEvolutionCard = ({ companyId }: { companyId: string }) => {
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: res, error } = await supabase.functions.invoke("client-benchmark", { body: { companyId } });
        if (!alive) return;
        if (!error && res?.ok) setData(res as BenchmarkResponse);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [companyId]);

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-8 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando sua evolução...
        </CardContent>
      </Card>
    );
  }
  if (!data || !data.evolution?.length) return null;

  const evo = data.evolution;
  const maxFat = Math.max(1, ...evo.map((e) => e.faturamento));
  const withData = evo.filter((e) => e.faturamento > 0);
  const lastWithData = withData[withData.length - 1];
  const bestMonth = withData.reduce((a, b) => (b.faturamento > a.faturamento ? b : a), withData[0] || evo[0]);
  const startMonth = data.contract_start ? data.contract_start.slice(0, 7) : null;

  return (
    <div className="space-y-4">
      {/* ── Sua Evolução ── */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-emerald-400" /> Sua Evolução
          </CardTitle>
          <CardDescription className="text-slate-400">
            Faturamento dos últimos 12 meses{startMonth ? " · a marca mostra quando a UNV entrou" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* barras */}
          <div className="flex items-end gap-1 h-32 mb-1">
            {evo.map((e) => {
              const h = e.faturamento > 0 ? Math.max(4, (e.faturamento / maxFat) * 100) : 2;
              const isStart = startMonth && e.month === startMonth;
              const isBest = bestMonth && e.month === bestMonth.month && e.faturamento > 0;
              return (
                <div key={e.month} className="flex-1 flex flex-col items-center justify-end group relative">
                  {isStart && (
                    <span className="absolute -top-1 text-[9px] text-amber-400 font-semibold whitespace-nowrap">UNV ▼</span>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${isBest ? "bg-emerald-400" : "bg-slate-600 group-hover:bg-slate-500"}`}
                    style={{ height: `${h}%` }}
                    title={`${monthLabel(e.month)}: ${brl(e.faturamento)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            {evo.map((e) => (
              <div key={e.month} className="flex-1 text-center text-[9px] text-slate-500">{monthLabel(e.month)}</div>
            ))}
          </div>
          {/* stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Último mês</p>
              <p className="text-base font-bold text-white tabular-nums">{lastWithData ? brl(lastWithData.faturamento) : "—"}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ticket médio</p>
              <p className="text-base font-bold text-white tabular-nums">{lastWithData?.ticket ? brl(lastWithData.ticket) : "—"}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Melhor mês</p>
              <p className="text-base font-bold text-emerald-400 tabular-nums">{bestMonth?.faturamento ? brl(bestMonth.faturamento) : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Você vs o Mercado ── */}
      {data.benchmark && (data.benchmark.ticket || data.benchmark.conversao) && (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-400" /> Você vs o Mercado
            </CardTitle>
            <CardDescription className="text-slate-400">
              Comparado com {data.benchmark.sample} empresas de {data.benchmark.segment} acompanhadas pela UNV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.benchmark.ticket && (
              <BenchRow label="Ticket médio" stat={data.benchmark.ticket} fmt={brl} />
            )}
            {data.benchmark.conversao && (
              <BenchRow label="Conversão" stat={data.benchmark.conversao} fmt={(n) => `${n}%`} />
            )}
            <p className="text-[11px] text-slate-500 pt-1">
              Esse comparativo só existe porque você está com a UNV — é dado do seu segmento que não se acha sozinho.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function BenchRow({ label, stat, fmt }: { label: string; stat: BenchStat; fmt: (n: number) => string }) {
  const better = stat.you >= stat.median;
  return (
    <div className="bg-slate-800/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        {stat.percentile != null && (
          <Badge variant="outline" className={better ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-700/40 text-slate-300 border-slate-600"}>
            {stat.percentile >= 50 ? `Top ${100 - stat.percentile}%` : `${stat.percentile}º percentil`}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-bold tabular-nums">Você: {fmt(stat.you)}</span>
        <span className="text-slate-400 tabular-nums">Mediana: {fmt(stat.median)}</span>
      </div>
    </div>
  );
}
