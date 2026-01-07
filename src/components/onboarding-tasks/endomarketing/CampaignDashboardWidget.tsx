import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Clock, Medal, Target, TrendingUp, Crown, Users, Gift } from "lucide-react";
import { format, parseISO, differenceInDays, differenceInHours, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
  kpi_id: string;
  calculation_method: string;
  competition_type: string;
  has_goal: boolean;
  goal_value: number | null;
  has_prizes: boolean;
  all_salespeople: boolean;
  kpi?: { name: string; kpi_type: string } | null;
}

interface RankingEntry {
  salesperson_id: string;
  salesperson_name: string;
  value: number;
  position: number;
  goalPercent?: number;
}

interface CampaignDashboardWidgetProps {
  companyId: string;
  projectId: string;
}

export const CampaignDashboardWidget = ({ companyId, projectId }: CampaignDashboardWidgetProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [teamTotal, setTeamTotal] = useState(0);

  useEffect(() => {
    fetchActiveCampaigns();

    // Subscribe to realtime changes for campaigns
    const channel = supabase
      .channel(`endomarketing-campaigns-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'endomarketing_campaigns',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchActiveCampaigns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    if (activeCampaign) {
      fetchCampaignRanking(activeCampaign);
    }
  }, [activeCampaign]);

  const fetchActiveCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("endomarketing_campaigns")
        .select(`
          *,
          kpi:company_kpis(name, kpi_type)
        `)
        .eq("project_id", projectId)
        .order("start_date", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const visibleCampaigns = (data || [])
        .filter((campaign) => {
          if (campaign.status === "ended") return false;
          const endDate = parseISO(campaign.end_date);
          return isAfter(endDate, now) || endDate >= now;
        })
        .slice(0, 3);

      setCampaigns(visibleCampaigns);
      
      // Set the first active campaign as the main one
      if (visibleCampaigns.length > 0) {
        const now = new Date();
        const runningCampaign = visibleCampaigns.find(c => {
          const start = parseISO(c.start_date);
          const end = parseISO(c.end_date);
          return start <= now && end >= now;
        });
        setActiveCampaign(runningCampaign || visibleCampaigns[0]);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignRanking = async (campaign: Campaign) => {
    try {
      let salespeopleIds: string[] = [];
      
      if (campaign.all_salespeople) {
        const { data: salespeople } = await supabase
          .from("company_salespeople")
          .select("id, name")
          .eq("company_id", companyId)
          .eq("is_active", true);
        
        salespeopleIds = (salespeople || []).map(s => s.id);
      } else {
        const { data: participants } = await supabase
          .from("endomarketing_participants")
          .select("salesperson_id")
          .eq("campaign_id", campaign.id);
        
        salespeopleIds = (participants || []).map(p => p.salesperson_id);
      }

      if (salespeopleIds.length === 0) {
        setRanking([]);
        setTeamTotal(0);
        return;
      }

      const startDate = format(parseISO(campaign.start_date), "yyyy-MM-dd");
      const endDate = format(parseISO(campaign.end_date), "yyyy-MM-dd");

      const { data: entries } = await supabase
        .from("kpi_entries")
        .select("salesperson_id, value")
        .eq("kpi_id", campaign.kpi_id)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .in("salesperson_id", salespeopleIds);

      const valuesBySalesperson = new Map<string, number[]>();
      (entries || []).forEach(entry => {
        const current = valuesBySalesperson.get(entry.salesperson_id) || [];
        current.push(entry.value);
        valuesBySalesperson.set(entry.salesperson_id, current);
      });

      const { data: salespeople } = await supabase
        .from("company_salespeople")
        .select("id, name")
        .in("id", salespeopleIds);

      const salespeopleMap = new Map((salespeople || []).map(s => [s.id, s.name]));

      const results: RankingEntry[] = [];
      let total = 0;

      salespeopleIds.forEach(spId => {
        const values = valuesBySalesperson.get(spId) || [];
        let finalValue = 0;

        switch (campaign.calculation_method) {
          case "sum":
            finalValue = values.reduce((a, b) => a + b, 0);
            break;
          case "avg":
            finalValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case "max":
            finalValue = values.length > 0 ? Math.max(...values) : 0;
            break;
        }

        total += finalValue;

        results.push({
          salesperson_id: spId,
          salesperson_name: salespeopleMap.get(spId) || "Desconhecido",
          value: finalValue,
          position: 0,
          goalPercent: campaign.has_goal && campaign.goal_value 
            ? Math.round((finalValue / campaign.goal_value) * 100) 
            : undefined,
        });
      });

      results.sort((a, b) => b.value - a.value);
      results.forEach((r, i) => {
        r.position = i + 1;
      });

      setRanking(results);
      setTeamTotal(total);
    } catch (error) {
      console.error("Error fetching ranking:", error);
    }
  };

  const getTimeRemaining = (startDateStr: string, endDateStr: string) => {
    const start = parseISO(startDateStr);
    const end = parseISO(endDateStr);
    const now = new Date();

    if (isBefore(now, start)) {
      const daysToStart = differenceInDays(start, now);
      if (daysToStart > 0) return `Começa em ${daysToStart} dia${daysToStart > 1 ? "s" : ""}`;
      const hoursToStart = differenceInHours(start, now);
      if (hoursToStart > 0) return `Começa em ${hoursToStart} hora${hoursToStart > 1 ? "s" : ""}`;
      return "Começa em breve";
    }

    const days = differenceInDays(end, now);
    if (days > 0) return `${days} dia${days > 1 ? "s" : ""} restante${days > 1 ? "s" : ""}`;
    const hours = differenceInHours(end, now);
    if (hours > 0) return `${hours} hora${hours > 1 ? "s" : ""} restante${hours > 1 ? "s" : ""}`;
    return "Encerrando";
  };

  const formatValue = (value: number, kpiType?: string) => {
    if (kpiType === "monetary") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString("pt-BR");
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Medal className="h-5 w-5 text-amber-600" />;
      default: return null;
    }
  };

  if (loading) {
    return null;
  }

  if (campaigns.length === 0) {
    return null;
  }

  const topParticipant = ranking[0];

  return (
    <Card className="border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            🏆 Campanhas de Endomarketing
          </CardTitle>
          {activeCampaign && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {getTimeRemaining(activeCampaign.start_date, activeCampaign.end_date)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Campanha
              </div>
              <p className="text-lg font-bold truncate">{activeCampaign?.name || "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Participantes
              </div>
              <p className="text-lg font-bold">{ranking.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="h-4 w-4 text-amber-500" />
                Líder
              </div>
              <p className="text-lg font-bold truncate">
                {topParticipant?.salesperson_name || "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Total do Time
              </div>
              <p className="text-lg font-bold">
                {activeCampaign ? formatValue(teamTotal, activeCampaign.kpi?.kpi_type) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Goal Progress */}
        {activeCampaign?.has_goal && activeCampaign.goal_value && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Meta Geral da Campanha</span>
                </div>
                <span className="text-sm font-medium">
                  {Math.round((teamTotal / activeCampaign.goal_value) * 100)}%
                </span>
              </div>
              <Progress value={Math.min((teamTotal / activeCampaign.goal_value) * 100, 100)} />
              <p className="text-xs text-muted-foreground mt-2">
                {formatValue(teamTotal, activeCampaign.kpi?.kpi_type)} de {formatValue(activeCampaign.goal_value, activeCampaign.kpi?.kpi_type)}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Ranking */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Medal className="h-4 w-4" />
                Ranking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Sem participantes</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      {activeCampaign?.has_goal && <TableHead className="w-20">%</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.slice(0, 10).map((entry) => (
                      <TableRow key={entry.salesperson_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {getPositionIcon(entry.position)}
                            {!getPositionIcon(entry.position) && entry.position}
                          </div>
                        </TableCell>
                        <TableCell>{entry.salesperson_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatValue(entry.value, activeCampaign?.kpi?.kpi_type)}
                        </TableCell>
                        {activeCampaign?.has_goal && (
                          <TableCell>
                            <Badge variant={entry.goalPercent && entry.goalPercent >= 100 ? "default" : "secondary"}>
                              {entry.goalPercent || 0}%
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Campaign Info & Prizes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Detalhes da Campanha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeCampaign && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">KPI:</span>
                      <span className="font-medium">{activeCampaign.kpi?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Período:</span>
                      <span className="font-medium">
                        {format(parseISO(activeCampaign.start_date), "dd/MM", { locale: ptBR })} - {format(parseISO(activeCampaign.end_date), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cálculo:</span>
                      <span className="font-medium">
                        {activeCampaign.calculation_method === "sum" && "Soma"}
                        {activeCampaign.calculation_method === "avg" && "Média"}
                        {activeCampaign.calculation_method === "max" && "Máximo"}
                      </span>
                    </div>
                    {activeCampaign.has_prizes && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Premiação:</span>
                        <Badge variant="default">🎁 Com Prêmios</Badge>
                      </div>
                    )}
                  </div>

                  {activeCampaign.description && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">{activeCampaign.description}</p>
                    </div>
                  )}
                </>
              )}

              {/* Other campaigns */}
              {campaigns.length > 1 && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Outras campanhas:</p>
                  <div className="space-y-2">
                    {campaigns.filter(c => c.id !== activeCampaign?.id).map(campaign => (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => setActiveCampaign(campaign)}
                      >
                        <span className="text-sm font-medium truncate">{campaign.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {getTimeRemaining(campaign.start_date, campaign.end_date)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};
