import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Presentation, FolderOpen, Trash2, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SlideCreationForm } from "@/components/slide-generator/SlideCreationForm";
import { SlideViewer } from "@/components/slide-generator/SlideViewer";
import { SlideTemplateLibrary } from "@/components/slide-generator/SlideTemplateLibrary";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Presentation {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  audience: string | null;
  duration_minutes: number | null;
  content_level: string | null;
  status: string | null;
  slide_count: number | null;
  is_template: boolean | null;
  template_category: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

type ViewMode = "library" | "create" | "view" | "templates";

export default function SlideGeneratorPage() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("library");
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (staff && ["admin", "master"].includes(staff.role)) {
        setIsAdmin(true);
      }
    };
    fetchUserRole();
  }, []);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      const { data, error } = await supabase
        .from("slide_presentations")
        .select("*")
        .eq("is_template", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPresentations((data as unknown as Presentation[]) || []);
    } catch (err) {
      console.error("Error loading presentations:", err);
      toast.error("Erro ao carregar apresentações");
    } finally {
      setLoading(false);
    }
  };

  const handlePresentationCreated = (id: string) => {
    setSelectedPresentationId(id);
    setViewMode("view");
    loadPresentations();
  };

  const handleDuplicate = async (presentation: Presentation) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get staff_id
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.user.id)
        .eq("is_active", true)
        .maybeSingle();

      // Duplicate presentation
      const { data: newPres, error: presError } = await supabase
        .from("slide_presentations")
        .insert({
          title: `${presentation.title} (cópia)`,
          description: presentation.description,
          topic: presentation.topic,
          audience: presentation.audience,
          duration_minutes: presentation.duration_minutes,
          content_level: presentation.content_level,
          created_by: user.user.id,
          staff_id: staffData?.id || null,
          slide_count: presentation.slide_count,
        } as any)
        .select()
        .single();

      if (presError) throw presError;

      // Duplicate slides
      const { data: slides } = await supabase
        .from("slide_items")
        .select("*")
        .eq("presentation_id", presentation.id)
        .order("sort_order");

      if (slides?.length) {
        const newSlides = slides.map((s: any) => ({
          presentation_id: (newPres as any).id,
          slide_number: s.slide_number,
          slide_type: s.slide_type,
          title: s.title,
          subtitle: s.subtitle,
          content: s.content,
          speaker_notes: s.speaker_notes,
          layout_type: s.layout_type,
          sort_order: s.sort_order,
        }));
        await supabase.from("slide_items").insert(newSlides as any);
      }

      toast.success("Apresentação duplicada!");
      loadPresentations();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao duplicar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta apresentação?")) return;
    try {
      const { error } = await supabase
        .from("slide_presentations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Apresentação excluída");
      loadPresentations();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir");
    }
  };

  if (viewMode === "create") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setViewMode("library")} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <SlideCreationForm onCreated={handlePresentationCreated} />
        </div>
      </div>
    );
  }

  if (viewMode === "view" && selectedPresentationId) {
    return (
      <SlideViewer
        presentationId={selectedPresentationId}
        onBack={() => {
          setViewMode("library");
          setSelectedPresentationId(null);
          loadPresentations();
        }}
      />
    );
  }

  if (viewMode === "templates") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setViewMode("library")} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <SlideTemplateLibrary onSelect={(topic) => {
            setViewMode("create");
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Presentation className="h-6 w-6 text-primary" />
                Gerador de Slides
              </h1>
              <p className="text-sm text-muted-foreground">
                Crie apresentações profissionais com inteligência artificial
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewMode("templates")} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Modelos Prontos
            </Button>
            <Button onClick={() => setViewMode("create")} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Apresentação
            </Button>
          </div>
        </div>

        {/* Library */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : presentations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma apresentação ainda</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Crie sua primeira apresentação profissional com IA. Basta informar o tema e deixar a inteligência artificial fazer o resto.
              </p>
              <Button onClick={() => setViewMode("create")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Criar Primeira Apresentação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presentations.map((p) => (
              <Card
                key={p.id}
                className="group hover:shadow-lg transition-all cursor-pointer border-border/50 hover:border-primary/30"
                onClick={() => {
                  setSelectedPresentationId(p.id);
                  setViewMode("view");
                }}
              >
                {/* Thumbnail area */}
                <div className="h-36 bg-gradient-to-br from-[#0A1931] to-[#1a2f50] rounded-t-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#C81E1E]" />
                  <div className="text-center px-4">
                    <Presentation className="h-8 w-8 text-white/60 mx-auto mb-2" />
                    <p className="text-white/90 text-sm font-medium line-clamp-2">{p.title}</p>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
                      {p.slide_count || 0} slides
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm line-clamp-1 mb-1">{p.title}</h3>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(p);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
