import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Trophy, Loader2 } from "lucide-react";
import { isBusinessDay, getTotalBusinessDaysInMonth } from "@/lib/businessDays";

interface Props {
  companyId: string | null;
  projectId: string | null;
}

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  target_value: number;
  is_main_goal?: boolean;
}
interface Salesperson { id: string; name: string; }
interface Entry { kpi_id: string; salesperson_id: string; entry_date: string; value: number; }

const fmt = (val: number, type: string) => {
  if (type === "monetary") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
  if (type === "percentage") return `${val.toFixed(1)}%`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(val);
};

export function HubKPIMiniDashboard({ companyId, projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const { monthStart, monthEnd, totalBd, elapsedBd } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const total = getTotalBusinessDaysInMonth(y, m);
    let elapsed = 0;
    const cur = new Date(y, m, 1);
    while (cur < new Date(y, m, now.getDate())) {
      if (isBusinessDay(cur)) elapsed++;
      cur.setDate(cur.getDate() + 1);
    }
    if (elapsed === 0) elapsed = 1;
    const iso = (d: Date) => d.toISOString().split("T")[0];
    return { monthStart: iso(start), monthEnd: iso(end), totalBd: total, elapsedBd: elapsed };
  }, []);

  useEffect(() => {
    if (!companyId) {
      setKpis([]); setSalespeople([]); setEntries([]);
      return;
    }
    setLoading(true);
    (async () => {
      const [kRes, sRes] = await Promise.all([
        supabase.from("company_kpis").select("id, name, kpi_type, target_value, is_main_goal").eq("company_id", companyId).eq("is_active", true),
        supabase.from("company_salespeople").select("id, name").eq("company_id", companyId).eq("is_active", true),
      ]);
      const ks = (kRes.data || []) as KPI[];
      setKpis(ks);
      setSalespeople((sRes.data || []) as Salesperson[]);
      if (ks.length > 0) {
        const { data: eData } = await supabase
          .from("kpi_entries")
          .select("kpi_id, salesperson_id, entry_date, value")
          .eq("company_id", companyId)
          .gte("entry_date", monthStart)
          .lte("entry_date", monthEnd);
        setEntries((eData || []) as Entry[]);
      } else {
        setEntries([]);
      }
      setLoading(false);
    })();
  }, [companyId, monthStart, monthEnd]);

  const mainKpis = useMemo(() => {
    const main = kpis.filter((k) => k.is_main_goal);
    return main.length > 0 ? main : kpis.slice(0, 1);
  }, [kpis]);

  const projection = useMemo(() => {
    if (mainKpis.length === 0) return null;
    const kpi = mainKpis[0];
    const realized = entries.filter((e) => e.kpi_id === kpi.id).reduce((s, e) => s + (e.value || 0), 0);
    const target = kpi.target_value || 0;
    const projected = elapsedBd > 0 ? (realized / elapsedBd) * totalBd : 0;
    const percentTarget = target > 0 ? (projected / target) * 100 : 0;
    const realizedPercent = target > 0 ? (realized / target) * 100 : 0;
    return { kpi, realized, target, projected, percentTarget, realizedPercent };
  }, [mainKpis, entries, elapsedBd, totalBd]);

  const ranking = useMemo(() => {
    if (mainKpis.length === 0 || salespeople.length === 0) return [];
    const totalTarget = mainKpis.reduce((s, k) => s + (k.target_value || 0), 0);
    const kpiIds = new Set(mainKpis.map((k) => k.id));
    return salespeople
      .map((sp) => {
        const realized = entries
          .filter((e) => e.salesperson_id === sp.id && kpiIds.has(e.kpi_id))
          .reduce((s, e) => s + (e.value || 0), 0);
        const percent = totalTarget > 0 ? (realized / totalTarget) * 100 : 0;
        return { id: sp.id, name: sp.name, realized, percent };
      })
      .sort((a, b) => b.realized - a.realized);
  }, [mainKpis, salespeople, entries]);

  const barColor = (p: number) => p >= 100 ? "bg-emerald-500" : p >= 70 ? "bg-amber-500" : "bg-rose-500";

  if (!companyId) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
        Vincule uma empresa para ver os KPIs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (mainKpis.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
        Nenhum KPI configurado para esta empresa.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projection && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Projeção do Mês
            </CardTitle>
            <p className="text-[10px] text-muted-foreground truncate">{projection.kpi.name}</p>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold">{fmt(projection.projected, projection.kpi.kpi_type)}</span>
              <span className={`text-xs font-medium ${projection.percentTarget >= 100 ? "text-emerald-600" : projection.percentTarget >= 70 ? "text-amber-600" : "text-rose-600"}`}>
                {projection.percentTarget.toFixed(0)}% da meta
              </span>
            </div>
            <Progress value={Math.min(projection.realizedPercent, 100)} className="h-1.5" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Realizado: {fmt(projection.realized, projection.kpi.kpi_type)}</span>
              <span>Meta: {fmt(projection.target, projection.kpi.kpi_type)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {elapsedBd}/{totalBd} dias úteis
            </div>
          </CardContent>
        </Card>
      )}

      {ranking.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {ranking.map((r, idx) => (
              <div key={r.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate flex items-center gap-1.5">
                    <span className="text-muted-foreground font-mono w-4">{idx + 1}.</span>
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="font-medium tabular-nums">{r.percent.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${barColor(r.percent)} transition-all`} style={{ width: `${Math.min(r.percent, 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
