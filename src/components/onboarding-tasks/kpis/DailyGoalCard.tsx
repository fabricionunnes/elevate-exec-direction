import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarDays, Target, TrendingUp, TrendingDown, Trophy, Flame } from "lucide-react";
import { isHoliday } from "@/lib/businessDays";
import { motion } from "framer-motion";

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
    if (dow === 6 && !includeSaturday) continue;
    if (dow === 0 && !includeSunday) continue;
    if (!includeHolidays && isHoliday(date)) continue;
    total++;
    if (d < today) elapsed++;
  }

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

  const mainGoalKpis = useMemo(() => kpis.filter((k) => k.is_main_goal), [kpis]);

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

  const filteredSalespeople = useMemo(() => {
    return salespeople.filter((sp) => {
      if (selectedSalesperson !== "all") return sp.id === selectedSalesperson;
      if (selectedUnit !== "all" && sp.unit_id !== selectedUnit) return false;
      if (selectedTeam !== "all" && sp.team_id !== selectedTeam) return false;
      if (selectedSector !== "all" && !salespersonBelongsToSector(sp, selectedSector)) return false;
      return true;
    });
  }, [salespeople, selectedUnit, selectedTeam, selectedSector, selectedSalesperson, teamIdsBySector]);

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

  const activeSalespeopleCount = useMemo(() => {
    return Math.max(salespeople.filter((sp) => sp.is_active).length, 1);
  }, [salespeople]);

  const getTarget = (kpiId: string, salespersonId?: string): number => {
    if (salespersonId) {
      const spTargets = allMonthlyTargets.filter(
        (mt) => mt.kpi_id === kpiId && mt.salesperson_id === salespersonId
      );
      if (spTargets.length > 0) {
        const meta = spTargets.find((t) => t.level_name === "Meta");
        return meta?.target_value ?? spTargets[0].target_value;
      }
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
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  };

  if (mainGoalKpis.length === 0) return null;

  const kpiType = mainGoalKpis[0]?.kpi_type;
  const companyPercentage = companyData && companyData.totalTarget > 0
    ? (companyData.totalRealized / companyData.totalTarget) * 100
    : 0;

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/[0.03] via-transparent to-primary/[0.04] dark:from-blue-800/20 dark:via-transparent dark:to-primary/15" />
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-radial from-primary/[0.07] to-transparent rounded-full blur-3xl" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-radial from-blue-500/[0.06] to-transparent rounded-full blur-3xl" />

      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/20">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Meta Diária</CardTitle>
              <p className="text-xs text-muted-foreground">
                {dayInfo.remaining} dia{dayInfo.remaining !== 1 ? "s" : ""} útil{dayInfo.remaining !== 1 ? "eis" : ""} restante{dayInfo.remaining !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: "include-saturday", label: "Sáb", checked: includeSaturday, onChange: handleSaturdayChange },
              { id: "include-sunday", label: "Dom", checked: includeSunday, onChange: handleSundayChange },
              { id: "include-holidays", label: "Feriados", checked: includeHolidays, onChange: handleHolidaysChange },
            ].map((toggle) => (
              <div key={toggle.id} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                <Switch
                  id={toggle.id}
                  checked={toggle.checked}
                  onCheckedChange={toggle.onChange}
                  className="scale-[0.65]"
                />
                <Label htmlFor={toggle.id} className="text-[10px] cursor-pointer">
                  {toggle.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5">
        {companyData && (
          <>
            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Progresso do mês</span>
                <span className={`font-bold ${companyPercentage >= 100 ? "text-emerald-600" : "text-primary"}`}>
                  {companyPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-muted/60 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    companyPercentage >= 100
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                      : "bg-gradient-to-r from-primary/80 to-primary"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(companyPercentage, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                />
              </div>
            </motion.div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                <div className="relative overflow-hidden rounded-xl border p-3 bg-card/80 backdrop-blur-sm text-center">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/10" />
                  <Target className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground font-medium">Meta do Mês</p>
                  <p className="text-base sm:text-lg font-bold mt-0.5">{formatValue(companyData.totalTarget, kpiType)}</p>
                </div>
              </motion.div>

              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                <div className="relative overflow-hidden rounded-xl border p-3 bg-card/80 backdrop-blur-sm text-center">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground font-medium">Realizado</p>
                  <p className="text-base sm:text-lg font-bold mt-0.5">{formatValue(companyData.totalRealized, kpiType)}</p>
                </div>
              </motion.div>

              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
                <div className="relative overflow-hidden rounded-xl border p-3 bg-card/80 backdrop-blur-sm text-center">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                  <TrendingDown className="h-3.5 w-3.5 text-amber-600 mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground font-medium">Falta</p>
                  <p className="text-base sm:text-lg font-bold mt-0.5">{formatValue(companyData.remaining, kpiType)}</p>
                </div>
              </motion.div>

              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                <div className="relative overflow-hidden rounded-xl border border-primary/20 p-3 bg-gradient-to-br from-primary/5 to-primary/10 text-center">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-blue-600" />
                  <Flame className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground font-medium">Meta Diária</p>
                  <p className="text-base sm:text-lg font-extrabold text-primary mt-0.5">
                    {formatValue(companyData.dailyGoal, kpiType)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">por dia útil</p>
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Per-salesperson ranking */}
        {salespeopleData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-2"
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Ranking por Vendedor
            </p>
            <div className="space-y-1.5">
              {salespeopleData.map((sp, idx) => {
                const isCompleted = sp.percentage >= 100;
                const isTop = idx === 0 && sp.percentage > 0;
                return (
                  <motion.div
                    key={sp.id}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.45 + idx * 0.05 }}
                    className={`relative overflow-hidden rounded-xl border p-3 transition-all hover:shadow-md ${
                      isCompleted
                        ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                        : isTop
                        ? "border-primary/20 bg-primary/[0.02]"
                        : "bg-card/60 backdrop-blur-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500/15 text-emerald-600"
                          : idx < 3
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold truncate">{sp.name}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border-0 font-bold shrink-0 ${
                              isCompleted
                                ? "bg-emerald-500/15 text-emerald-600"
                                : sp.percentage >= 70
                                ? "bg-amber-500/15 text-amber-600"
                                : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {sp.percentage.toFixed(0)}%
                          </Badge>
                        </div>

                        <div className="relative h-1.5 rounded-full bg-muted/60 overflow-hidden mb-1.5">
                          <motion.div
                            className={`h-full rounded-full ${
                              isCompleted
                                ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                                : sp.percentage >= 70
                                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                : "bg-gradient-to-r from-red-400 to-red-500"
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(sp.percentage, 100)}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 + idx * 0.05 }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Meta: {formatValue(sp.totalTarget, kpiType)}</span>
                          <span>Real: {formatValue(sp.totalRealized, kpiType)}</span>
                          <span>Falta: {formatValue(sp.remaining, kpiType)}</span>
                          <span className="font-bold text-primary">
                            Diária: {formatValue(sp.dailyGoal, kpiType)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
