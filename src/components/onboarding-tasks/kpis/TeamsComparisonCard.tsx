import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UsersRound, TrendingUp, TrendingDown, Trophy, Target } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  kpi_type: "numeric" | "monetary" | "percentage";
  target_value: number;
  effective_target?: number;
  team_id?: string | null;
  is_main_goal?: boolean;
  scope?: string | null;
}

interface Team {
  id: string;
  name: string;
  is_active: boolean;
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

interface TeamsComparisonCardProps {
  teams: Team[];
  kpis: KPI[];
  entries: Entry[];
  sectorTeams: SectorTeam[];
  selectedSector?: string;
  monthStart: string;
  monthEnd: string;
}

interface TeamPerformance {
  teamId: string;
  teamName: string;
  realized: number;
  target: number;
  percentage: number;
}

export const TeamsComparisonCard = ({
  teams,
  kpis,
  entries,
  sectorTeams,
  selectedSector,
  monthStart,
  monthEnd,
}: TeamsComparisonCardProps) => {
  const teamPerformances = useMemo(() => {
    // Get teams to display
    let teamsToShow = teams;
    
    // If sector is selected, filter teams by sector
    if (selectedSector && selectedSector !== "all") {
      const teamIdsInSector = new Set(
        sectorTeams
          .filter(st => st.sector_id === selectedSector)
          .map(st => st.team_id)
      );
      teamsToShow = teams.filter(t => teamIdsInSector.has(t.id));
    }

    // Only show teams that have associated monetary KPIs
    const performances: TeamPerformance[] = [];

    teamsToShow.forEach(team => {
      // Find monetary KPIs for this team (main goal or any monetary)
      const teamKpis = kpis.filter(k => 
        k.team_id === team.id && 
        k.kpi_type === "monetary"
      );

      if (teamKpis.length === 0) return;

      // Get entries for this team's KPIs in the current month
      const teamKpiIds = new Set(teamKpis.map(k => k.id));
      const monthEntries = entries.filter(e => 
        teamKpiIds.has(e.kpi_id) &&
        e.entry_date >= monthStart &&
        e.entry_date <= monthEnd
      );

      const realized = monthEntries.reduce((sum, e) => sum + e.value, 0);
      
      // Sum targets from team KPIs
      const target = teamKpis.reduce((sum, k) => {
        return sum + (k.effective_target ?? k.target_value);
      }, 0);

      if (target > 0) {
        performances.push({
          teamId: team.id,
          teamName: team.name,
          realized,
          target,
          percentage: (realized / target) * 100,
        });
      }
    });

    // Sort by percentage (descending)
    performances.sort((a, b) => b.percentage - a.percentage);

    return performances;
  }, [teams, kpis, entries, sectorTeams, selectedSector, monthStart, monthEnd]);

  // Don't show if no teams have data
  if (teamPerformances.length === 0) {
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

  const getBadgeVariant = (pct: number): "default" | "secondary" | "destructive" => {
    if (pct >= 100) return "default";
    if (pct >= 70) return "secondary";
    return "destructive";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersRound className="h-5 w-5" />
            Desempenho por Equipe
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <Target className="h-3 w-3" />
            % da Meta
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {teamPerformances.map((team, index) => (
          <div key={team.teamId} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {index === 0 && team.percentage >= 100 && (
                  <Trophy className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-medium text-sm">{team.teamName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${getPercentageColor(team.percentage)}`}>
                  {team.percentage.toFixed(1)}%
                </span>
                {team.percentage >= 100 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor(team.percentage)}`}
                style={{ width: `${Math.min(team.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="pt-3 border-t mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Média geral:</span>
            <span className="font-medium">
              {(teamPerformances.reduce((sum, t) => sum + t.percentage, 0) / teamPerformances.length).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
            <span>Equipes acima da meta:</span>
            <span className="font-medium text-green-600">
              {teamPerformances.filter(t => t.percentage >= 100).length} de {teamPerformances.length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
