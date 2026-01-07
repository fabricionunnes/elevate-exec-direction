import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Brain, Users, TrendingUp, AlertTriangle, Star, Download } from "lucide-react";
import { discProfiles, assessment360Competencies } from "@/data/discQuestions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

interface DISCResponse {
  id: string;
  participant_id: string;
  respondent_name: string;
  dominance_score: number;
  influence_score: number;
  steadiness_score: number;
  conscientiousness_score: number;
  primary_profile: string;
  secondary_profile: string;
  completed_at: string;
}

interface Evaluation360 {
  id: string;
  evaluated_id: string;
  evaluator_name: string;
  relationship: string;
  leadership_score: number | null;
  communication_score: number | null;
  teamwork_score: number | null;
  conflict_management_score: number | null;
  proactivity_score: number | null;
  results_delivery_score: number | null;
  strengths: string | null;
  improvements: string | null;
  additional_comments: string | null;
  completed_at: string | null;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  department: string | null;
}

export default function AssessmentReportsPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cycleId = searchParams.get("cycle");

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [discResponses, setDiscResponses] = useState<DISCResponse[]>([]);
  const [evaluations360, setEvaluations360] = useState<Evaluation360[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<string>("all");
  const [cycleInfo, setCycleInfo] = useState<{ title: string; type: string } | null>(null);

  useEffect(() => {
    if (cycleId) {
      fetchData();
    }
  }, [cycleId]);

  const fetchData = async () => {
    try {
      // Get cycle info
      const { data: cycle } = await supabase
        .from("assessment_cycles")
        .select("title, type")
        .eq("id", cycleId)
        .single();

      if (cycle) setCycleInfo(cycle);

      // Get participants
      const { data: participantsData } = await supabase
        .from("assessment_participants")
        .select("id, name, role, department")
        .eq("cycle_id", cycleId)
        .order("name");

      setParticipants(participantsData || []);

      // Get DISC responses
      const { data: discData } = await supabase
        .from("disc_responses")
        .select("*")
        .eq("cycle_id", cycleId);

      setDiscResponses(discData || []);

      // Get 360 evaluations
      const { data: eval360Data } = await supabase
        .from("assessment_360_evaluations")
        .select("*")
        .eq("cycle_id", cycleId)
        .eq("is_completed", true);

      setEvaluations360(eval360Data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate DISC distribution
  const discDistribution = discResponses.reduce((acc, r) => {
    acc[r.primary_profile] = (acc[r.primary_profile] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const discChartData = Object.entries(discDistribution).map(([profile, count]) => ({
    name: discProfiles[profile as keyof typeof discProfiles]?.name || profile,
    value: count,
    color: discProfiles[profile as keyof typeof discProfiles]?.color || "#888",
  }));

  // Filter data by participant
  const filteredDiscResponses = selectedParticipant === "all"
    ? discResponses
    : discResponses.filter(r => r.participant_id === selectedParticipant);

  const filteredEvaluations = selectedParticipant === "all"
    ? evaluations360
    : evaluations360.filter(e => e.evaluated_id === selectedParticipant);

  // Calculate 360 averages
  const calculate360Averages = (evals: Evaluation360[]) => {
    if (evals.length === 0) return null;

    const avgScores = {
      leadership: 0,
      communication: 0,
      teamwork: 0,
      conflict_management: 0,
      proactivity: 0,
      results_delivery: 0,
    };

    let counts = { ...avgScores };

    evals.forEach(e => {
      if (e.leadership_score) { avgScores.leadership += e.leadership_score; counts.leadership++; }
      if (e.communication_score) { avgScores.communication += e.communication_score; counts.communication++; }
      if (e.teamwork_score) { avgScores.teamwork += e.teamwork_score; counts.teamwork++; }
      if (e.conflict_management_score) { avgScores.conflict_management += e.conflict_management_score; counts.conflict_management++; }
      if (e.proactivity_score) { avgScores.proactivity += e.proactivity_score; counts.proactivity++; }
      if (e.results_delivery_score) { avgScores.results_delivery += e.results_delivery_score; counts.results_delivery++; }
    });

    return {
      leadership: counts.leadership ? (avgScores.leadership / counts.leadership).toFixed(1) : 0,
      communication: counts.communication ? (avgScores.communication / counts.communication).toFixed(1) : 0,
      teamwork: counts.teamwork ? (avgScores.teamwork / counts.teamwork).toFixed(1) : 0,
      conflict_management: counts.conflict_management ? (avgScores.conflict_management / counts.conflict_management).toFixed(1) : 0,
      proactivity: counts.proactivity ? (avgScores.proactivity / counts.proactivity).toFixed(1) : 0,
      results_delivery: counts.results_delivery ? (avgScores.results_delivery / counts.results_delivery).toFixed(1) : 0,
    };
  };

  const avgScores360 = calculate360Averages(filteredEvaluations);

  const radarData = avgScores360 ? [
    { subject: "Liderança", A: parseFloat(avgScores360.leadership as string), fullMark: 5 },
    { subject: "Comunicação", A: parseFloat(avgScores360.communication as string), fullMark: 5 },
    { subject: "Trabalho em Equipe", A: parseFloat(avgScores360.teamwork as string), fullMark: 5 },
    { subject: "Gestão de Conflitos", A: parseFloat(avgScores360.conflict_management as string), fullMark: 5 },
    { subject: "Proatividade", A: parseFloat(avgScores360.proactivity as string), fullMark: 5 },
    { subject: "Entrega de Resultados", A: parseFloat(avgScores360.results_delivery as string), fullMark: 5 },
  ] : [];

  // Climate score
  const overallClimate = avgScores360 
    ? (
        (parseFloat(avgScores360.leadership as string) +
         parseFloat(avgScores360.communication as string) +
         parseFloat(avgScores360.teamwork as string) +
         parseFloat(avgScores360.conflict_management as string) +
         parseFloat(avgScores360.proactivity as string) +
         parseFloat(avgScores360.results_delivery as string)) / 6
      ).toFixed(2)
    : null;

  const getClimateLabel = (score: number) => {
    if (score >= 4.5) return { label: "Excelente", color: "text-green-500", bg: "bg-green-500/10" };
    if (score >= 4.0) return { label: "Muito Bom", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (score >= 3.5) return { label: "Bom", color: "text-blue-500", bg: "bg-blue-500/10" };
    if (score >= 3.0) return { label: "Regular", color: "text-amber-500", bg: "bg-amber-500/10" };
    return { label: "Precisa Atenção", color: "text-red-500", bg: "bg-red-500/10" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Relatórios de Avaliação</h1>
              <p className="text-muted-foreground">{cycleInfo?.title}</p>
            </div>
          </div>
          <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrar por pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Participantes</SelectItem>
              {participants.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Brain className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Respostas DISC</p>
                  <p className="text-2xl font-bold">{filteredDiscResponses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avaliações 360°</p>
                  <p className="text-2xl font-bold">{filteredEvaluations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Participantes</p>
                  <p className="text-2xl font-bold">{participants.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {overallClimate && (
            <Card className={cn(getClimateLabel(parseFloat(overallClimate)).bg)}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg">
                    <Star className={cn("w-6 h-6", getClimateLabel(parseFloat(overallClimate)).color)} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clima Organizacional</p>
                    <p className={cn("text-2xl font-bold", getClimateLabel(parseFloat(overallClimate)).color)}>
                      {overallClimate}/5
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {getClimateLabel(parseFloat(overallClimate)).label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="disc">
          <TabsList>
            <TabsTrigger value="disc">
              <Brain className="w-4 h-4 mr-2" />
              Relatório DISC
            </TabsTrigger>
            <TabsTrigger value="360">
              <Users className="w-4 h-4 mr-2" />
              Relatório 360°
            </TabsTrigger>
            <TabsTrigger value="climate">
              <TrendingUp className="w-4 h-4 mr-2" />
              Clima Organizacional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disc" className="space-y-6">
            {/* DISC Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição de Perfis DISC</CardTitle>
                  <CardDescription>Quantidade de pessoas por perfil predominante</CardDescription>
                </CardHeader>
                <CardContent>
                  {discChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={discChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {discChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma resposta DISC ainda</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Perfis Identificados</CardTitle>
                  <CardDescription>Lista de participantes e seus perfis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {filteredDiscResponses.map(response => {
                      const primary = discProfiles[response.primary_profile as keyof typeof discProfiles];
                      const secondary = discProfiles[response.secondary_profile as keyof typeof discProfiles];
                      return (
                        <div key={response.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="font-medium">{response.respondent_name}</span>
                          <div className="flex gap-2">
                            <Badge style={{ backgroundColor: primary?.color }} className="text-white">
                              {primary?.emoji} {primary?.name}
                            </Badge>
                            {secondary && (
                              <Badge variant="outline" style={{ borderColor: secondary.color, color: secondary.color }}>
                                {secondary.emoji} {secondary.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredDiscResponses.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">Nenhuma resposta encontrada</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* DISC Profile Details */}
            <Card>
              <CardHeader>
                <CardTitle>Sobre os Perfis DISC</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(discProfiles).map(([key, profile]) => (
                    <div
                      key={key}
                      className="p-4 rounded-lg border"
                      style={{ borderColor: profile.color + "40", backgroundColor: profile.color + "10" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{profile.emoji}</span>
                        <span className="font-bold" style={{ color: profile.color }}>{profile.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{profile.shortDesc}</p>
                      <div className="text-xs space-y-1">
                        <p className="font-medium">Pontos fortes:</p>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {profile.strengths.slice(0, 3).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="360" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Visão Geral das Competências</CardTitle>
                  <CardDescription>Média de todas as avaliações</CardDescription>
                </CardHeader>
                <CardContent>
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 5]} />
                        <Radar
                          name="Média"
                          dataKey="A"
                          stroke="#3B82F6"
                          fill="#3B82F6"
                          fillOpacity={0.5}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma avaliação 360° ainda</p>
                  )}
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Notas por Competência</CardTitle>
                  <CardDescription>Comparativo entre competências</CardDescription>
                </CardHeader>
                <CardContent>
                  {avgScores360 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={[
                          { name: "Liderança", score: parseFloat(avgScores360.leadership as string) },
                          { name: "Comunicação", score: parseFloat(avgScores360.communication as string) },
                          { name: "Trabalho Equipe", score: parseFloat(avgScores360.teamwork as string) },
                          { name: "Gestão Conflitos", score: parseFloat(avgScores360.conflict_management as string) },
                          { name: "Proatividade", score: parseFloat(avgScores360.proactivity as string) },
                          { name: "Resultados", score: parseFloat(avgScores360.results_delivery as string) },
                        ]}
                        layout="vertical"
                        margin={{ left: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 5]} />
                        <YAxis type="category" dataKey="name" />
                        <Tooltip />
                        <Bar dataKey="score" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma avaliação 360° ainda</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Feedbacks */}
            <Card>
              <CardHeader>
                <CardTitle>Feedbacks Qualitativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-green-600 mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4" /> Pontos Fortes
                    </h4>
                    <div className="space-y-2">
                      {filteredEvaluations
                        .filter(e => e.strengths)
                        .slice(0, 5)
                        .map(e => (
                          <div key={e.id} className="p-3 bg-green-500/5 rounded-lg text-sm">
                            <p className="text-muted-foreground italic">"{e.strengths}"</p>
                            <p className="text-xs mt-1">— {e.evaluator_name}</p>
                          </div>
                        ))}
                      {filteredEvaluations.filter(e => e.strengths).length === 0 && (
                        <p className="text-muted-foreground text-sm">Nenhum feedback ainda</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-amber-600 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Pontos de Melhoria
                    </h4>
                    <div className="space-y-2">
                      {filteredEvaluations
                        .filter(e => e.improvements)
                        .slice(0, 5)
                        .map(e => (
                          <div key={e.id} className="p-3 bg-amber-500/5 rounded-lg text-sm">
                            <p className="text-muted-foreground italic">"{e.improvements}"</p>
                            <p className="text-xs mt-1">— {e.evaluator_name}</p>
                          </div>
                        ))}
                      {filteredEvaluations.filter(e => e.improvements).length === 0 && (
                        <p className="text-muted-foreground text-sm">Nenhum feedback ainda</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-medium mb-3">Comentários adicionais</h4>
                  <div className="space-y-2">
                    {filteredEvaluations
                      .filter(e => e.additional_comments)
                      .map(e => (
                        <div key={e.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                          <p className="text-muted-foreground italic">"{e.additional_comments}"</p>
                          <p className="text-xs mt-1">— {e.evaluator_name}</p>
                        </div>
                      ))}
                    {filteredEvaluations.filter(e => e.additional_comments).length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhum comentário adicional ainda</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="climate" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Índice de Clima Organizacional</CardTitle>
                <CardDescription>
                  Baseado nas avaliações 360° de todas as competências
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overallClimate ? (
                  <div className="text-center space-y-6">
                    <div className={cn("inline-block p-8 rounded-full", getClimateLabel(parseFloat(overallClimate)).bg)}>
                      <p className={cn("text-6xl font-bold", getClimateLabel(parseFloat(overallClimate)).color)}>
                        {overallClimate}
                      </p>
                      <p className="text-muted-foreground">/5.00</p>
                    </div>
                    <Badge className={cn("text-lg px-4 py-2", getClimateLabel(parseFloat(overallClimate)).bg, getClimateLabel(parseFloat(overallClimate)).color)}>
                      {getClimateLabel(parseFloat(overallClimate)).label}
                    </Badge>

                    <div className="max-w-2xl mx-auto text-left space-y-4 mt-8">
                      <h4 className="font-semibold">Interpretação do Resultado:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-500/10 rounded-lg">
                          <p className="font-medium text-green-600">4.5 - 5.0: Excelente</p>
                          <p className="text-sm text-muted-foreground">Ambiente altamente positivo com colaboradores engajados</p>
                        </div>
                        <div className="p-4 bg-emerald-500/10 rounded-lg">
                          <p className="font-medium text-emerald-600">4.0 - 4.4: Muito Bom</p>
                          <p className="text-sm text-muted-foreground">Clima positivo com oportunidades de melhoria</p>
                        </div>
                        <div className="p-4 bg-blue-500/10 rounded-lg">
                          <p className="font-medium text-blue-600">3.5 - 3.9: Bom</p>
                          <p className="text-sm text-muted-foreground">Clima satisfatório, mas requer atenção em algumas áreas</p>
                        </div>
                        <div className="p-4 bg-amber-500/10 rounded-lg">
                          <p className="font-medium text-amber-600">3.0 - 3.4: Regular</p>
                          <p className="text-sm text-muted-foreground">Necessita intervenções para melhorar o ambiente</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aguardando avaliações 360° para calcular o clima organizacional
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
