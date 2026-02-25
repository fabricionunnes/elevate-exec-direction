import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Plus,
  BookOpen,
  Video,
  Settings,
  Trash2,
  Edit,
  GripVertical,
  ChevronRight,
  Upload,
  Image,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import type { AcademyUserContext } from "../AcademyLayout";

interface Track {
  id: string;
  name: string;
  description: string | null;
  category: string;
  cover_image_url: string | null;
  level: number;
  is_active: boolean;
  require_sequential_lessons: boolean;
  require_quiz_to_advance: boolean;
  min_quiz_score: number;
  lessons_count: number;
}

interface Module {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_provider: string;
  sort_order: number;
  is_active: boolean;
  points_on_complete: number;
  module_id: string | null;
}

const CATEGORIES = [
  { value: "gestao", label: "Gestão" },
  { value: "vendas", label: "Vendas" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "marketing", label: "Marketing" },
  { value: "geral", label: "Geral" },
];

const VIDEO_PROVIDERS = [
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "panda", label: "Panda Video" },
  { value: "google_drive", label: "Google Drive" },
  { value: "embed", label: "Embed genérico" },
];

export const AcademyAdminContentPage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track dialog
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [trackForm, setTrackForm] = useState({
    name: "",
    description: "",
    category: "geral",
    cover_image_url: null as string | null,
    level: 1,
    is_active: true,
    require_sequential_lessons: true,
    require_quiz_to_advance: true,
    min_quiz_score: 70,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonTrackId, setLessonTrackId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    description: "",
    video_url: "",
    video_provider: "youtube",
    points_on_complete: 10,
    is_active: true,
    module_id: null as string | null,
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "track" | "lesson"; id: string; name: string } | null>(null);

  // Expanded tracks for viewing lessons
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [trackLessons, setTrackLessons] = useState<Map<string, Lesson[]>>(new Map());

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      const { data } = await supabase
        .from("academy_tracks")
        .select(`
          *,
          academy_lessons(id)
        `)
        .order("level", { ascending: true })
        .order("sort_order", { ascending: true });

      if (data) {
        setTracks(
          data.map((t) => ({
            ...t,
            lessons_count: (t.academy_lessons as any[]).length,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading tracks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrackLessons = async (trackId: string) => {
    const { data } = await supabase
      .from("academy_lessons")
      .select("*")
      .eq("track_id", trackId)
      .order("sort_order", { ascending: true });

    if (data) {
      setTrackLessons((prev) => new Map(prev).set(trackId, data));
    }
    setExpandedTrack(trackId);
  };

  const moveLessonOrder = async (trackId: string, lessonIndex: number, direction: "up" | "down") => {
    const lessons = trackLessons.get(trackId);
    if (!lessons) return;

    const newIndex = direction === "up" ? lessonIndex - 1 : lessonIndex + 1;
    if (newIndex < 0 || newIndex >= lessons.length) return;

    const reordered = [...lessons];
    [reordered[lessonIndex], reordered[newIndex]] = [reordered[newIndex], reordered[lessonIndex]];

    // Optimistic update
    setTrackLessons((prev) => new Map(prev).set(trackId, reordered));

    // Persist
    try {
      const updates = reordered.map((l, i) =>
        supabase.from("academy_lessons").update({ sort_order: i + 1 }).eq("id", l.id)
      );
      await Promise.all(updates);
    } catch (error) {
      console.error("Error reordering:", error);
      toast.error("Erro ao reordenar");
      loadTrackLessons(trackId);
    }
  };

  const handleTrackSubmit = async () => {
    try {
      if (editingTrack) {
        const { error } = await supabase
          .from("academy_tracks")
          .update(trackForm)
          .eq("id", editingTrack.id);
        if (error) throw error;
        toast.success("Trilha atualizada!");
      } else {
        const { error } = await supabase.from("academy_tracks").insert(trackForm);
        if (error) throw error;
        toast.success("Trilha criada!");
      }

      setTrackDialogOpen(false);
      setEditingTrack(null);
      resetTrackForm();
      await loadTracks();
    } catch (error: any) {
      console.error("Error saving track:", error);
      toast.error(error?.message || "Erro ao salvar trilha");
    }
  };

  const handleLessonSubmit = async () => {
    if (!lessonTrackId) return;

    try {
      const lessonData = {
        ...lessonForm,
        track_id: lessonTrackId,
        sort_order: (trackLessons.get(lessonTrackId)?.length || 0) + 1,
      };

      if (editingLesson) {
        const { error } = await supabase
          .from("academy_lessons")
          .update(lessonData)
          .eq("id", editingLesson.id);
        if (error) throw error;
        toast.success("Aula atualizada!");
      } else {
        const { error } = await supabase.from("academy_lessons").insert(lessonData);
        if (error) throw error;
        toast.success("Aula criada!");
      }

      setLessonDialogOpen(false);
      setEditingLesson(null);
      resetLessonForm();
      loadTrackLessons(lessonTrackId);
      loadTracks();
    } catch (error: any) {
      console.error("Error saving lesson:", error);
      toast.error(error?.message || "Erro ao salvar aula");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.type === "track") {
        await supabase.from("academy_tracks").delete().eq("id", deleteConfirm.id);
        toast.success("Trilha excluída!");
        loadTracks();
      } else {
        await supabase.from("academy_lessons").delete().eq("id", deleteConfirm.id);
        toast.success("Aula excluída!");
        if (expandedTrack) loadTrackLessons(expandedTrack);
        loadTracks();
      }
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Erro ao excluir");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openEditTrack = (track: Track) => {
    setEditingTrack(track);
    setTrackForm({
      name: track.name,
      description: track.description || "",
      category: track.category,
      cover_image_url: track.cover_image_url,
      level: track.level,
      is_active: track.is_active,
      require_sequential_lessons: track.require_sequential_lessons,
      require_quiz_to_advance: track.require_quiz_to_advance,
      min_quiz_score: track.min_quiz_score,
    });
    setTrackDialogOpen(true);
  };

  const openAddLesson = (trackId: string) => {
    setLessonTrackId(trackId);
    setEditingLesson(null);
    resetLessonForm();
    setLessonDialogOpen(true);
  };

  const openEditLesson = (lesson: Lesson, trackId: string) => {
    setLessonTrackId(trackId);
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || "",
      video_url: lesson.video_url || "",
      video_provider: lesson.video_provider,
      points_on_complete: lesson.points_on_complete,
      is_active: lesson.is_active,
      module_id: lesson.module_id,
    });
    setLessonDialogOpen(true);
  };

  const resetTrackForm = () => {
    setTrackForm({
      name: "",
      description: "",
      category: "geral",
      cover_image_url: null,
      level: 1,
      is_active: true,
      require_sequential_lessons: true,
      require_quiz_to_advance: true,
      min_quiz_score: 70,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("academy-covers")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("academy-covers")
        .getPublicUrl(fileName);

      setTrackForm({ ...trackForm, cover_image_url: publicUrl });
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setTrackForm({ ...trackForm, cover_image_url: null });
  };

  const resetLessonForm = () => {
    setLessonForm({
      title: "",
      description: "",
      video_url: "",
      video_provider: "youtube",
      points_on_complete: 10,
      is_active: true,
      module_id: null,
    });
  };

  if (!userContext.isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-2">Acesso negado</h3>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Conteúdos</h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie trilhas, módulos e aulas
          </p>
        </div>
        <Button onClick={() => { setEditingTrack(null); resetTrackForm(); setTrackDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Trilha
        </Button>
      </div>

      {/* Tracks List */}
      <div className="space-y-4">
        {tracks.map((track) => (
          <Card key={track.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {track.name}
                      <Badge variant={track.is_active ? "default" : "secondary"}>
                        {track.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="outline">{track.category}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Nível {track.level} • {track.lessons_count} aulas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditTrack(track)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm({ type: "track", id: track.id, name: track.name })}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (expandedTrack === track.id) {
                        setExpandedTrack(null);
                      } else {
                        loadTrackLessons(track.id);
                      }
                    }}
                  >
                    {expandedTrack === track.id ? "Fechar" : "Ver aulas"}
                    <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${
                      expandedTrack === track.id ? "rotate-90" : ""
                    }`} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedTrack === track.id && (
              <CardContent className="pt-0">
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Aulas</h4>
                    <Button size="sm" onClick={() => openAddLesson(track.id)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Aula
                    </Button>
                  </div>

                  {(trackLessons.get(track.id) || []).map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => moveLessonOrder(track.id, index, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === (trackLessons.get(track.id) || []).length - 1}
                          onClick={() => moveLessonOrder(track.id, index, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{lesson.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {lesson.video_provider} • {lesson.points_on_complete} pontos
                        </p>
                      </div>
                      <Badge variant={lesson.is_active ? "default" : "secondary"}>
                        {lesson.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => openEditLesson(lesson, track.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm({ type: "lesson", id: lesson.id, name: lesson.title })}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}

                  {(trackLessons.get(track.id) || []).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhuma aula nesta trilha
                    </p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {tracks.length === 0 && (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma trilha criada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira trilha para começar.
            </p>
            <Button onClick={() => { setEditingTrack(null); resetTrackForm(); setTrackDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar trilha
            </Button>
          </Card>
        )}
      </div>

      {/* Track Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={setTrackDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTrack ? "Editar Trilha" : "Nova Trilha"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={trackForm.name}
                onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
                placeholder="Nome da trilha"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={trackForm.description}
                onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })}
                placeholder="Descrição da trilha"
              />
            </div>
            <div>
              <Label>Imagem de Capa</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                📐 <strong>Tamanho ideal:</strong> 400x600 pixels (proporção 2:3 vertical, estilo poster)
              </p>
              {trackForm.cover_image_url ? (
                <div className="relative mt-2">
                  <img 
                    src={trackForm.cover_image_url} 
                    alt="Capa da trilha"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="mt-2 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploadingImage ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Clique para enviar uma imagem
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG (max. 5MB)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </label>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={trackForm.category}
                  onValueChange={(v) => setTrackForm({ ...trackForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nível</Label>
                <Select
                  value={trackForm.level.toString()}
                  onValueChange={(v) => setTrackForm({ ...trackForm, level: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((l) => (
                      <SelectItem key={l} value={l.toString()}>
                        Nível {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nota mínima na prova (%)</Label>
              <Input
                type="number"
                value={trackForm.min_quiz_score}
                onChange={(e) => setTrackForm({ ...trackForm, min_quiz_score: parseInt(e.target.value) || 70 })}
                min={0}
                max={100}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Trilha ativa</Label>
                <Switch
                  checked={trackForm.is_active}
                  onCheckedChange={(v) => setTrackForm({ ...trackForm, is_active: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aulas em sequência</Label>
                <Switch
                  checked={trackForm.require_sequential_lessons}
                  onCheckedChange={(v) => setTrackForm({ ...trackForm, require_sequential_lessons: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Exigir prova para avançar</Label>
                <Switch
                  checked={trackForm.require_quiz_to_advance}
                  onCheckedChange={(v) => setTrackForm({ ...trackForm, require_quiz_to_advance: v })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setTrackDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleTrackSubmit} disabled={!trackForm.name}>
                {editingTrack ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLesson ? "Editar Aula" : "Nova Aula"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={lessonForm.title}
                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                placeholder="Título da aula"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                placeholder="Descrição da aula"
              />
            </div>
            <div>
              <Label>Provedor de vídeo</Label>
              <Select
                value={lessonForm.video_provider}
                onValueChange={(v) => setLessonForm({ ...lessonForm, video_provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>URL do vídeo</Label>
              <Input
                value={lessonForm.video_url}
                onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Pontos ao concluir</Label>
              <Input
                type="number"
                value={lessonForm.points_on_complete}
                onChange={(e) => setLessonForm({ ...lessonForm, points_on_complete: parseInt(e.target.value) || 10 })}
                min={0}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Aula ativa</Label>
              <Switch
                checked={lessonForm.is_active}
                onCheckedChange={(v) => setLessonForm({ ...lessonForm, is_active: v })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleLessonSubmit} disabled={!lessonForm.title}>
                {editingLesson ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteConfirm?.type === "track" ? "a trilha" : "a aula"}{" "}
              <strong>{deleteConfirm?.name}</strong>?
              {deleteConfirm?.type === "track" && (
                <span className="block mt-2 text-red-600">
                  Atenção: Isso também excluirá todas as aulas desta trilha.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AcademyAdminContentPage;
