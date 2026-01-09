import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHealthScore, getRiskLevelInfo, getTrendInfo } from "@/hooks/useHealthScore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  MessageSquare,
  BarChart3,
  Settings,
  AlertTriangle,
  Target,
  Users,
  Headphones,
  Activity,
  Calendar,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { HealthScoreAIInsights } from "./HealthScoreAIInsights";

interface HealthScoreDetailPanelProps {
  projectId: string;
  isAdmin?: boolean;
}

interface Observation {
  id: string;
  observation: string;
  observation_type: string;
  created_at: string;
  staff?: { name: string } | null;
}

export const HealthScoreDetailPanel = ({ projectId, isAdmin = false }: HealthScoreDetailPanelProps) => {
  const { score, weights, snapshots, loading, calculating, calculateScore, updateWeights } = useHealthScore(projectId);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [newObservation, setNewObservation] = useState("");
  const [savingObs, setSavingObs] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [localWeights, setLocalWeights] = useState(weights);
  const [savingWeights, setSavingWeights] = useState(false);

  const riskInfo = score ? getRiskLevelInfo(score.risk_level) : null;
  const trendInfo = score ? getTrendInfo(score.trend_direction) : null;

  // Fetch observations
  useState(() => {
    const fetchObservations = async () => {
      const { data } = await supabase
        .from("health_score_observations")
        .select("*, staff:onboarding_staff(name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      setObservations(data || []);
    };
    fetchObservations();
  });

  const handleSaveObservation = async () => {
    if (!newObservation.trim()) return;
    setSavingObs(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let staffId = null;
      if (user) {
        const { data: staff } = await supabase
          .from("onboarding_staff")
          .select("id")
          .eq("user_id", user.id)
          .single();
        staffId = staff?.id;
      }

      await supabase.from("health_score_observations").insert({
        project_id: projectId,
        staff_id: staffId,
        observation: newObservation,
        observation_type: "general",
      });

      setNewObservation("");
      toast.success("Observação salva!");
      
      // Refresh observations
      const { data } = await supabase
        .from("health_score_observations")
        .select("*, staff:onboarding_staff(name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      setObservations(data || []);
    } catch (error) {
      toast.error("Erro ao salvar observação");
    } finally {
      setSavingObs(false);
    }
  };

  const handleSaveWeights = async () => {
    setSavingWeights(true);
    try {
      await updateWeights(localWeights);
      toast.success("Pesos atualizados!");
    } catch (error) {
      toast.error("Erro ao salvar pesos");
    } finally {
      setSavingWeights(false);
    }
  };

  const TrendIcon = () => {
    if (!trendInfo) return null;
    switch (trendInfo.icon) {
      case "TrendingUp":
        return <TrendingUp className={cn("h-5 w-5", trendInfo.color)} />;
      case "TrendingDown":
        return <TrendingDown className={cn("h-5 w-5", trendInfo.color)} />;
      default:
        return <Minus className={cn("h-5 w-5", trendInfo.color)} />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const pillarData = score ? [
    { name: "Satisfação", value: score.satisfaction_score, fullMark: 100 },
    { name: "Metas", value: score.goals_score, fullMark: 100 },
    { name: "Comercial", value: score.commercial_score, fullMark: 100 },
    { name: "Engajamento", value: score.engagement_score, fullMark: 100 },
    { name: "Suporte", value: score.support_score, fullMark: 100 },
    { name: "Tendência", value: score.trend_score, fullMark: 100 },
  ] : [];

  const historyData = snapshots
    .slice(0, 30)
    .reverse()
    .map(s => ({
      date: format(parseISO(s.snapshot_date), "dd/MM", { locale: ptBR }),
      score: Number(s.total_score),
    }));

  const alerts = [];
  if (score) {
    if (score.total_score < 40) {
      alerts.push({ type: "critical", message: "Alto risco de churn detectado" });
    } else if (score.total_score < 60) {
      alerts.push({ type: "warning", message: "Cliente em risco - ação necessária" });
    }
    if (score.satisfaction_score < 50) {
      alerts.push({ type: "warning", message: "Satisfação abaixo do esperado" });
    }
    if (score.goals_score < 50) {
      alerts.push({ type: "warning", message: "Metas não estão sendo atingidas" });
    }
    if (score.trend_direction === "falling") {
      alerts.push({ type: "warning", message: "Tendência de queda no score" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!score) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Heart className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Score ainda não calculado</p>
          <Button onClick={calculateScore} disabled={calculating}>
            {calculating ? (
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
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with main score */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 sm:gap-6">
        <Card className={cn("flex-1 border-2", riskInfo?.border)}>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Score de Saúde</p>
                <div className={cn("text-4xl sm:text-6xl font-bold", getScoreColor(score.total_score))}>
                  {score.total_score}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">de 100 pontos</div>
              </div>
              <div className="text-right space-y-1.5 sm:space-y-2">
                <Badge variant="outline" className={cn("text-xs sm:text-sm", riskInfo?.bg, riskInfo?.color)}>
                  {riskInfo?.label}
                </Badge>
                <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
                  <TrendIcon />
                  <span className={cn("text-xs sm:text-sm", trendInfo?.color)}>{trendInfo?.label}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={calculateScore}
                  disabled={calculating}
                  className="h-8 text-xs sm:text-sm"
                >
                  {calculating ? (
                    <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Recalcular</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="lg:w-80 border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-xs sm:text-sm text-orange-700">
                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 sm:px-6">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded",
                    alert.type === "critical" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  )}
                >
                  {alert.message}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 pb-1">
          <TabsList className="h-auto w-max sm:w-full inline-flex sm:flex flex-nowrap sm:flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="overview" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
              <span className="sm:hidden">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Insights IA</span>
              <span className="sm:hidden">IA</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Hist.</span>
            </TabsTrigger>
            <TabsTrigger value="observations" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Observações</span>
              <span className="sm:hidden">Obs.</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="settings" className="gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground bg-muted whitespace-nowrap">
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Configurações</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="insights" className="mt-4 sm:mt-6">
          <HealthScoreAIInsights projectId={projectId} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {/* Radar Chart */}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-xs sm:text-sm">Pilares do Score</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={pillarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pillar details */}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-xs sm:text-sm">Detalhes por Pilar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                {[
                  { icon: Heart, label: "Satisfação", fullLabel: "Satisfação (CSAT/NPS)", value: score.satisfaction_score, weight: weights.satisfaction_weight },
                  { icon: Target, label: "Metas", fullLabel: "Entrega de Metas", value: score.goals_score, weight: weights.goals_weight },
                  { icon: TrendingUp, label: "Comercial", fullLabel: "Performance Comercial", value: score.commercial_score, weight: weights.commercial_weight },
                  { icon: Users, label: "Engajamento", fullLabel: "Engajamento", value: score.engagement_score, weight: weights.engagement_weight },
                  { icon: Headphones, label: "Suporte", fullLabel: "Suporte", value: score.support_score, weight: weights.support_weight },
                  { icon: Activity, label: "Tendência", fullLabel: "Tendência", value: score.trend_score, weight: weights.trend_weight },
                ].map((pillar, idx) => (
                  <div key={idx} className="flex items-center gap-2 sm:gap-3">
                    <pillar.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs sm:text-sm mb-1">
                        <span className="sm:hidden">{pillar.label}</span>
                        <span className="hidden sm:inline">{pillar.fullLabel}</span>
                        <span className={getScoreColor(pillar.value)}>{pillar.value}</span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pillar.value >= 80 ? "bg-green-500" :
                            pillar.value >= 60 ? "bg-yellow-500" :
                            pillar.value >= 40 ? "bg-orange-500" : "bg-red-500"
                          )}
                          style={{ width: `${pillar.value}%` }}
                        />
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                        Peso: {pillar.weight}%
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Evolução do Score (últimos 30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Sem dados históricos disponíveis
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observations">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Observações Qualitativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar observação..."
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                  rows={2}
                />
                <Button onClick={handleSaveObservation} disabled={savingObs || !newObservation.trim()}>
                  {savingObs ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {observations.map((obs) => (
                  <div key={obs.id} className="border rounded-lg p-3">
                    <p className="text-sm">{obs.observation}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{obs.staff?.name || "Sistema"}</span>
                      <span>•</span>
                      <span>{format(parseISO(obs.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                ))}
                {observations.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma observação registrada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Configuração de Pesos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { key: "satisfaction_weight", label: "Satisfação (CSAT/NPS)" },
                  { key: "goals_weight", label: "Entrega de Metas" },
                  { key: "commercial_weight", label: "Performance Comercial" },
                  { key: "engagement_weight", label: "Engajamento" },
                  { key: "support_weight", label: "Suporte" },
                  { key: "trend_weight", label: "Tendência Histórica" },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="font-medium">{localWeights[item.key as keyof typeof localWeights]}%</span>
                    </div>
                    <Slider
                      value={[localWeights[item.key as keyof typeof localWeights]]}
                      onValueChange={(value) => setLocalWeights({ ...localWeights, [item.key]: value[0] })}
                      max={50}
                      step={5}
                    />
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total: {Object.values(localWeights).reduce((a, b) => a + b, 0)}%
                    </span>
                    <Button onClick={handleSaveWeights} disabled={savingWeights}>
                      {savingWeights ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Salvar Pesos
                    </Button>
                  </div>
                  {Object.values(localWeights).reduce((a, b) => a + b, 0) !== 100 && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ Os pesos devem somar 100%
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
