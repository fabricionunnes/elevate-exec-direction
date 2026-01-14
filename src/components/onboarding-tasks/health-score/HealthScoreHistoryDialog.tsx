import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Building2,
  AlertTriangle,
  Target,
  Calendar,
  FileWarning,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lightbulb,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import ReactMarkdown from "react-markdown";

interface HealthScoreHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectIds?: string[];
}

interface HealthEvent {
  id: string;
  project_id: string;
  event_type: string;
  event_data: any;
  score_before: number | null;
  score_after: number | null;
  created_at: string;
  project?: {
    product_name: string;
    onboarding_company?: {
      name: string;
    } | null;
  };
}

interface ProjectHealth {
  project_id: string;
  total_score: number;
  risk_level: string | null;
  trend_direction: string | null;
  satisfaction_score: number | null;
  goals_score: number | null;
  engagement_score: number | null;
  support_score: number | null;
  updated_at: string;
  project?: {
    product_name: string;
    onboarding_company?: {
      name: string;
    } | null;
  };
}

interface DailySnapshot {
  date: string;
  avgScore: number;
  count: number;
}

interface ImpactSummary {
  type: string;
  label: string;
  totalImpact: number;
  count: number;
  isPositive: boolean;
}

interface DetailedFactor {
  key: string;
  label: string;
  value: number;
  companyName: string;
  projectId: string;
  isPositive: boolean;
  createdAt: string;
}

