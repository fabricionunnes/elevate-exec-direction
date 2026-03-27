import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Eye, MousePointerClick, DollarSign, Target, Users, Repeat, BarChart3, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface MetaAdsOverviewProps {
  projectId: string;
  dateStart: string;
  dateStop: string;
  syncing: boolean;
}

const COLORS = ["hsl(var(--primary))", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

export const MetaAdsOverview = ({ projectId, dateStart, dateStop, syncing }: MetaAdsOverviewProps) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("meta_ads_campaigns")
        .select("*")
        .eq("project_id", projectId)
        .eq("date_start", dateStart)
        .eq("date_stop", dateStop)
        .order("spend", { ascending: false });
      setCampaigns(data || []);
      setLoading(false);
    };
    fetch();
  }, [projectId, dateStart, dateStop, syncing]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (campaigns.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">Nenhum dado encontrado. Clique em "Sincronizar" para buscar dados do Meta Ads.</p>
      </CardContent></Card>
    );
  }

  // Aggregate totals
  const totals = campaigns.reduce((acc, c) => ({
    impressions: acc.impressions + Number(c.impressions || 0),
    reach: acc.reach + Number(c.reach || 0),
    clicks: acc.clicks + Number(c.clicks || 0),
    spend: acc.spend + Number(c.spend || 0),
    conversions: acc.conversions + Number(c.conversions || 0),
    conversion_value: acc.conversion_value + Number(c.conversion_value || 0),
    messaging_conversations_started: acc.messaging_conversations_started + Number((c as any).messaging_conversations_started || 0),
    frequency_sum: acc.frequency_sum + Number((c as any).frequency || 0),
    frequency_count: acc.frequency_count + (Number((c as any).frequency || 0) > 0 ? 1 : 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, messaging_conversations_started: 0, frequency_sum: 0, frequency_count: 0 });

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCPM = totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0;
  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  const avgFrequency = totals.frequency_count > 0 ? totals.frequency_sum / totals.frequency_count : 0;
  const costPerConversation = totals.messaging_conversations_started > 0 ? totals.spend / totals.messaging_conversations_started : 0;

  const kpis = [
    { label: "Investimento", value: formatCurrency(totals.spend), icon: DollarSign, color: "text-red-500" },
    { label: "Impressões", value: formatNumber(totals.impressions), icon: Eye, color: "text-blue-500" },
    { label: "Alcance", value: formatNumber(totals.reach), icon: Users, color: "text-green-500" },
    { label: "Cliques", value: formatNumber(totals.clicks), icon: MousePointerClick, color: "text-amber-500" },
    { label: "CTR", value: formatPercent(avgCTR), icon: TrendingUp, color: "text-purple-500" },
    { label: "CPC", value: formatCurrency(avgCPC), icon: DollarSign, color: "text-cyan-500" },
    { label: "CPM", value: formatCurrency(avgCPM), icon: BarChart3, color: "text-pink-500" },
    { label: "ROAS", value: roas.toFixed(2) + "x", icon: Target, color: "text-emerald-500" },
  ];

  // Chart data: spend by campaign
  const spendByCampaign = campaigns
    .filter(c => Number(c.spend) > 0)
    .map(c => ({ name: c.campaign_name?.substring(0, 20) || "Sem nome", spend: Number(c.spend), clicks: Number(c.clicks), impressions: Number(c.impressions) }));

  // Pie: spend distribution
  const pieData = campaigns
    .filter(c => Number(c.spend) > 0)
    .map(c => ({ name: c.campaign_name?.substring(0, 25) || "Sem nome", value: Number(c.spend) }));

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <p className="text-xl font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend by Campaign Bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Investimento por Campanha</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={spendByCampaign} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tickFormatter={(v) => `R$${v}`} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={120} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Spend Distribution Pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Distribuição de Investimento</h4>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Clicks vs Impressions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Cliques e Impressões por Campanha</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendByCampaign}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="clicks" fill="#3b82f6" name="Cliques" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="impressions" fill="#10b981" name="Impressões" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
