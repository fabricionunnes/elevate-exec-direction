import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Target, 
  Zap, 
  Compass, 
  TrendingUp, 
  RefreshCw,
  Trophy,
  AlertTriangle,
  Lightbulb,
  Crown,
  Shield,
  Clock
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CEOScore {
  id: string;
  calculated_at: string;
  total_score: number;
  focus_score: number;
  execution_score: number;
  clarity_score: number;
  consistency_score: number;
  classification: string;
  insights: string[];
  metrics_breakdown: Record<string, any>;
}

const CLASSIFICATIONS = {
  elite: { label: "Elite", color: "bg-yellow-500", icon: Crown, min: 85 },
  forte: { label: "Forte", color: "bg-green-500", icon: Shield, min: 70 },
  ajuste: { label: "Em Ajuste", color: "bg-orange-500", icon: Clock, min: 50 },
  critico: { label: "Crítico", color: "bg-red-500", icon: AlertTriangle, min: 0 }
};

const getClassification = (score: number) => {
  if (score >= 85) return CLASSIFICATIONS.elite;
  if (score >= 70) return CLASSIFICATIONS.forte;
  if (score >= 50) return CLASSIFICATIONS.ajuste;
  return CLASSIFICATIONS.critico;
};

export const CEOScoreCard = () => {
  const navigate = useNavigate();
  const [scores, setScores] = useState<CEOScore[]>([]);
  const [currentScore, setCurrentScore] = useState<CEOScore | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('ceo_scores')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        insights: item.insights || [],
        metrics_breakdown: item.metrics_breakdown as Record<string, any>
      }));
      
      setScores(typedData);
      if (typedData.length > 0) {
        setCurrentScore(typedData[0]);
      }
    } catch (error) {
      console.error('Error fetching scores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateScore = async () => {
    setIsCalculating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        navigate("/onboarding-tasks/login");
        return;
      }

      // Fetch all necessary data
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const last30Days = subDays(new Date(), 30);

      const [tasksResult, decisionsResult, agendaResult, previousScoresResult, boardSessionsResult, simulationsResult] = await Promise.all([
        supabase.from('ceo_tasks').select('*').gte('created_at', last30Days.toISOString()),
        supabase.from('ceo_decisions').select('*').gte('created_at', last30Days.toISOString()),
        supabase.from('ceo_agenda').select('*').gte('start_time', weekStart.toISOString()).lte('start_time', weekEnd.toISOString()),
        supabase.from('ceo_scores').select('total_score').order('calculated_at', { ascending: false }).limit(4),
        supabase.from('ceo_board_sessions').select('*').gte('created_at', last30Days.toISOString()),
        supabase.from('ceo_simulations').select('*').gte('created_at', last30Days.toISOString())
      ]);

      const tasks = tasksResult.data || [];
      const decisions = decisionsResult.data || [];
      const agenda = agendaResult.data || [];
      const previousScores = previousScoresResult.data || [];
      const boardSessions = (boardSessionsResult.data || []) as any[];
      const simulations = (simulationsResult.data || []) as any[];

      // ================== A) FOCO (25%) ==================
      const strategicTasks = tasks.filter(t => t.is_strategic);
      const completedStrategicTasks = strategicTasks.filter(t => t.status === 'completed');
      const nonStrategicTasks = tasks.filter(t => !t.is_strategic);
      
      const strategicEventTypes = ['reuniao_estrategica', 'decisao', 'planejamento'];
      const strategicAgenda = agenda.filter(a => strategicEventTypes.includes(a.event_type));
      const strategicTimePercent = agenda.length > 0 ? (strategicAgenda.length / agenda.length) * 100 : 50;
      
      const focusMetrics = {
        strategicTimePercent: Math.min(strategicTimePercent, 100),
        criticalTasksExecuted: completedStrategicTasks.length,
        distractionsReduced: Math.max(0, 100 - (nonStrategicTasks.length * 5))
      };
      
      const focusScore = Math.round(
        (focusMetrics.strategicTimePercent * 0.4) +
        (Math.min(completedStrategicTasks.length * 10, 100) * 0.3) +
        (focusMetrics.distractionsReduced * 0.3)
      );

      // ================== B) EXECUÇÃO (25%) ==================
      const completedDecisions = decisions.filter(d => d.status === 'concluida');
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const onTimeTasks = completedTasks.filter(t => {
        if (!t.due_date) return true;
        return new Date(t.updated_at) <= new Date(t.due_date);
      });
      
      const avgDecisionTime = decisions.length > 0 
        ? decisions.reduce((acc, d) => {
            if (d.status === 'concluida' && d.decision_date) {
              return acc + differenceInDays(new Date(d.updated_at), new Date(d.decision_date));
            }
            return acc;
          }, 0) / Math.max(completedDecisions.length, 1)
        : 30;
      
      const executionMetrics = {
        decisionsCompletedPercent: decisions.length > 0 ? (completedDecisions.length / decisions.length) * 100 : 50,
        tasksOnTimePercent: completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 50,
        avgDecisionToExecutionDays: avgDecisionTime
      };
      
      const executionScore = Math.round(
        (executionMetrics.decisionsCompletedPercent * 0.4) +
        (executionMetrics.tasksOnTimePercent * 0.4) +
        (Math.max(0, 100 - avgDecisionTime * 2) * 0.2)
      );

      // ================== C) CLAREZA ESTRATÉGICA (25%) ==================
      const decisionsWithHypothesis = decisions.filter(d => d.hypothesis && d.hypothesis.length > 10);
      const decisionsWithKPIs = decisions.filter(d => d.linked_kpis && (d.linked_kpis as string[]).length > 0);
      const reviewedDecisions = decisions.filter(d => d.final_result);
      
      // Include Board Virtual and Simulator usage for strategic clarity
      const completedBoardSessions = boardSessions.filter((s: any) => s.status === 'completed');
      const decisionsWithBoardAnalysis = boardSessions.filter((s: any) => s.ceo_decision);
      const executedSimulations = simulations.filter((s: any) => s.status === 'executed');
      const simulatedDecisions = simulations.filter((s: any) => s.status === 'simulated' || s.status === 'executed');
      
      const clarityMetrics = {
        hypothesisPercent: decisions.length > 0 ? (decisionsWithHypothesis.length / decisions.length) * 100 : 50,
        kpisPercent: decisions.length > 0 ? (decisionsWithKPIs.length / decisions.length) * 100 : 50,
        reviewedPercent: decisions.length > 0 ? (reviewedDecisions.length / decisions.length) * 100 : 50,
        boardUsagePercent: Math.min(completedBoardSessions.length * 20, 100),
        simulatorUsagePercent: Math.min(simulatedDecisions.length * 20, 100)
      };
      
      const clarityScore = Math.round(
        (clarityMetrics.hypothesisPercent * 0.25) +
        (clarityMetrics.kpisPercent * 0.25) +
        (clarityMetrics.reviewedPercent * 0.2) +
        (clarityMetrics.boardUsagePercent * 0.15) +
        (clarityMetrics.simulatorUsagePercent * 0.15)
      );

      // ================== D) CONSISTÊNCIA (25%) ==================
      const weeklyDecisions = decisions.filter(d => new Date(d.created_at) >= weekStart);
      const hasWeeklyRhythm = weeklyDecisions.length >= 2;
      
      const scoreVariance = previousScores.length >= 2 
        ? Math.abs(previousScores[0].total_score - previousScores[previousScores.length - 1].total_score)
        : 0;
      
      const consistencyMetrics = {
        weeklyDecisionRhythm: hasWeeklyRhythm ? 100 : weeklyDecisions.length * 40,
        continuityScore: Math.min(decisions.filter(d => d.status !== 'pendente').length * 10, 100),
        stabilityScore: Math.max(0, 100 - scoreVariance * 2)
      };
      
      const consistencyScore = Math.round(
        (consistencyMetrics.weeklyDecisionRhythm * 0.35) +
        (consistencyMetrics.continuityScore * 0.35) +
        (consistencyMetrics.stabilityScore * 0.3)
      );

      // ================== TOTAL SCORE ==================
      const totalScore = Math.round(
        (focusScore * 0.25) +
        (executionScore * 0.25) +
        (clarityScore * 0.25) +
        (consistencyScore * 0.25)
      );

      // ================== GENERATE INSIGHTS ==================
      const insights: string[] = [];
      
      if (executionScore < focusScore - 15) {
        insights.push("Você está decidindo bem, mas executando pouco. Foco na implementação.");
      }
      if (focusScore > 70 && clarityScore < 50) {
        insights.push("Alto foco, baixa clareza de métricas. Defina KPIs para suas decisões.");
      }
      if (executionScore > 75 && consistencyScore > 75) {
        insights.push("Execução consistente acima da média. Continue o ritmo!");
      }
      if (clarityScore > 80) {
        insights.push("Excelente clareza estratégica. Suas decisões têm base sólida.");
      }
      if (consistencyScore < 50) {
        insights.push("Ritmo inconsistente. Estabeleça uma rotina semanal de decisões.");
      }
      if (focusScore < 50) {
        insights.push("Muitas distrações. Priorize tarefas estratégicas.");
      }
      if (totalScore >= 85) {
        insights.push("Performance de elite! Mantenha este padrão de excelência.");
      }
      if (totalScore < 50 && previousScores.length > 0 && previousScores[0].total_score > totalScore) {
        insights.push("Score em queda. Revise suas prioridades e realinhe o foco.");
      }
      // Board Virtual insights
      if (completedBoardSessions.length === 0) {
        insights.push("Utilize o Board Virtual para decisões estratégicas importantes.");
      } else if (completedBoardSessions.length >= 3) {
        insights.push("Excelente uso do Board Virtual. Decisões mais bem fundamentadas.");
      }
      // Simulator insights
      if (simulatedDecisions.length === 0) {
        insights.push("Simule decisões antes de executá-las para reduzir riscos.");
      } else if (executedSimulations.length >= 2) {
        insights.push("Bom uso do Simulador. Suas decisões têm base analítica.");
      }

      const classification = getClassification(totalScore).label;

      console.log('[CEOScoreCard] Saving score with values:', {
        totalScore,
        focusScore,
        executionScore,
        clarityScore,
        consistencyScore,
        classification,
        insights
      });

      // Save score - ensure all values are integers
      const { data: newScore, error } = await supabase
        .from('ceo_scores')
        .insert({
          total_score: Math.round(totalScore),
          focus_score: Math.round(focusScore),
          execution_score: Math.round(executionScore),
          clarity_score: Math.round(clarityScore),
          consistency_score: Math.round(consistencyScore),
          classification,
          insights,
          metrics_breakdown: {
            focus: focusMetrics,
            execution: executionMetrics,
            clarity: clarityMetrics,
            consistency: consistencyMetrics
          }
        })
        .select()
        .single();

      if (error) {
        console.error('[CEOScoreCard] Error saving score:', error);
        throw error;
      }

      const typedNewScore = {
        ...newScore,
        insights: newScore.insights || [],
        metrics_breakdown: newScore.metrics_breakdown as Record<string, any>
      };

      setCurrentScore(typedNewScore);
      setScores(prev => [typedNewScore, ...prev]);
      toast.success("Score do CEO calculado!");
    } catch (error) {
      console.error('Error calculating score:', error);
      toast.error("Erro ao calcular score");
    } finally {
      setIsCalculating(false);
    }
  };

  const radarData = currentScore ? [
    {
      subject: 'Foco',
      score: currentScore.focus_score,
      fullMark: 100
    },
    {
      subject: 'Execução',
      score: currentScore.execution_score,
      fullMark: 100
    },
    {
      subject: 'Clareza',
      score: currentScore.clarity_score,
      fullMark: 100
    },
    {
      subject: 'Consistência',
      score: currentScore.consistency_score,
      fullMark: 100
    }
  ] : [];

  const historyData = scores.slice(0, 12).reverse().map(s => ({
    date: format(new Date(s.calculated_at), 'dd/MM', { locale: ptBR }),
    score: s.total_score,
    foco: s.focus_score,
    execucao: s.execution_score,
    clareza: s.clarity_score,
    consistencia: s.consistency_score
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const classification = currentScore ? getClassification(currentScore.total_score) : null;
  const ClassificationIcon = classification?.icon || Trophy;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Score do CEO
          </h2>
          <p className="text-muted-foreground">
            Avaliação pessoal de comportamento, execução e foco estratégico
          </p>
        </div>
        <Button onClick={calculateScore} disabled={isCalculating}>
          {isCalculating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Calculando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Calcular Score
            </>
          )}
        </Button>
      </div>

      {currentScore ? (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="pillars">Pilares</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main Score Card */}
              <Card className="md:col-span-1">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center ${classification?.color} text-white`}>
                      <span className="text-4xl font-bold">{currentScore.total_score}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClassificationIcon className="h-5 w-5" />
                      <Badge className={classification?.color}>
                        {classification?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Calculado em {format(new Date(currentScore.calculated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Radar Chart */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Distribuição por Pilar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Score"
                          dataKey="score"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.5}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Pillar Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Foco</span>
                  </div>
                  <div className="text-2xl font-bold">{currentScore.focus_score}</div>
                  <Progress value={currentScore.focus_score} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">Execução</span>
                  </div>
                  <div className="text-2xl font-bold">{currentScore.execution_score}</div>
                  <Progress value={currentScore.execution_score} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Compass className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Clareza</span>
                  </div>
                  <div className="text-2xl font-bold">{currentScore.clarity_score}</div>
                  <Progress value={currentScore.clarity_score} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Consistência</span>
                  </div>
                  <div className="text-2xl font-bold">{currentScore.consistency_score}</div>
                  <Progress value={currentScore.consistency_score} className="mt-2" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pillars Tab */}
          <TabsContent value="pillars" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Foco */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    A) Foco
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{currentScore.focus_score}</span>
                    <Badge variant={currentScore.focus_score >= 70 ? "default" : "secondary"}>
                      {currentScore.focus_score >= 70 ? "Bom" : "A melhorar"}
                    </Badge>
                  </div>
                  <Progress value={currentScore.focus_score} className="h-3" />
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p>• % do tempo em atividades estratégicas</p>
                    <p>• Nº de tarefas críticas executadas</p>
                    <p>• Redução de distrações</p>
                  </div>
                </CardContent>
              </Card>

              {/* Execução */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    B) Execução
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{currentScore.execution_score}</span>
                    <Badge variant={currentScore.execution_score >= 70 ? "default" : "secondary"}>
                      {currentScore.execution_score >= 70 ? "Bom" : "A melhorar"}
                    </Badge>
                  </div>
                  <Progress value={currentScore.execution_score} className="h-3" />
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p>• % de decisões concluídas</p>
                    <p>• % de tarefas no prazo</p>
                    <p>• Tempo médio decisão → execução</p>
                  </div>
                </CardContent>
              </Card>

              {/* Clareza */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Compass className="h-5 w-5 text-green-500" />
                    C) Clareza Estratégica
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{currentScore.clarity_score}</span>
                    <Badge variant={currentScore.clarity_score >= 70 ? "default" : "secondary"}>
                      {currentScore.clarity_score >= 70 ? "Bom" : "A melhorar"}
                    </Badge>
                  </div>
                  <Progress value={currentScore.clarity_score} className="h-3" />
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p>• Decisões com hipótese definida</p>
                    <p>• Decisões com KPIs claros</p>
                    <p>• Revisões realizadas (antes x depois)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Consistência */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    D) Consistência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{currentScore.consistency_score}</span>
                    <Badge variant={currentScore.consistency_score >= 70 ? "default" : "secondary"}>
                      {currentScore.consistency_score >= 70 ? "Bom" : "A melhorar"}
                    </Badge>
                  </div>
                  <Progress value={currentScore.consistency_score} className="h-3" />
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <p>• Ritmo semanal de decisões</p>
                    <p>• Continuidade de acompanhamento</p>
                    <p>• Estabilidade do score ao longo do tempo</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Evolução Histórica</CardTitle>
              </CardHeader>
              <CardContent>
                {historyData.length > 1 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          name="Score Total"
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="foco" 
                          name="Foco"
                          stroke="#3b82f6" 
                          strokeWidth={1}
                          strokeDasharray="5 5"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="execucao" 
                          name="Execução"
                          stroke="#eab308" 
                          strokeWidth={1}
                          strokeDasharray="5 5"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="clareza" 
                          name="Clareza"
                          stroke="#22c55e" 
                          strokeWidth={1}
                          strokeDasharray="5 5"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="consistencia" 
                          name="Consistência"
                          stroke="#a855f7" 
                          strokeWidth={1}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Calcule mais scores para ver a evolução histórica</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History Table */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Cálculos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scores.slice(0, 10).map((score) => {
                    const cls = getClassification(score.total_score);
                    return (
                      <div 
                        key={score.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cls.color} text-white text-sm font-bold`}>
                            {score.total_score}
                          </div>
                          <div>
                            <p className="font-medium">{cls.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(score.calculated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-blue-500">F: {score.focus_score}</span>
                          <span className="text-yellow-500">E: {score.execution_score}</span>
                          <span className="text-green-500">C: {score.clarity_score}</span>
                          <span className="text-purple-500">Co: {score.consistency_score}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Insights Automáticos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentScore.insights && currentScore.insights.length > 0 ? (
                  <div className="space-y-3">
                    {currentScore.insights.map((insight, index) => (
                      <div 
                        key={index}
                        className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg"
                      >
                        <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum insight disponível. Calcule o score para gerar insights.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Classification Legend */}
            <Card>
              <CardHeader>
                <CardTitle>Classificações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(CLASSIFICATIONS).map(([key, cls]) => {
                    const Icon = cls.icon;
                    return (
                      <div key={key} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cls.color} text-white`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{cls.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {cls.min === 85 ? "85-100" : cls.min === 70 ? "70-84" : cls.min === 50 ? "50-69" : "<50"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center space-y-4">
              <Trophy className="h-16 w-16 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-medium">Nenhum score calculado ainda</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Clique em "Calcular Score" para avaliar sua performance como CEO baseado em foco, execução, clareza estratégica e consistência.
              </p>
              <Button onClick={calculateScore} disabled={isCalculating}>
                {isCalculating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Calcular Primeiro Score
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
