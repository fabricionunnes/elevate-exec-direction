import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Target,
  GraduationCap,
  Award,
  CheckCircle2,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface CareerLevel {
  name: string;
  criteria?: string;
  min_months?: number;
  salary_min?: number | null;
  salary_max?: number | null;
  responsibilities?: string[];
  hard_skills?: string[];
  soft_skills?: string[];
  certifications?: string[];
  performance_min?: number | null; // 0..100
  promotion_rules?: string;
}

interface CareerTrack {
  id: string;
  name: string;
  area: string | null;
  levels: CareerLevel[];
  created_at: string;
}

const DEFAULT_LEVELS: CareerLevel[] = [
  {
    name: "Júnior",
    criteria: "Iniciante, supervisão constante",
    min_months: 0,
    responsibilities: [],
    hard_skills: [],
    soft_skills: [],
    certifications: [],
    promotion_rules: "",
  },
  {
    name: "Pleno",
    criteria: "Autonomia em tarefas padrão",
    min_months: 18,
    responsibilities: [],
    hard_skills: [],
    soft_skills: [],
    certifications: [],
    promotion_rules: "",
  },
  {
    name: "Sênior",
    criteria: "Autonomia total + mentoria",
    min_months: 36,
    responsibilities: [],
    hard_skills: [],
    soft_skills: [],
    certifications: [],
    promotion_rules: "",
  },
  {
    name: "Especialista",
    criteria: "Referência técnica da área",
    min_months: 60,
    responsibilities: [],
    hard_skills: [],
    soft_skills: [],
    certifications: [],
    promotion_rules: "",
  },
];

