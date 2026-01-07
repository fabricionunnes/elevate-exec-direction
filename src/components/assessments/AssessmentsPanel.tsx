import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Users, Brain, Copy, ExternalLink, BarChart3, Trash2, Link2, TrendingUp, Star, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { discProfiles } from "@/data/discQuestions";
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
import { cn } from "@/lib/utils";

interface AssessmentCycle {
  id: string;
  title: string;
  type: "360" | "disc" | "both";
  status: "active" | "closed" | "draft";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  email: string | null;
  role: string;
  department: string | null;
  access_token: string;
}

interface Props {
  projectId: string;
}

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

export function AssessmentsPanel({ projectId }: Props) {
  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<AssessmentCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewCycleOpen, setIsNewCycleOpen] = useState(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [reportCycleId, setReportCycleId] = useState<string | null>(null);
  const [discResponses, setDiscResponses] = useState<DISCResponse[]>([]);
  const [evaluations360, setEvaluations360] = useState<Evaluation360[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const [newCycle, setNewCycle] = useState({
    title: "",
    type: "both" as "360" | "disc" | "both",
  });

  const [newParticipant, setNewParticipant] = useState({
    name: "",
    email: "",
    role: "employee" as "owner" | "manager" | "employee" | "peer",
    department: "",
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: staff } = await supabase
      .from("onboarding_staff")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    setIsAdmin(staff?.role === "admin");
  };

  useEffect(() => {
    fetchCycles();
  }, [projectId]);

  useEffect(() => {
    if (selectedCycle) {
      fetchParticipants(selectedCycle.id);
    }
  }, [selectedCycle]);

  const fetchCycles = async () => {
    try {
      const { data, error } = await supabase
        .from("assessment_cycles")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const typedData = (data || []) as AssessmentCycle[];
      setCycles(typedData);
      if (typedData.length > 0 && !selectedCycle) {
        setSelectedCycle(typedData[0]);
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (cycleId: string) => {
    try {
      const { data, error } = await supabase
        .from("assessment_participants")
        .select("*")
        .eq("cycle_id", cycleId)
        .order("name");

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  };

  const handleCreateCycle = async () => {
    if (!newCycle.title.trim()) {
      toast.error("Informe o título do ciclo");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("assessment_cycles")
        .insert({
          project_id: projectId,
          title: newCycle.title,
          type: newCycle.type,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      const typedData = data as AssessmentCycle;
      setCycles([typedData, ...cycles]);
      setSelectedCycle(typedData);
      setNewCycle({ title: "", type: "both" });
      setIsNewCycleOpen(false);
      toast.success("Ciclo criado com sucesso!");
    } catch (error) {
      console.error("Error creating cycle:", error);
      toast.error("Erro ao criar ciclo");
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedCycle) return;
    if (!newParticipant.name.trim()) {
      toast.error("Informe o nome do participante");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("assessment_participants")
        .insert({
          cycle_id: selectedCycle.id,
          name: newParticipant.name,
          email: newParticipant.email || null,
          role: newParticipant.role,
          department: newParticipant.department || null,
        })
        .select()
        .single();

      if (error) throw error;

      setParticipants([...participants, data]);
      setNewParticipant({ name: "", email: "", role: "employee", department: "" });
      setIsAddParticipantOpen(false);
      toast.success("Participante adicionado!");
    } catch (error) {
      console.error("Error adding participant:", error);
      toast.error("Erro ao adicionar participante");
    }
  };

  const handleDeleteParticipant = async (participantId: string) => {
    if (!confirm("Remover este participante?")) return;

    try {
      const { error } = await supabase
        .from("assessment_participants")
        .delete()
        .eq("id", participantId);

      if (error) throw error;
      setParticipants(participants.filter(p => p.id !== participantId));
      toast.success("Participante removido");
    } catch (error) {
      console.error("Error deleting participant:", error);
      toast.error("Erro ao remover participante");
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    if (!confirm("Excluir este ciclo e todas as respostas associadas? Esta ação não pode ser desfeita.")) return;

    try {
      // Delete in order: evaluations, disc_responses, participants, cycle
      await supabase.from("assessment_360_evaluations").delete().eq("cycle_id", cycleId);
      await supabase.from("disc_responses").delete().eq("cycle_id", cycleId);
      await supabase.from("assessment_participants").delete().eq("cycle_id", cycleId);
      
      const { error } = await supabase.from("assessment_cycles").delete().eq("id", cycleId);
      if (error) throw error;

      setCycles(cycles.filter(c => c.id !== cycleId));
      if (selectedCycle?.id === cycleId) {
        setSelectedCycle(cycles.find(c => c.id !== cycleId) || null);
      }
      toast.success("Ciclo excluído com sucesso");
    } catch (error) {
      console.error("Error deleting cycle:", error);
      toast.error("Erro ao excluir ciclo");
    }
  };

  const openReports = async (cycleId: string) => {
    setReportCycleId(cycleId);
    setIsReportsOpen(true);
    setLoadingReports(true);

    try {
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
      console.error("Error fetching reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoadingReports(false);
    }
  };

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
      leadership: counts.leadership ? (avgScores.leadership / counts.leadership).toFixed(1) : "0",
      communication: counts.communication ? (avgScores.communication / counts.communication).toFixed(1) : "0",
      teamwork: counts.teamwork ? (avgScores.teamwork / counts.teamwork).toFixed(1) : "0",
      conflict_management: counts.conflict_management ? (avgScores.conflict_management / counts.conflict_management).toFixed(1) : "0",
      proactivity: counts.proactivity ? (avgScores.proactivity / counts.proactivity).toFixed(1) : "0",
      results_delivery: counts.results_delivery ? (avgScores.results_delivery / counts.results_delivery).toFixed(1) : "0",
    };
  };

  const avgScores360 = calculate360Averages(evaluations360);

  const radarData = avgScores360 ? [
    { subject: "Liderança", A: parseFloat(avgScores360.leadership), fullMark: 5 },
    { subject: "Comunicação", A: parseFloat(avgScores360.communication), fullMark: 5 },
    { subject: "Trabalho em Equipe", A: parseFloat(avgScores360.teamwork), fullMark: 5 },
    { subject: "Gestão de Conflitos", A: parseFloat(avgScores360.conflict_management), fullMark: 5 },
    { subject: "Proatividade", A: parseFloat(avgScores360.proactivity), fullMark: 5 },
    { subject: "Entrega de Resultados", A: parseFloat(avgScores360.results_delivery), fullMark: 5 },
  ] : [];

  const overallClimate = avgScores360 
    ? (
        (parseFloat(avgScores360.leadership) +
         parseFloat(avgScores360.communication) +
         parseFloat(avgScores360.teamwork) +
         parseFloat(avgScores360.conflict_management) +
         parseFloat(avgScores360.proactivity) +
         parseFloat(avgScores360.results_delivery)) / 6
      ).toFixed(2)
    : null;

  const getClimateLabel = (score: number) => {
    if (score >= 4.5) return { label: "Excelente", color: "text-green-500", bg: "bg-green-500/10" };
    if (score >= 4.0) return { label: "Muito Bom", color: "text-emerald-500", bg: "bg-emerald-500/10" };
    if (score >= 3.5) return { label: "Bom", color: "text-blue-500", bg: "bg-blue-500/10" };
    if (score >= 3.0) return { label: "Regular", color: "text-amber-500", bg: "bg-amber-500/10" };
    return { label: "Precisa Atenção", color: "text-red-500", bg: "bg-red-500/10" };
  };

  const discDistribution = discResponses.reduce((acc, r) => {
    acc[r.primary_profile] = (acc[r.primary_profile] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const discChartData = Object.entries(discDistribution).map(([profile, count]) => ({
    name: discProfiles[profile as keyof typeof discProfiles]?.name || profile,
    value: count,
    color: discProfiles[profile as keyof typeof discProfiles]?.color || "#888",
  }));

  const getAssessmentLinks = (participant: Participant) => {
    const baseUrl = window.location.origin;
    
    const discLink = `${baseUrl}/disc?cycle=${selectedCycle?.id}&participant=${participant.id}&token=${participant.access_token}`;
    const selfLink = `${baseUrl}/360?cycle=${selectedCycle?.id}&evaluated=${participant.id}&rel=self&token=${participant.access_token}`;
    const peerLink = `${baseUrl}/360?cycle=${selectedCycle?.id}&evaluated=${participant.id}&rel=peer&token=${participant.access_token}`;
    const managerLink = `${baseUrl}/360?cycle=${selectedCycle?.id}&evaluated=${participant.id}&rel=manager&token=${participant.access_token}`;
    const subordinateLink = `${baseUrl}/360?cycle=${selectedCycle?.id}&evaluated=${participant.id}&rel=subordinate&token=${participant.access_token}`;

    return { discLink, selfLink, peerLink, managerLink, subordinateLink };
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Link ${label} copiado!`);
  };

  const roleLabels = {
    owner: "Proprietário",
    manager: "Gestor",
    employee: "Funcionário",
    peer: "Par",
  };

  const typeLabels = {
    "360": "Pesquisa 360°",
    disc: "Teste DISC",
    both: "360° + DISC",
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Avaliações 360° e DISC</h2>
          <p className="text-sm text-muted-foreground">Gerencie ciclos de avaliação e participantes</p>
        </div>
        <Button onClick={() => setIsNewCycleOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Ciclo
        </Button>
      </div>

      {/* Cycles */}
      {cycles.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-8">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum ciclo de avaliação criado</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsNewCycleOpen(true)}>
              Criar Primeiro Ciclo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={selectedCycle?.id || ""} onValueChange={(id) => setSelectedCycle(cycles.find(c => c.id === id) || null)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            {cycles.map(cycle => (
              <TabsTrigger key={cycle.id} value={cycle.id} className="flex items-center gap-2">
                {typeLabels[cycle.type]}
                <Badge variant={cycle.status === "active" ? "default" : "secondary"} className="ml-1">
                  {cycle.status === "active" ? "Ativo" : "Fechado"}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {cycles.map(cycle => (
            <TabsContent key={cycle.id} value={cycle.id} className="space-y-4">
              {/* Cycle Info + Public Link */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cycle.title}</CardTitle>
                    <div className="flex gap-2">
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteCycle(cycle.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir Ciclo
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openReports(cycle.id)}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Ver Relatórios
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Criado em {format(new Date(cycle.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Public Link */}
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-primary">🔗 Link Público da Avaliação</p>
                        <p className="text-sm text-muted-foreground">
                          Envie este link para todos responderem. Cada pessoa informa o nome ao acessar.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}/avaliacao?cycle=${cycle.id}`}
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="default"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/avaliacao?cycle=${cycle.id}`);
                          toast.success("Link copiado!");
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Participants (responses) */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Respostas Recebidas ({participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {participants.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Nenhuma resposta ainda. Compartilhe o link acima!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participants.map(participant => (
                        <div key={participant.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {roleLabels[participant.role as keyof typeof roleLabels]}
                              {participant.department && ` • ${participant.department}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteParticipant(participant.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* New Cycle Dialog */}
      <Dialog open={isNewCycleOpen} onOpenChange={setIsNewCycleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Ciclo de Avaliação</DialogTitle>
            <DialogDescription>Crie um novo ciclo para avaliações 360° e/ou DISC</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newCycle.title}
                onChange={(e) => setNewCycle({ ...newCycle, title: e.target.value })}
                placeholder="Ex: Avaliação Q1 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Avaliação</Label>
              <Select
                value={newCycle.type}
                onValueChange={(value) => setNewCycle({ ...newCycle, type: value as "360" | "disc" | "both" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">360° + DISC (Completo)</SelectItem>
                  <SelectItem value="360">Apenas Pesquisa 360°</SelectItem>
                  <SelectItem value="disc">Apenas Teste DISC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCycleOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCycle}>Criar Ciclo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog */}
      <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Participante</DialogTitle>
            <DialogDescription>Adicione um funcionário ou proprietário para participar das avaliações</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={newParticipant.name}
                onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={newParticipant.email}
                onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                placeholder="email@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo/Função</Label>
              <Select
                value={newParticipant.role}
                onValueChange={(value) => setNewParticipant({ ...newParticipant, role: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Proprietário/Sócio</SelectItem>
                  <SelectItem value="manager">Gestor/Gerente</SelectItem>
                  <SelectItem value="employee">Funcionário</SelectItem>
                  <SelectItem value="peer">Par/Colega</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento (opcional)</Label>
              <Input
                id="department"
                value={newParticipant.department}
                onChange={(e) => setNewParticipant({ ...newParticipant, department: e.target.value })}
                placeholder="Ex: Comercial, RH, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddParticipantOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddParticipant}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Links Dialog */}
      <Dialog open={isLinksOpen} onOpenChange={setIsLinksOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Links de Avaliação - {selectedParticipant?.name}</DialogTitle>
            <DialogDescription>Copie e envie os links apropriados para cada avaliador</DialogDescription>
          </DialogHeader>
          {selectedParticipant && selectedCycle && (
            <div className="space-y-4">
              {(selectedCycle.type === "disc" || selectedCycle.type === "both") && (
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">Teste DISC</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Link para {selectedParticipant.name} responder o DISC</p>
                  <div className="flex gap-2">
                    <Input value={getAssessmentLinks(selectedParticipant).discLink} readOnly className="text-xs" />
                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(getAssessmentLinks(selectedParticipant).discLink, "DISC")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => window.open(getAssessmentLinks(selectedParticipant).discLink, "_blank")}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {(selectedCycle.type === "360" || selectedCycle.type === "both") && (
                <>
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Autoavaliação 360°</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Link para {selectedParticipant.name} se autoavaliar</p>
                    <div className="flex gap-2">
                      <Input value={getAssessmentLinks(selectedParticipant).selfLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(getAssessmentLinks(selectedParticipant).selfLink, "Autoavaliação")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Avaliação pelo Gestor</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Link para o gestor avaliar {selectedParticipant.name}</p>
                    <div className="flex gap-2">
                      <Input value={getAssessmentLinks(selectedParticipant).managerLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(getAssessmentLinks(selectedParticipant).managerLink, "Gestor")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-500" />
                      <span className="font-medium">Avaliação por Pares</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Link para colegas avaliarem {selectedParticipant.name}</p>
                    <div className="flex gap-2">
                      <Input value={getAssessmentLinks(selectedParticipant).peerLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(getAssessmentLinks(selectedParticipant).peerLink, "Pares")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Avaliação por Subordinados</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Link para subordinados avaliarem {selectedParticipant.name}</p>
                    <div className="flex gap-2">
                      <Input value={getAssessmentLinks(selectedParticipant).subordinateLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyToClipboard(getAssessmentLinks(selectedParticipant).subordinateLink, "Subordinados")}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reports Sheet */}
      <Sheet open={isReportsOpen} onOpenChange={setIsReportsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Relatórios de Avaliação
            </SheetTitle>
            <SheetDescription>
              {selectedCycle?.title || "Ciclo de Avaliação"}
            </SheetDescription>
          </SheetHeader>

          {loadingReports ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-6 mt-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Brain className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Respostas DISC</p>
                        <p className="text-xl font-bold">{discResponses.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Users className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avaliações 360°</p>
                        <p className="text-xl font-bold">{evaluations360.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Climate Score */}
              {overallClimate && (
                <Card className={cn(getClimateLabel(parseFloat(overallClimate)).bg)}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded-lg">
                        <Star className={cn("w-5 h-5", getClimateLabel(parseFloat(overallClimate)).color)} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Clima Organizacional</p>
                        <p className={cn("text-xl font-bold", getClimateLabel(parseFloat(overallClimate)).color)}>
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

              {/* DISC Section */}
              {discResponses.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Perfis DISC Identificados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4">
                      {discChartData.length > 0 && (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={discChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              outerRadius={70}
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
                      )}
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {discResponses.map(response => {
                          const primary = discProfiles[response.primary_profile as keyof typeof discProfiles];
                          const secondary = discProfiles[response.secondary_profile as keyof typeof discProfiles];
                          return (
                            <div key={response.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                              <span className="font-medium">{response.respondent_name}</span>
                              <div className="flex gap-1">
                                <Badge style={{ backgroundColor: primary?.color }} className="text-white text-xs">
                                  {primary?.emoji} {primary?.name}
                                </Badge>
                                {secondary && (
                                  <Badge variant="outline" className="text-xs" style={{ borderColor: secondary.color, color: secondary.color }}>
                                    {secondary.emoji} {secondary.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 360 Section */}
              {evaluations360.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Avaliação 360° - Competências
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {radarData.length > 0 && (
                      <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10 }} />
                          <Radar name="Média" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                        </RadarChart>
                      </ResponsiveContainer>
                    )}

                    {/* Scores breakdown */}
                    {avgScores360 && (
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Liderança:</span>
                          <span className="font-bold ml-2">{avgScores360.leadership}</span>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Comunicação:</span>
                          <span className="font-bold ml-2">{avgScores360.communication}</span>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Trabalho em Equipe:</span>
                          <span className="font-bold ml-2">{avgScores360.teamwork}</span>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Gestão de Conflitos:</span>
                          <span className="font-bold ml-2">{avgScores360.conflict_management}</span>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Proatividade:</span>
                          <span className="font-bold ml-2">{avgScores360.proactivity}</span>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-sm">
                          <span className="text-muted-foreground">Entrega de Resultados:</span>
                          <span className="font-bold ml-2">{avgScores360.results_delivery}</span>
                        </div>
                      </div>
                    )}

                    {/* Comments */}
                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Pontos Fortes</h4>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {evaluations360.filter(e => e.strengths).map(e => (
                          <div key={e.id + "-str"} className="p-2 bg-green-500/10 rounded text-xs">
                            <p className="italic">"{e.strengths}"</p>
                            <p className="text-muted-foreground mt-1">— {e.evaluator_name}</p>
                          </div>
                        ))}
                        {evaluations360.filter(e => e.strengths).length === 0 && (
                          <p className="text-muted-foreground text-xs">Nenhum comentário ainda</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Pontos a Melhorar</h4>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {evaluations360.filter(e => e.improvements).map(e => (
                          <div key={e.id + "-imp"} className="p-2 bg-amber-500/10 rounded text-xs">
                            <p className="italic">"{e.improvements}"</p>
                            <p className="text-muted-foreground mt-1">— {e.evaluator_name}</p>
                          </div>
                        ))}
                        {evaluations360.filter(e => e.improvements).length === 0 && (
                          <p className="text-muted-foreground text-xs">Nenhum comentário ainda</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium text-sm mb-2">Comentários Adicionais</h4>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {evaluations360.filter(e => e.additional_comments).map(e => (
                          <div key={e.id + "-add"} className="p-2 bg-muted/50 rounded text-xs">
                            <p className="italic">"{e.additional_comments}"</p>
                            <p className="text-muted-foreground mt-1">— {e.evaluator_name}</p>
                          </div>
                        ))}
                        {evaluations360.filter(e => e.additional_comments).length === 0 && (
                          <p className="text-muted-foreground text-xs">Nenhum comentário ainda</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {discResponses.length === 0 && evaluations360.length === 0 && (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma resposta recebida ainda</p>
                  <p className="text-sm text-muted-foreground">Compartilhe o link da avaliação para receber respostas</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
