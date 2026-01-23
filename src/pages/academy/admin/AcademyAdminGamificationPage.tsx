import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Award,
  Star,
  Plus,
  Edit,
  Trash2,
  Settings,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";

interface GamificationConfig {
  id: string;
  points_per_lesson: number;
  points_per_module: number;
  points_per_track: number;
  points_per_quiz_pass: number;
  points_bonus_perfect_score: number;
  points_streak_7_days: number;
  enable_ranking: boolean;
  enable_badges: boolean;
}

interface BadgeEntry {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  criteria_type: string;
  criteria_value: number | null;
  points_reward: number;
  is_active: boolean;
}

interface LevelDefinition {
  id: string;
  level: number;
  name: string;
  min_points: number;
  icon: string | null;
  color: string | null;
}

const BADGE_ICONS = [
  { value: "Award", label: "Medalha" },
  { value: "Trophy", label: "Troféu" },
  { value: "Star", label: "Estrela" },
  { value: "Zap", label: "Raio" },
  { value: "Flame", label: "Fogo" },
  { value: "Target", label: "Alvo" },
  { value: "Crown", label: "Coroa" },
  { value: "Medal", label: "Medalha 2" },
  { value: "Flag", label: "Bandeira" },
  { value: "CheckCircle", label: "Check" },
  { value: "Play", label: "Play" },
];

const CRITERIA_TYPES = [
  { value: "first_lesson", label: "Primeira aula" },
  { value: "first_quiz", label: "Primeira prova" },
  { value: "track_complete", label: "Trilha concluída" },
  { value: "streak_7", label: "Sequência de 7 dias" },
  { value: "perfect_score", label: "Nota 100%" },
  { value: "top_3", label: "Top 3 ranking" },
  { value: "lessons_count", label: "Número de aulas" },
  { value: "custom", label: "Personalizado" },
];