// Editor de listas (chips) — adiciona/remove itens textuais
function ListField({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: any;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...(value || []), t]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" /> {label}
      </Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {(value || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((item, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              <span className="text-xs">{item}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Diálogo: criar/editar nível (com TODAS as regras de promoção)
function LevelEditor({
  open,
  onOpenChange,
  initial,
  onSave,
  levelIndex,
  totalLevels,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: CareerLevel | null;
  onSave: (lvl: CareerLevel) => void;
  levelIndex?: number;
  totalLevels?: number;
}) {
  const [lvl, setLvl] = useState<CareerLevel>(
    initial || {
      name: "",
      criteria: "",
      min_months: 0,
      responsibilities: [],
      hard_skills: [],
      soft_skills: [],
      certifications: [],
      promotion_rules: "",
    },
  );

  useEffect(() => {
    if (open) {
      setLvl(
        initial || {
          name: "",
          criteria: "",
          min_months: 0,
          responsibilities: [],
          hard_skills: [],
          soft_skills: [],
          certifications: [],
          promotion_rules: "",
        },
      );
    }
  }, [open, initial]);

  const isPromotionLevel =
    typeof levelIndex === "number" && typeof totalLevels === "number" && levelIndex < totalLevels - 1;

  const submit = () => {
    if (!lvl.name.trim()) return toast.error("Dê um nome ao nível.");
    onSave({
      ...lvl,
      min_months: Number(lvl.min_months) || 0,
      salary_min: lvl.salary_min ? Number(lvl.salary_min) : null,
      salary_max: lvl.salary_max ? Number(lvl.salary_max) : null,
      performance_min: lvl.performance_min ? Number(lvl.performance_min) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            {initial ? "Editar nível" : "Novo nível"}
          </DialogTitle>
          <DialogDescription>
            Defina o que o colaborador precisa entregar para alcançar e ser promovido deste nível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs">Nome do nível</Label>
              <Input
                value={lvl.name}
                onChange={(e) => setLvl({ ...lvl, name: e.target.value })}
                placeholder="Ex: Sênior, Coordenador, Tech Lead"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" /> Tempo mínimo (meses)
              </Label>
              <Input
                type="number"
                min={0}
                value={lvl.min_months ?? 0}
                onChange={(e) => setLvl({ ...lvl, min_months: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Resumo / critério geral</Label>
            <Input
              value={lvl.criteria || ""}
              onChange={(e) => setLvl({ ...lvl, criteria: e.target.value })}
              placeholder="Resumo do que se espera neste nível"
            />
          </div>

          {/* Faixa salarial e performance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Salário mínimo (R$)</Label>
              <Input
                type="number"
                min={0}
                value={lvl.salary_min ?? ""}
                onChange={(e) =>
                  setLvl({ ...lvl, salary_min: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Salário máximo (R$)</Label>
              <Input
                type="number"
                min={0}
                value={lvl.salary_max ?? ""}
                onChange={(e) =>
                  setLvl({ ...lvl, salary_max: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nota mínima de avaliação (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={lvl.performance_min ?? ""}
                onChange={(e) =>
                  setLvl({
                    ...lvl,
                    performance_min: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ex: 80"
              />
            </div>
          </div>

          {/* Listas de competências/responsabilidades */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ListField
              label="Responsabilidades"
              icon={Target}
              value={lvl.responsibilities || []}
              onChange={(v) => setLvl({ ...lvl, responsibilities: v })}
              placeholder="Ex: Liderar squad de 3 pessoas"
            />
            <ListField
              label="Hard skills (técnicas)"
              icon={GraduationCap}
              value={lvl.hard_skills || []}
              onChange={(v) => setLvl({ ...lvl, hard_skills: v })}
              placeholder="Ex: SQL avançado"
            />
            <ListField
              label="Soft skills (comportamentais)"
              icon={CheckCircle2}
              value={lvl.soft_skills || []}
              onChange={(v) => setLvl({ ...lvl, soft_skills: v })}
              placeholder="Ex: Comunicação assertiva"
            />
            <ListField
              label="Certificações exigidas"
              icon={Award}
              value={lvl.certifications || []}
              onChange={(v) => setLvl({ ...lvl, certifications: v })}
              placeholder="Ex: Scrum Master"
            />
          </div>

          {/* Regras explícitas para promoção */}
          <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-primary" />
              Regras para ser promovido {isPromotionLevel ? "ao próximo nível" : "(nível final da trilha)"}
            </Label>
            <Textarea
              rows={4}
              value={lvl.promotion_rules || ""}
              onChange={(e) => setLvl({ ...lvl, promotion_rules: e.target.value })}
              placeholder={
                isPromotionLevel
                  ? "Ex: Cumprir tempo mínimo + nota ≥ 85% nas 2 últimas avaliações + concluir trilha de liderança + ter aprovação do gestor + entregar 1 projeto estratégico no ano."
                  : "Topo da trilha — descreva critérios para mover-se para outra trilha ou cargo de gestão."
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Liste todos os critérios objetivos. Quanto mais claro, mais justa a promoção.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{initial ? "Salvar" : "Adicionar nível"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useProfileViewerScope } from "@/hooks/useProfileViewerScope";

export default function UNVProfileCareerPage() {
  const { isAdmin, employeeId, loading: scopeLoading } = useProfileViewerScope();
  const [tracks, setTracks] = useState<CareerTrack[]>([]);
  const [loading, setLoading] = useState(true);

  // Nova trilha
  const [openTrack, setOpenTrack] = useState(false);
  const [trackForm, setTrackForm] = useState({ name: "", area: "" });

  // Edição de níveis
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);
  const [editingLevel, setEditingLevel] = useState<CareerLevel | null>(null);

  // Detalhe do nível
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLevel, setDetailLevel] = useState<{
    track: CareerTrack;
    level: CareerLevel;
    index: number;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profile_career_tracks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro: " + error.message);
      setLoading(false);
      return;
    }
    let allTracks = (data || []).map((t: any) => ({
      ...t,
      levels: Array.isArray(t.levels) ? t.levels : [],
    }));

    // Não-admin: filtra somente a trilha relacionada ao cargo/área do colaborador.
    if (!isAdmin && employeeId) {
      const { data: emp } = await supabase
        .from("profile_employees")
        .select("position_id, department_id, profile_positions(name, area), profile_departments(name)")
        .eq("id", employeeId)
        .maybeSingle();
      const empArea = ((emp as any)?.profile_positions?.area || (emp as any)?.profile_departments?.name || "").toLowerCase();
      const empPos = ((emp as any)?.profile_positions?.name || "").toLowerCase();
      if (empArea || empPos) {
        allTracks = allTracks.filter((t) => {
          const a = (t.area || "").toLowerCase();
          const n = (t.name || "").toLowerCase();
          return (empArea && (a.includes(empArea) || empArea.includes(a) || n.includes(empArea))) ||
                 (empPos && (n.includes(empPos) || empPos.includes(n)));
        });
      } else {
        allTracks = [];
      }
    } else if (!isAdmin) {
      allTracks = [];
    }

    setTracks(allTracks);
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading) load();
  }, [scopeLoading, isAdmin, employeeId]);

  const createTrack = async () => {
    if (!trackForm.name.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase
      .from("profile_career_tracks")
      .insert({ name: trackForm.name.trim(), area: trackForm.area.trim() || null, levels: DEFAULT_LEVELS as any });
    if (error) return toast.error(error.message);
    toast.success("Trilha criada com níveis padrão");
    setOpenTrack(false);
    setTrackForm({ name: "", area: "" });
    load();
  };

  const deleteTrack = async (id: string) => {
    if (!confirm("Excluir a trilha inteira? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("profile_career_tracks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Trilha excluída");
    load();
  };

  const persistLevels = async (trackId: string, levels: CareerLevel[]) => {
    const { error } = await supabase
      .from("profile_career_tracks")
      .update({ levels: levels as any })
      .eq("id", trackId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const saveLevel = async (lvl: CareerLevel) => {
    if (!editingTrackId) return;
    const track = tracks.find((t) => t.id === editingTrackId);
    if (!track) return;
    const next = [...track.levels];
    if (editingLevelIndex === null) {
      next.push(lvl);
    } else {
      next[editingLevelIndex] = lvl;
    }
    const ok = await persistLevels(editingTrackId, next);
    if (ok) {
      toast.success("Nível salvo");
      setEditorOpen(false);
      setEditingLevel(null);
      setEditingLevelIndex(null);
      setEditingTrackId(null);
      load();
    }
  };

  const removeLevel = async (trackId: string, idx: number) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    if (!confirm(`Remover o nível "${track.levels[idx].name}"?`)) return;
    const next = track.levels.filter((_, i) => i !== idx);
    const ok = await persistLevels(trackId, next);
    if (ok) {
      toast.success("Nível removido");
      load();
    }
  };

  const moveLevel = async (trackId: string, idx: number, dir: -1 | 1) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const next = [...track.levels];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    const ok = await persistLevels(trackId, next);
    if (ok) load();
  };

  const totalLevels = useMemo(
    () => tracks.reduce((acc, t) => acc + (t.levels?.length || 0), 0),
    [tracks],
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Plano de Carreira
          </h1>
          <p className="text-sm text-muted-foreground">
            Trilhas com regras claras de promoção em cada nível
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline">
            {tracks.length} trilhas · {totalLevels} níveis
          </Badge>
          {isAdmin && (
            <Button onClick={() => setOpenTrack(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova trilha
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Crie sua primeira trilha de carreira clicando em <strong>Nova trilha</strong>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tracks.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.area && <p className="text-xs text-muted-foreground">{t.area}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingTrackId(t.id);
                          setEditingLevelIndex(null);
                          setEditingLevel(null);
                          setEditorOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nível
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTrack(t.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {t.levels.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhum nível ainda. Clique em "+ Nível" para começar.
                  </p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {t.levels.map((lvl, i) => (
                      <div
                        key={i}
                        className="min-w-[240px] max-w-[260px] border rounded-lg p-3 bg-card hover:border-primary/40 transition-colors flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="default">Nível {i + 1}</Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {lvl.min_months || 0}m+
                          </span>
                        </div>
                        <p className="font-semibold text-sm">{lvl.name}</p>
                        {lvl.criteria && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {lvl.criteria}
                          </p>
                        )}

                        {/* Mini-resumo das regras */}
                        <div className="mt-2 space-y-1 text-[11px]">
                          {(lvl.salary_min || lvl.salary_max) && (
                            <p className="text-muted-foreground">
                              💰{" "}
                              {lvl.salary_min
                                ? `R$ ${Number(lvl.salary_min).toLocaleString("pt-BR")}`
                                : "—"}
                              {" → "}
                              {lvl.salary_max
                                ? `R$ ${Number(lvl.salary_max).toLocaleString("pt-BR")}`
                                : "—"}
                            </p>
                          )}
                          {lvl.performance_min ? (
                            <p className="text-muted-foreground">
                              🎯 Avaliação ≥ {lvl.performance_min}%
                            </p>
                          ) : null}
                          {(lvl.responsibilities?.length || 0) > 0 && (
                            <p className="text-muted-foreground">
                              📋 {lvl.responsibilities!.length} responsabilidades
                            </p>
                          )}
                          {((lvl.hard_skills?.length || 0) +
                            (lvl.soft_skills?.length || 0) +
                            (lvl.certifications?.length || 0)) >
                            0 && (
                            <p className="text-muted-foreground">
                              🎓{" "}
                              {(lvl.hard_skills?.length || 0) +
                                (lvl.soft_skills?.length || 0) +
                                (lvl.certifications?.length || 0)}{" "}
                              competências
                            </p>
                          )}
                          {lvl.promotion_rules && (
                            <p className="text-primary font-medium line-clamp-2">
                              ✅ Regras de promoção definidas
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1 mt-3 pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs flex-1"
                            onClick={() => {
                              setDetailLevel({ track: t, level: lvl, index: i });
                              setDetailOpen(true);
                            }}
                          >
                            Ver
                          </Button>
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingTrackId(t.id);
                                  setEditingLevelIndex(i);
                                  setEditingLevel(lvl);
                                  setEditorOpen(true);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moveLevel(t.id, i, -1)}
                                disabled={i === 0}
                              >
                                ←
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moveLevel(t.id, i, 1)}
                                disabled={i === t.levels.length - 1}
                              >
                                →
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeLevel(t.id, i)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Nova trilha */}
      <Dialog open={openTrack} onOpenChange={setOpenTrack}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova trilha de carreira</DialogTitle>
            <DialogDescription>
              Os 4 níveis padrão (Júnior → Especialista) serão criados automaticamente. Você pode
              editá-los depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome da trilha</Label>
              <Input
                placeholder="Ex: Vendas, Engenharia, Marketing"
                value={trackForm.name}
                onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Área (opcional)</Label>
              <Input
                placeholder="Ex: Comercial"
                value={trackForm.area}
                onChange={(e) => setTrackForm({ ...trackForm, area: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenTrack(false)}>
              Cancelar
            </Button>
            <Button onClick={createTrack}>Criar trilha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor de nível */}
      <LevelEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) {
            setEditingLevel(null);
            setEditingLevelIndex(null);
            setEditingTrackId(null);
          }
        }}
        initial={editingLevel}
        onSave={saveLevel}
        levelIndex={editingLevelIndex ?? undefined}
        totalLevels={
          editingTrackId ? tracks.find((t) => t.id === editingTrackId)?.levels.length : undefined
        }
      />

      {/* Detalhe do nível */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              {detailLevel?.track.name} — Nível {detailLevel ? detailLevel.index + 1 : ""}:{" "}
              {detailLevel?.level.name}
            </DialogTitle>
            {detailLevel?.level.criteria && (
              <DialogDescription>{detailLevel.level.criteria}</DialogDescription>
            )}
          </DialogHeader>

          {detailLevel && (
            <div className="space-y-4 py-1 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5">
                  <p className="text-[11px] text-muted-foreground">Tempo mínimo</p>
                  <p className="font-semibold">{detailLevel.level.min_months || 0} meses</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-[11px] text-muted-foreground">Avaliação mínima</p>
                  <p className="font-semibold">
                    {detailLevel.level.performance_min
                      ? `${detailLevel.level.performance_min}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-2.5 col-span-2">
                  <p className="text-[11px] text-muted-foreground">Faixa salarial</p>
                  <p className="font-semibold">
                    {detailLevel.level.salary_min
                      ? `R$ ${Number(detailLevel.level.salary_min).toLocaleString("pt-BR")}`
                      : "—"}
                    {" → "}
                    {detailLevel.level.salary_max
                      ? `R$ ${Number(detailLevel.level.salary_max).toLocaleString("pt-BR")}`
                      : "—"}
                  </p>
                </div>
              </div>

              {(["responsibilities", "hard_skills", "soft_skills", "certifications"] as const).map(
                (k) => {
                  const labelMap: Record<string, { label: string; icon: any }> = {
                    responsibilities: { label: "Responsabilidades", icon: Target },
                    hard_skills: { label: "Hard skills", icon: GraduationCap },
                    soft_skills: { label: "Soft skills", icon: CheckCircle2 },
                    certifications: { label: "Certificações", icon: Award },
                  };
                  const list = (detailLevel.level[k] as string[]) || [];
                  if (list.length === 0) return null;
                  const Icon = labelMap[k].icon;
                  return (
                    <div key={k}>
                      <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                        <Icon className="w-3.5 h-3.5 text-primary" /> {labelMap[k].label}
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                        {list.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                },
              )}

              {detailLevel.level.promotion_rules && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-primary" /> Regras para promoção
                  </p>
                  <p className="text-xs whitespace-pre-wrap">
                    {detailLevel.level.promotion_rules}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>
              Fechar
            </Button>
            {detailLevel && (
              <Button
                onClick={() => {
                  setEditingTrackId(detailLevel.track.id);
                  setEditingLevelIndex(detailLevel.index);
                  setEditingLevel(detailLevel.level);
                  setDetailOpen(false);
                  setEditorOpen(true);
                }}
              >
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
