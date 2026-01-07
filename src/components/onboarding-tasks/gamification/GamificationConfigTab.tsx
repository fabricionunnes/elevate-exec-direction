import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Settings, 
  Users, 
  Calendar, 
  Trophy,
  Target,
  Zap,
  Star,
  Flame
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GamificationConfigTabProps {
  companyId: string;
  projectId: string;
  isAdmin: boolean;
}

interface Config {
  id: string;
  is_active: boolean;
  season_type: string;
  reset_points_on_season_end: boolean;
  team_mode_enabled: boolean;
}

interface ScoringRule {
  id: string;
  name: string;
  description: string | null;
  rule_type: string;
  kpi_id: string | null;
  event_type: string | null;
  points_value: number;
  points_per_unit: number | null;
  streak_days: number | null;
  streak_bonus: number | null;
  max_points_per_day: number | null;
  max_points_per_week: number | null;
  is_active: boolean;
}

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
}

interface KPI {
  id: string;
  name: string;
  kpi_type: string;
}

interface Salesperson {
  id: string;
  name: string;
  is_active: boolean;
}

interface Participant {
  id: string;
  salesperson_id: string;
  current_level: number;
  total_points: number;
  salesperson?: Salesperson;
}

interface Level {
  id: string;
  level_number: number;
  name: string;
  min_points: number;
  icon: string;
}

