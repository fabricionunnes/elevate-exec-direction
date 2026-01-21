import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Brain,
  Users,
  TrendingUp,
  Star,
  BarChart3,
  User,
  Filter,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { climateSections, climateQuestions } from "@/data/climateQuestions";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { discProfiles } from "@/data/discQuestions";
import { cn } from "@/lib/utils";
import { AssessmentAIReportGenerator } from "./AssessmentAIReportGenerator";

interface AssessmentReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  cycleTitle: string;
  projectId?: string;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  department: string | null;
}

interface DISCResponse {
  id: string;
  participant_id: string;
  respondent_name: string;
  dominance_score: number;
  influence_score: number;
  steadiness_score: number;
  conscientiousness_score: number;
  primary_profile: string | null;
  secondary_profile: string | null;
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

interface ClimateResponse {
  id: string;
  participant_id: string;
  respondent_name: string;
  company_satisfaction: number | null;
  organizational_culture: number | null;
  feels_valued: string | null;
  communication_with_superiors: number | null;
  superior_interest_development: number | null;
  feels_supported: number | null;
  has_growth_opportunities: boolean | null;
  receives_feedback: string | null;
  training_rating: number | null;
  company_values_balance: boolean | null;
  company_offers_wellness: boolean | null;
  manages_responsibilities: boolean | null;
  feels_valued_for_work: boolean | null;
  adequate_recognition: boolean | null;
  rewards_rating: number | null;
  feels_comfortable_safe: boolean | null;
  good_coworker_relationship: boolean | null;
  diversity_inclusion: number | null;
  what_company_does_well: string | null;
  what_company_should_improve: string | null;
  enjoys_working_score: number | null;
  would_recommend_score: number | null;
  open_feedback: string | null;
  completed_at: string;
}

const DISC_COLORS: Record<string, string> = {
  D: "#ef4444",
  I: "#f59e0b",
  S: "#22c55e",
  C: "#3b82f6",
};

export function AssessmentReportSheet({
  open,
  onOpenChange,
  cycleId,
  cycleTitle,
  projectId,
}: AssessmentReportSheetProps) {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [discResponses, setDiscResponses] = useState<DISCResponse[]>([]);
  const [evaluations360, setEvaluations360] = useState<Evaluation360[]>([]);
  const [climateResponses, setClimateResponses] = useState<ClimateResponse[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    if (open && cycleId) {
      fetchData();
    }
  }, [open, cycleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [participantsRes, discRes, eval360Res, climateRes] = await Promise.all([
        supabase
          .from("assessment_participants")
          .select("id, name, role, department")
          .eq("cycle_id", cycleId)
          .order("name"),
        supabase
          .from("disc_responses")
          .select("*")
          .eq("cycle_id", cycleId),
        supabase
          .from("assessment_360_evaluations")
          .select("*")
          .eq("cycle_id", cycleId)
          .eq("is_completed", true),
        supabase
          .from("climate_survey_responses")
          .select("*")
          .eq("cycle_id", cycleId),
      ]);

      setParticipants(participantsRes.data || []);
      setDiscResponses(discRes.data || []);
      setEvaluations360(eval360Res.data || []);
      setClimateResponses(climateRes.data || []);
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered data based on selected participant
  const filteredDiscResponses = useMemo(() => {
    if (selectedParticipantId === "all") return discResponses;
    return discResponses.filter(r => r.participant_id === selectedParticipantId);
  }, [discResponses, selectedParticipantId]);

  const filteredEvaluations = useMemo(() => {
    if (selectedParticipantId === "all") return evaluations360;
    return evaluations360.filter(e => e.evaluated_id === selectedParticipantId);
  }, [evaluations360, selectedParticipantId]);

  const filteredClimateResponses = useMemo(() => {
    if (selectedParticipantId === "all") return climateResponses;
    return climateResponses.filter(r => r.participant_id === selectedParticipantId);
  }, [climateResponses, selectedParticipantId]);

  const selectedParticipant = useMemo(() => {
    if (selectedParticipantId === "all") return null;
    return participants.find(p => p.id === selectedParticipantId);
  }, [participants, selectedParticipantId]);

  // Calculate 360 averages
  const calculate360Averages = (evals: Evaluation360[]) => {
    if (evals.length === 0) return null;

    const sum = {
      leadership: 0,
      communication: 0,
      teamwork: 0,
      conflict: 0,
      proactivity: 0,
      results: 0,
    };
    const counts = { ...sum };

    evals.forEach(e => {
      if (e.leadership_score) { sum.leadership += e.leadership_score; counts.leadership++; }
      if (e.communication_score) { sum.communication += e.communication_score; counts.communication++; }
      if (e.teamwork_score) { sum.teamwork += e.teamwork_score; counts.teamwork++; }
      if (e.conflict_management_score) { sum.conflict += e.conflict_management_score; counts.conflict++; }
      if (e.proactivity_score) { sum.proactivity += e.proactivity_score; counts.proactivity++; }
      if (e.results_delivery_score) { sum.results += e.results_delivery_score; counts.results++; }
    });

    return [
      { subject: "Liderança", value: counts.leadership ? sum.leadership / counts.leadership : 0, fullMark: 5 },
      { subject: "Comunicação", value: counts.communication ? sum.communication / counts.communication : 0, fullMark: 5 },
      { subject: "Trabalho em Equipe", value: counts.teamwork ? sum.teamwork / counts.teamwork : 0, fullMark: 5 },
      { subject: "Gestão de Conflitos", value: counts.conflict ? sum.conflict / counts.conflict : 0, fullMark: 5 },
      { subject: "Proatividade", value: counts.proactivity ? sum.proactivity / counts.proactivity : 0, fullMark: 5 },
      { subject: "Entrega de Resultados", value: counts.results ? sum.results / counts.results : 0, fullMark: 5 },
    ];
  };

  const radarData = useMemo(() => calculate360Averages(filteredEvaluations), [filteredEvaluations]);

  // Calculate climate score from climate_survey_responses
  const climateScore = useMemo(() => {
    if (filteredClimateResponses.length === 0) return null;
    
    let totalScore = 0;
    let count = 0;
    
    filteredClimateResponses.forEach(response => {
      // Scale questions (0-5 or 1-5)
      const scaleFields = [
        response.company_satisfaction,
        response.organizational_culture,
        response.communication_with_superiors,
        response.superior_interest_development,
        response.feels_supported,
        response.training_rating,
        response.rewards_rating,
        response.diversity_inclusion,
        response.enjoys_working_score,
        response.would_recommend_score,
      ];
      
      scaleFields.forEach(val => {
        if (val !== null && val !== undefined) {
          totalScore += val;
          count++;
        }
      });
    });
    
    return count > 0 ? totalScore / count : null;
  }, [filteredClimateResponses]);

  const overallClimate = useMemo(() => {
    // Use climate survey data if available, otherwise fall back to 360 averages
    if (climateScore !== null) return climateScore;
    if (!radarData) return 0;
    const total = radarData.reduce((acc, item) => acc + item.value, 0);
    return total / radarData.length;
  }, [climateScore, radarData]);

  const getClimateLabel = (score: number) => {
    if (score >= 4.5) return { label: "Excelente", color: "text-green-500", bg: "bg-green-500/10" };
    if (score >= 4.0) return { label: "Muito Bom", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (score >= 3.5) return { label: "Bom", color: "text-blue-500", bg: "bg-blue-500/10" };
    if (score >= 3.0) return { label: "Regular", color: "text-amber-500", bg: "bg-amber-500/10" };
    return { label: "Precisa Atenção", color: "text-red-500", bg: "bg-red-500/10" };
  };

  // DISC distribution for pie chart
  const discDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    filteredDiscResponses.forEach(r => {
      if (r.primary_profile) {
        dist[r.primary_profile] = (dist[r.primary_profile] || 0) + 1;
      }
    });
    return Object.entries(dist).map(([profile, count]) => ({
      name: discProfiles[profile as keyof typeof discProfiles]?.name || profile,
      value: count,
      color: DISC_COLORS[profile] || "#888",
    }));
  }, [filteredDiscResponses]);

  // Bar chart data for competencies
  const barChartData = useMemo(() => {
    if (!radarData) return [];
    return radarData.map(item => ({
      name: item.subject.split(" ")[0],
      fullName: item.subject,
      value: Number(item.value.toFixed(2)),
    }));
  }, [radarData]);

  // Individual DISC profile details
  const getIndividualDiscProfile = (response: DISCResponse) => {
    const primary = discProfiles[response.primary_profile as keyof typeof discProfiles];
    const secondary = discProfiles[response.secondary_profile as keyof typeof discProfiles];

    const scores = [
      { label: "Dominância", value: response.dominance_score, color: DISC_COLORS.D },
      { label: "Influência", value: response.influence_score, color: DISC_COLORS.I },
      { label: "Estabilidade", value: response.steadiness_score, color: DISC_COLORS.S },
      { label: "Conformidade", value: response.conscientiousness_score, color: DISC_COLORS.C },
    ];

    return { primary, secondary, scores };
  };

  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    manager: "Gestor",
    employee: "Funcionário",
    peer: "Par",
  };

