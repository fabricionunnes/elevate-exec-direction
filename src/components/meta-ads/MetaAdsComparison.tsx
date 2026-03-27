import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { MetricKey } from "./useMetricVisibility";

interface MetaAdsComparisonProps {
  projectId: string;
  dateStart: string;
  dateStop: string;
  visibleMetrics: Set<MetricKey>;
}

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatNumber = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const formatPercent = (v: number) => `${v.toFixed(2)}%`;

function calcTotals(campaigns: any[]) {
  const t = campaigns.reduce((acc, c) => ({
    impressions: acc.impressions + Number(c.impressions || 0),
    reach: acc.reach + Number(c.reach || 0),
    clicks: acc.clicks + Number(c.clicks || 0),
    spend: acc.spend + Number(c.spend || 0),
    conversions: acc.conversions + Number(c.conversions || 0),
    conversion_value: acc.conversion_value + Number(c.conversion_value || 0),
    messaging_conversations_started: acc.messaging_conversations_started + Number((c as any).messaging_conversations_started || 0),
    leads: acc.leads + Number((c as any).leads || 0),
    frequency_sum: acc.frequency_sum + Number(c.frequency || 0),
    frequency_count: acc.frequency_count + (Number(c.frequency || 0) > 0 ? 1 : 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0, messaging_conversations_started: 0, leads: 0, frequency_sum: 0, frequency_count: 0 });

  const avgCTR = t.impressions > 0 ? (t.clicks / t.impressions * 100) : 0;
  const avgCPC = t.clicks > 0 ? t.spend / t.clicks : 0;
  const avgCPM = t.impressions > 0 ? (t.spend / t.impressions * 1000) : 0;
  const roas = t.spend > 0 ? t.conversion_value / t.spend : 0;
  const avgFrequency = t.frequency_count > 0 ? t.frequency_sum / t.frequency_count : 0;
  const costPerConv = t.messaging_conversations_started > 0 ? t.spend / t.messaging_conversations_started : 0;

  return { ...t, avgCTR, avgCPC, avgCPM, roas, avgFrequency, costPerConv };
}

function getPreviousPeriod(dateStart: string, dateStop: string) {
  const start = new Date(dateStart + "T12:00:00");
  const stop = new Date(dateStop + "T12:00:00");
  const diffMs = stop.getTime() - start.getTime();
  const prevStop = new Date(start.getTime() - 86400000); // day before start
  const prevStart = new Date(prevStop.getTime() - diffMs);
  return {
    start: prevStart.toISOString().split("T")[0],
    stop: prevStop.toISOString().split("T")[0],
  };
}

export const MetaAdsComparison = ({ projectId, dateStart, dateStop, visibleMetrics }: MetaAdsComparisonProps) => {
  const prev = getPreviousPeriod(dateStart, dateStop);
  const [compStart, setCompStart] = useState(prev.start);
  const [compStop, setCompStop] = useState(prev.stop);
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [compData, setCompData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = getPreviousPeriod(dateStart, dateStop);
    setCompStart(p.start);
    setCompStop(p.stop);
  }, [dateStart, dateStop]);

  useEffect(() => {
    const fetchBoth = async () => {
      setLoading(true);
      const [currentRes, compRes] = await Promise.all([
        supabase.from("meta_ads_campaigns").select("*").eq("project_id", projectId).eq("date_start", dateStart).eq("date_stop", dateStop),
        supabase.from("meta_ads_campaigns").select("*").eq("project_id", projectId).eq("date_start", compStart).eq("date_stop", compStop),
      ]);
      setCurrentData(currentRes.data || []);
      setCompData(compRes.data || []);
      setLoading(false);
    };
    fetchBoth();
  }, [projectId, dateStart, dateStop, compStart, compStop]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const current = calcTotals(currentData);
  const comparison = calcTotals(compData);

  const fmtDateBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  type MetricDef = { key: MetricKey; label: string; currentVal: number; compVal: number; format: (v: number) => string; invertColor?: boolean };

  const allMetrics: MetricDef[] = [
    { key: "spend", label: "Investimento", currentVal: current.spend, compVal: comparison.spend, format: formatCurrency, invertColor: true },
    { key: "impressions", label: "Impressões", currentVal: current.impressions, compVal: comparison.impressions, format: formatNumber },
    { key: "reach", label: "Alcance", currentVal: current.reach, compVal: comparison.reach, format: formatNumber },
    { key: "clicks", label: "Cliques", currentVal: current.clicks, compVal: comparison.clicks, format: formatNumber },
    { key: "ctr", label: "CTR", currentVal: current.avgCTR, compVal: comparison.avgCTR, format: formatPercent },
    { key: "cpc", label: "CPC", currentVal: current.avgCPC, compVal: comparison.avgCPC, format: formatCurrency, invertColor: true },
    { key: "cpm", label: "CPM", currentVal: current.avgCPM, compVal: comparison.avgCPM, format: formatCurrency, invertColor: true },
    { key: "roas", label: "ROAS", currentVal: current.roas, compVal: comparison.roas, format: (v) => v.toFixed(2) + "x" },
    { key: "conversations", label: "Conversas", currentVal: current.messaging_conversations_started, compVal: comparison.messaging_conversations_started, format: formatNumber },
    { key: "cost_per_conversation", label: "Custo/Conversa", currentVal: current.costPerConv, compVal: comparison.costPerConv, format: formatCurrency, invertColor: true },
    { key: "frequency", label: "Frequência", currentVal: current.avgFrequency, compVal: comparison.avgFrequency, format: (v) => v.toFixed(2) },
    { key: "conversions", label: "Conversões", currentVal: current.conversions, compVal: comparison.conversions, format: formatNumber },
    { key: "leads", label: "Leads", currentVal: current.leads, compVal: comparison.leads, format: formatNumber },
  ];

  const metrics = allMetrics.filter(m => visibleMetrics.has(m.key));

  const getDelta = (cur: number, comp: number) => comp === 0 ? (cur > 0 ? 100 : 0) : ((cur - comp) / comp) * 100;

  // Chart data for bar comparison
  const chartMetrics = [
    { name: "Invest.", atual: current.spend, anterior: comparison.spend },
    { name: "Cliques", atual: current.clicks, anterior: comparison.clicks },
    { name: "Impressões", atual: current.impressions / 1000, anterior: comparison.impressions / 1000 },
    { name: "Alcance", atual: current.reach / 1000, anterior: comparison.reach / 1000 },
  ];

  return (
    <div className="space-y-6 mt-4">
      {/* Comparison period selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Comparar com:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="date" value={compStart} onChange={(e) => setCompStart(e.target.value)} className="h-8 text-xs w-36" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={compStop} onChange={(e) => setCompStop(e.target.value)} className="h-8 text-xs w-36" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => { const p = getPreviousPeriod(dateStart, dateStop); setCompStart(p.start); setCompStop(p.stop); }}
              >
                Período anterior
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              Atual: {fmtDateBR(dateStart)} – {fmtDateBR(dateStop)}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/40" />
              Comparação: {fmtDateBR(compStart)} – {fmtDateBR(compStop)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {metrics.map((m, i) => {
          const delta = getDelta(m.currentVal, m.compVal);
          const isPositive = m.invertColor ? delta < 0 : delta > 0;
          const isNeutral = delta === 0;

          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <span className="text-xs text-muted-foreground font-medium">{m.label}</span>

                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="text-lg font-bold">{m.format(m.currentVal)}</p>
                      <p className="text-xs text-muted-foreground">{m.format(m.compVal)}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                      isNeutral
                        ? "bg-muted text-muted-foreground"
                        : isPositive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {isNeutral ? (
                        <Minus className="h-3 w-3" />
                      ) : isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(delta).toFixed(1)}%
                    </div>
                  </div>

                  {/* Mini comparison bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-primary flex-1" style={{ maxWidth: `${Math.min(100, m.compVal > 0 ? (m.currentVal / Math.max(m.currentVal, m.compVal)) * 100 : 100)}%` }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-muted-foreground/30 flex-1" style={{ maxWidth: `${Math.min(100, m.currentVal > 0 ? (m.compVal / Math.max(m.currentVal, m.compVal)) * 100 : 100)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Comparison Bar Chart */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold mb-4">Comparativo por Métrica</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartMetrics}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" />
              <Tooltip
                formatter={(v: number, name: string) => {
                  const label = name === "atual" ? "Período Atual" : "Período Anterior";
                  return [formatNumber(v), label];
                }}
              />
              <Legend
                formatter={(value) => value === "atual" ? "Período Atual" : "Período Anterior"}
              />
              <Bar dataKey="atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="anterior" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-2">* Impressões e Alcance exibidos em milhares (÷1000)</p>
        </CardContent>
      </Card>

      {/* Campaign-level comparison table */}
      {currentData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-4">Comparativo por Campanha</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Campanha</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Invest. Atual</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Invest. Anterior</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Δ</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cliques Atual</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cliques Anterior</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((c, i) => {
                    const comp = compData.find((cd) => cd.campaign_id === c.campaign_id);
                    const compSpend = comp ? Number(comp.spend) : 0;
                    const compClicks = comp ? Number(comp.clicks) : 0;
                    const spendDelta = getDelta(Number(c.spend), compSpend);
                    const clicksDelta = getDelta(Number(c.clicks), compClicks);

                    return (
                      <tr key={c.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                        <td className="py-2 px-2 font-medium max-w-[180px] truncate">{c.campaign_name || "Sem nome"}</td>
                        <td className="text-right py-2 px-2">{formatCurrency(Number(c.spend))}</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(compSpend)}</td>
                        <td className={`text-right py-2 px-2 font-semibold ${spendDelta > 0 ? "text-red-500" : spendDelta < 0 ? "text-green-500" : ""}`}>
                          {spendDelta > 0 ? "+" : ""}{spendDelta.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-2">{formatNumber(Number(c.clicks))}</td>
                        <td className="text-right py-2 px-2 text-muted-foreground">{formatNumber(compClicks)}</td>
                        <td className={`text-right py-2 px-2 font-semibold ${clicksDelta > 0 ? "text-green-500" : clicksDelta < 0 ? "text-red-500" : ""}`}>
                          {clicksDelta > 0 ? "+" : ""}{clicksDelta.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {compData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Sem dados para o período de comparação ({fmtDateBR(compStart)} – {fmtDateBR(compStop)}).
              Sincronize esse período primeiro.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
