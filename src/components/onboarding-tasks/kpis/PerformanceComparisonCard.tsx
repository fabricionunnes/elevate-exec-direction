import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UsersRound, TrendingUp, TrendingDown, Trophy, Target, Building2, Layers, Users } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  target_value: number;
  effective_target?: number;
  team_id?: string | null;
  unit_id?: string | null;
  sector_id?: string | null;
  salesperson_id?: string | null;
  is_main_goal?: boolean;
  scope?: string | null;
}

interface Team {
  id: string;
  name: string;
  is_active: boolean;
}

interface Unit {
  id: string;
  name: string;
  is_active: boolean;
}

interface Sector {
  id: string;
  name: string;
  is_active: boolean;
}

interface Salesperson {
  id: string;
  name: string;
  is_active: boolean;
  team_id?: string | null;
  unit_id?: string | null;
  sector_id?: string | null;
}

interface Entry {
  id: string;
  kpi_id: string;
  salesperson_id: string;
  entry_date: string;
  value: number;
}

interface SectorTeam {
  sector_id: string;
  team_id: string;
}

interface TeamUnit {
  team_id: string;
  unit_id: string;
}

interface PerformanceComparisonCardProps {
  teams: Team[];
  units: Unit[];
  sectors: Sector[];
  salespeople: Salesperson[];
  kpis: KPI[];
  entries: Entry[];
  sectorTeams: SectorTeam[];
  teamUnits: TeamUnit[];
  selectedUnit?: string;
  selectedSector?: string;
  selectedTeam?: string;
  monthStart: string;
  monthEnd: string;
}

interface PerformanceItem {
  id: string;
  name: string;
  realized: number;
  target: number;
  percentage: number;
}

type ComparisonType = "units" | "sectors" | "teams" | "salespeople";