  const relationshipLabels: Record<string, string> = {
    self: "Autoavaliação",
    manager: "Gestor",
    peer: "Par",
    subordinate: "Subordinado",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 overflow-hidden">
        <SheetHeader className="p-6 pb-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Relatório: {cycleTitle}
            </SheetTitle>
            <AssessmentAIReportGenerator
              cycleId={cycleId}
              cycleTitle={cycleTitle}
              projectId={projectId}
            />
          </div>

          {/* Filter by participant */}
          <div className="flex items-center gap-2 mt-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Todos os colaboradores
                  </span>
                </SelectItem>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {p.name}
                      {p.department && (
                        <span className="text-muted-foreground text-xs">({p.department})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                {/* Selected participant header */}
                {selectedParticipant && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{selectedParticipant.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {roleLabels[selectedParticipant.role] || selectedParticipant.role}
                            {selectedParticipant.department && ` • ${selectedParticipant.department}`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Brain className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                      <div className="text-2xl font-bold">{filteredDiscResponses.length}</div>
                      <div className="text-xs text-muted-foreground">DISC</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Users className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                      <div className="text-2xl font-bold">{filteredEvaluations.length}</div>
                      <div className="text-xs text-muted-foreground">360°</div>
                    </CardContent>
                  </Card>
                  <Card className={overallClimate > 0 ? getClimateLabel(overallClimate).bg : ""}>
                    <CardContent className="p-4 text-center">
                      <Star className={cn("h-6 w-6 mx-auto mb-2", overallClimate > 0 ? getClimateLabel(overallClimate).color : "text-muted-foreground")} />
                      <div className={cn("text-2xl font-bold", overallClimate > 0 ? getClimateLabel(overallClimate).color : "")}>
                        {overallClimate > 0 ? overallClimate.toFixed(1) : "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">Clima</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs for different report sections */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="disc">DISC</TabsTrigger>
                    <TabsTrigger value="360">360°</TabsTrigger>
                    <TabsTrigger value="climate">Clima</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4 mt-4">
                    {/* DISC Distribution Chart */}
                    {discDistribution.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Brain className="h-4 w-4" />
                            Distribuição DISC
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={discDistribution}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={70}
                                  paddingAngle={2}
                                  dataKey="value"
                                  label={({ name, value }) => `${name}: ${value}`}
                                  labelLine={false}
                                >
                                  {discDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* 360 Competencies Radar */}
                    {radarData && filteredEvaluations.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Competências 360°
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                                <Radar
                                  name="Média"
                                  dataKey="value"
                                  stroke="hsl(var(--primary))"
                                  fill="hsl(var(--primary))"
                                  fillOpacity={0.3}
                                />
                                <Tooltip formatter={(value: number) => value.toFixed(2)} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {filteredDiscResponses.length === 0 && filteredEvaluations.length === 0 && (
                      <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                          <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">
                            {selectedParticipantId === "all"
                              ? "Nenhuma resposta registrada neste ciclo ainda."
                              : "Nenhuma resposta registrada para este colaborador."}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* DISC Tab */}
                  <TabsContent value="disc" className="space-y-4 mt-4">
                    {filteredDiscResponses.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                          <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">Nenhum perfil DISC registrado.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      filteredDiscResponses.map((response) => {
                        const { primary, secondary, scores } = getIndividualDiscProfile(response);
                        const maxScore = Math.max(...scores.map(s => s.value));

                        return (
                          <Card key={response.id}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {response.respondent_name}
                                </CardTitle>
                                <div className="flex gap-1">
                                  {primary && (
                                    <Badge style={{ backgroundColor: DISC_COLORS[response.primary_profile || ""] }} className="text-white">
                                      {primary.emoji} {primary.name}
                                    </Badge>
                                  )}
                                  {secondary && (
                                    <Badge variant="outline" style={{ borderColor: DISC_COLORS[response.secondary_profile || ""] }}>
                                      {secondary.emoji}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* Score bars */}
                              <div className="space-y-2">
                                {scores.map((score) => (
                                  <div key={score.label} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span>{score.label}</span>
                                      <span className="font-medium">{score.value}</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${(score.value / maxScore) * 100}%`,
                                          backgroundColor: score.color,
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Profile description */}
                              {primary && (
                                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                                  <p className="font-medium mb-1" style={{ color: DISC_COLORS[response.primary_profile || ""] }}>
                                    {primary.name}: {primary.shortDesc}
                                  </p>
                                  <p className="text-muted-foreground text-xs">{primary.description}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* 360 Tab */}
                  <TabsContent value="360" className="space-y-4 mt-4">
                    {filteredEvaluations.length === 0 ? (
                      <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">Nenhuma avaliação 360° registrada.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        {/* Bar chart of competencies */}
                        {barChartData.length > 0 && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Pontuação por Competência</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={barChartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                                    <Tooltip
                                      formatter={(value: number, name, props) => [
                                        value.toFixed(2),
                                        props.payload.fullName,
                                      ]}
                                    />
                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Evaluations by relationship */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Avaliações Recebidas</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {filteredEvaluations.map((evaluation) => (
                              <div key={evaluation.id} className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{evaluation.evaluator_name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {relationshipLabels[evaluation.relationship] || evaluation.relationship}
                                  </Badge>
                                </div>

                                {/* Scores grid */}
                                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                                  {evaluation.leadership_score && (
                                    <div className="p-1.5 bg-background rounded text-center">
                                      <div className="text-muted-foreground">Liderança</div>
                                      <div className="font-bold">{evaluation.leadership_score}</div>
                                    </div>
                                  )}
                                  {evaluation.communication_score && (
                                    <div className="p-1.5 bg-background rounded text-center">
                                      <div className="text-muted-foreground">Comunicação</div>
                                      <div className="font-bold">{evaluation.communication_score}</div>
                                    </div>
                                  )}
                                  {evaluation.teamwork_score && (
                                    <div className="p-1.5 bg-background rounded text-center">
                                      <div className="text-muted-foreground">Equipe</div>
                                      <div className="font-bold">{evaluation.teamwork_score}</div>
                                    </div>
                                  )}
                                  {evaluation.proactivity_score && (
                                    <div className="p-1.5 bg-background rounded text-center">
                                      <div className="text-muted-foreground">Proatividade</div>
                                      <div className="font-bold">{evaluation.proactivity_score}</div>
                                    </div>
                                  )}
                                  {evaluation.results_delivery_score && (
                                    <div className="p-1.5 bg-background rounded text-center">
                                      <div className="text-muted-foreground">Resultados</div>
                                      <div className="font-bold">{evaluation.results_delivery_score}</div>
                                    </div>
                                  )}
                                  {evaluation.conflict_management_score && (
                                    <div className="p-1.5 bg-background rounded text-center">
                                      <div className="text-muted-foreground">Conflitos</div>
                                      <div className="font-bold">{evaluation.conflict_management_score}</div>
                                    </div>
                                  )}
                                </div>

                                {/* Qualitative feedback */}
                                {evaluation.strengths && (
                                  <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded text-xs mb-2">
                                    <span className="font-medium text-green-600">Pontos Fortes: </span>
                                    <span className="text-muted-foreground">{evaluation.strengths}</span>
                                  </div>
                                )}
                                {evaluation.improvements && (
                                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-xs mb-2">
                                    <span className="font-medium text-amber-600">Melhorias: </span>
                                    <span className="text-muted-foreground">{evaluation.improvements}</span>
                                  </div>
                                )}
                                {evaluation.additional_comments && (
                                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs">
                                    <span className="font-medium text-blue-600">Comentário: </span>
                                    <span className="text-muted-foreground">{evaluation.additional_comments}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        {/* Summary of qualitative feedback */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Resumo de Feedbacks</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Strengths */}
                            {filteredEvaluations.some(e => e.strengths) && (
                              <div>
                                <h4 className="text-sm font-medium text-green-600 mb-2">Pontos Fortes</h4>
                                <div className="space-y-1">
                                  {filteredEvaluations
                                    .filter(e => e.strengths)
                                    .map((e) => (
                                      <p key={e.id} className="text-xs text-muted-foreground p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                        "{e.strengths}" — <span className="italic">{e.evaluator_name}</span>
                                      </p>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Improvements */}
                            {filteredEvaluations.some(e => e.improvements) && (
                              <div>
                                <h4 className="text-sm font-medium text-amber-600 mb-2">Áreas de Melhoria</h4>
                                <div className="space-y-1">
                                  {filteredEvaluations
                                    .filter(e => e.improvements)
                                    .map((e) => (
                                      <p key={e.id} className="text-xs text-muted-foreground p-2 bg-amber-50 dark:bg-amber-950/20 rounded">
                                        "{e.improvements}" — <span className="italic">{e.evaluator_name}</span>
                                      </p>
                                    ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </TabsContent>

                  {/* Climate Tab */}
                  <TabsContent value="climate" className="space-y-4 mt-4">
                    {filteredClimateResponses.length > 0 ? (
                      <>
                        {/* Overall Score */}
                        <Card className={getClimateLabel(overallClimate).bg}>
                          <CardContent className="py-8 text-center">
                            <div className={cn("inline-block p-6 rounded-full mb-4", getClimateLabel(overallClimate).bg)}>
                              <p className={cn("text-5xl font-bold", getClimateLabel(overallClimate).color)}>
                                {overallClimate.toFixed(2)}
                              </p>
                              <p className="text-muted-foreground text-sm">/5.00</p>
                            </div>
                            <Badge className={cn("text-base px-4 py-1", getClimateLabel(overallClimate).bg, getClimateLabel(overallClimate).color)}>
                              {getClimateLabel(overallClimate).label}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-2">
                              Baseado em {filteredClimateResponses.length} resposta(s) da pesquisa de clima
                            </p>
                          </CardContent>
                        </Card>

                        {/* Climate Metrics by Section */}
                        {climateSections.map(section => {
                          const sectionQuestions = climateQuestions.filter(q => q.section === section.id);
                          
                          return (
                            <Card key={section.id}>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <span>{section.icon}</span>
                                  {section.name}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {sectionQuestions.map(question => {
                                  // Get all responses for this question
                                  const responses = filteredClimateResponses.map(r => {
                                    const key = question.id as keyof ClimateResponse;
                                    return r[key];
                                  }).filter(v => v !== null && v !== undefined);
                                  
                                  if (responses.length === 0) return null;
                                  
                                  // Handle different question types
                                  if (question.type === 'text') {
                                    return (
                                      <div key={question.id} className="space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground">{question.question}</p>
                                        {responses.map((response, idx) => (
                                          <div key={idx} className="p-2 bg-muted/50 rounded text-xs">
                                            <MessageSquare className="h-3 w-3 inline mr-1 text-muted-foreground" />
                                            "{response}"
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                  
                                  if (question.type === 'boolean') {
                                    const yesCount = responses.filter(r => r === true).length;
                                    const noCount = responses.filter(r => r === false).length;
                                    const yesPercent = (yesCount / responses.length) * 100;
                                    
                                    return (
                                      <div key={question.id} className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground">{question.question}</p>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-green-500"
                                              style={{ width: `${yesPercent}%` }}
                                            />
                                          </div>
                                          <div className="flex items-center gap-3 text-xs">
                                            <span className="flex items-center gap-1 text-green-600">
                                              <ThumbsUp className="h-3 w-3" /> {yesCount}
                                            </span>
                                            <span className="flex items-center gap-1 text-red-500">
                                              <ThumbsDown className="h-3 w-3" /> {noCount}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  if (question.type === 'options') {
                                    const optionCounts: Record<string, number> = {};
                                    responses.forEach(r => {
                                      const val = String(r);
                                      optionCounts[val] = (optionCounts[val] || 0) + 1;
                                    });
                                    
                                    return (
                                      <div key={question.id} className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground">{question.question}</p>
                                        <div className="flex flex-wrap gap-1">
                                          {question.options?.map(opt => {
                                            const count = optionCounts[opt.value] || 0;
                                            return (
                                              <Badge key={opt.value} variant={count > 0 ? "default" : "outline"} className="text-xs">
                                                {opt.label}: {count}
                                              </Badge>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Scale questions (scale_1_5 or scale_0_5)
                                  const numericResponses = responses.map(r => Number(r)).filter(n => !isNaN(n));
                                  const avg = numericResponses.length > 0 
                                    ? numericResponses.reduce((a, b) => a + b, 0) / numericResponses.length
                                    : 0;
                                  
                                  return (
                                    <div key={question.id} className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground">{question.question}</p>
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                          <div 
                                            className={cn("h-full transition-all", getClimateLabel(avg).color.replace('text-', 'bg-'))}
                                            style={{ width: `${(avg / 5) * 100}%` }}
                                          />
                                        </div>
                                        <span className={cn("text-sm font-medium min-w-[40px] text-right", getClimateLabel(avg).color)}>
                                          {avg.toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </CardContent>
                            </Card>
                          );
                        })}

                        {/* Interpretation Card */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Interpretação do Resultado</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-xs">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                              <p className="font-medium text-green-600">4.5 - 5.0: Excelente</p>
                              <p className="text-muted-foreground">Clima altamente positivo e motivador</p>
                            </div>
                            <div className="p-3 bg-emerald-500/10 rounded-lg">
                              <p className="font-medium text-emerald-600">4.0 - 4.4: Muito Bom</p>
                              <p className="text-muted-foreground">Clima positivo com oportunidades de melhoria</p>
                            </div>
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                              <p className="font-medium text-blue-600">3.5 - 3.9: Bom</p>
                              <p className="text-muted-foreground">Clima satisfatório, requer atenção em algumas áreas</p>
                            </div>
                            <div className="p-3 bg-amber-500/10 rounded-lg">
                              <p className="font-medium text-amber-600">3.0 - 3.4: Regular</p>
                              <p className="text-muted-foreground">Áreas de preocupação que precisam ser trabalhadas</p>
                            </div>
                            <div className="p-3 bg-red-500/10 rounded-lg">
                              <p className="font-medium text-red-600">Abaixo de 3.0: Precisa Atenção</p>
                              <p className="text-muted-foreground">Intervenção necessária para melhorar o ambiente</p>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : overallClimate > 0 ? (
                      // Fallback to 360 data if no climate survey responses
                      <>
                        <Card className={getClimateLabel(overallClimate).bg}>
                          <CardContent className="py-8 text-center">
                            <div className={cn("inline-block p-6 rounded-full mb-4", getClimateLabel(overallClimate).bg)}>
                              <p className={cn("text-5xl font-bold", getClimateLabel(overallClimate).color)}>
                                {overallClimate.toFixed(2)}
                              </p>
                              <p className="text-muted-foreground text-sm">/5.00</p>
                            </div>
                            <Badge className={cn("text-base px-4 py-1", getClimateLabel(overallClimate).bg, getClimateLabel(overallClimate).color)}>
                              {getClimateLabel(overallClimate).label}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-2">
                              Baseado nas avaliações 360°
                            </p>
                          </CardContent>
                        </Card>

                        {/* Competencies breakdown from 360 */}
                        {radarData && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Detalhamento por Competência</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {radarData.map((item) => (
                                <div key={item.subject} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                  <span className="text-sm">{item.subject}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${(item.value / 5) * 100}%` }}
                                      />
                                    </div>
                                    <span className={cn("text-sm font-medium min-w-[40px] text-right", getClimateLabel(item.value).color)}>
                                      {item.value.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        )}
                      </>
                    ) : (
                      <Card className="border-dashed">
                        <CardContent className="py-8 text-center">
                          <Star className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">
                            Nenhuma resposta da pesquisa de clima registrada
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