export const GamificationConfigTab = ({ companyId, projectId, isAdmin }: GamificationConfigTabProps) => {
  const [config, setConfig] = useState<Config | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("rules");

  // Dialog states
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);
  const [showLevelDialog, setShowLevelDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [deletingSeasonId, setDeletingSeasonId] = useState<string | null>(null);

  // Form states
  const [ruleForm, setRuleForm] = useState({
    name: "",
    description: "",
    rule_type: "per_unit",
    kpi_id: "",
    event_type: "",
    points_value: 0,
    points_per_unit: 0,
    streak_days: 0,
    streak_bonus: 0,
    max_points_per_day: 0,
    max_points_per_week: 0,
    is_active: true,
  });

  const [seasonForm, setSeasonForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    status: "upcoming",
  });

  const [levelForm, setLevelForm] = useState({
    level_number: 1,
    name: "",
    min_points: 0,
    icon: "star",
  });

  useEffect(() => {
    fetchData();
  }, [companyId, projectId]);

  const fetchData = async () => {
    try {
      // Fetch or create config
      let { data: configData } = await supabase
        .from("gamification_configs")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (!configData) {
        // Create default config
        const { data: newConfig, error: createError } = await supabase
          .from("gamification_configs")
          .insert({
            project_id: projectId,
            company_id: companyId,
          })
          .select()
          .single();

        if (createError) throw createError;
        configData = newConfig;
      }

      setConfig(configData);

      // Fetch all related data in parallel
      const [rulesRes, seasonsRes, kpisRes, salespeopleRes, participantsRes, levelsRes] = await Promise.all([
        supabase.from("gamification_scoring_rules").select("*").eq("config_id", configData.id).order("name"),
        supabase.from("gamification_seasons").select("*").eq("config_id", configData.id).order("start_date", { ascending: false }),
        supabase.from("company_kpis").select("id, name, kpi_type").eq("company_id", companyId).eq("is_active", true),
        supabase.from("company_salespeople").select("id, name, is_active").eq("company_id", companyId).eq("is_active", true),
        supabase.from("gamification_participants").select("*, salesperson:company_salespeople(id, name, is_active)").eq("config_id", configData.id),
        supabase.from("gamification_levels").select("*").eq("config_id", configData.id).order("level_number"),
      ]);

      setScoringRules(rulesRes.data || []);
      setSeasons(seasonsRes.data || []);
      setKpis(kpisRes.data || []);
      setSalespeople(salespeopleRes.data || []);
      setParticipants(participantsRes.data || []);
      setLevels(levelsRes.data || []);

      // Create default levels if none exist
      if (!levelsRes.data?.length && configData) {
        await createDefaultLevels(configData.id);
      }
    } catch (error) {
      console.error("Error fetching gamification data:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const createDefaultLevels = async (configId: string) => {
    const defaultLevels = [
      { level_number: 1, name: "Iniciante", min_points: 0, icon: "star" },
      { level_number: 2, name: "Aprendiz", min_points: 500, icon: "star" },
      { level_number: 3, name: "Intermediário", min_points: 1500, icon: "star" },
      { level_number: 4, name: "Avançado", min_points: 3500, icon: "trophy" },
      { level_number: 5, name: "Expert", min_points: 7000, icon: "trophy" },
      { level_number: 6, name: "Mestre", min_points: 15000, icon: "flame" },
    ];

    await supabase.from("gamification_levels").insert(
      defaultLevels.map(l => ({ ...l, config_id: configId }))
    );

    const { data } = await supabase.from("gamification_levels").select("*").eq("config_id", configId).order("level_number");
    setLevels(data || []);
  };

  const handleUpdateConfig = async (updates: Partial<Config>) => {
    if (!config) return;

    try {
      const { error } = await supabase
        .from("gamification_configs")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", config.id);

      if (error) throw error;

      setConfig({ ...config, ...updates });
      toast.success("Configuração atualizada");
    } catch (error) {
      console.error("Error updating config:", error);
      toast.error("Erro ao atualizar configuração");
    }
  };

  const handleSaveRule = async () => {
    if (!config || !ruleForm.name) return;

    try {
      if (editingRule) {
        const { error } = await supabase
          .from("gamification_scoring_rules")
          .update({
            ...ruleForm,
            kpi_id: ruleForm.kpi_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingRule.id);

        if (error) throw error;
        toast.success("Regra atualizada");
      } else {
        const { error } = await supabase
          .from("gamification_scoring_rules")
          .insert({
            ...ruleForm,
            config_id: config.id,
            kpi_id: ruleForm.kpi_id || null,
          });

        if (error) throw error;
        toast.success("Regra criada");
      }

      setShowRuleDialog(false);
      setEditingRule(null);
      resetRuleForm();
      fetchData();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Erro ao salvar regra");
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRuleId) return;

    try {
      const { error } = await supabase
        .from("gamification_scoring_rules")
        .delete()
        .eq("id", deletingRuleId);

      if (error) throw error;
      toast.success("Regra excluída");
      setDeletingRuleId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Erro ao excluir regra");
    }
  };

  const handleSaveSeason = async () => {
    if (!config || !seasonForm.name || !seasonForm.start_date || !seasonForm.end_date) return;

    try {
      if (editingSeason) {
        const { error } = await supabase
          .from("gamification_seasons")
          .update({
            ...seasonForm,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSeason.id);

        if (error) throw error;
        toast.success("Temporada atualizada");
      } else {
        const { error } = await supabase
          .from("gamification_seasons")
          .insert({
            ...seasonForm,
            config_id: config.id,
          });

        if (error) throw error;
        toast.success("Temporada criada");
      }

      setShowSeasonDialog(false);
      setEditingSeason(null);
      resetSeasonForm();
      fetchData();
    } catch (error) {
      console.error("Error saving season:", error);
      toast.error("Erro ao salvar temporada");
    }
  };

  const handleDeleteSeason = async () => {
    if (!deletingSeasonId) return;

    try {
      const { error } = await supabase
        .from("gamification_seasons")
        .delete()
        .eq("id", deletingSeasonId);

      if (error) throw error;
      toast.success("Temporada excluída");
      setDeletingSeasonId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting season:", error);
      toast.error("Erro ao excluir temporada");
    }
  };

  const handleSetCurrentSeason = async (seasonId: string) => {
    if (!config) return;

    try {
      // First, unset all current seasons
      await supabase
        .from("gamification_seasons")
        .update({ is_current: false, status: "ended" })
        .eq("config_id", config.id);

      // Set the selected season as current
      const { error } = await supabase
        .from("gamification_seasons")
        .update({ is_current: true, status: "active" })
        .eq("id", seasonId);

      if (error) throw error;
      toast.success("Temporada ativada");
      fetchData();
    } catch (error) {
      console.error("Error setting current season:", error);
      toast.error("Erro ao ativar temporada");
    }
  };

  const handleAddAllParticipants = async () => {
    if (!config) return;

    try {
      const existingIds = participants.map(p => p.salesperson_id);
      const newParticipants = salespeople.filter(sp => !existingIds.includes(sp.id));

      if (newParticipants.length === 0) {
        toast.info("Todos os vendedores já são participantes");
        return;
      }

      const { error } = await supabase.from("gamification_participants").insert(
        newParticipants.map(sp => ({
          config_id: config.id,
          salesperson_id: sp.id,
        }))
      );

      if (error) throw error;
      toast.success(`${newParticipants.length} participantes adicionados`);
      fetchData();
    } catch (error) {
      console.error("Error adding participants:", error);
      toast.error("Erro ao adicionar participantes");
    }
  };

  const handleSaveLevel = async () => {
    if (!config || !levelForm.name) return;

    try {
      if (editingLevel) {
        const { error } = await supabase
          .from("gamification_levels")
          .update(levelForm)
          .eq("id", editingLevel.id);

        if (error) throw error;
        toast.success("Nível atualizado");
      } else {
        const { error } = await supabase
          .from("gamification_levels")
          .insert({
            ...levelForm,
            config_id: config.id,
          });

        if (error) throw error;
        toast.success("Nível criado");
      }

      setShowLevelDialog(false);
      setEditingLevel(null);
      resetLevelForm();
      fetchData();
    } catch (error) {
      console.error("Error saving level:", error);
      toast.error("Erro ao salvar nível");
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: "",
      description: "",
      rule_type: "per_unit",
      kpi_id: "",
      event_type: "",
      points_value: 0,
      points_per_unit: 0,
      streak_days: 0,
      streak_bonus: 0,
      max_points_per_day: 0,
      max_points_per_week: 0,
      is_active: true,
    });
  };

  const resetSeasonForm = () => {
    setSeasonForm({
      name: "",
      start_date: "",
      end_date: "",
      status: "upcoming",
    });
  };

  const resetLevelForm = () => {
    setLevelForm({
      level_number: levels.length + 1,
      name: "",
      min_points: 0,
      icon: "star",
    });
  };

  const openEditRule = (rule: ScoringRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      description: rule.description || "",
      rule_type: rule.rule_type,
      kpi_id: rule.kpi_id || "",
      event_type: rule.event_type || "",
      points_value: rule.points_value,
      points_per_unit: rule.points_per_unit || 0,
      streak_days: rule.streak_days || 0,
      streak_bonus: rule.streak_bonus || 0,
      max_points_per_day: rule.max_points_per_day || 0,
      max_points_per_week: rule.max_points_per_week || 0,
      is_active: rule.is_active,
    });
    setShowRuleDialog(true);
  };

  const openEditSeason = (season: Season) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      status: season.status,
    });
    setShowSeasonDialog(true);
  };

  const openEditLevel = (level: Level) => {
    setEditingLevel(level);
    setLevelForm({
      level_number: level.level_number,
      name: level.name,
      min_points: level.min_points,
      icon: level.icon,
    });
    setShowLevelDialog(true);
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "per_unit": return "Por unidade";
      case "per_value": return "Por valor";
      case "goal_achieved": return "Meta atingida";
      case "streak": return "Sequência";
      default: return type;
    }
  };

  const getStatusBadge = (status: string, isCurrent: boolean) => {
    if (isCurrent) return <Badge className="bg-green-500">Ativa</Badge>;
    switch (status) {
      case "upcoming": return <Badge variant="outline">Futura</Badge>;
      case "active": return <Badge className="bg-blue-500">Em andamento</Badge>;
      case "ended": return <Badge variant="secondary">Encerrada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Main Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração Geral
          </CardTitle>
          <CardDescription>Defina as configurações principais da gamificação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Gamificação Ativa</Label>
              <p className="text-sm text-muted-foreground">Ativar/desativar o sistema de gamificação</p>
            </div>
            <Switch
              checked={config?.is_active}
              onCheckedChange={(checked) => handleUpdateConfig({ is_active: checked })}
              disabled={!isAdmin}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Tipo de Temporada</Label>
              <p className="text-sm text-muted-foreground">Período de cada temporada</p>
            </div>
            <Select
              value={config?.season_type}
              onValueChange={(value) => handleUpdateConfig({ season_type: value })}
              disabled={!isAdmin}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Resetar pontos ao fim da temporada</Label>
              <p className="text-sm text-muted-foreground">Zerar pontos quando a temporada encerrar</p>
            </div>
            <Switch
              checked={config?.reset_points_on_season_end}
              onCheckedChange={(checked) => handleUpdateConfig({ reset_points_on_season_end: checked })}
              disabled={!isAdmin}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Modo por equipes</Label>
              <p className="text-sm text-muted-foreground">Habilitar ranking por equipes</p>
            </div>
            <Switch
              checked={config?.team_mode_enabled}
              onCheckedChange={(checked) => handleUpdateConfig({ team_mode_enabled: checked })}
              disabled={!isAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" />
            Regras de Pontuação
          </TabsTrigger>
          <TabsTrigger value="seasons" className="gap-2">
            <Calendar className="h-4 w-4" />
            Temporadas
          </TabsTrigger>
          <TabsTrigger value="participants" className="gap-2">
            <Users className="h-4 w-4" />
            Participantes
          </TabsTrigger>
          <TabsTrigger value="levels" className="gap-2">
            <Star className="h-4 w-4" />
            Níveis
          </TabsTrigger>
        </TabsList>

        {/* Scoring Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Regras de Pontuação</CardTitle>
                <CardDescription>Configure como os pontos são calculados</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetRuleForm(); setShowRuleDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Regra
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {scoringRules.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma regra configurada. Crie regras para começar a pontuar.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>KPI</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoringRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>{getRuleTypeLabel(rule.rule_type)}</TableCell>
                        <TableCell>
                          {rule.kpi_id ? kpis.find(k => k.id === rule.kpi_id)?.name || "-" : "-"}
                        </TableCell>
                        <TableCell>
                          {rule.rule_type === "per_unit" && `${rule.points_value} pts/unidade`}
                          {rule.rule_type === "per_value" && `${rule.points_per_unit || 0} pts/R$1000`}
                          {rule.rule_type === "goal_achieved" && `${rule.points_value} pts`}
                          {rule.rule_type === "streak" && `${rule.streak_bonus || 0} pts (${rule.streak_days || 0} dias)`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingRuleId(rule.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasons Tab */}
        <TabsContent value="seasons" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Temporadas</CardTitle>
                <CardDescription>Gerencie os períodos de competição</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetSeasonForm(); setShowSeasonDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Temporada
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {seasons.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma temporada criada. Crie uma temporada para iniciar.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasons.map((season) => (
                      <TableRow key={season.id}>
                        <TableCell className="font-medium">{season.name}</TableCell>
                        <TableCell>
                          {format(new Date(season.start_date), "dd/MM/yyyy", { locale: ptBR })} -{" "}
                          {format(new Date(season.end_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getStatusBadge(season.status, season.is_current)}</TableCell>
                        <TableCell>
                          {isAdmin && (
                            <div className="flex gap-2">
                              {!season.is_current && season.status !== "ended" && (
                                <Button variant="outline" size="sm" onClick={() => handleSetCurrentSeason(season.id)}>
                                  Ativar
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => openEditSeason(season)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingSeasonId(season.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Participantes</CardTitle>
                <CardDescription>Vendedores participando da gamificação</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={handleAddAllParticipants}>
                  <Users className="h-4 w-4 mr-2" />
                  Adicionar Todos
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum participante. Adicione vendedores à gamificação.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Pontos Totais</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((p) => {
                      const level = levels.find(l => p.total_points >= l.min_points) || levels[0];
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.salesperson?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Star className="h-3 w-3" />
                              {level?.name || `Nível ${p.current_level}`}
                            </Badge>
                          </TableCell>
                          <TableCell>{p.total_points.toLocaleString("pt-BR")} pts</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Levels Tab */}
        <TabsContent value="levels" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Níveis</CardTitle>
                <CardDescription>Configure os níveis de progressão</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetLevelForm(); setShowLevelDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Nível
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nível</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Pontos Mínimos</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((level) => (
                    <TableRow key={level.id}>
                      <TableCell>{level.level_number}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {level.icon === "star" && <Star className="h-4 w-4 text-yellow-500" />}
                          {level.icon === "trophy" && <Trophy className="h-4 w-4 text-amber-500" />}
                          {level.icon === "flame" && <Flame className="h-4 w-4 text-orange-500" />}
                          {level.name}
                        </div>
                      </TableCell>
                      <TableCell>{level.min_points.toLocaleString("pt-BR")} pts</TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => openEditLevel(level)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Pontuação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Regra *</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="Ex: Venda fechada"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Regra</Label>
              <Select
                value={ruleForm.rule_type}
                onValueChange={(value) => setRuleForm({ ...ruleForm, rule_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_unit">Pontos por unidade</SelectItem>
                  <SelectItem value="per_value">Pontos por valor monetário</SelectItem>
                  <SelectItem value="goal_achieved">Meta atingida</SelectItem>
                  <SelectItem value="streak">Sequência (streak)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>KPI Base</Label>
              <Select
                value={ruleForm.kpi_id}
                onValueChange={(value) => setRuleForm({ ...ruleForm, kpi_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um KPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {kpis.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ruleForm.rule_type === "per_unit" && (
              <div className="space-y-2">
                <Label>Pontos por unidade</Label>
                <Input
                  type="number"
                  value={ruleForm.points_value}
                  onChange={(e) => setRuleForm({ ...ruleForm, points_value: Number(e.target.value) })}
                />
              </div>
            )}

            {ruleForm.rule_type === "per_value" && (
              <div className="space-y-2">
                <Label>Pontos a cada R$ 1.000</Label>
                <Input
                  type="number"
                  value={ruleForm.points_per_unit}
                  onChange={(e) => setRuleForm({ ...ruleForm, points_per_unit: Number(e.target.value) })}
                />
              </div>
            )}

            {ruleForm.rule_type === "goal_achieved" && (
              <div className="space-y-2">
                <Label>Pontos ao atingir meta</Label>
                <Input
                  type="number"
                  value={ruleForm.points_value}
                  onChange={(e) => setRuleForm({ ...ruleForm, points_value: Number(e.target.value) })}
                />
              </div>
            )}

            {ruleForm.rule_type === "streak" && (
              <>
                <div className="space-y-2">
                  <Label>Dias consecutivos</Label>
                  <Input
                    type="number"
                    value={ruleForm.streak_days}
                    onChange={(e) => setRuleForm({ ...ruleForm, streak_days: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bônus de pontos</Label>
                  <Input
                    type="number"
                    value={ruleForm.streak_bonus}
                    onChange={(e) => setRuleForm({ ...ruleForm, streak_bonus: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máx. pontos/dia</Label>
                <Input
                  type="number"
                  value={ruleForm.max_points_per_day}
                  onChange={(e) => setRuleForm({ ...ruleForm, max_points_per_day: Number(e.target.value) })}
                  placeholder="0 = sem limite"
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. pontos/semana</Label>
                <Input
                  type="number"
                  value={ruleForm.max_points_per_week}
                  onChange={(e) => setRuleForm({ ...ruleForm, max_points_per_week: Number(e.target.value) })}
                  placeholder="0 = sem limite"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={ruleForm.is_active}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_active: checked })}
              />
              <Label>Regra ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveRule}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Season Dialog */}
      <Dialog open={showSeasonDialog} onOpenChange={setShowSeasonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSeason ? "Editar Temporada" : "Nova Temporada"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={seasonForm.name}
                onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                placeholder="Ex: Janeiro 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={seasonForm.start_date}
                  onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim *</Label>
                <Input
                  type="date"
                  value={seasonForm.end_date}
                  onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSeasonDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveSeason}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Level Dialog */}
      <Dialog open={showLevelDialog} onOpenChange={setShowLevelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número do Nível</Label>
                <Input
                  type="number"
                  value={levelForm.level_number}
                  onChange={(e) => setLevelForm({ ...levelForm, level_number: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={levelForm.icon}
                  onValueChange={(value) => setLevelForm({ ...levelForm, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="star">⭐ Estrela</SelectItem>
                    <SelectItem value="trophy">🏆 Troféu</SelectItem>
                    <SelectItem value="flame">🔥 Fogo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome do Nível *</Label>
              <Input
                value={levelForm.name}
                onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                placeholder="Ex: Expert"
              />
            </div>
            <div className="space-y-2">
              <Label>Pontos Mínimos</Label>
              <Input
                type="number"
                value={levelForm.min_points}
                onChange={(e) => setLevelForm({ ...levelForm, min_points: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLevelDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveLevel}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Confirmation */}
      <AlertDialog open={!!deletingRuleId} onOpenChange={() => setDeletingRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Season Confirmation */}
      <AlertDialog open={!!deletingSeasonId} onOpenChange={() => setDeletingSeasonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir temporada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A temporada e seus dados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSeason} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
