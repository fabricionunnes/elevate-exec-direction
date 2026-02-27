import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowRight, BarChart3, Sparkles, Loader2 } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface SalesHistoryEntry {
  id: string;
  month_year: string;
  revenue: number;
  sales_count: number | null;
  is_pre_unv: boolean;
}

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  revenue: number;
  isPreUnv: boolean;
  fill: string;
}

interface SalesComparisonChartProps {
  companyId: string;
  projectId?: string;
  contractStartDate?: string | null;
  currentMonthRevenue?: number;
  refreshKey?: number;
  companyName?: string;
  showAIAnalysis?: boolean;
}

export const SalesComparisonChart = ({ 
  companyId,
  projectId,
  contractStartDate, 
  currentMonthRevenue = 0,
  refreshKey = 0,
  companyName = "",
  showAIAnalysis = true
}: SalesComparisonChartProps) => {
  const [historyData, setHistoryData] = useState<SalesHistoryEntry[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId, currentMonthRevenue, refreshKey]);

  const fetchData = async () => {
    try {
      const { data: history, error } = await supabase
        .from("company_sales_history")
        .select("*")
        .eq("company_id", companyId)
        .order("month_year", { ascending: true });

      if (error) throw error;
      setHistoryData(history || []);

      const data: ChartDataPoint[] = (history || []).map((entry) => ({
        month: entry.month_year,
        monthLabel: format(parseISO(entry.month_year), "MMM/yy", { locale: ptBR }),
        revenue: entry.revenue,
        isPreUnv: entry.is_pre_unv,
        fill: entry.is_pre_unv ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))",
      }));

      if (currentMonthRevenue > 0) {
        const currentMonth = startOfMonth(new Date());
        const currentMonthStr = format(currentMonth, "yyyy-MM-dd");
        const hasCurrentMonth = data.some((d) => d.month === currentMonthStr);
        if (!hasCurrentMonth) {
          data.push({
            month: currentMonthStr,
            monthLabel: format(currentMonth, "MMM/yy", { locale: ptBR }),
            revenue: currentMonthRevenue,
            isPreUnv: false,
            fill: "hsl(var(--primary))",
          });
        }
      }

      data.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
      setChartData(data);
      setAiAnalysis(null);
      setAnalysisGenerated(false);
    } catch (error) {
      console.error("Error fetching sales comparison data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const formatFullCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const preUnvData = chartData.filter((d) => d.isPreUnv);
  const postUnvData = chartData.filter((d) => !d.isPreUnv);

  const preUnvAvg = preUnvData.length > 0
    ? preUnvData.reduce((sum, d) => sum + d.revenue, 0) / preUnvData.length
    : 0;
  const postUnvAvg = postUnvData.length > 0
    ? postUnvData.reduce((sum, d) => sum + d.revenue, 0) / postUnvData.length
    : 0;
  const growthPercent = preUnvAvg > 0 ? ((postUnvAvg - preUnvAvg) / preUnvAvg) * 100 : 0;
  const hasGrowth = growthPercent > 0;

  const generateAIAnalysis = async () => {
    if (!hasGrowth || postUnvData.length < 1 || preUnvData.length < 1) return;
    if (!projectId) {
      setAiAnalysis("Para gerar uma análise conectando tarefas e reuniões ao resultado, preciso do projectId deste acompanhamento.");
      setAnalysisGenerated(true);
      return;
    }

    setAiLoading(true);
    try {
      const prompt = `Você vai explicar *por que* o faturamento aumentou, conectando evidências do que foi feito (tarefas) e do que foi discutido (reuniões) com o resultado.

CONTEXTO DO RESULTADO (ANTES vs DEPOIS da UNV):
- Média antes: ${formatFullCurrency(preUnvAvg)} (${preUnvData.length} meses)
- Média depois: ${formatFullCurrency(postUnvAvg)} (${postUnvData.length} meses)
- Crescimento: ${growthPercent.toFixed(1)}%
- Diferença média: ${formatFullCurrency(postUnvAvg - preUnvAvg)} / mês

INSTRUÇÕES (importante):
1) Analise as TAREFAS CONCLUÍDAS e as NOTAS/TRANSCRIÇÕES das REUNIÕES do projeto.
2) Aponte quais pontos do que foi falado (decisões, direcionamentos, correções de rota) e/ou executado nas tarefas *fazem sentido* como causa do aumento.
3) Cite evidências de forma objetiva (ex.: nome da tarefa, trecho/tema de reunião) e descreva o mecanismo (ex.: melhoria de conversão, aumento de volume, aumento de ticket, melhoria de follow-up).
4) Se não houver evidência suficiente, diga explicitamente o que está faltando (ex.: reuniões sem notas, tarefas sem descrição/observações) e como registrar melhor.

FORMATO:
- 3 a 6 bullets com "Evidência → Por que impacta o resultado".
- Feche com uma conclusão de 1 parágrafo com a hipótese mais provável.

Empresa: "${companyName || 'cliente'}".`;

      const { data, error } = await supabase.functions.invoke("onboarding-ai-chat", {
        body: { projectId, companyId, message: prompt, history: [] },
      });

      if (error) throw error;
      setAiAnalysis(data?.response || data?.message || data?.content || "Análise não disponível.");
      setAnalysisGenerated(true);
    } catch (error) {
      console.error("Error generating AI analysis:", error);
      setAiAnalysis("Não foi possível gerar a análise no momento.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (showAIAnalysis && hasGrowth && preUnvData.length > 0 && postUnvData.length > 0 && !analysisGenerated && !aiLoading) {
      generateAIAnalysis();
    }
  }, [showAIAnalysis, hasGrowth, preUnvData.length, postUnvData.length, analysisGenerated]);

  if (loading || chartData.length === 0) return null;

  // Build separated data for dual areas
  const areaData = chartData.map((d) => ({
    ...d,
    pre: d.isPreUnv ? d.revenue : null,
    post: !d.isPreUnv ? d.revenue : null,
  }));

  // Find the transition point index
  const transitionIdx = chartData.findIndex((d) => !d.isPreUnv);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      const isPre = data.isPreUnv;
      return (
        <div className="rounded-xl border bg-popover/95 backdrop-blur-md shadow-xl p-3.5 min-w-[160px]">
          <p className="text-xs text-muted-foreground font-medium mb-1">{data.monthLabel}</p>
          <p className="text-xl font-extrabold tracking-tight">{formatFullCurrency(data.revenue)}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`h-2 w-2 rounded-full ${isPre ? "bg-amber-500" : "bg-emerald-500"}`} />
            <span className="text-[11px] text-muted-foreground">
              {isPre ? "Antes da UNV" : "Com a UNV"}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/[0.03] via-transparent to-emerald-900/[0.04] dark:from-slate-800/20 dark:via-transparent dark:to-emerald-900/15" />
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-radial from-emerald-500/[0.07] to-transparent rounded-full blur-3xl" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-radial from-amber-500/[0.06] to-transparent rounded-full blur-3xl" />

      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Comparativo de Vendas</CardTitle>
              <p className="text-xs text-muted-foreground">Antes vs Depois da UNV</p>
            </div>
          </div>
          {preUnvData.length > 0 && postUnvData.length > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge
                variant="outline"
                className={`gap-1.5 px-3 py-1 text-sm font-bold border-0 shadow-sm ${
                  hasGrowth
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                }`}
              >
                {hasGrowth ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {hasGrowth ? "+" : ""}{growthPercent.toFixed(1)}%
              </Badge>
            </motion.div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="relative overflow-hidden rounded-xl border p-3 sm:p-4 bg-card/80 backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight mb-1">
                Média Antes
              </p>
              <p className="text-sm sm:text-lg font-bold truncate">
                {preUnvData.length > 0 ? formatFullCurrency(preUnvAvg) : "—"}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {preUnvData.length} mês{preUnvData.length !== 1 ? "es" : ""}
              </p>
            </div>
          </motion.div>

          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="relative flex flex-col items-center justify-center rounded-xl border p-3 sm:p-4 bg-card/80 backdrop-blur-sm h-full">
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground mb-1" />
              {preUnvData.length > 0 && postUnvData.length > 0 && (
                <p className={`text-xs sm:text-sm font-bold ${hasGrowth ? "text-emerald-600" : "text-red-600"}`}>
                  {hasGrowth ? "+" : ""}{formatFullCurrency(postUnvAvg - preUnvAvg)}
                </p>
              )}
              <p className="text-[9px] text-muted-foreground mt-0.5">por mês</p>
            </div>
          </motion.div>

          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="relative overflow-hidden rounded-xl border p-3 sm:p-4 bg-card/80 backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight mb-1">
                Média Depois
              </p>
              <p className="text-sm sm:text-lg font-bold truncate text-emerald-700 dark:text-emerald-400">
                {postUnvData.length > 0 ? formatFullCurrency(postUnvAvg) : "—"}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {postUnvData.length} mês{postUnvData.length !== 1 ? "es" : ""}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="h-[280px] sm:h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPre" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
                <filter id="glowPost">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />

              {preUnvAvg > 0 && (
                <ReferenceLine
                  y={preUnvAvg}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="6 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Média Antes: ${formatCurrency(preUnvAvg)}`,
                    position: "insideTopRight",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="pre"
                stroke="hsl(38, 92%, 50%)"
                strokeWidth={2.5}
                fill="url(#gradPre)"
                dot={{ r: 4, fill: "hsl(38, 92%, 50%)", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "hsl(38, 92%, 50%)", strokeWidth: 2, fill: "#fff" }}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="post"
                stroke="hsl(160, 84%, 39%)"
                strokeWidth={3}
                fill="url(#gradPost)"
                filter="url(#glowPost)"
                dot={{ r: 4, fill: "hsl(160, 84%, 39%)", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "hsl(160, 84%, 39%)", strokeWidth: 2, fill: "#fff" }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-sm shadow-amber-400/30" />
            <span className="text-xs text-muted-foreground">Antes da UNV</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 shadow-sm shadow-emerald-400/30" />
            <span className="text-xs text-muted-foreground">Com a UNV</span>
          </div>
        </div>

        {/* AI Analysis */}
        {showAIAnalysis && hasGrowth && preUnvData.length > 0 && postUnvData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/5 via-primary/10 to-violet-500/5 p-4">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-violet-500 to-primary" />
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/15">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-primary">Análise do Crescimento</p>
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando dados...
                    </div>
                  ) : aiAnalysis ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {aiAnalysis}
                    </p>
                  ) : (
                    <Button variant="outline" size="sm" onClick={generateAIAnalysis} className="gap-2">
                      <Sparkles className="h-3 w-3" />
                      Gerar Análise
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