export const AcademyAdminGamificationPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [levels, setLevels] = useState<LevelDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Badge dialog
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeEntry | null>(null);
  const [badgeForm, setBadgeForm] = useState({
    name: "",
    description: "",
    icon: "Award",
    color: "#FFD700",
    criteria_type: "first_lesson",
    criteria_value: 1,
    points_reward: 10,
    is_active: true,
  });

  // Level dialog
  const [levelDialogOpen, setLevelDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<LevelDefinition | null>(null);
  const [levelForm, setLevelForm] = useState({
    level: 1,
    name: "",
    min_points: 0,
    icon: "Star",
    color: "#FFD700",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load config
      const { data: configData } = await supabase
        .from("academy_gamification_config")
        .select("*")
        .is("company_id", null)
        .single();

      if (configData) {
        setConfig(configData);
      }

      // Load badges
      const { data: badgesData } = await supabase
        .from("academy_badges")
        .select("*")
        .order("sort_order");

      setBadges(badgesData || []);

      // Load levels
      const { data: levelsData } = await supabase
        .from("academy_level_definitions")
        .select("*")
        .order("level");

      setLevels(levelsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;

    try {
      await supabase
        .from("academy_gamification_config")
        .update({
          points_per_lesson: config.points_per_lesson,
          points_per_module: config.points_per_module,
          points_per_track: config.points_per_track,
          points_per_quiz_pass: config.points_per_quiz_pass,
          points_bonus_perfect_score: config.points_bonus_perfect_score,
          points_streak_7_days: config.points_streak_7_days,
          enable_ranking: config.enable_ranking,
          enable_badges: config.enable_badges,
        })
        .eq("id", config.id);

      toast.success("Configurações salvas!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Erro ao salvar configurações");
    }
  };

  const handleSaveBadge = async () => {
    try {
      if (editingBadge) {
        await supabase
          .from("academy_badges")
          .update(badgeForm)
          .eq("id", editingBadge.id);
        toast.success("Conquista atualizada!");
      } else {
        await supabase.from("academy_badges").insert([{
          ...badgeForm,
          sort_order: badges.length + 1,
        }]);
        toast.success("Conquista criada!");
      }

      setBadgeDialogOpen(false);
      setEditingBadge(null);
      resetBadgeForm();
      loadData();
    } catch (error) {
      console.error("Error saving badge:", error);
      toast.error("Erro ao salvar conquista");
    }
  };

  const handleSaveLevel = async () => {
    try {
      if (editingLevel) {
        await supabase
          .from("academy_level_definitions")
          .update(levelForm)
          .eq("id", editingLevel.id);
        toast.success("Nível atualizado!");
      } else {
        await supabase.from("academy_level_definitions").insert([levelForm]);
        toast.success("Nível criado!");
      }

      setLevelDialogOpen(false);
      setEditingLevel(null);
      resetLevelForm();
      loadData();
    } catch (error) {
      console.error("Error saving level:", error);
      toast.error("Erro ao salvar nível");
    }
  };

  const handleDeleteBadge = async (id: string) => {
    try {
      await supabase.from("academy_badges").delete().eq("id", id);
      toast.success("Conquista excluída!");
      loadData();
    } catch (error) {
      console.error("Error deleting badge:", error);
      toast.error("Erro ao excluir");
    }
  };

  const handleDeleteLevel = async (id: string) => {
    try {
      await supabase.from("academy_level_definitions").delete().eq("id", id);
      toast.success("Nível excluído!");
      loadData();
    } catch (error) {
      console.error("Error deleting level:", error);
      toast.error("Erro ao excluir");
    }
  };

  const openEditBadge = (badge: BadgeEntry) => {
    setEditingBadge(badge);
    setBadgeForm({
      name: badge.name,
      description: badge.description || "",
      icon: badge.icon,
      color: badge.color,
      criteria_type: badge.criteria_type,
      criteria_value: badge.criteria_value || 1,
      points_reward: badge.points_reward,
      is_active: badge.is_active,
    });
    setBadgeDialogOpen(true);
  };

  const openEditLevel = (level: LevelDefinition) => {
    setEditingLevel(level);
    setLevelForm({
      level: level.level,
      name: level.name,
      min_points: level.min_points,
      icon: level.icon || "Star",
      color: level.color || "#FFD700",
    });
    setLevelDialogOpen(true);
  };

  const resetBadgeForm = () => {
    setBadgeForm({
      name: "",
      description: "",
      icon: "Award",
      color: "#FFD700",
      criteria_type: "first_lesson",
      criteria_value: 1,
      points_reward: 10,
      is_active: true,
    });
  };

  const resetLevelForm = () => {
    setLevelForm({
      level: levels.length + 1,
      name: "",
      min_points: 0,
      icon: "Star",
      color: "#FFD700",
    });
  };

  if (!userContext.isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Acesso negado</h3>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gamificação</h1>
        <p className="text-muted-foreground mt-1">
          Configure pontos, níveis e conquistas
        </p>
      </div>

      {/* Points Config */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração de Pontos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Pontos por aula</Label>
                <Input
                  type="number"
                  value={config.points_per_lesson}
                  onChange={(e) => setConfig({ ...config, points_per_lesson: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Pontos por módulo</Label>
                <Input
                  type="number"
                  value={config.points_per_module}
                  onChange={(e) => setConfig({ ...config, points_per_module: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Pontos por trilha</Label>
                <Input
                  type="number"
                  value={config.points_per_track}
                  onChange={(e) => setConfig({ ...config, points_per_track: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Pontos por prova aprovada</Label>
                <Input
                  type="number"
                  value={config.points_per_quiz_pass}
                  onChange={(e) => setConfig({ ...config, points_per_quiz_pass: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Bônus nota 100%</Label>
                <Input
                  type="number"
                  value={config.points_bonus_perfect_score}
                  onChange={(e) => setConfig({ ...config, points_bonus_perfect_score: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Bônus 7 dias seguidos</Label>
                <Input
                  type="number"
                  value={config.points_streak_7_days}
                  onChange={(e) => setConfig({ ...config, points_streak_7_days: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enable_ranking}
                  onCheckedChange={(v) => setConfig({ ...config, enable_ranking: v })}
                />
                <Label>Ranking habilitado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enable_badges}
                  onCheckedChange={(v) => setConfig({ ...config, enable_badges: v })}
                />
                <Label>Conquistas habilitadas</Label>
              </div>
            </div>

            <Button onClick={handleSaveConfig}>
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Levels */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Níveis
            </CardTitle>
            <Button size="sm" onClick={() => { setEditingLevel(null); resetLevelForm(); setLevelDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Nível
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {levels.map((level) => (
              <div
                key={level.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${level.color}20` }}
                  >
                    <Star className="h-5 w-5" style={{ color: level.color || "#FFD700" }} />
                  </div>
                  <div>
                    <p className="font-medium">Nível {level.level}: {level.name}</p>
                    <p className="text-sm text-muted-foreground">
                      A partir de {level.min_points} pontos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditLevel(level)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteLevel(level.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Conquistas
            </CardTitle>
            <Button size="sm" onClick={() => { setEditingBadge(null); resetBadgeForm(); setBadgeDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Conquista
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <Card key={badge.id} className={!badge.is_active ? "opacity-60" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${badge.color}20` }}
                      >
                        <Award className="h-6 w-6" style={{ color: badge.color }} />
                      </div>
                      <div>
                        <p className="font-semibold">{badge.name}</p>
                        <p className="text-xs text-muted-foreground">{badge.description}</p>
                        <Badge variant="secondary" className="mt-1">
                          +{badge.points_reward} pts
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditBadge(badge)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteBadge(badge.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Badge Dialog */}
      <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBadge ? "Editar Conquista" : "Nova Conquista"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={badgeForm.name}
                onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={badgeForm.description}
                onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ícone</Label>
                <Select value={badgeForm.icon} onValueChange={(v) => setBadgeForm({ ...badgeForm, icon: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGE_ICONS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Input
                  type="color"
                  value={badgeForm.color}
                  onChange={(e) => setBadgeForm({ ...badgeForm, color: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Critério</Label>
                <Select value={badgeForm.criteria_type} onValueChange={(v) => setBadgeForm({ ...badgeForm, criteria_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITERIA_TYPES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pontos de recompensa</Label>
                <Input
                  type="number"
                  value={badgeForm.points_reward}
                  onChange={(e) => setBadgeForm({ ...badgeForm, points_reward: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={badgeForm.is_active}
                onCheckedChange={(v) => setBadgeForm({ ...badgeForm, is_active: v })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBadgeDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveBadge} disabled={!badgeForm.name}>
                {editingBadge ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Level Dialog */}
      <Dialog open={levelDialogOpen} onOpenChange={setLevelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Número do nível</Label>
                <Input
                  type="number"
                  value={levelForm.level}
                  onChange={(e) => setLevelForm({ ...levelForm, level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  value={levelForm.name}
                  onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Pontos mínimos</Label>
              <Input
                type="number"
                value={levelForm.min_points}
                onChange={(e) => setLevelForm({ ...levelForm, min_points: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Cor</Label>
              <Input
                type="color"
                value={levelForm.color}
                onChange={(e) => setLevelForm({ ...levelForm, color: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLevelDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveLevel} disabled={!levelForm.name}>
                {editingLevel ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyAdminGamificationPage;
