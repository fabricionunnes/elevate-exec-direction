import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Compass, TrendingUp, Trophy, Flame } from "lucide-react";
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

  if (loading || !targetCents) return null;

  const targetValue = targetCents / 100;
  const pct = targetValue > 0 ? Math.min(999, Math.round((achievedValue / targetValue) * 100)) : 0;
  const reached = pct >= 100;
  const close90 = pct >= 90 && pct < 100;
  const close70 = pct >= 70 && pct < 90;
  const remaining = Math.max(0, targetValue - achievedValue);

  const tone = reached
    ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30"
    : close90
    ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/30"
    : close70
    ? "border-blue-400 bg-blue-50/60 dark:bg-blue-950/30"
    : "border-primary/30 bg-primary/5";

  const Icon = reached ? Trophy : close90 ? Flame : close70 ? TrendingUp : Compass;

  return (
    <Card className={`${tone} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Norte Estratégico (NSM)</CardTitle>
            <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
              {format(new Date(), "MMMM yyyy", { locale: ptBR })}
            </Badge>
          </div>
          <Badge
            variant={reached ? "default" : "outline"}
            className={`text-sm font-bold ${reached ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
          >
            {pct}% da meta
          </Badge>
        </div>
        {label && <CardDescription className="mt-1">{label}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground tracking-wider">Realizado no mês</p>
            <p className="text-xl font-bold">{formatBRLFromValue(achievedValue)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground tracking-wider">Meta NSM</p>
            <p className="text-xl font-bold">{formatBRL(targetCents)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground tracking-wider">{reached ? "Excedeu em" : "Faltam"}</p>
            <p className="text-xl font-bold">{formatBRLFromValue(reached ? achievedValue - targetValue : remaining)}</p>
          </div>
        </div>
        <Progress value={Math.min(100, pct)} className="h-3" />
        {reached && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold text-center">
            🎯 Norte Estratégico atingido neste mês!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
