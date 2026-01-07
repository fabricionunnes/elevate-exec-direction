import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Target,
  Award,
  Gift,
  Star,
  Trophy,
  Flame,
  Zap,
  Medal,
  Crown,
  Shield
} from "lucide-react";

interface GamificationMissionsTabProps {
  companyId: string;
  projectId: string;
  isAdmin: boolean;
}

interface Config {
  id: string;
}

interface KPI {
  id: string;
  name: string;
}

interface Season {
  id: string;
  name: string;
  is_current: boolean;
}

interface Mission {
  id: string;
  name: string;
  description: string | null;
  mission_type: string;
  metric_kpi_id: string | null;
  condition_type: string;
  condition_value: number;
  season_id: string | null;
  start_date: string | null;
  end_date: string | null;
  reward_points: number;
  reward_badge_id: string | null;
  is_active: boolean;
}

interface GamificationBadge {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  condition_type: string;
  condition_value: number | null;
  condition_kpi_id: string | null;
  is_repeatable: boolean;
  show_on_profile: boolean;
  is_active: boolean;
}

interface Reward {
  id: string;
  name: string;
  description: string | null;
  reward_type: string;
  value: number | null;
  condition_type: string;
  condition_value: number | null;
  mission_id: string | null;
  season_id: string | null;
  show_on_dashboard: boolean;
  is_active: boolean;
}

const BADGE_ICONS = [
  { value: "star", label: "⭐ Estrela", icon: Star },
  { value: "trophy", label: "🏆 Troféu", icon: Trophy },
  { value: "flame", label: "🔥 Fogo", icon: Flame },
  { value: "zap", label: "⚡ Raio", icon: Zap },
  { value: "medal", label: "🏅 Medalha", icon: Medal },
  { value: "crown", label: "👑 Coroa", icon: Crown },
  { value: "shield", label: "🛡️ Escudo", icon: Shield },
  { value: "award", label: "🎖️ Prêmio", icon: Award },
];

