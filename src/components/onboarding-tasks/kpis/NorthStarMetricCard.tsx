import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Compass, TrendingUp, Trophy, Flame, Sparkles } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  companyId: string;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);

const formatBRLFromValue = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

export const NorthStarMetricCard = ({ companyId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [targetCents, setTargetCents] = useState<number>(0);
  const [label, setLabel] = useState<string>("");
  const [achievedValue, setAchievedValue] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      try {
        const [companyRes, kpisRes] = await Promise.all([
          supabase
            .from("onboarding_companies")
            .select("north_star_metric_cents, north_star_metric_label")
            .eq("id", companyId)
            .maybeSingle(),
          supabase
            .from("company_kpis")
            .select("id")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .eq("is_main_goal", true)
            .eq("kpi_type", "monetary"),
        ]);

        const target = Number((companyRes.data as any)?.north_star_metric_cents) || 0;
        setTargetCents(target);
        setLabel((companyRes.data as any)?.north_star_metric_label || "");

        const kpiIds = (kpisRes.data || []).map((k: any) => k.id);
        if (kpiIds.length === 0) {
          setAchievedValue(0);
          return;
        }

        const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
        const end = format(endOfMonth(new Date()), "yyyy-MM-dd");
        const { data: entries } = await supabase
          .from("kpi_entries")
          .select("value")
          .eq("company_id", companyId)
          .in("kpi_id", kpiIds)
          .gte("entry_date", start)
          .lte("entry_date", end);

        const total = (entries || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
        setAchievedValue(total);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  if (loading) return null;

  // Estado: NSM não definido — placeholder elegante com CTA
  if (!targetCents) {
    return (
      <Card className="relative overflow-hidden border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <Compass className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold tracking-tight">Norte Estratégico (NSM)</h3>
              <Badge variant="outline" className="uppercase tracking-wider text-[10px]">Não definido</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Defina a meta principal de faturamento mensal no formulário de Kickoff para acompanhar o NSM aqui e receber alertas em 70%, 90% e 100%.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const targetValue = targetCents / 100;
  const pct = targetValue > 0 ? Math.min(999, Math.round((achievedValue / targetValue) * 100)) : 0;
  const reached = pct >= 100;
  const close90 = pct >= 90 && pct < 100;
  const close70 = pct >= 70 && pct < 90;
  const remaining = Math.max(0, targetValue - achievedValue);

  const Icon = reached ? Trophy : close90 ? Flame : close70 ? TrendingUp : Compass;

  // Paleta dramática por estado
  const palette = reached
    ? {
        gradient: "from-emerald-500/25 via-emerald-400/10 to-teal-500/25",
        ring: "ring-emerald-400/60",
        glow: "shadow-[0_0_60px_-12px_hsl(142_76%_45%/0.55)]",
        accent: "text-emerald-400",
        bar: "bg-gradient-to-r from-emerald-400 to-teal-400",
        chip: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
      }
    : close90
    ? {
        gradient: "from-amber-500/25 via-orange-400/10 to-rose-500/25",
        ring: "ring-amber-400/60",
        glow: "shadow-[0_0_60px_-12px_hsl(38_95%_55%/0.55)]",
        accent: "text-amber-300",
        bar: "bg-gradient-to-r from-amber-400 to-orange-400",
        chip: "bg-amber-500/20 text-amber-200 border-amber-400/40",
      }
    : close70
    ? {
        gradient: "from-sky-500/25 via-blue-400/10 to-indigo-500/25",
        ring: "ring-sky-400/60",
        glow: "shadow-[0_0_60px_-12px_hsl(217_91%_60%/0.5)]",
        accent: "text-sky-300",
        bar: "bg-gradient-to-r from-sky-400 to-indigo-400",
        chip: "bg-sky-500/20 text-sky-200 border-sky-400/40",
      }
    : {
        gradient: "from-primary/25 via-primary/5 to-primary/20",
        ring: "ring-primary/40",
        glow: "shadow-[0_0_60px_-12px_hsl(var(--primary)/0.45)]",
        accent: "text-primary",
        bar: "bg-gradient-to-r from-primary to-primary/70",
        chip: "bg-primary/15 text-primary border-primary/40",
      };

  return (
    <div className="relative">
      {/* Halo / glow externo */}
      <div
        aria-hidden
        className={`absolute -inset-[2px] rounded-2xl bg-gradient-to-r ${palette.gradient} blur-xl opacity-70`}
      />
      <Card
        className={`relative overflow-hidden rounded-2xl border-0 ring-2 ${palette.ring} ${palette.glow} bg-gradient-to-br from-background via-background to-background/80`}
      >
        {/* Pattern decorativo */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${palette.gradient} opacity-60`}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/5 blur-3xl"
        />

        <CardContent className="relative p-6 md:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`relative rounded-xl p-3 bg-background/40 backdrop-blur ring-1 ${palette.ring}`}>
                <Icon className={`h-6 w-6 ${palette.accent}`} />
                {reached && (
                  <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-300 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="uppercase tracking-[0.2em] text-[10px] font-semibold text-muted-foreground">
                    North Star Metric
                  </span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {format(new Date(), "MMMM yyyy", { locale: ptBR })}
                  </Badge>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight mt-0.5">
                  Norte Estratégico do Mês
                </h2>
                {label && <p className="text-sm text-muted-foreground mt-0.5">{label}</p>}
              </div>
            </div>

            <div className={`px-4 py-2 rounded-xl border ${palette.chip} backdrop-blur`}>
              <p className="text-[10px] uppercase tracking-wider opacity-80">Atingido</p>
              <p className="text-2xl font-black leading-none">{pct}%</p>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-background/50 backdrop-blur p-3 ring-1 ring-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizado</p>
              <p className={`text-lg md:text-xl font-bold ${palette.accent}`}>
                {formatBRLFromValue(achievedValue)}
              </p>
            </div>
            <div className="rounded-xl bg-background/50 backdrop-blur p-3 ring-1 ring-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Meta NSM</p>
              <p className="text-lg md:text-xl font-bold">{formatBRL(targetCents)}</p>
            </div>
            <div className="rounded-xl bg-background/50 backdrop-blur p-3 ring-1 ring-border/50">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {reached ? "Excedeu" : "Faltam"}
              </p>
              <p className="text-lg md:text-xl font-bold">
                {formatBRLFromValue(reached ? achievedValue - targetValue : remaining)}
              </p>
            </div>
          </div>

          {/* Progresso custom */}
          <div className="space-y-2">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-background/60 ring-1 ring-border/50">
              <div
                className={`h-full ${palette.bar} transition-all duration-700 ease-out`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
              {/* marcos 70% / 90% */}
              <div className="absolute inset-y-0 left-[70%] w-px bg-foreground/20" />
              <div className="absolute inset-y-0 left-[90%] w-px bg-foreground/20" />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>0%</span>
              <span>70%</span>
              <span>90%</span>
              <span className={reached ? palette.accent : ""}>100%</span>
            </div>
          </div>

          {reached && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/40 py-2">
              <Trophy className="h-4 w-4 text-emerald-300" />
              <p className="text-sm font-bold text-emerald-300">Norte Estratégico atingido neste mês!</p>
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
