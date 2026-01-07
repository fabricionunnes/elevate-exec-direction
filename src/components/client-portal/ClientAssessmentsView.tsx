import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ClipboardCheck, 
  Users, 
  TrendingUp, 
  Star,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface ClientAssessmentsViewProps {
  projectId: string;
}

interface Cycle {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

interface DISCResponse {
  id: string;
  respondent_name: string;
  primary_profile: string | null;
  secondary_profile: string | null;
  dominance_score: number;
  influence_score: number;
  steadiness_score: number;
  conscientiousness_score: number;
}

interface Evaluation360 {
  id: string;
  evaluator_name: string;
  relationship: string;
  leadership_score: number | null;
  communication_score: number | null;
  teamwork_score: number | null;
  proactivity_score: number | null;
  results_delivery_score: number | null;
  conflict_management_score: number | null;
  strengths: string | null;
  improvements: string | null;
  additional_comments: string | null;
}

const DISC_COLORS: Record<string, string> = {
  D: "#ef4444",
  I: "#f59e0b",
  S: "#22c55e",
  C: "#3b82f6",
};

const DISC_LABELS: Record<string, string> = {
  D: "Dominância",
  I: "Influência",
  S: "Estabilidade",
  C: "Conformidade",
};

export function ClientAssessmentsView({ projectId }: ClientAssessmentsViewProps) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [discResponses, setDiscResponses] = useState<DISCResponse[]>([]);
  const [evaluations360, setEvaluations360] = useState<Evaluation360[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    fetchCycles();
  }, [projectId]);

  const fetchCycles = async () => {
    try {
      const { data, error } = await supabase
        .from("assessment_cycles")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCycles(data || []);
    } catch (error) {
      console.error("Error fetching cycles:", error);
    } finally {
      setLoading(false);
    }
  };

  const openReports = async (cycle: Cycle) => {
    setSelectedCycle(cycle);
    setLoadingReports(true);
    setIsReportsOpen(true);

    try {
      const [discRes, eval360Res] = await Promise.all([
        supabase
          .from("disc_responses")
          .select("*")
          .eq("cycle_id", cycle.id),
        supabase
          .from("assessment_360_evaluations")
          .select("*")
          .eq("cycle_id", cycle.id)
          .eq("is_completed", true),
      ]);

      setDiscResponses(discRes.data || []);
      setEvaluations360(eval360Res.data || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoadingReports(false);
    }
  };

  const calculate360Averages = () => {
    if (evaluations360.length === 0) return null;

    const sum = {
      leadership: 0,
      communication: 0,
      teamwork: 0,
      proactivity: 0,
      results: 0,
      conflict: 0,
    };
    let count = 0;

    evaluations360.forEach((e) => {
      if (e.leadership_score) sum.leadership += e.leadership_score;
      if (e.communication_score) sum.communication += e.communication_score;
      if (e.teamwork_score) sum.teamwork += e.teamwork_score;
      if (e.proactivity_score) sum.proactivity += e.proactivity_score;
      if (e.results_delivery_score) sum.results += e.results_delivery_score;
      if (e.conflict_management_score) sum.conflict += e.conflict_management_score;
      count++;
    });

    return [
      { subject: "Liderança", value: sum.leadership / count, fullMark: 5 },
      { subject: "Comunicação", value: sum.communication / count, fullMark: 5 },
      { subject: "Trabalho em Equipe", value: sum.teamwork / count, fullMark: 5 },
      { subject: "Proatividade", value: sum.proactivity / count, fullMark: 5 },
      { subject: "Entrega de Resultados", value: sum.results / count, fullMark: 5 },
      { subject: "Gestão de Conflitos", value: sum.conflict / count, fullMark: 5 },
    ];
  };

  const overallClimate = (() => {
    const avgData = calculate360Averages();
    if (!avgData) return 0;
    const total = avgData.reduce((acc, item) => acc + item.value, 0);
    return total / avgData.length;
  })();

  const getClimateLabel = (score: number) => {
    if (score >= 4.5) return { label: "Excelente", color: "text-green-500" };
    if (score >= 3.5) return { label: "Bom", color: "text-blue-500" };
    if (score >= 2.5) return { label: "Regular", color: "text-yellow-500" };
    return { label: "Precisa Melhorar", color: "text-red-500" };
  };

  const discDistribution = discResponses.reduce(
    (acc, r) => {
      if (r.primary_profile) {
        acc[r.primary_profile] = (acc[r.primary_profile] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const discChartData = Object.entries(discDistribution).map(([profile, count]) => ({
    name: DISC_LABELS[profile] || profile,
    value: count,
    color: DISC_COLORS[profile] || "#888",
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma avaliação disponível</h3>
          <p className="text-sm text-muted-foreground">
            Quando houver ciclos de avaliação para seu projeto, eles aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        Avaliações
      </h2>

      <div className="grid gap-3">
        {cycles.map((cycle) => (
          <Card 
            key={cycle.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openReports(cycle)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={cycle.type === "disc" ? "default" : "secondary"}>
                      {cycle.type === "disc" ? "DISC" : "360°"}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={
                        cycle.status === "active" 
                          ? "border-green-500 text-green-600" 
                          : "border-muted"
                      }
                    >
                      {cycle.status === "active" ? "Ativo" : "Encerrado"}
                    </Badge>
                  </div>
                  <h3 className="font-medium truncate">{cycle.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Criado em {format(new Date(cycle.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reports Sheet */}
      <Sheet open={isReportsOpen} onOpenChange={setIsReportsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {selectedCycle?.title}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-6 space-y-6">
              {loadingReports ? (
                <div className="space-y-4">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Users className="h-6 w-6 mx-auto text-primary mb-2" />
                        <div className="text-2xl font-bold">{discResponses.length}</div>
                        <div className="text-xs text-muted-foreground">Respostas DISC</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Star className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
                        <div className="text-2xl font-bold">{evaluations360.length}</div>
                        <div className="text-xs text-muted-foreground">Avaliações 360°</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Climate Score */}
                  {evaluations360.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Clima Organizacional
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-4xl font-bold">{overallClimate.toFixed(1)}</div>
                          <div className={`text-sm font-medium ${getClimateLabel(overallClimate).color}`}>
                            {getClimateLabel(overallClimate).label}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* DISC Distribution */}
                  {discResponses.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Distribuição DISC</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={discChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${value}`}
                                labelLine={false}
                              >
                                {discChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* DISC List */}
                        <div className="mt-4 space-y-2">
                          {discResponses.map((response) => (
                            <div 
                              key={response.id} 
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <span className="text-sm font-medium truncate">
                                {response.respondent_name}
                              </span>
                              <div className="flex gap-1">
                                {response.primary_profile && (
                                  <Badge 
                                    style={{ backgroundColor: DISC_COLORS[response.primary_profile] }}
                                    className="text-white"
                                  >
                                    {response.primary_profile}
                                  </Badge>
                                )}
                                {response.secondary_profile && (
                                  <Badge variant="outline">
                                    {response.secondary_profile}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 360 Radar Chart */}
                  {evaluations360.length > 0 && calculate360Averages() && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Competências 360°</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={calculate360Averages()!}>
                              <PolarGrid />
                              <PolarAngleAxis 
                                dataKey="subject" 
                                tick={{ fontSize: 10 }} 
                              />
                              <PolarRadiusAxis 
                                angle={30} 
                                domain={[0, 5]} 
                                tick={{ fontSize: 10 }} 
                              />
                              <Radar
                                name="Média"
                                dataKey="value"
                                stroke="hsl(var(--primary))"
                                fill="hsl(var(--primary))"
                                fillOpacity={0.3}
                              />
                              <Tooltip />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Qualitative Feedback */}
                  {evaluations360.some(e => e.strengths || e.improvements || e.additional_comments) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Feedback Qualitativo</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {evaluations360.filter(e => e.strengths).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-green-600 mb-2">
                              Pontos Fortes
                            </h4>
                            <div className="space-y-2">
                              {evaluations360
                                .filter(e => e.strengths)
                                .map((e) => (
                                  <p key={e.id} className="text-sm text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded">
                                    "{e.strengths}"
                                  </p>
                                ))}
                            </div>
                          </div>
                        )}

                        {evaluations360.filter(e => e.improvements).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-amber-600 mb-2">
                              Áreas de Melhoria
                            </h4>
                            <div className="space-y-2">
                              {evaluations360
                                .filter(e => e.improvements)
                                .map((e) => (
                                  <p key={e.id} className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                                    "{e.improvements}"
                                  </p>
                                ))}
                            </div>
                          </div>
                        )}

                        {evaluations360.filter(e => e.additional_comments).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-blue-600 mb-2">
                              Comentários Adicionais
                            </h4>
                            <div className="space-y-2">
                              {evaluations360
                                .filter(e => e.additional_comments)
                                .map((e) => (
                                  <p key={e.id} className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                                    "{e.additional_comments}"
                                  </p>
                                ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* No data message */}
                  {discResponses.length === 0 && evaluations360.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Nenhuma resposta registrada para este ciclo ainda.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
