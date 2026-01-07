import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Users, Brain, Copy, ExternalLink, BarChart3, Trash2, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export function AssessmentsPanel({ projectId }: Props) {
  const [cycles, setCycles] = useState<AssessmentCycle[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<AssessmentCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewCycleOpen, setIsNewCycleOpen] = useState(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

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
                      <Button variant="outline" size="sm" onClick={() => window.open(`/onboarding-tasks/${projectId}/reports?cycle=${cycle.id}`, "_blank")}>
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
    </div>
  );
}