export const PerformanceComparisonCard = ({
  teams,
  units,
  sectors,
  salespeople,
  kpis,
  entries,
  sectorTeams,
  teamUnits,
  selectedUnit,
  selectedSector,
  selectedTeam,
  monthStart,
  monthEnd,
}: PerformanceComparisonCardProps) => {
  const [comparisonType, setComparisonType] = useState<ComparisonType>("teams");

  // Build lookup maps
  const teamIdsBySectorId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    sectorTeams.forEach(st => {
      if (!map[st.sector_id]) map[st.sector_id] = new Set();
      map[st.sector_id].add(st.team_id);
    });
    return map;
  }, [sectorTeams]);

  const teamIdsByUnitId = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    teamUnits.forEach(tu => {
      if (!map[tu.unit_id]) map[tu.unit_id] = new Set();
      map[tu.unit_id].add(tu.team_id);
    });
    return map;
  }, [teamUnits]);

  const performances = useMemo(() => {
    const items: PerformanceItem[] = [];
    const monetaryKpiIds = new Set(kpis.filter(k => k.kpi_type === "monetary").map(k => k.id));
    
    // Filter entries by month
    const monthEntries = entries.filter(e => 
      e.entry_date >= monthStart && 
      e.entry_date <= monthEnd &&
      monetaryKpiIds.has(e.kpi_id)
    );

    if (comparisonType === "units") {
      // Compare units
      let unitsToShow = units.filter(u => u.is_active);
      
      unitsToShow.forEach(unit => {
        // Get all salespeople in this unit
        const salespeopleInUnit = salespeople.filter(sp => {
          if (sp.unit_id === unit.id) return true;
          // Check via team
          if (sp.team_id) {
            const teamsInUnit = teamIdsByUnitId[unit.id];
            if (teamsInUnit && teamsInUnit.has(sp.team_id)) return true;
          }
          return false;
        });
        
        const salespersonIds = new Set(salespeopleInUnit.map(sp => sp.id));
        const realized = monthEntries
          .filter(e => salespersonIds.has(e.salesperson_id))
          .reduce((sum, e) => sum + e.value, 0);

        // Get target from unit-scoped KPIs
        const unitKpis = kpis.filter(k => 
          k.kpi_type === "monetary" && 
          (k.unit_id === unit.id || k.scope === "unit")
        );
        const target = unitKpis.reduce((sum, k) => sum + (k.effective_target ?? k.target_value), 0);

        if (target > 0) {
          items.push({
            id: unit.id,
            name: unit.name,
            realized,
            target,
            percentage: (realized / target) * 100,
          });
        }
      });
    } else if (comparisonType === "sectors") {
      // Compare sectors
      let sectorsToShow = sectors.filter(s => s.is_active);
      
      // If unit is selected, filter sectors
      if (selectedUnit && selectedUnit !== "all") {
        // Filter sectors that have teams in the selected unit
        const teamsInUnit = teamIdsByUnitId[selectedUnit] || new Set();
        sectorsToShow = sectorsToShow.filter(sector => {
          const teamsInSector = teamIdsBySectorId[sector.id] || new Set();
          return Array.from(teamsInSector).some(tid => teamsInUnit.has(tid));
        });
      }

      sectorsToShow.forEach(sector => {
        // Get all salespeople in this sector
        const teamsInSector = teamIdsBySectorId[sector.id] || new Set();
        const salespeopleInSector = salespeople.filter(sp => {
          if (sp.sector_id === sector.id) return true;
          if (sp.team_id && teamsInSector.has(sp.team_id)) return true;
          return false;
        });

        const salespersonIds = new Set(salespeopleInSector.map(sp => sp.id));
        const realized = monthEntries
          .filter(e => salespersonIds.has(e.salesperson_id))
          .reduce((sum, e) => sum + e.value, 0);

        // Get target from sector-scoped KPIs
        const sectorKpis = kpis.filter(k => 
          k.kpi_type === "monetary" && 
          k.sector_id === sector.id
        );
        const target = sectorKpis.reduce((sum, k) => sum + (k.effective_target ?? k.target_value), 0);

        if (target > 0) {
          items.push({
            id: sector.id,
            name: sector.name,
            realized,
            target,
            percentage: (realized / target) * 100,
          });
        }
      });
    } else if (comparisonType === "teams") {
      // Compare teams
      let teamsToShow = teams.filter(t => t.is_active);
      
      // Apply filters
      if (selectedSector && selectedSector !== "all") {
        const teamIdsInSector = teamIdsBySectorId[selectedSector] || new Set();
        teamsToShow = teamsToShow.filter(t => teamIdsInSector.has(t.id));
      }
      if (selectedUnit && selectedUnit !== "all") {
        const teamIdsInUnit = teamIdsByUnitId[selectedUnit] || new Set();
        teamsToShow = teamsToShow.filter(t => teamIdsInUnit.has(t.id));
      }

      teamsToShow.forEach(team => {
        // Get team KPIs
        const teamKpis = kpis.filter(k => 
          k.team_id === team.id && 
          k.kpi_type === "monetary"
        );

        if (teamKpis.length === 0) return;

        const teamKpiIds = new Set(teamKpis.map(k => k.id));
        const realized = monthEntries
          .filter(e => teamKpiIds.has(e.kpi_id))
          .reduce((sum, e) => sum + e.value, 0);

        const target = teamKpis.reduce((sum, k) => sum + (k.effective_target ?? k.target_value), 0);

        if (target > 0) {
          items.push({
            id: team.id,
            name: team.name,
            realized,
            target,
            percentage: (realized / target) * 100,
          });
        }
      });
    } else if (comparisonType === "salespeople") {
      // Compare salespeople
      let salespeopleToShow = salespeople; // active + inactive-with-sales already filtered upstream
      
      // Apply filters
      if (selectedTeam && selectedTeam !== "all") {
        salespeopleToShow = salespeopleToShow.filter(sp => sp.team_id === selectedTeam);
      }
      if (selectedSector && selectedSector !== "all") {
        const teamsInSector = teamIdsBySectorId[selectedSector] || new Set();
        salespeopleToShow = salespeopleToShow.filter(sp => 
          sp.sector_id === selectedSector || 
          (sp.team_id && teamsInSector.has(sp.team_id))
        );
      }
      if (selectedUnit && selectedUnit !== "all") {
        const teamsInUnit = teamIdsByUnitId[selectedUnit] || new Set();
        salespeopleToShow = salespeopleToShow.filter(sp => 
          sp.unit_id === selectedUnit || 
          (sp.team_id && teamsInUnit.has(sp.team_id))
        );
      }

      salespeopleToShow.forEach(sp => {
        const realized = monthEntries
          .filter(e => e.salesperson_id === sp.id)
          .reduce((sum, e) => sum + e.value, 0);

        // Get target from salesperson's team KPI or individual target
        let target = 0;
        const spKpis = kpis.filter(k => 
          k.kpi_type === "monetary" && 
          k.salesperson_id === sp.id
        );
        
        if (spKpis.length > 0) {
          target = spKpis.reduce((sum, k) => sum + (k.effective_target ?? k.target_value), 0);
        } else if (sp.team_id) {
          // Use team KPI target divided by team members
          const teamKpis = kpis.filter(k => k.team_id === sp.team_id && k.kpi_type === "monetary");
          const teamMembers = salespeople.filter(s => s.team_id === sp.team_id && s.is_active).length;
          if (teamMembers > 0) {
            target = teamKpis.reduce((sum, k) => sum + (k.effective_target ?? k.target_value), 0) / teamMembers;
          }
        }

        if (target > 0) {
          items.push({
            id: sp.id,
            name: sp.name,
            realized,
            target,
            percentage: (realized / target) * 100,
          });
        }
      });
    }

    // Sort by percentage (descending)
    items.sort((a, b) => b.percentage - a.percentage);

    return items;
  }, [comparisonType, teams, units, sectors, salespeople, kpis, entries, sectorTeams, teamUnits, selectedUnit, selectedSector, selectedTeam, monthStart, monthEnd, teamIdsBySectorId, teamIdsByUnitId]);

  // Don't show if no data
  if (performances.length === 0) {
    return null;
  }

  const getPercentageColor = (pct: number) => {
    if (pct >= 100) return "text-green-600";
    if (pct >= 70) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  const getIcon = () => {
    switch (comparisonType) {
      case "units": return <Building2 className="h-5 w-5" />;
      case "sectors": return <Layers className="h-5 w-5" />;
      case "teams": return <UsersRound className="h-5 w-5" />;
      case "salespeople": return <Users className="h-5 w-5" />;
    }
  };

  const getLabel = () => {
    switch (comparisonType) {
      case "units": return "Unidades";
      case "sectors": return "Setores";
      case "teams": return "Equipes";
      case "salespeople": return "Vendedores";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {getIcon()}
            Desempenho por
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={comparisonType} onValueChange={(v) => setComparisonType(v as ComparisonType)}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="units">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Unidades
                  </div>
                </SelectItem>
                <SelectItem value="sectors">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Setores
                  </div>
                </SelectItem>
                <SelectItem value="teams">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    Equipes
                  </div>
                </SelectItem>
                <SelectItem value="salespeople">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Vendedores
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1">
              <Target className="h-3 w-3" />
              % Meta
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {performances.slice(0, 10).map((item, index) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {index === 0 && item.percentage >= 100 && (
                  <Trophy className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-medium text-sm truncate max-w-[150px]" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${getPercentageColor(item.percentage)}`}>
                  {item.percentage.toFixed(1)}%
                </span>
                {item.percentage >= 100 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor(item.percentage)}`}
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="pt-3 border-t mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Média geral:</span>
            <span className="font-medium">
              {(performances.reduce((sum, t) => sum + t.percentage, 0) / performances.length).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
            <span>{getLabel()} acima da meta:</span>
            <span className="font-medium text-green-600">
              {performances.filter(t => t.percentage >= 100).length} de {performances.length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
