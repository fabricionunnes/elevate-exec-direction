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
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [realized, setRealized] = useState(0);
  const [kpiType, setKpiType] = useState<string>("monetary");
  const [loading, setLoading] = useState(true);

  // Load company settings for day toggles
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

      // Fetch main goal KPIs
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

      setKpiType(kpis[0].kpi_type);
      const kpiIds = kpis.map((k) => k.id);

      // Fetch monthly targets for this salesperson
      const { data: targets } = await supabase
        .from("kpi_monthly_targets")
        .select("kpi_id, target_value, level_name, salesperson_id, unit_id, team_id")
        .eq("company_id", companyId)
        .eq("month_year", monthYear)
        .in("kpi_id", kpiIds);

      // Count active salespeople to divide company target when no individual target
      const { count: salespeopleCount } = await supabase
        .from("company_salespeople")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("is_active", true);

      const divisor = Math.max(salespeopleCount || 1, 1);

      // Calculate total target: prefer salesperson-specific, then company-level / number of salespeople
      let totalTarget = 0;
      kpis.forEach((kpi) => {
        const spTargets = (targets || []).filter(
          (t) => t.kpi_id === kpi.id && t.salesperson_id === salespersonId
        );
        if (spTargets.length > 0) {
          const meta = spTargets.find((t) => t.level_name === "Meta");
          totalTarget += meta?.target_value ?? spTargets[0].target_value;
        } else {
          // No individual target: divide company target by number of salespeople
          const companyTargets = (targets || []).filter(
            (t) =>
              t.kpi_id === kpi.id &&
              t.unit_id === null &&
              t.team_id === null &&
              t.salesperson_id === null
          );
          if (companyTargets.length > 0) {
            const meta = companyTargets.find((t) => t.level_name === "Meta");
            totalTarget += (meta?.target_value ?? companyTargets[0].target_value) / divisor;
          } else {
            totalTarget += kpi.target_value / divisor;
          }
        }
      });

      setMonthlyTarget(totalTarget);

      // Fetch entries for this salesperson this month
      const { data: entries } = await supabase
        .from("kpi_entries")
        .select("kpi_id, value")
        .eq("salesperson_id", salespersonId)
        .in("kpi_id", kpiIds)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd);

      const totalRealized = (entries || []).reduce((sum, e) => sum + e.value, 0);
      setRealized(totalRealized);
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

  const remaining = Math.max(monthlyTarget - realized, 0);
  const dailyGoal = dayInfo.remaining > 0 ? remaining / dayInfo.remaining : 0;
  const percentage = monthlyTarget > 0 ? (realized / monthlyTarget) * 100 : 0;

  const formatValue = (value: number) => {
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

  if (loading || monthlyTarget === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Sua Meta Diária
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
            <p className="text-sm font-bold">{formatValue(monthlyTarget)}</p>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Realizado</p>
            <p className="text-sm font-bold">
              {formatValue(realized)}
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
            <p className="text-sm font-bold">{formatValue(remaining)}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Meta Diária</p>
            <p className="text-sm font-bold text-primary">{formatValue(dailyGoal)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
