import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Trophy, Clock, Medal, Target, TrendingUp, Crown, Eye } from "lucide-react";
import { format, parseISO, differenceInDays, differenceInHours } from "date-fns";
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
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [teamTotal, setTeamTotal] = useState(0);

  useEffect(() => {
    fetchActiveCampaigns();
  }, [projectId]);

  const fetchActiveCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("endomarketing_campaigns")
        .select(`
          *,
          kpi:company_kpis(name, kpi_type)
        `)
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("end_date", { ascending: true })
        .limit(3);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignRanking = async (campaign: Campaign) => {
    setRankingLoading(true);
    try {
      // Fetch participants (or all salespeople if all_salespeople is true)
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

      // Fetch KPI entries for the campaign period
      const startDate = format(parseISO(campaign.start_date), "yyyy-MM-dd");
      const endDate = format(parseISO(campaign.end_date), "yyyy-MM-dd");

      const { data: entries } = await supabase
        .from("kpi_entries")
        .select("salesperson_id, value")
        .eq("kpi_id", campaign.kpi_id)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .in("salesperson_id", salespeopleIds);

      // Calculate values per salesperson
      const valuesBySalesperson = new Map<string, number[]>();
      (entries || []).forEach(entry => {
        const current = valuesBySalesperson.get(entry.salesperson_id) || [];
        current.push(entry.value);
        valuesBySalesperson.set(entry.salesperson_id, current);
      });

      // Get salesperson names
      const { data: salespeople } = await supabase
        .from("company_salespeople")
        .select("id, name")
        .in("id", salespeopleIds);

      const salespeopleMap = new Map((salespeople || []).map(s => [s.id, s.name]));

      // Calculate final values based on calculation method
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

      // Sort and assign positions
      results.sort((a, b) => b.value - a.value);
      results.forEach((r, i) => {
        r.position = i + 1;
      });

      setRanking(results);
      setTeamTotal(total);
    } catch (error) {
      console.error("Error fetching ranking:", error);
    } finally {
      setRankingLoading(false);
    }
  };

  const handleViewDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    fetchCampaignRanking(campaign);
  };

  const getTimeRemaining = (endDate: string) => {
    const end = parseISO(endDate);
    const now = new Date();
    const days = differenceInDays(end, now);
    
    if (days > 0) {
      return `${days} dia${days > 1 ? "s" : ""} restante${days > 1 ? "s" : ""}`;
    }
    
    const hours = differenceInHours(end, now);
    if (hours > 0) {
      return `${hours} hora${hours > 1 ? "s" : ""} restante${hours > 1 ? "s" : ""}`;
    }
    
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

  const getMedalColor = (position: number) => {
    switch (position) {
      case 1: return "text-amber-500";
      case 2: return "text-gray-400";
      case 3: return "text-amber-700";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48"></div>
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return null; // Don't show widget if no active campaigns
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Campanhas de Endomarketing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map(campaign => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{campaign.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {getTimeRemaining(campaign.end_date)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    KPI: {campaign.kpi?.name} • 
                    {format(parseISO(campaign.start_date), " dd/MM", { locale: ptBR })} - 
                    {format(parseISO(campaign.end_date), " dd/MM", { locale: ptBR })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleViewDetails(campaign)} className="gap-2">
                  <Eye className="h-4 w-4" />
                  Ver detalhes
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Details Sheet */}
      <Sheet open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              {selectedCampaign?.name}
            </SheetTitle>
          </SheetHeader>

          {selectedCampaign && (
            <div className="mt-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total do time</span>
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {formatValue(teamTotal, selectedCampaign.kpi?.kpi_type)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-muted-foreground">Líder atual</span>
                    </div>
                    <p className="text-xl font-bold mt-1 truncate">
                      {ranking[0]?.salesperson_name || "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Goal progress */}
              {selectedCampaign.has_goal && selectedCampaign.goal_value && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Meta geral</span>
                      </div>
                      <span className="text-sm font-medium">
                        {Math.round((teamTotal / selectedCampaign.goal_value) * 100)}%
                      </span>
                    </div>
                    <Progress value={Math.min((teamTotal / selectedCampaign.goal_value) * 100, 100)} />
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatValue(teamTotal, selectedCampaign.kpi?.kpi_type)} de {formatValue(selectedCampaign.goal_value, selectedCampaign.kpi?.kpi_type)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Ranking */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4" />
                  Ranking
                </h4>
                {rankingLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando ranking...
                  </div>
                ) : ranking.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum resultado registrado ainda
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ranking.map((entry) => (
                      <div
                        key={entry.salesperson_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          entry.position <= 3 ? "bg-amber-50/50 border-amber-200" : ""
                        }`}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          entry.position === 1 ? "bg-amber-100 text-amber-700" :
                          entry.position === 2 ? "bg-gray-100 text-gray-600" :
                          entry.position === 3 ? "bg-amber-50 text-amber-800" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {entry.position <= 3 ? (
                            <Medal className={`h-4 w-4 ${getMedalColor(entry.position)}`} />
                          ) : (
                            entry.position
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.salesperson_name}</p>
                          {entry.goalPercent !== undefined && (
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={Math.min(entry.goalPercent, 100)} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground">{entry.goalPercent}%</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {formatValue(entry.value, selectedCampaign.kpi?.kpi_type)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Time remaining */}
              <div className="text-center text-sm text-muted-foreground">
                <Clock className="h-4 w-4 inline mr-1" />
                {getTimeRemaining(selectedCampaign.end_date)}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
