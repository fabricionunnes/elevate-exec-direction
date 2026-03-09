import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { isHoliday } from "@/lib/businessDays";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface SalespersonDailyGoalCardProps {
  companyId: string;
  salespersonId: string;
  salespersonName: string;
}

interface KpiGoalData {
  kpiId: string;
  kpiName: string;
  kpiType: string;
  monthlyTarget: number;
  realized: number;
}

function getRemainingDaysInMonth(
  includeSaturday: boolean,
  includeSunday: boolean,
  includeHolidays: boolean
): { remaining: number; total: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();

  let total = 0;
  let elapsed = 0;

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 6 && !includeSaturday) continue;
    if (dow === 0 && !includeSunday) continue;
    if (!includeHolidays && isHoliday(date)) continue;
    total++;
    if (d < today) elapsed++;
  }

  return { remaining: Math.max(total - elapsed, 1), total };
}

export const SalespersonDailyGoalCard = ({
  companyId,
  salespersonId,
  salespersonName,
}: SalespersonDailyGoalCardProps) => {
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [includeSunday, setIncludeSunday] = useState(false);
  const [includeHolidays, setIncludeHolidays] = useState(false);
  const [kpiGoals, setKpiGoals] = useState<KpiGoalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("company_daily_goal_settings")
      .select("include_saturday, include_sunday, include_holidays")
      .eq("company_id", companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIncludeSaturday(data.include_saturday);
          setIncludeSunday(data.include_sunday);
          setIncludeHolidays(data.include_holidays);
        }
      });
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [companyId, salespersonId]);

  const fetchData = async () => {
    try {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const monthYear = format(now, "yyyy-MM");

      const { data: kpis } = await supabase
        .from("company_kpis")
        .select("id, name, kpi_type, target_value, is_main_goal")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .eq("is_main_goal", true);

      if (!kpis || kpis.length === 0) {
        setLoading(false);
        return;
      }

      const kpiIds = kpis.map((k) => k.id);

      const [{ data: targets }, { count: salespeopleCount }, { data: entries }] = await Promise.all([
        supabase
          .from("kpi_monthly_targets")
          .select("kpi_id, target_value, level_name, salesperson_id, unit_id, team_id")
          .eq("company_id", companyId)
          .eq("month_year", monthYear)
          .in("kpi_id", kpiIds),
        supabase
          .from("company_salespeople")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("kpi_entries")
          .select("kpi_id, value")
          .eq("salesperson_id", salespersonId)
          .in("kpi_id", kpiIds)
          .gte("entry_date", monthStart)
          .lte("entry_date", monthEnd),
      ]);

      const divisor = Math.max(salespeopleCount || 1, 1);

      const goals: KpiGoalData[] = kpis.map((kpi) => {
        // Calculate target
        let monthlyTarget = 0;
        const spTargets = (targets || []).filter(
          (t) => t.kpi_id === kpi.id && t.salesperson_id === salespersonId
        );
        if (spTargets.length > 0) {
          const meta = spTargets.find((t) => t.level_name === "Meta");
          monthlyTarget = meta?.target_value ?? spTargets[0].target_value;
        } else {
          const companyTargets = (targets || []).filter(
            (t) =>
              t.kpi_id === kpi.id &&
              t.unit_id === null &&
              t.team_id === null &&
              t.salesperson_id === null
          );
          if (companyTargets.length > 0) {
            const meta = companyTargets.find((t) => t.level_name === "Meta");
            monthlyTarget = (meta?.target_value ?? companyTargets[0].target_value) / divisor;
          } else {
            monthlyTarget = kpi.target_value / divisor;
          }
        }

        // Calculate realized
        const realized = (entries || [])
          .filter((e) => e.kpi_id === kpi.id)
          .reduce((sum, e) => sum + e.value, 0);

        return {
          kpiId: kpi.id,
          kpiName: kpi.name,
          kpiType: kpi.kpi_type,
          monthlyTarget,
          realized,
        };
      });

      setKpiGoals(goals);
    } catch (error) {
      console.error("Error fetching daily goal data:", error);
    } finally {
      setLoading(false);
    }
  };

  const dayInfo = useMemo(
    () => getRemainingDaysInMonth(includeSaturday, includeSunday, includeHolidays),
    [includeSaturday, includeSunday, includeHolidays]
  );

  const formatValue = (value: number, kpiType: string) => {
    if (kpiType === "monetary") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  };

  const activeGoals = kpiGoals.filter((g) => g.monthlyTarget > 0);

  if (loading || activeGoals.length === 0) return null;

  return (
    <>
      {activeGoals.map((goal) => {
        const remaining = Math.max(goal.monthlyTarget - goal.realized, 0);
        const dailyGoal = dayInfo.remaining > 0 ? remaining / dayInfo.remaining : 0;
        const percentage = goal.monthlyTarget > 0 ? (goal.realized / goal.monthlyTarget) * 100 : 0;

        return (
          <Card key={goal.kpiId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Sua Meta Diária{activeGoals.length > 1 ? ` — ${goal.kpiName}` : ""}
                  <Badge variant="outline" className="text-[10px]">
                    {dayInfo.remaining} dia{dayInfo.remaining !== 1 ? "s" : ""} restante
                    {dayInfo.remaining !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Meta</p>
                  <p className="text-sm font-bold">{formatValue(goal.monthlyTarget, goal.kpiType)}</p>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Realizado</p>
                  <p className="text-sm font-bold">
                    {formatValue(goal.realized, goal.kpiType)}
                    <Badge
                      variant={percentage >= 100 ? "default" : percentage >= 70 ? "secondary" : "destructive"}
                      className={`ml-1 text-[9px] ${percentage >= 100 ? "bg-green-600" : ""}`}
                    >
                      {percentage.toFixed(0)}%
                    </Badge>
                  </p>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Falta</p>
                  <p className="text-sm font-bold">{formatValue(remaining, goal.kpiType)}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">Meta Diária</p>
                  <p className="text-sm font-bold text-primary">{formatValue(dailyGoal, goal.kpiType)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
};