export const GamificationMissionsTab = ({ companyId, projectId, isAdmin }: GamificationMissionsTabProps) => {
  const [config, setConfig] = useState<Config | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [badges, setBadges] = useState<GamificationBadge[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("missions");

  // Dialog states
  const [showMissionDialog, setShowMissionDialog] = useState(false);
  const [showBadgeDialog, setShowBadgeDialog] = useState(false);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [editingBadge, setEditingBadge] = useState<GamificationBadge | null>(null);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
  const [deletingBadgeId, setDeletingBadgeId] = useState<string | null>(null);
  const [deletingRewardId, setDeletingRewardId] = useState<string | null>(null);

  // Form states
  const [missionForm, setMissionForm] = useState({
    name: "",
    description: "",
    mission_type: "individual",
    metric_kpi_id: "",
    condition_type: "reach_value",
    condition_value: 0,
    season_id: "",
    start_date: "",
    end_date: "",
    reward_points: 0,
    reward_badge_id: "",
    is_active: true,
  });

  const [badgeForm, setBadgeForm] = useState({
    name: "",
    description: "",
    icon: "star",
    condition_type: "points_threshold",
    condition_value: 0,
    condition_kpi_id: "",
    is_repeatable: false,
    show_on_profile: true,
    is_active: true,
  });

  const [rewardForm, setRewardForm] = useState({
    name: "",
    description: "",
    reward_type: "money",
    value: 0,
    condition_type: "rank_position",
    condition_value: 1,
    mission_id: "",
    season_id: "",
    show_on_dashboard: true,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, [companyId, projectId]);

  const fetchData = async () => {
    try {
      // Fetch config
      const { data: configData } = await supabase
        .from("gamification_configs")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (!configData) {
        setLoading(false);
        return;
      }

      setConfig(configData);

      // Fetch all data in parallel
      const [missionsRes, badgesRes, rewardsRes, kpisRes, seasonsRes] = await Promise.all([
        supabase.from("gamification_missions").select("*").eq("config_id", configData.id).order("name"),
        supabase.from("gamification_badges").select("*").eq("config_id", configData.id).order("name"),
        supabase.from("gamification_rewards").select("*").eq("config_id", configData.id).order("name"),
        supabase.from("company_kpis").select("id, name").eq("company_id", companyId).eq("is_active", true),
        supabase.from("gamification_seasons").select("id, name, is_current").eq("config_id", configData.id),
      ]);

      setMissions(missionsRes.data || []);
      setBadges(badgesRes.data || []);
      setRewards(rewardsRes.data || []);
      setKpis(kpisRes.data || []);
      setSeasons(seasonsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Mission handlers
  const handleSaveMission = async () => {
    if (!config || !missionForm.name) return;

    try {
      const data = {
        ...missionForm,
        config_id: config.id,
        metric_kpi_id: missionForm.metric_kpi_id || null,
        season_id: missionForm.season_id || null,
        start_date: missionForm.start_date || null,
        end_date: missionForm.end_date || null,
        reward_badge_id: missionForm.reward_badge_id || null,
      };

      if (editingMission) {
        const { error } = await supabase
          .from("gamification_missions")
          .update(data)
          .eq("id", editingMission.id);
        if (error) throw error;
        toast.success("Missão atualizada");
      } else {
        const { error } = await supabase
          .from("gamification_missions")
          .insert(data);
        if (error) throw error;
        toast.success("Missão criada");
      }

      setShowMissionDialog(false);
      setEditingMission(null);
      resetMissionForm();
      fetchData();
    } catch (error) {
      console.error("Error saving mission:", error);
      toast.error("Erro ao salvar missão");
    }
  };

  const handleDeleteMission = async () => {
    if (!deletingMissionId) return;
    try {
      await supabase.from("gamification_mission_progress").delete().eq("mission_id", deletingMissionId);
      const { error } = await supabase.from("gamification_missions").delete().eq("id", deletingMissionId);
      if (error) throw error;
      toast.success("Missão excluída");
      setDeletingMissionId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting mission:", error);
      toast.error("Erro ao excluir missão");
    }
  };

  // Badge handlers
  const handleSaveBadge = async () => {
    if (!config || !badgeForm.name) return;

    try {
      const data = {
        ...badgeForm,
        config_id: config.id,
        condition_value: badgeForm.condition_value || null,
        condition_kpi_id: badgeForm.condition_kpi_id || null,
      };

      if (editingBadge) {
        const { error } = await supabase
          .from("gamification_badges")
          .update(data)
          .eq("id", editingBadge.id);
        if (error) throw error;
        toast.success("Badge atualizada");
      } else {
        const { error } = await supabase
          .from("gamification_badges")
          .insert(data);
        if (error) throw error;
        toast.success("Badge criada");
      }

      setShowBadgeDialog(false);
      setEditingBadge(null);
      resetBadgeForm();
      fetchData();
    } catch (error) {
      console.error("Error saving badge:", error);
      toast.error("Erro ao salvar badge");
    }
  };

  const handleDeleteBadge = async () => {
    if (!deletingBadgeId) return;
    try {
      await supabase.from("gamification_user_badges").delete().eq("badge_id", deletingBadgeId);
      const { error } = await supabase.from("gamification_badges").delete().eq("id", deletingBadgeId);
      if (error) throw error;
      toast.success("Badge excluída");
      setDeletingBadgeId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting badge:", error);
      toast.error("Erro ao excluir badge");
    }
  };

  // Reward handlers
  const handleSaveReward = async () => {
    if (!config || !rewardForm.name) return;

    try {
      const data = {
        ...rewardForm,
        config_id: config.id,
        value: rewardForm.value || null,
        mission_id: rewardForm.mission_id || null,
        season_id: rewardForm.season_id || null,
      };

      if (editingReward) {
        const { error } = await supabase
          .from("gamification_rewards")
          .update(data)
          .eq("id", editingReward.id);
        if (error) throw error;
        toast.success("Recompensa atualizada");
      } else {
        const { error } = await supabase
          .from("gamification_rewards")
          .insert(data);
        if (error) throw error;
        toast.success("Recompensa criada");
      }

      setShowRewardDialog(false);
      setEditingReward(null);
      resetRewardForm();
      fetchData();
    } catch (error) {
      console.error("Error saving reward:", error);
      toast.error("Erro ao salvar recompensa");
    }
  };

  const handleDeleteReward = async () => {
    if (!deletingRewardId) return;
    try {
      const { error } = await supabase.from("gamification_rewards").delete().eq("id", deletingRewardId);
      if (error) throw error;
      toast.success("Recompensa excluída");
      setDeletingRewardId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting reward:", error);
      toast.error("Erro ao excluir recompensa");
    }
  };

  // Form reset functions
  const resetMissionForm = () => {
    setMissionForm({
      name: "",
      description: "",
      mission_type: "individual",
      metric_kpi_id: "",
      condition_type: "reach_value",
      condition_value: 0,
      season_id: "",
      start_date: "",
      end_date: "",
      reward_points: 0,
      reward_badge_id: "",
      is_active: true,
    });
  };

  const resetBadgeForm = () => {
    setBadgeForm({
      name: "",
      description: "",
      icon: "star",
      condition_type: "points_threshold",
      condition_value: 0,
      condition_kpi_id: "",
      is_repeatable: false,
      show_on_profile: true,
      is_active: true,
    });
  };

  const resetRewardForm = () => {
    setRewardForm({
      name: "",
      description: "",
      reward_type: "money",
      value: 0,
      condition_type: "rank_position",
      condition_value: 1,
      mission_id: "",
      season_id: "",
      show_on_dashboard: true,
      is_active: true,
    });
  };

  // Edit handlers
  const openEditMission = (mission: Mission) => {
    setEditingMission(mission);
    setMissionForm({
      name: mission.name,
      description: mission.description || "",
      mission_type: mission.mission_type,
      metric_kpi_id: mission.metric_kpi_id || "",
      condition_type: mission.condition_type,
      condition_value: mission.condition_value,
      season_id: mission.season_id || "",
      start_date: mission.start_date || "",
      end_date: mission.end_date || "",
      reward_points: mission.reward_points,
      reward_badge_id: mission.reward_badge_id || "",
      is_active: mission.is_active,
    });
    setShowMissionDialog(true);
  };

  const openEditBadge = (badge: GamificationBadge) => {
    setEditingBadge(badge);
    setBadgeForm({
      name: badge.name,
      description: badge.description || "",
      icon: badge.icon,
      condition_type: badge.condition_type,
      condition_value: badge.condition_value || 0,
      condition_kpi_id: badge.condition_kpi_id || "",
      is_repeatable: badge.is_repeatable,
      show_on_profile: badge.show_on_profile,
      is_active: badge.is_active,
    });
    setShowBadgeDialog(true);
  };

  const openEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description || "",
      reward_type: reward.reward_type,
      value: reward.value || 0,
      condition_type: reward.condition_type,
      condition_value: reward.condition_value || 1,
      mission_id: reward.mission_id || "",
      season_id: reward.season_id || "",
      show_on_dashboard: reward.show_on_dashboard,
      is_active: reward.is_active,
    });
    setShowRewardDialog(true);
  };

  const getBadgeIcon = (iconName: string) => {
    const iconConfig = BADGE_ICONS.find(i => i.value === iconName);
    if (!iconConfig) return <Star className="h-4 w-4" />;
    const Icon = iconConfig.icon;
    return <Icon className="h-4 w-4" />;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Configure a gamificação primeiro na aba "Configurações".</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="missions" className="gap-2">
            <Target className="h-4 w-4" />
            Missões
          </TabsTrigger>
          <TabsTrigger value="badges" className="gap-2">
            <Award className="h-4 w-4" />
            Badges
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-2">
            <Gift className="h-4 w-4" />
            Recompensas
          </TabsTrigger>
        </TabsList>

        {/* Missions Tab */}
        <TabsContent value="missions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Missões</CardTitle>
                <CardDescription>Desafios para os participantes completarem</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetMissionForm(); setShowMissionDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Missão
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {missions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma missão criada. Crie missões para engajar o time.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Recompensa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missions.map((mission) => (
                      <TableRow key={mission.id}>
                        <TableCell className="font-medium">{mission.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {mission.mission_type === "individual" ? "Individual" : "Equipe"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mission.condition_type === "reach_value" && `Atingir ${mission.condition_value}`}
                          {mission.condition_type === "streak" && `${mission.condition_value} dias seguidos`}
                          {mission.condition_type === "top_rank" && `Top ${mission.condition_value}`}
                        </TableCell>
                        <TableCell>{mission.reward_points} pts</TableCell>
                        <TableCell>
                          <Badge variant={mission.is_active ? "default" : "secondary"}>
                            {mission.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditMission(mission)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingMissionId(mission.id)}>
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

        {/* Badges Tab */}
        <TabsContent value="badges" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Badges (Conquistas)</CardTitle>
                <CardDescription>Conquistas desbloqueáveis pelos participantes</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetBadgeForm(); setShowBadgeDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Badge
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma badge criada. Crie badges para reconhecer conquistas.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {badges.map((badge) => (
                    <Card key={badge.id} className="relative">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            {getBadgeIcon(badge.icon)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{badge.name}</h4>
                            <p className="text-sm text-muted-foreground">{badge.description}</p>
                            <div className="mt-2 flex gap-2">
                              <Badge variant={badge.is_active ? "default" : "secondary"} className="text-xs">
                                {badge.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                              {badge.is_repeatable && (
                                <Badge variant="outline" className="text-xs">Repetível</Badge>
                              )}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditBadge(badge)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingBadgeId(badge.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recompensas</CardTitle>
                <CardDescription>Prêmios para os melhores desempenhos</CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => { resetRewardForm(); setShowRewardDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Recompensa
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {rewards.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma recompensa criada. Configure prêmios para motivar o time.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.map((reward) => (
                      <TableRow key={reward.id}>
                        <TableCell className="font-medium">{reward.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reward.reward_type === "money" && "💵 Dinheiro"}
                            {reward.reward_type === "product" && "🎁 Produto"}
                            {reward.reward_type === "experience" && "🎉 Experiência"}
                            {reward.reward_type === "other" && "🏷️ Outro"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {reward.value ? `R$ ${reward.value.toLocaleString("pt-BR")}` : "-"}
                        </TableCell>
                        <TableCell>
                          {reward.condition_type === "rank_position" && `${reward.condition_value}º lugar`}
                          {reward.condition_type === "goal_achieved" && "Meta atingida"}
                          {reward.condition_type === "mission_complete" && "Missão completa"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={reward.is_active ? "default" : "secondary"}>
                            {reward.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditReward(reward)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeletingRewardId(reward.id)}>
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
      </Tabs>

      {/* Mission Dialog */}
      <Dialog open={showMissionDialog} onOpenChange={setShowMissionDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMission ? "Editar Missão" : "Nova Missão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={missionForm.name}
                onChange={(e) => setMissionForm({ ...missionForm, name: e.target.value })}
                placeholder="Ex: Bater 10 reuniões na semana"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={missionForm.description}
                onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })}
                placeholder="Descrição da missão"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={missionForm.mission_type}
                  onValueChange={(value) => setMissionForm({ ...missionForm, mission_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>KPI Base</Label>
                <Select
                  value={missionForm.metric_kpi_id}
                  onValueChange={(value) => setMissionForm({ ...missionForm, metric_kpi_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {kpis.map((kpi) => (
                      <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={missionForm.condition_type}
                  onValueChange={(value) => setMissionForm({ ...missionForm, condition_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reach_value">Atingir valor</SelectItem>
                    <SelectItem value="streak">Manter sequência</SelectItem>
                    <SelectItem value="top_rank">Estar no top N</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor da Condição</Label>
                <Input
                  type="number"
                  value={missionForm.condition_value}
                  onChange={(e) => setMissionForm({ ...missionForm, condition_value: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={missionForm.start_date}
                  onChange={(e) => setMissionForm({ ...missionForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={missionForm.end_date}
                  onChange={(e) => setMissionForm({ ...missionForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pontos de Recompensa</Label>
              <Input
                type="number"
                value={missionForm.reward_points}
                onChange={(e) => setMissionForm({ ...missionForm, reward_points: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={missionForm.is_active}
                onCheckedChange={(checked) => setMissionForm({ ...missionForm, is_active: checked })}
              />
              <Label>Missão ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMissionDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveMission}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge Dialog */}
      <Dialog open={showBadgeDialog} onOpenChange={setShowBadgeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBadge ? "Editar Badge" : "Nova Badge"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={badgeForm.name}
                onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
                placeholder="Ex: Primeira Venda"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={badgeForm.description}
                onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
                placeholder="Descrição da conquista"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select
                  value={badgeForm.icon}
                  onValueChange={(value) => setBadgeForm({ ...badgeForm, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGE_ICONS.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>{icon.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={badgeForm.condition_type}
                  onValueChange={(value) => setBadgeForm({ ...badgeForm, condition_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_sale">Primeira venda</SelectItem>
                    <SelectItem value="top_rank">Top do ranking</SelectItem>
                    <SelectItem value="streak">Sequência de dias</SelectItem>
                    <SelectItem value="points_threshold">Atingir X pontos</SelectItem>
                    <SelectItem value="mission_complete">Completar missão</SelectItem>
                    <SelectItem value="custom">Customizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(badgeForm.condition_type === "top_rank" || 
              badgeForm.condition_type === "streak" || 
              badgeForm.condition_type === "points_threshold") && (
              <div className="space-y-2">
                <Label>Valor da Condição</Label>
                <Input
                  type="number"
                  value={badgeForm.condition_value}
                  onChange={(e) => setBadgeForm({ ...badgeForm, condition_value: Number(e.target.value) })}
                />
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={badgeForm.is_repeatable}
                  onCheckedChange={(checked) => setBadgeForm({ ...badgeForm, is_repeatable: checked })}
                />
                <Label>Repetível</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={badgeForm.show_on_profile}
                  onCheckedChange={(checked) => setBadgeForm({ ...badgeForm, show_on_profile: checked })}
                />
                <Label>Mostrar no perfil</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={badgeForm.is_active}
                onCheckedChange={(checked) => setBadgeForm({ ...badgeForm, is_active: checked })}
              />
              <Label>Badge ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBadgeDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveBadge}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward Dialog */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReward ? "Editar Recompensa" : "Nova Recompensa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={rewardForm.name}
                onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                placeholder="Ex: Prêmio Top 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                placeholder="Descrição do prêmio"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={rewardForm.reward_type}
                  onValueChange={(value) => setRewardForm({ ...rewardForm, reward_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="money">💵 Dinheiro</SelectItem>
                    <SelectItem value="product">🎁 Produto</SelectItem>
                    <SelectItem value="experience">🎉 Experiência</SelectItem>
                    <SelectItem value="other">🏷️ Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={rewardForm.value}
                  onChange={(e) => setRewardForm({ ...rewardForm, value: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={rewardForm.condition_type}
                  onValueChange={(value) => setRewardForm({ ...rewardForm, condition_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank_position">Colocação no ranking</SelectItem>
                    <SelectItem value="goal_achieved">Meta atingida</SelectItem>
                    <SelectItem value="mission_complete">Missão completa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rewardForm.condition_type === "rank_position" && (
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <Input
                    type="number"
                    value={rewardForm.condition_value}
                    onChange={(e) => setRewardForm({ ...rewardForm, condition_value: Number(e.target.value) })}
                    min={1}
                  />
                </div>
              )}
            </div>

            {rewardForm.condition_type === "mission_complete" && (
              <div className="space-y-2">
                <Label>Missão</Label>
                <Select
                  value={rewardForm.mission_id}
                  onValueChange={(value) => setRewardForm({ ...rewardForm, mission_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {missions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={rewardForm.show_on_dashboard}
                  onCheckedChange={(checked) => setRewardForm({ ...rewardForm, show_on_dashboard: checked })}
                />
                <Label>Mostrar no Dashboard</Label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={rewardForm.is_active}
                onCheckedChange={(checked) => setRewardForm({ ...rewardForm, is_active: checked })}
              />
              <Label>Recompensa ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRewardDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveReward}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!deletingMissionId} onOpenChange={() => setDeletingMissionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir missão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A missão e seu progresso serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMission} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingBadgeId} onOpenChange={() => setDeletingBadgeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir badge?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A badge será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBadge} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingRewardId} onOpenChange={() => setDeletingRewardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recompensa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A recompensa será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReward} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
