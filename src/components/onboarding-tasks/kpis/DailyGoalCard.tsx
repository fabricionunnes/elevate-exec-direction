import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Target, TrendingUp, TrendingDown } from "lucide-react";
import { isHoliday } from "@/lib/businessDays";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  target_value: number;
  effective_target?: number;
  is_main_goal?: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  is_active: boolean;
  unit_id: string | null;
  team_id: string | null;
  sector_id: string | null;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  entry_date: string;
  value: number;
}

interface MonthlyTarget {
  id: string;
  kpi_id: string;
  level_name: string;
  level_order: number;
  target_value: number;
  unit_id: string | null;
  team_id: string | null;
  salesperson_id: string | null;
}

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface DailyGoalCardProps {
  companyId: string;
  kpis: KPI[];
  salespeople: Salesperson[];
  entries: Entry[];
  allMonthlyTargets: MonthlyTarget[];
  dateRange: { start: string; end: string };
  selectedUnit: string;
  selectedTeam: string;
  selectedSector: string;
  selectedSalesperson: string;
  sectorTeams: SectorTeam[];
}

/**
 * Count remaining working days in the month from today (inclusive),
 * respecting toggles for Saturday, Sunday and Holidays.
 */
function getRemainingDaysInMonth(
  includeSaturday: boolean,
  includeSunday: boolean,
  includeHolidays: boolean,
  referenceDate: Date
): { remaining: number; total: number; elapsed: number } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const today = referenceDate.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();

  let total = 0;
  let elapsed = 0;

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();

    // Skip days based on toggles
    if (dow === 6 && !includeSaturday) continue;
    if (dow === 0 && !includeSunday) continue;
    if (!includeHolidays && isHoliday(date)) continue;

    total++;
    if (d < today) {
      elapsed++;
    }
  }

  // Remaining includes today
  const remaining = total - elapsed;
  return { remaining: Math.max(remaining, 1), total, elapsed };
}

