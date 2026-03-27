import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Eye, MousePointerClick, DollarSign, Target, Users, Repeat, BarChart3, MessageCircle, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar, AreaChart, Area } from "recharts";
import type { MetricKey } from "./useMetricVisibility";

interface MetaAdsOverviewProps {
  projectId: string;
  dateStart: string;
  dateStop: string;
  syncing: boolean;
  visibleMetrics: Set<MetricKey>;
}

const COLORS = ["#0A1931", "#B4121B", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#ef4444", "#14b8a6"];
const GRADIENT_COLORS = [
  { start: "#0A1931", end: "#1e40af" },
  { start: "#B4121B", end: "#ef4444" },
  { start: "#059669", end: "#10b981" },
  { start: "#d97706", end: "#f59e0b" },
  { start: "#7c3aed", end: "#8b5cf6" },
  { start: "#db2777", end: "#ec4899" },
  { start: "#0891b2", end: "#06b6d4" },
  { start: "#dc2626", end: "#f87171" },
];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

export const MetaAdsOverview = ({ projectId, dateStart, dateStop, syncing, visibleMetrics }: MetaAdsOverviewProps) => {
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
    leads: acc.leads + Number((c as any).leads || 0),
    frequency_sum: acc.frequency_sum + Number((c as any).frequency || 0),
    frequency_count: acc.frequency_count + (Number((c as any).frequency || 0) > 0 ? 1 : 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, messaging_conversations_started: 0, leads: 0, frequency_sum: 0, frequency_count: 0 });

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const avgCPM = totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0;
  const roas = totals.spend > 0 ? totals.conversion_value / totals.spend : 0;
  const avgFrequency = totals.frequency_count > 0 ? totals.frequency_sum / totals.frequency_count : 0;
  const costPerConversation = totals.messaging_conversations_started > 0 ? totals.spend / totals.messaging_conversations_started : 0;

  const allKpis = [
    { key: "spend" as MetricKey, label: "Investimento", value: formatCurrency(totals.spend), icon: DollarSign, gradient: "from-red-500 to-rose-600", iconBg: "bg-gradient-to-br from-red-500 to-rose-700", shadow: "shadow-red-500/20" },
    { key: "impressions" as MetricKey, label: "Impressões", value: formatNumber(totals.impressions), icon: Eye, gradient: "from-blue-500 to-indigo-600", iconBg: "bg-gradient-to-br from-blue-500 to-indigo-700", shadow: "shadow-blue-500/20" },
    { key: "reach" as MetricKey, label: "Alcance", value: formatNumber(totals.reach), icon: Users, gradient: "from-emerald-500 to-green-600", iconBg: "bg-gradient-to-br from-emerald-500 to-green-700", shadow: "shadow-emerald-500/20" },
    { key: "clicks" as MetricKey, label: "Cliques", value: formatNumber(totals.clicks), icon: MousePointerClick, gradient: "from-amber-500 to-orange-600", iconBg: "bg-gradient-to-br from-amber-500 to-orange-700", shadow: "shadow-amber-500/20" },
    { key: "ctr" as MetricKey, label: "CTR", value: formatPercent(avgCTR), icon: TrendingUp, gradient: "from-purple-500 to-violet-600", iconBg: "bg-gradient-to-br from-purple-500 to-violet-700", shadow: "shadow-purple-500/20" },
    { key: "cpc" as MetricKey, label: "CPC", value: formatCurrency(avgCPC), icon: DollarSign, gradient: "from-cyan-500 to-blue-600", iconBg: "bg-gradient-to-br from-cyan-500 to-blue-700", shadow: "shadow-cyan-500/20" },
    { key: "cpm" as MetricKey, label: "CPM", value: formatCurrency(avgCPM), icon: BarChart3, gradient: "from-pink-500 to-rose-600", iconBg: "bg-gradient-to-br from-pink-500 to-rose-700", shadow: "shadow-pink-500/20" },
    { key: "roas" as MetricKey, label: "ROAS", value: roas.toFixed(2) + "x", icon: Target, gradient: "from-emerald-500 to-teal-600", iconBg: "bg-gradient-to-br from-emerald-500 to-teal-700", shadow: "shadow-emerald-500/20" },
    { key: "conversations" as MetricKey, label: "Conversas", value: formatNumber(totals.messaging_conversations_started), icon: MessageCircle, gradient: "from-indigo-500 to-blue-600", iconBg: "bg-gradient-to-br from-indigo-500 to-blue-700", shadow: "shadow-indigo-500/20" },
    { key: "cost_per_conversation" as MetricKey, label: "Custo/Conversa", value: formatCurrency(costPerConversation), icon: MessageCircle, gradient: "from-orange-500 to-red-600", iconBg: "bg-gradient-to-br from-orange-500 to-red-700", shadow: "shadow-orange-500/20" },
    { key: "frequency" as MetricKey, label: "Frequência", value: avgFrequency.toFixed(2), icon: Repeat, gradient: "from-teal-500 to-cyan-600", iconBg: "bg-gradient-to-br from-teal-500 to-cyan-700", shadow: "shadow-teal-500/20" },
    { key: "leads" as MetricKey, label: "Leads", value: formatNumber(totals.leads), icon: UserPlus, gradient: "from-lime-500 to-green-600", iconBg: "bg-gradient-to-br from-lime-500 to-green-700", shadow: "shadow-lime-500/20" },
  ];

  const kpis = allKpis.filter(k => visibleMetrics.has(k.key));

  // Chart data: spend by campaign
  const spendByCampaign = campaigns
    .filter(c => Number(c.spend) > 0)
    .map(c => ({ name: c.campaign_name?.substring(0, 20) || "Sem nome", spend: Number(c.spend), clicks: Number(c.clicks), impressions: Number(c.impressions), reach: Number(c.reach) }));

  // Pie: spend distribution
  const pieData = campaigns
    .filter(c => Number(c.spend) > 0)
    .map(c => ({ name: c.campaign_name?.substring(0, 25) || "Sem nome", value: Number(c.spend) }));

  // Radial performance data
  const maxClicks = Math.max(...campaigns.map(c => Number(c.clicks || 0)), 1);
  const radialData = campaigns
    .filter(c => Number(c.clicks) > 0)
    .slice(0, 6)
    .map((c, i) => ({
      name: c.campaign_name?.substring(0, 15) || "Sem nome",
      value: Math.round((Number(c.clicks) / maxClicks) * 100),
      fill: COLORS[i % COLORS.length],
    }));

  // Custom 3D-style bar shape
  const renderBar3D = (props: any) => {
    const { x, y, width, height, fill } = props;
    const depth = 6;
    const darkerFill = fill === "#0A1931" ? "#060f1e" : fill === "#B4121B" ? "#8a0e15" : "#1a2a4a";
    return (
      <g>
        {/* Side face */}
        <path
          d={`M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y + height - depth} L${x + width},${y + height} Z`}
          fill={darkerFill}
          opacity={0.6}
        />
        {/* Top face */}
        <path
          d={`M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`}
          fill={fill}
          opacity={0.8}
        />
        {/* Front face */}
        <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      </g>
    );
  };

  // Custom 3D tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border/60 rounded-lg p-3 shadow-xl backdrop-blur-sm">
        <p className="text-xs font-bold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === "number" && entry.value > 100 ? formatNumber(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  };

  // Render pie with 3D effect
  const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" className="text-[9px] fill-muted-foreground">
        {name} ({(percent * 100).toFixed(0)}%)
      </text>
    );
  };

  return (
    <div className="space-y-6 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20, rotateX: -10 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 200 }}
            style={{ perspective: 800 }}
          >
            <Card className={`overflow-hidden relative group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ${kpi.shadow} border-0`}
              style={{
                background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)",
                boxShadow: "6px 6px 12px hsl(var(--muted) / 0.5), -2px -2px 8px hsl(var(--background))",
              }}
            >
              {/* Top gradient accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.gradient}`} />
              {/* Decorative glow */}
              <div className={`absolute -top-8 -right-8 w-20 h-20 rounded-full bg-gradient-to-br ${kpi.gradient} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`} />
              
              <CardContent className="p-4 relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</span>
                  <div className={`p-2 rounded-xl ${kpi.iconBg} shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <kpi.icon className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight text-foreground">{kpi.value}</p>
                {/* Bottom shine effect */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${kpi.gradient} opacity-0 group-hover:opacity-40 transition-opacity`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 3D Spend by Campaign Bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Investimento por Campanha</h4>
              <div id="chart-spend-campaign">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={spendByCampaign} layout="vertical" margin={{ right: 20 }}>
                    <defs>
                      {GRADIENT_COLORS.map((gc, i) => (
                        <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={gc.start} />
                          <stop offset="100%" stopColor={gc.end} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `R$${v}`} className="text-xs" />
                    <YAxis type="category" dataKey="name" width={120} className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="spend" name="Investimento" shape={renderBar3D} fill="#0A1931">
                      {spendByCampaign.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3D Pie Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Distribuição de Investimento</h4>
              <div id="chart-spend-pie">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <defs>
                      {GRADIENT_COLORS.map((gc, i) => (
                        <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={gc.start} />
                          <stop offset="100%" stopColor={gc.end} />
                        </linearGradient>
                      ))}
                      <filter id="shadow3d">
                        <feDropShadow dx="3" dy="3" stdDeviation="3" floodOpacity="0.3" />
                      </filter>
                    </defs>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      innerRadius={40}
                      dataKey="value"
                      label={renderCustomPieLabel}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth={2}
                      style={{ filter: "url(#shadow3d)" }}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={`url(#pieGrad${i % GRADIENT_COLORS.length})`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Radial Performance */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Performance Relativa</h4>
              <div id="chart-radial">
                <ResponsiveContainer width="100%" height={280}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      background={{ fill: "hsl(var(--muted))" }}
                      label={{ position: "insideStart", fill: "#fff", fontSize: 9 }}
                    />
                    <Legend iconSize={8} formatter={(value, entry: any) => <span className="text-xs text-muted-foreground">{entry.payload?.name}</span>} />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cliques vs Impressões - Area Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-4">Cliques vs Alcance por Campanha</h4>
              <div id="chart-clicks-reach">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={spendByCampaign} margin={{ right: 20 }}>
                    <defs>
                      <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0A1931" stopOpacity={1} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#B4121B" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" className="text-xs" />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="clicks" name="Cliques" fill="url(#gradClicks)" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="right" dataKey="reach" name="Alcance" fill="url(#gradReach)" radius={[6, 6, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
