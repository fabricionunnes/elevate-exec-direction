import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, TrendingUp, TrendingDown, Minus, Medal } from "lucide-react";
import { motion } from "framer-motion";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  is_individual: boolean;
  is_main_goal?: boolean;
  unit_id?: string | null;
  team_id?: string | null;
  sector_id?: string | null;
}

interface Salesperson {
  id: string;
  name: string;
  unit_id: string | null;
  team_id?: string | null;
  sector_id?: string | null;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  value: number;
  unit_id: string | null;
  team_id?: string | null;
  sector_id?: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  unit_id?: string | null;
}

interface Sector {
  id: string;
  name: string;
  unit_id?: string | null;
  team_id?: string | null;
}

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface SalespeopleComparisonTableProps {
  kpis: KPI[];
  salespeople: Salesperson[];
  entries: Entry[];
  units: Unit[];
  teams: Team[];
  sectors: Sector[];
  sectorTeams: SectorTeam[];
  selectedUnit: string;
  selectedTeam: string;
  selectedSector: string;
  selectedSalesperson: string;
}

export const SalespeopleComparisonTable = ({
  kpis,
  salespeople,
  entries,
  units,
  teams,
  sectors,
  sectorTeams,
  selectedUnit,
  selectedTeam,
  selectedSector,
  selectedSalesperson,
}: SalespeopleComparisonTableProps) => {
  const teamIdsBySectorId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach(st => {
      if (!map[st.sector_id]) map[st.sector_id] = new Set();
      map[st.sector_id].add(st.team_id);
    });
    return map;
  }, [sectorTeams]);

  const salespersonBelongsToSector = (sp: Salesperson, sectorId: string): boolean => {
    if (sp.sector_id === sectorId) return true;
    if (sp.team_id) {
      const teamsInSector = teamIdsBySectorId[sectorId];
      if (teamsInSector && teamsInSector.has(sp.team_id)) return true;
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
  }, [salespeople, selectedUnit, selectedTeam, selectedSector, selectedSalesperson, teamIdsBySectorId]);

  const allMonetaryKpis = useMemo(() => kpis.filter((k) => k.kpi_type === "monetary"), [kpis]);

  const mainGoalKpi = useMemo(() => {
    return kpis.find((k) => k.is_main_goal) || kpis.find((k) => k.kpi_type === "monetary");
  }, [kpis]);

  const salesKpi = useMemo(() => {
    return kpis.find((k) =>
      k.name.toLowerCase().includes("venda") || k.name.toLowerCase().includes("fechamento")
    );
  }, [kpis]);

  const mainGoalKpiIds = useMemo(() => {
    if (allMonetaryKpis.length > 0) return allMonetaryKpis.map(k => k.id);
    if (mainGoalKpi) return [mainGoalKpi.id];
    return [];
  }, [allMonetaryKpis, mainGoalKpi]);

  const salespeopleData = useMemo(() => {
    const data = filteredSalespeople.map((sp) => {
      const spEntries = entries.filter((e) => e.salesperson_id === sp.id);
      const mainGoalTotal = spEntries
        .filter((e) => mainGoalKpiIds.includes(e.kpi_id))
        .reduce((sum, e) => sum + e.value, 0);
      const salesTotal = salesKpi
        ? spEntries.filter((e) => e.kpi_id === salesKpi.id).reduce((sum, e) => sum + e.value, 0)
        : 0;
      const avgTicket = salesTotal > 0 ? mainGoalTotal / salesTotal : 0;
      const unit = units.find((u) => u.id === sp.unit_id);
      return {
        id: sp.id,
        name: sp.name,
        unitName: unit?.name || "-",
        mainGoalValue: mainGoalTotal,
        salesCount: salesTotal,
        avgTicket,
      };
    });
    return data.sort((a, b) => b.mainGoalValue - a.mainGoalValue);
  }, [filteredSalespeople, entries, kpis, mainGoalKpiIds, salesKpi, units]);

  const teamAverages = useMemo(() => {
    const total = salespeopleData.length;
    if (total === 0) return { mainGoalValue: 0, salesCount: 0, avgTicket: 0 };
    const totals = salespeopleData.reduce(
      (acc, sp) => ({
        mainGoalValue: acc.mainGoalValue + sp.mainGoalValue,
        salesCount: acc.salesCount + sp.salesCount,
        avgTicket: acc.avgTicket + sp.avgTicket,
      }),
      { mainGoalValue: 0, salesCount: 0, avgTicket: 0 }
    );
    return {
      mainGoalValue: totals.mainGoalValue / total,
      salesCount: totals.salesCount / total,
      avgTicket: totals.avgTicket / total,
    };
  }, [salespeopleData]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatValue = (value: number, kpiType?: string) => {
    if (kpiType === "monetary") return formatCurrency(value);
    if (kpiType === "percentage") return `${value.toFixed(1)}%`;
    return new Intl.NumberFormat("pt-BR").format(value);
  };

  if (salespeopleData.length === 0) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Comparativo de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum vendedor encontrado para o filtro selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...salespeopleData.map(sp => sp.mainGoalValue), 1);

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/[0.03] via-transparent to-yellow-900/[0.04] dark:from-amber-800/20 dark:via-transparent dark:to-yellow-900/15" />
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-radial from-amber-500/[0.07] to-transparent rounded-full blur-3xl" />

      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-lg shadow-amber-500/20">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Comparativo de Vendedores</CardTitle>
              <p className="text-xs text-muted-foreground">
                {salespeopleData.length} vendedor{salespeopleData.length !== 1 ? "es" : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-0 bg-muted/60 text-xs font-medium px-3 py-1">
            Média: {formatValue(teamAverages.mainGoalValue, mainGoalKpi?.kpi_type)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-2">
        {salespeopleData.map((sp, idx) => {
          const diff = teamAverages.mainGoalValue > 0
            ? ((sp.mainGoalValue - teamAverages.mainGoalValue) / teamAverages.mainGoalValue) * 100
            : 0;
          const isAbove = diff > 10;
          const isBelow = diff < -10;
          const barWidth = maxValue > 0 ? (sp.mainGoalValue / maxValue) * 100 : 0;

          return (
            <motion.div
              key={sp.id}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative overflow-hidden rounded-xl border p-3 transition-all hover:shadow-md ${
                idx === 0
                  ? "border-amber-500/20 bg-amber-500/[0.03]"
                  : "bg-card/60 backdrop-blur-sm"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 ${
                  idx === 0
                    ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-400/30"
                    : idx === 1
                    ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800"
                    : idx === 2
                    ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {idx + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold truncate">{sp.name}</p>
                      {selectedUnit === "all" && sp.unitName !== "-" && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                          {sp.unitName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-bold shrink-0">
                      {formatValue(sp.mainGoalValue, mainGoalKpi?.kpi_type)}
                    </p>
                  </div>

                  {/* Bar */}
                  <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden mb-1.5">
                    <motion.div
                      className={`h-full rounded-full ${
                        idx === 0
                          ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                          : "bg-gradient-to-r from-primary/70 to-primary"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 + idx * 0.05 }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Vendas: {sp.salesCount.toLocaleString("pt-BR")}</span>
                    <span>Ticket: {formatCurrency(sp.avgTicket)}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 border-0 font-bold ${
                        isAbove
                          ? "bg-emerald-500/10 text-emerald-600"
                          : isBelow
                          ? "bg-red-500/10 text-red-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isAbove ? <TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" /> : isBelow ? <TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" /> : null}
                      {diff > 0 ? "+" : ""}{diff.toFixed(0)}% vs média
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};
