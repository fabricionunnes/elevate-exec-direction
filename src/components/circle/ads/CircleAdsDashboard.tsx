import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Eye, 
  MousePointer, 
  TrendingUp, 
  DollarSign,
  BarChart3,
  Target,
  Trophy,
  Gavel,
  Users
} from "lucide-react";
import { useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Props {
  profileId?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function CircleAdsDashboard({ profileId }: Props) {
  const [period, setPeriod] = useState("7");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  const { data: campaigns } = useQuery({
    queryKey: ["circle-ads-campaigns-list", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("circle_ads_campaigns")
        .select("id, name")
        .eq("profile_id", profileId);
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["circle-ads-metrics", profileId, period, selectedCampaign],
    queryFn: async () => {
      if (!profileId) return null;

      const startDate = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd");
      
      // Get daily metrics
      let query = supabase
        .from("circle_ads_daily_metrics")
        .select(`
          *,
          ad:circle_ads_ads!inner(
            id,
            name,
            ad_set:circle_ads_ad_sets!inner(
              campaign:circle_ads_campaigns!inner(
                id,
                name,
                profile_id
              )
            )
          )
        `)
        .gte("date", startDate);

      const { data: dailyData, error } = await query;
      if (error) throw error;

      // Filter by profile and optionally campaign
      const filtered = dailyData?.filter((m: any) => {
        const campaign = m.ad?.ad_set?.campaign;
        if (!campaign || campaign.profile_id !== profileId) return false;
        if (selectedCampaign !== "all" && campaign.id !== selectedCampaign) return false;
        return true;
      }) || [];

      // Aggregate by date
      const byDate = filtered.reduce((acc: any, m: any) => {
        if (!acc[m.date]) {
          acc[m.date] = { date: m.date, impressions: 0, clicks: 0, spent: 0, reach: 0 };
        }
        acc[m.date].impressions += m.impressions || 0;
        acc[m.date].clicks += m.clicks || 0;
        acc[m.date].spent += parseFloat(m.spent) || 0;
        acc[m.date].reach += m.unique_reach || 0;
        return acc;
      }, {});

      const chartData = Object.values(byDate)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .map((d: any) => ({
          ...d,
          dateLabel: format(new Date(d.date), "dd/MM", { locale: ptBR }),
          ctr: d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : 0,
        }));

      // Totals
      const totals = filtered.reduce(
        (acc: any, m: any) => ({
          impressions: acc.impressions + (m.impressions || 0),
          clicks: acc.clicks + (m.clicks || 0),
          spent: acc.spent + (parseFloat(m.spent) || 0),
          reach: acc.reach + (m.unique_reach || 0),
        }),
        { impressions: 0, clicks: 0, spent: 0, reach: 0 }
      );

      return {
        chartData,
        totals,
        ctr: totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : "0",
        cpc: totals.clicks > 0 ? (totals.spent / totals.clicks).toFixed(2) : "0",
        cpm: totals.impressions > 0 ? ((totals.spent / totals.impressions) * 1000).toFixed(2) : "0",
      };
    },
    enabled: !!profileId,
  });

  // Auction stats
  const { data: auctionStats } = useQuery({
    queryKey: ["circle-ads-auction-stats", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("circle_ads_auction_history")
        .select("result")
        .eq("profile_id", profileId);
      if (error) throw error;
      
      const won = data?.filter(a => a.result === "won").length || 0;
      const lost = data?.filter(a => a.result === "lost").length || 0;
      return { won, lost, total: data?.length || 0 };
    },
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const auctionPieData = auctionStats ? [
    { name: 'Vencidos', value: auctionStats.won },
    { name: 'Perdidos', value: auctionStats.lost },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaigns?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Impressões</p>
                <p className="text-lg font-bold">{metrics?.totals.impressions.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Alcance</p>
                <p className="text-lg font-bold">{metrics?.totals.reach.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-lg font-bold">{metrics?.totals.clicks.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="text-lg font-bold">{metrics?.ctr || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">CPC</p>
                <p className="text-lg font-bold">R$ {metrics?.cpc || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Gasto Total</p>
                <p className="text-lg font-bold">R$ {metrics?.totals.spent.toFixed(2) || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {metrics?.chartData && metrics.chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Impressões e Cliques</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dateLabel" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Impressões"
                    />
                    <Line
                      type="monotone"
                      dataKey="clicks"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      name="Cliques"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gasto Diário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dateLabel" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                    <Bar dataKey="spent" fill="hsl(var(--primary))" name="Gasto" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sem dados ainda</h3>
            <p className="text-muted-foreground text-sm">
              As métricas aparecerão aqui quando seus anúncios começarem a ser exibidos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Auction Stats */}
      {auctionStats && auctionStats.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                Performance em Leilões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">{auctionStats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-500">{auctionStats.won}</p>
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-500">{auctionStats.lost}</p>
                  <p className="text-sm text-muted-foreground">Perdidos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Taxa de Vitória
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={auctionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {auctionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-2xl font-bold">
                {auctionStats.total > 0 
                  ? ((auctionStats.won / auctionStats.total) * 100).toFixed(1) 
                  : 0}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