export const HealthScoreHistoryDialog = ({
  open,
  onOpenChange,
  projectIds,
}: HealthScoreHistoryDialogProps) => {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [projectHealths, setProjectHealths] = useState<ProjectHealth[]>([]);
  const [dailyData, setDailyData] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, projectIds]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent health events with project info
      let eventsQuery = supabase
        .from("health_score_events")
        .select(`
          id,
          project_id,
          event_type,
          event_data,
          score_before,
          score_after,
          created_at,
          project:onboarding_projects(
            product_name,
            onboarding_company:onboarding_companies(name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (projectIds && projectIds.length > 0) {
        eventsQuery = eventsQuery.in("project_id", projectIds);
      }

      const { data: eventsData } = await eventsQuery;
      setEvents((eventsData || []) as unknown as HealthEvent[]);

      // Fetch current health scores for all projects
      let healthQuery = supabase
        .from("client_health_scores")
        .select(`
          project_id,
          total_score,
          risk_level,
          trend_direction,
          satisfaction_score,
          goals_score,
          engagement_score,
          support_score,
          updated_at,
          project:onboarding_projects(
            product_name,
            status,
            onboarding_company:onboarding_companies(name)
          )
        `)
        .order("total_score", { ascending: true });

      if (projectIds && projectIds.length > 0) {
        healthQuery = healthQuery.in("project_id", projectIds);
      }

      const { data: healthData } = await healthQuery;
      const activeHealths = (healthData || []).filter(
        (h: any) => h.project?.status === "active"
      );
      setProjectHealths(activeHealths as unknown as ProjectHealth[]);

      // Fetch snapshots for chart
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];
      let snapshotsQuery = supabase
        .from("health_score_snapshots")
        .select("snapshot_date, total_score")
        .gte("snapshot_date", thirtyDaysAgo)
        .order("snapshot_date", { ascending: true });

      if (projectIds && projectIds.length > 0) {
        snapshotsQuery = snapshotsQuery.in("project_id", projectIds);
      }

      const { data: snapshotsData } = await snapshotsQuery;

      const byDate = new Map<string, { total: number; count: number }>();
      (snapshotsData || []).forEach((s) => {
        const existing = byDate.get(s.snapshot_date) || { total: 0, count: 0 };
        byDate.set(s.snapshot_date, {
          total: existing.total + (s.total_score || 0),
          count: existing.count + 1,
        });
      });

      const chartData: DailySnapshot[] = [];
      byDate.forEach((value, date) => {
        chartData.push({
          date: format(parseISO(date), "dd/MM", { locale: ptBR }),
          avgScore: Math.round(value.total / value.count),
          count: value.count,
        });
      });

      setDailyData(chartData);
    } catch (error) {
      console.error("Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get factor label
  const getFactorLabel = (key: string, type: 'penalty' | 'bonus'): string => {
    const labels: Record<string, string> = {
      // Penalties
      overdue_tasks: "Tarefas Atrasadas",
      no_goal: "Sem Meta Lançada",
      no_kpi_entries: "Sem Lançamentos de KPI",
      inactivity: "Inatividade",
      cancellation: "Sinalização de Cancelamento",
      // Bonuses
      completed_tasks: "Tarefas Concluídas",
      meetings: "Reuniões Realizadas",
      projection: "Projeção de Meta Alcançada",
      renewal: "Renovação Confirmada",
    };
    return labels[key] || key;
  };

  // Extract detailed factors from event_data.details
  const detailedFactors = useMemo(() => {
    const allFactors: DetailedFactor[] = [];

    events.forEach((event) => {
      const eventData = typeof event.event_data === "string"
        ? (() => {
            try {
              return JSON.parse(event.event_data);
            } catch {
              return null;
            }
          })()
        : event.event_data;

      const details = eventData?.details;
      if (!details) return;

      const companyName = event.project?.onboarding_company?.name || event.project?.product_name || "Projeto";

      // Extract penalties (negative factors)
      if (details.penalties) {
        Object.entries(details.penalties).forEach(([key, value]) => {
          const numValue = Number(value);
          if (numValue > 0) {
            allFactors.push({
              key,
              label: getFactorLabel(key, 'penalty'),
              value: -numValue,
              companyName,
              projectId: event.project_id,
              isPositive: false,
              createdAt: event.created_at,
            });
          }
        });
      }

      // Extract bonuses (positive factors)
      if (details.bonuses) {
        Object.entries(details.bonuses).forEach(([key, value]) => {
          const numValue = Number(value);
          if (numValue > 0) {
            allFactors.push({
              key,
              label: getFactorLabel(key, 'bonus'),
              value: numValue,
              companyName,
              projectId: event.project_id,
              isPositive: true,
              createdAt: event.created_at,
            });
          }
        });
      }
    });

    return allFactors;
  }, [events]);

  // Aggregate factors by type for summary view
  const impactSummary = useMemo(() => {
    const impactByKey = new Map<string, { total: number; count: number; isPositive: boolean; label: string }>();

    detailedFactors.forEach((factor) => {
      const existing = impactByKey.get(factor.key) || { total: 0, count: 0, isPositive: factor.isPositive, label: factor.label };
      impactByKey.set(factor.key, {
        total: existing.total + Math.abs(factor.value),
        count: existing.count + 1,
        isPositive: factor.isPositive,
        label: factor.label,
      });
    });

    const summary: ImpactSummary[] = [];
    impactByKey.forEach((value, key) => {
      summary.push({
        type: key,
        label: value.label,
        totalImpact: value.isPositive ? value.total : -value.total,
        count: value.count,
        isPositive: value.isPositive,
      });
    });

    return summary.sort((a, b) => Math.abs(b.totalImpact) - Math.abs(a.totalImpact));
  }, [detailedFactors]);

  // Get unique companies with negative factors for display
  const negativeFactorsByCompany = useMemo(() => {
    const byCompany = new Map<string, DetailedFactor[]>();
    
    detailedFactors
      .filter(f => !f.isPositive)
      .forEach(factor => {
        const existing = byCompany.get(factor.companyName) || [];
        // Avoid duplicates for same factor type per company
        if (!existing.some(e => e.key === factor.key)) {
          existing.push(factor);
          byCompany.set(factor.companyName, existing);
        }
      });

    return Array.from(byCompany.entries())
      .map(([company, factors]) => ({
        company,
        factors,
        totalImpact: factors.reduce((sum, f) => sum + f.value, 0)
      }))
      .sort((a, b) => a.totalImpact - b.totalImpact)
      .slice(0, 10);
  }, [detailedFactors]);

  // Get unique companies with positive factors for display
  const positiveFactorsByCompany = useMemo(() => {
    const byCompany = new Map<string, DetailedFactor[]>();
    
    detailedFactors
      .filter(f => f.isPositive)
      .forEach(factor => {
        const existing = byCompany.get(factor.companyName) || [];
        // Avoid duplicates for same factor type per company
        if (!existing.some(e => e.key === factor.key)) {
          existing.push(factor);
          byCompany.set(factor.companyName, existing);
        }
      });

    return Array.from(byCompany.entries())
      .map(([company, factors]) => ({
        company,
        factors,
        totalImpact: factors.reduce((sum, f) => sum + f.value, 0)
      }))
      .sort((a, b) => b.totalImpact - a.totalImpact)
      .slice(0, 10);
  }, [detailedFactors]);

  const positiveFactors = useMemo(() => 
    impactSummary.filter((s) => s.isPositive).slice(0, 5),
    [impactSummary]
  );

  const negativeFactors = useMemo(() => 
    impactSummary.filter((s) => !s.isPositive).slice(0, 5),
    [impactSummary]
  );

  // Pillar averages for insights
  const pillarAverages = useMemo(() => {
    if (projectHealths.length === 0) return null;

    const totals = {
      satisfaction: 0,
      goals: 0,
      engagement: 0,
      support: 0,
      count: 0,
    };

    projectHealths.forEach((p) => {
      totals.satisfaction += p.satisfaction_score || 0;
      totals.goals += p.goals_score || 0;
      totals.engagement += p.engagement_score || 0;
      totals.support += p.support_score || 0;
      totals.count++;
    });

    return {
      satisfaction: Math.round(totals.satisfaction / totals.count),
      goals: Math.round(totals.goals / totals.count),
      engagement: Math.round(totals.engagement / totals.count),
      support: Math.round(totals.support / totals.count),
    };
  }, [projectHealths]);

  const generateAIInsights = async () => {
    setLoadingInsights(true);
    setAiInsights("");

    try {
      const context = {
        totalProjects: projectHealths.length,
        criticalCount: projectHealths.filter((p) => p.risk_level === "critical").length,
        highRiskCount: projectHealths.filter((p) => p.risk_level === "high").length,
        mediumRiskCount: projectHealths.filter((p) => p.risk_level === "medium").length,
        lowRiskCount: projectHealths.filter((p) => p.risk_level === "low" || p.risk_level === "excellent").length,
        averageScore: projectHealths.length > 0 
          ? Math.round(projectHealths.reduce((acc, p) => acc + p.total_score, 0) / projectHealths.length) 
          : 0,
        pillarAverages,
        positiveFactors: positiveFactors.map((f) => ({ label: f.label, impact: f.totalImpact, count: f.count })),
        negativeFactors: negativeFactors.map((f) => ({ label: f.label, impact: f.totalImpact, count: f.count })),
        negativeByCompany: negativeFactorsByCompany.slice(0, 10).map(({ company, factors, totalImpact }) => ({
          company,
          impact: totalImpact,
          factors: factors.map(f => f.label)
        })),
        positiveByCompany: positiveFactorsByCompany.slice(0, 5).map(({ company, factors, totalImpact }) => ({
          company,
          impact: totalImpact,
          factors: factors.map(f => f.label)
        })),
        criticalProjects: projectHealths
          .filter((p) => p.risk_level === "critical" || p.risk_level === "high")
          .slice(0, 10)
          .map((p) => ({
            name: getCompanyName(p),
            score: p.total_score,
            goals: p.goals_score,
            engagement: p.engagement_score,
            satisfaction: p.satisfaction_score,
          })),
      };

      const systemPrompt = `Você é um especialista em Customer Success. Analise os dados de saúde da carteira de clientes e forneça insights acionáveis.

CONTEXTO:
- Os dados mostram penalidades e bônus que afetam o health score
- Cada empresa pode ter múltiplos fatores impactando positiva ou negativamente
- O objetivo é melhorar a saúde geral da carteira

FORMATO DA RESPOSTA:
## 📊 Diagnóstico Geral
[Breve análise da situação atual da carteira - 2-3 frases]

## 🔴 Principais Problemas
[Liste os 3-4 principais problemas identificados com base nos fatores negativos, incluindo quais empresas são as mais críticas]

## ✅ Ações Recomendadas
[Liste 4-5 ações específicas e práticas para melhorar a saúde da carteira, mencionando empresas específicas quando relevante]

## 💡 Quick Wins
[2-3 ações rápidas que podem ser implementadas imediatamente para melhorar o score]

Seja direto, prático e focado em ações concretas. Mencione empresas específicas quando apropriado.`;

      const userPrompt = `Analise os seguintes dados de saúde da carteira:

RESUMO GERAL:
- Total de projetos: ${context.totalProjects}
- Críticos: ${context.criticalCount}
- Alto risco: ${context.highRiskCount}
- Médio risco: ${context.mediumRiskCount}
- Baixo risco/Excelente: ${context.lowRiskCount}
- Score médio: ${context.averageScore}

MÉDIAS POR PILAR:
${pillarAverages ? `- Satisfação: ${pillarAverages.satisfaction}\n- Metas: ${pillarAverages.goals}\n- Engajamento: ${pillarAverages.engagement}\n- Suporte: ${pillarAverages.support}` : "N/A"}

FATORES NEGATIVOS (o que está diminuindo a saúde):
${context.negativeFactors.length > 0 ? context.negativeFactors.map(f => `- ${f.label}: ${f.impact} pts (${f.count} ocorrências)`).join("\n") : "Nenhum fator negativo identificado"}

EMPRESAS COM MAIOR IMPACTO NEGATIVO:
${context.negativeByCompany.length > 0 ? context.negativeByCompany.map(c => `- ${c.company}: ${c.impact} pts (${c.factors.join(", ")})`).join("\n") : "Nenhuma"}

FATORES POSITIVOS (o que está aumentando a saúde):
${context.positiveFactors.length > 0 ? context.positiveFactors.map(f => `- ${f.label}: +${f.impact} pts (${f.count} ocorrências)`).join("\n") : "Nenhum fator positivo identificado"}

PROJETOS CRÍTICOS (top 10):
${context.criticalProjects.length > 0 ? context.criticalProjects.map(p => `- ${p.name}: Score ${p.score} (Metas: ${p.goals}, Eng: ${p.engagement}, Sat: ${p.satisfaction})`).join("\n") : "Nenhum projeto crítico"}

Forneça insights práticos para melhorar a saúde geral dos clientes.`;

      const response = await supabase.functions.invoke("health-portfolio-insights", {
        body: {
          systemPrompt,
          userPrompt,
        },
      });

      if (response.error) throw response.error;

      // The function returns JSON (no streaming)
      const text =
        (response.data && typeof response.data === "object" && "text" in response.data
          ? (response.data as any).text
          : response.data) as string | undefined;

      if (text && typeof text === "string" && text.trim().length > 0) {
        setAiInsights(text);
      } else {
        setAiInsights("Não foi possível gerar insights. Tente novamente.");
      }
    } catch (error) {
      console.error("Error generating insights:", error);
      setAiInsights("Erro ao gerar insights. Tente novamente.");
    } finally {
      setLoadingInsights(false);
    }
  };

  const getRiskBadge = (riskLevel: string | null) => {
    switch (riskLevel) {
      case "critical":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Crítico</Badge>;
      case "high":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">Alto</Badge>;
      case "medium":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Médio</Badge>;
      case "low":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Baixo</Badge>;
      case "excellent":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">Excelente</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">—</Badge>;
    }
  };

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "falling":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "goal_projection":
        return <Target className="h-4 w-4 text-teal-500" />;
      case "task_overdue":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "task_completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "meeting_completed":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "nps_received":
        return <HeartPulse className="h-4 w-4 text-purple-500" />;
      case "renewal_confirmed":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "cancellation_signaled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "no_goals":
        return <FileWarning className="h-4 w-4 text-amber-500" />;
      default:
        return <HeartPulse className="h-4 w-4 text-gray-500" />;
    }
  };

  function getEventLabel(eventType: string) {
    switch (eventType) {
      case "goal_projection":
        return "Projeção de Meta";
      case "task_overdue":
        return "Tarefas Atrasadas";
      case "task_completed":
        return "Tarefas Concluídas";
      case "meeting_completed":
        return "Reuniões Realizadas";
      case "nps_received":
        return "NPS Recebido";
      case "renewal_confirmed":
        return "Renovação Confirmada";
      case "cancellation_signaled":
        return "Cancelamento Sinalizado";
      case "no_goals":
        return "Sem Metas";
      case "inactivity":
        return "Inatividade";
      case "recalculation":
        return "Recálculo";
      default:
        return eventType;
    }
  }

  const getCompanyName = (item: HealthEvent | ProjectHealth) => {
    return item.project?.onboarding_company?.name || item.project?.product_name || "Projeto";
  };

  const criticalProjects = projectHealths.filter(
    (p) => p.risk_level === "critical" || p.risk_level === "high"
  );

  const impactChartData = useMemo(() => {
    return impactSummary.slice(0, 8).map((item) => ({
      name: item.label.length > 15 ? item.label.substring(0, 15) + "..." : item.label,
      impacto: item.totalImpact,
      fill: item.isPositive ? "#22c55e" : "#ef4444",
    }));
  }, [impactSummary]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-red-500" />
            Histórico de Saúde - Visão Geral
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="resumo" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Resumo
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5">
                <Sparkles className="h-4 w-4" />
                Insights IA
              </TabsTrigger>
              <TabsTrigger value="detalhes" className="gap-1.5">
                <Building2 className="h-4 w-4" />
                Detalhes
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[calc(90vh-200px)]">
                <TabsContent value="resumo" className="mt-0 space-y-4 pr-4">
                  {/* Impact Summary Cards */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Positive Factors */}
                    <Card className="border-green-200 bg-green-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                          <ArrowUpCircle className="h-4 w-4" />
                          O que fez a saúde SUBIR
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {positiveFactors.length === 0 && positiveFactorsByCompany.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum fator positivo registrado</p>
                        ) : (
                          <>
                            {/* Summary by factor type */}
                            {positiveFactors.length > 0 && (
                              <div className="space-y-2">
                                {positiveFactors.map((factor) => (
                                  <div key={factor.type} className="flex items-center justify-between bg-white rounded-lg p-2 border border-green-100">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      <span className="text-sm">{factor.label}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-green-600 font-bold">+{factor.totalImpact} pts</span>
                                      <span className="text-xs text-muted-foreground ml-2">({factor.count}x)</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Companies contributing positively */}
                            {positiveFactorsByCompany.length > 0 && (
                              <div className="pt-2 border-t border-green-100">
                                <p className="text-xs text-muted-foreground mb-2">Empresas que contribuíram:</p>
                                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                                  {positiveFactorsByCompany.slice(0, 5).map(({ company, factors, totalImpact }) => (
                                    <div key={company} className="bg-white rounded p-2 border border-green-100 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-foreground">{company}</span>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                          +{totalImpact} pts
                                        </Badge>
                                      </div>
                                      <div className="mt-1 text-muted-foreground">
                                        {factors.map(f => f.label).join(", ")}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Negative Factors */}
                    <Card className="border-red-200 bg-red-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                          <ArrowDownCircle className="h-4 w-4" />
                          O que fez a saúde DESCER
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {negativeFactors.length === 0 && negativeFactorsByCompany.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum fator negativo registrado</p>
                        ) : (
                          <>
                            {/* Summary by factor type */}
                            {negativeFactors.length > 0 && (
                              <div className="space-y-2">
                                {negativeFactors.map((factor) => (
                                  <div key={factor.type} className="flex items-center justify-between bg-white rounded-lg p-2 border border-red-100">
                                    <div className="flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-red-500" />
                                      <span className="text-sm">{factor.label}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-red-600 font-bold">{factor.totalImpact} pts</span>
                                      <span className="text-xs text-muted-foreground ml-2">({factor.count}x)</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Companies contributing negatively */}
                            {negativeFactorsByCompany.length > 0 && (
                              <div className="pt-2 border-t border-red-100">
                                <p className="text-xs text-muted-foreground mb-2">Empresas impactando negativamente:</p>
                                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                                  {negativeFactorsByCompany.slice(0, 5).map(({ company, factors, totalImpact }) => (
                                    <div key={company} className="bg-white rounded p-2 border border-red-100 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-foreground">{company}</span>
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                                          {totalImpact} pts
                                        </Badge>
                                      </div>
                                      <div className="mt-1 text-muted-foreground">
                                        {factors.map(f => f.label).join(", ")}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Impact Chart */}
                  {impactChartData.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Impacto por Tipo de Evento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={impactChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                              <Tooltip formatter={(value: number) => [`${value} pts`, "Impacto"]} />
                              <Bar dataKey="impacto" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Evolution Chart */}
                  {dailyData.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Evolução da Saúde Média (30 dias)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[150px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
                              <Tooltip formatter={(value: number) => [`${value} pts`, "Média"]} />
                              <Line type="monotone" dataKey="avgScore" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pillar Averages */}
                  {pillarAverages && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Média por Pilar</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: "Satisfação", value: pillarAverages.satisfaction, icon: HeartPulse },
                            { label: "Metas", value: pillarAverages.goals, icon: Target },
                            { label: "Engajamento", value: pillarAverages.engagement, icon: Calendar },
                            { label: "Suporte", value: pillarAverages.support, icon: CheckCircle2 },
                          ].map((pillar) => (
                            <div key={pillar.label} className="text-center">
                              <pillar.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                              <p className={cn("text-2xl font-bold", getScoreColor(pillar.value))}>{pillar.value}</p>
                              <p className="text-xs text-muted-foreground">{pillar.label}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="mt-0 space-y-4 pr-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Insights e Recomendações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!aiInsights && !loadingInsights && (
                        <div className="text-center py-8">
                          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground mb-4">
                            Gere insights personalizados com base nos dados de saúde da sua carteira
                          </p>
                          <Button onClick={generateAIInsights} className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Gerar Insights com IA
                          </Button>
                        </div>
                      )}

                      {loadingInsights && (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary mr-2" />
                          <span>Analisando dados...</span>
                        </div>
                      )}

                      {aiInsights && (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{aiInsights}</ReactMarkdown>
                        </div>
                      )}

                      {aiInsights && !loadingInsights && (
                        <div className="mt-4 pt-4 border-t">
                          <Button variant="outline" size="sm" onClick={generateAIInsights} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Gerar Novamente
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="detalhes" className="mt-0 space-y-4 pr-4">
                  {/* Critical Projects */}
                  {criticalProjects.length > 0 && (
                    <Card className="border-red-200 bg-red-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                          <AlertTriangle className="h-4 w-4" />
                          Empresas em Risco ({criticalProjects.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {criticalProjects.slice(0, 10).map((project) => (
                            <div key={project.project_id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                              <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{getCompanyName(project)}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Metas: {project.goals_score ?? "—"} | Satisfação: {project.satisfaction_score ?? "—"}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getTrendIcon(project.trend_direction)}
                                <span className={cn("text-lg font-bold", getScoreColor(project.total_score))}>{project.total_score}</span>
                                {getRiskBadge(project.risk_level)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* All Projects Ranking */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Ranking de Saúde
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {projectHealths.slice(0, 20).map((project, idx) => (
                          <div key={project.project_id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                              <span className="text-sm">{getCompanyName(project)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getTrendIcon(project.trend_direction)}
                              <span className={cn("font-bold", getScoreColor(project.total_score))}>{project.total_score}</span>
                              {getRiskBadge(project.risk_level)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