export const DailyGoalCard = ({
  companyId,
  kpis,
  salespeople,
  entries,
  allMonthlyTargets,
  dateRange,
  selectedUnit,
  selectedTeam,
  selectedSector,
  selectedSalesperson,
  sectorTeams,
}: DailyGoalCardProps) => {
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [includeSunday, setIncludeSunday] = useState(false);
  const [includeHolidays, setIncludeHolidays] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings from DB
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
        setSettingsLoaded(true);
      });
  }, [companyId]);

  // Persist settings to DB
  const saveSettings = useCallback(
    async (sat: boolean, sun: boolean, hol: boolean) => {
      if (!companyId) return;
      await supabase
        .from("company_daily_goal_settings")
        .upsert(
          {
            company_id: companyId,
            include_saturday: sat,
            include_sunday: sun,
            include_holidays: hol,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
    },
    [companyId]
  );

  const handleSaturdayChange = (v: boolean) => {
    setIncludeSaturday(v);
    saveSettings(v, includeSunday, includeHolidays);
  };
  const handleSundayChange = (v: boolean) => {
    setIncludeSunday(v);
    saveSettings(includeSaturday, v, includeHolidays);
  };
  const handleHolidaysChange = (v: boolean) => {
    setIncludeHolidays(v);
    saveSettings(includeSaturday, includeSunday, v);
  };

  // Main goal KPIs only
  const mainGoalKpis = useMemo(() => {
    return kpis.filter((k) => k.is_main_goal);
  }, [kpis]);

  // Build sector->teams map
  const teamIdsBySector = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach((st) => {
      if (!map[st.sector_id]) map[st.sector_id] = new Set();
      map[st.sector_id].add(st.team_id);
    });
    return map;
  }, [sectorTeams]);

  const salespersonBelongsToSector = (sp: Salesperson, sectorId: string) => {
    if (sp.sector_id === sectorId) return true;
    if (sp.team_id) {
      const teams = teamIdsBySector[sectorId];
      if (teams && teams.has(sp.team_id)) return true;
    }
    return false;
  };

  // Filter salespeople by current filters
  const filteredSalespeople = useMemo(() => {
    return salespeople.filter((sp) => {
      if (selectedSalesperson !== "all") return sp.id === selectedSalesperson;
      if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
      if (selectedSector !== "all" && !salespersonBelongsToSector(sp, selectedSector)) return false;
      return true;
    });
  }, [salespeople, selectedUnit, selectedTeam, selectedSector, selectedSalesperson, teamIdsBySector]);

  // Day calculations based on selected month
  const dayInfo = useMemo(() => {
    const startDate = new Date(dateRange.start + "T12:00:00");
    const now = new Date();
    const isCurrentMonth =
      now.getMonth() === startDate.getMonth() && now.getFullYear() === startDate.getFullYear();

    const ref = isCurrentMonth ? now : startDate;
    return {
      ...getRemainingDaysInMonth(includeSaturday, includeSunday, includeHolidays, ref),
      isCurrentMonth,
    };
  }, [dateRange.start, includeSaturday, includeSunday, includeHolidays]);

  // Count active salespeople for dividing company target
  const activeSalespeopleCount = useMemo(() => {
    return Math.max(salespeople.filter((sp) => sp.is_active).length, 1);
  }, [salespeople]);

  // Get target for a KPI + optional salesperson
  const getTarget = (kpiId: string, salespersonId?: string): number => {
    // If requesting for a specific salesperson, try individual target first
    if (salespersonId) {
      const spTargets = allMonthlyTargets.filter(
        (mt) => mt.kpi_id === kpiId && mt.salesperson_id === salespersonId
      );
      if (spTargets.length > 0) {
        const meta = spTargets.find((t) => t.level_name === "Meta");
        return meta?.target_value ?? spTargets[0].target_value;
      }

      // No individual target: use company target divided by active salespeople
      const companyTargets = allMonthlyTargets.filter(
        (mt) =>
          mt.kpi_id === kpiId &&
          mt.unit_id === null &&
          mt.team_id === null &&
          mt.salesperson_id === null
      );
      if (companyTargets.length > 0) {
        const meta = companyTargets.find((t) => t.level_name === "Meta");
        return (meta?.target_value ?? companyTargets[0].target_value) / activeSalespeopleCount;
      }

      const kpi = mainGoalKpis.find((k) => k.id === kpiId);
      return (kpi?.effective_target ?? kpi?.target_value ?? 0) / activeSalespeopleCount;
    }

    // Company-level (no salesperson): return full target
    const targets = allMonthlyTargets.filter(
      (mt) =>
        mt.kpi_id === kpiId &&
        mt.unit_id === null &&
        mt.team_id === null &&
        mt.salesperson_id === null
    );

    if (targets.length > 0) {
      const meta = targets.find((t) => t.level_name === "Meta");
      return meta?.target_value ?? targets[0].target_value;
    }

    const kpi = mainGoalKpis.find((k) => k.id === kpiId);
    return kpi?.effective_target ?? kpi?.target_value ?? 0;
  };

  // Company daily goal
  const companyData = useMemo(() => {
    if (mainGoalKpis.length === 0) return null;

    let totalTarget = 0;
    let totalRealized = 0;

    mainGoalKpis.forEach((kpi) => {
      totalTarget += getTarget(kpi.id);

      const kpiEntries = entries.filter((e) => {
        if (e.kpi_id !== kpi.id) return false;
        const sp = salespeople.find((s) => s.id === e.salesperson_id);
        if (!sp) return false;
        if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
        if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
        if (selectedSector !== "all" && !salespersonBelongsToSector(sp, selectedSector)) return false;
        if (selectedSalesperson !== "all" && sp.id !== selectedSalesperson) return false;
        return true;
      });
      totalRealized += kpiEntries.reduce((sum, e) => sum + e.value, 0);
    });

    const remaining = Math.max(totalTarget - totalRealized, 0);
    const dailyGoal = dayInfo.remaining > 0 ? remaining / dayInfo.remaining : 0;
    const kpiType = mainGoalKpis[0]?.kpi_type;

    return { totalTarget, totalRealized, remaining, dailyGoal, kpiType };
  }, [mainGoalKpis, entries, dayInfo, salespeople, selectedUnit, selectedTeam, selectedSector, selectedSalesperson]);

  // Per-salesperson daily goals
  const salespeopleData = useMemo(() => {
    if (mainGoalKpis.length === 0) return [];

    return filteredSalespeople
      .map((sp) => {
        let totalTarget = 0;
        let totalRealized = 0;

        mainGoalKpis.forEach((kpi) => {
          totalTarget += getTarget(kpi.id, sp.id);

          const spEntries = entries.filter(
            (e) => e.kpi_id === kpi.id && e.salesperson_id === sp.id
          );
          totalRealized += spEntries.reduce((sum, e) => sum + e.value, 0);
        });

        const remaining = Math.max(totalTarget - totalRealized, 0);
        const dailyGoal = dayInfo.remaining > 0 ? remaining / dayInfo.remaining : 0;

        return {
          id: sp.id,
          name: sp.name,
          totalTarget,
          totalRealized,
          remaining,
          dailyGoal,
          percentage: totalTarget > 0 ? (totalRealized / totalTarget) * 100 : 0,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
  }, [mainGoalKpis, filteredSalespeople, entries, dayInfo]);

  const formatValue = (value: number, kpiType?: string) => {
    if (kpiType === "monetary") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
    }).format(value);
  };

  if (mainGoalKpis.length === 0) return null;

  const kpiType = mainGoalKpis[0]?.kpi_type;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Meta Diária
            <Badge variant="outline" className="ml-1">
              {dayInfo.remaining} dia{dayInfo.remaining !== 1 ? "s" : ""} restante
              {dayInfo.remaining !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Switch
                id="include-saturday"
                checked={includeSaturday}
                onCheckedChange={handleSaturdayChange}
                className="scale-75"
              />
              <Label htmlFor="include-saturday" className="text-xs cursor-pointer">
                Sábado
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                id="include-sunday"
                checked={includeSunday}
                onCheckedChange={handleSundayChange}
                className="scale-75"
              />
              <Label htmlFor="include-sunday" className="text-xs cursor-pointer">
                Domingo
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                id="include-holidays"
                checked={includeHolidays}
                onCheckedChange={handleHolidaysChange}
                className="scale-75"
              />
              <Label htmlFor="include-holidays" className="text-xs cursor-pointer">
                Feriados
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company-level summary */}
        {companyData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Meta do Mês</p>
              <p className="text-lg font-bold">{formatValue(companyData.totalTarget, kpiType)}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Realizado</p>
              <p className="text-lg font-bold">{formatValue(companyData.totalRealized, kpiType)}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Falta</p>
              <p className="text-lg font-bold">{formatValue(companyData.remaining, kpiType)}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-xs text-muted-foreground">Meta Diária</p>
              <p className="text-lg font-bold text-primary">
                {formatValue(companyData.dailyGoal, kpiType)}
              </p>
              <p className="text-[10px] text-muted-foreground">por dia útil</p>
            </div>
          </div>
        )}

        {/* Per-salesperson table */}
        {salespeopleData.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                  <TableHead className="text-right">Meta Diária</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salespeopleData.map((sp) => (
                  <TableRow key={sp.id}>
                    <TableCell className="font-medium">{sp.name}</TableCell>
                    <TableCell className="text-right">
                      {formatValue(sp.totalTarget, kpiType)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatValue(sp.totalRealized, kpiType)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={sp.percentage >= 100 ? "default" : sp.percentage >= 70 ? "secondary" : "destructive"}
                        className={sp.percentage >= 100 ? "bg-green-600" : ""}
                      >
                        {sp.percentage.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatValue(sp.remaining, kpiType)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatValue(sp.dailyGoal, kpiType)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
