import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Trophy } from "lucide-react";
import { motion } from "framer-motion";

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface Salesperson {
  id: string;
  unit_id: string | null;
  team_id: string | null;
}

interface Entry {
  kpi_id: string;
  salesperson_id: string | null;
  unit_id?: string | null;
  value: number;
}

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  is_main_goal?: boolean;
}

interface MonthlyTarget {
  kpi_id: string;
  level_name: string;
  target_value: number;
  unit_id: string | null;
  team_id: string | null;
  salesperson_id: string | null;
}

interface TeamUnit {
  team_id: string;
  unit_id: string;
}

interface UnitRankingCardProps {
  units: Unit[];
  salespeople: Salesperson[];
  teamUnits: TeamUnit[];
  entries: Entry[];
  kpis: KPI[];
  allMonthlyTargets: MonthlyTarget[];
}

export const UnitRankingCard = ({
  units,
  salespeople,
  teamUnits,
  entries,
  kpis,
  allMonthlyTargets,
}: UnitRankingCardProps) => {
  const activeUnits = useMemo(() => units.filter((u) => u.is_active), [units]);
  const mainGoalKpis = useMemo(() => kpis.filter((k) => k.is_main_goal), [kpis]);

  const unitIdByTeam = useMemo(() => {
    const map: Record<string, string> = {};
    teamUnits.forEach((tu) => {
      map[tu.team_id] = tu.unit_id;
    });
    return map;
  }, [teamUnits]);

  // Unidade do lançamento resolvida pelo cadastro do vendedor (lançamentos
  // antigos não gravavam unit_id na entry)
  const unitBySalesperson = useMemo(() => {
    const map: Record<string, string> = {};
    salespeople.forEach((sp) => {
      const unitId = sp.unit_id || (sp.team_id ? unitIdByTeam[sp.team_id] : null);
      if (unitId) map[sp.id] = unitId;
    });
    return map;
  }, [salespeople, unitIdByTeam]);

  const pickMeta = (targets: MonthlyTarget[]): number =>
    targets.find((t) => t.level_name === "Meta")?.target_value ?? targets[0].target_value;

  const perKpiData = useMemo(() => {
    return mainGoalKpis
      .map((kpi) => {
        const unitData = activeUnits
          .map((unit) => {
            const realized = entries.reduce((sum, e) => {
              if (e.kpi_id !== kpi.id) return sum;
              const entryUnit =
                (e.salesperson_id && unitBySalesperson[e.salesperson_id]) || e.unit_id || null;
              return entryUnit === unit.id ? sum + e.value : sum;
            }, 0);

            const unitTargets = allMonthlyTargets.filter(
              (mt) =>
                mt.kpi_id === kpi.id &&
                mt.unit_id === unit.id &&
                mt.team_id === null &&
                mt.salesperson_id === null
            );
            const target = unitTargets.length > 0 ? pickMeta(unitTargets) : 0;

            return {
              id: unit.id,
              name: unit.name,
              realized,
              target,
              percentage: target > 0 ? (realized / target) * 100 : 0,
            };
          })
          .filter((u) => u.realized > 0 || u.target > 0)
          .sort((a, b) => {
            if (a.percentage === 0 && b.percentage === 0) return b.realized - a.realized;
            if (a.percentage === 0) return 1;
            if (b.percentage === 0) return -1;
            return b.percentage - a.percentage;
          });

        return { kpi, unitData };
      })
      .filter((block) => block.unitData.length > 1);
  }, [mainGoalKpis, activeUnits, entries, unitBySalesperson, allMonthlyTargets]);

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

  if (perKpiData.length === 0) return null;

  return (
    <div className="space-y-4">
      {perKpiData.map(({ kpi, unitData }) => (
        <Card key={`unit-ranking-${kpi.id}`} className="relative overflow-hidden border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/[0.03] via-transparent to-primary/[0.04] dark:from-blue-800/20 dark:via-transparent dark:to-primary/15" />

          <CardHeader className="relative pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/20">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Ranking por Unidade — {kpi.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {unitData.length} unidades no comparativo
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-1.5">
            {unitData.map((unit, idx) => {
              const isCompleted = unit.percentage >= 100;
              const isTop = idx === 0 && unit.percentage > 0;
              return (
                <motion.div
                  key={unit.id}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  className={`relative overflow-hidden rounded-xl border p-3 transition-all hover:shadow-md ${
                    isCompleted
                      ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                      : isTop
                      ? "border-primary/20 bg-primary/[0.02]"
                      : "bg-card/60 backdrop-blur-sm"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500/15 text-emerald-600"
                          : idx < 3
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {isTop && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {unit.name}
                        </p>
                        {unit.target > 0 ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border-0 font-bold shrink-0 ${
                              isCompleted
                                ? "bg-emerald-500/15 text-emerald-600"
                                : unit.percentage >= 70
                                ? "bg-amber-500/15 text-amber-600"
                                : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {unit.percentage.toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-[10px] font-bold text-primary shrink-0">
                            {formatValue(unit.realized, kpi.kpi_type)}
                          </span>
                        )}
                      </div>

                      <div className="relative h-1.5 rounded-full bg-muted/60 overflow-hidden mb-1.5">
                        <motion.div
                          className={`h-full rounded-full ${
                            isCompleted
                              ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                              : unit.percentage >= 70
                              ? "bg-gradient-to-r from-amber-400 to-amber-500"
                              : "bg-gradient-to-r from-red-400 to-red-500"
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(unit.percentage, 100)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 + idx * 0.05 }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        {unit.target > 0 ? (
                          <>
                            <span>Meta: {formatValue(unit.target, kpi.kpi_type)}</span>
                            <span>Real: {formatValue(unit.realized, kpi.kpi_type)}</span>
                            <span>
                              Falta: {formatValue(Math.max(unit.target - unit.realized, 0), kpi.kpi_type)}
                            </span>
                          </>
                        ) : (
                          <span>
                            Realizado:{" "}
                            <span className="font-semibold text-foreground">
                              {formatValue(unit.realized, kpi.kpi_type)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
