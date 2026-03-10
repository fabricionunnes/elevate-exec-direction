import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Play, Download, Grid3X3,
  Edit3, Trash2, Copy, Plus, Loader2, Save, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "./SlideRenderer";
import { SlidePresenterMode } from "./SlidePresenterMode";
import { SlidePDFExport } from "./SlidePDFExport";

interface SlideItem {
  id: string;
  presentation_id: string;
  slide_number: number;
  slide_type: string;
  title: string | null;
  subtitle: string | null;
  content: any;
  speaker_notes: string | null;
  layout_type: string | null;
  sort_order: number;
}

interface PresentationData {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  slide_count: number | null;
}

interface Props {
  presentationId: string;
  onBack: () => void;
}

export function SlideViewer({ presentationId, onBack }: Props) {
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<SlideItem>>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [presentationId]);

  const loadData = async () => {
    try {
      const [presRes, slidesRes] = await Promise.all([
        supabase.from("slide_presentations").select("*").eq("id", presentationId).single(),
        supabase.from("slide_items").select("*").eq("presentation_id", presentationId).order("sort_order"),
      ]);
      if (presRes.error) throw presRes.error;
      if (slidesRes.error) throw slidesRes.error;
      setPresentation(presRes.data as unknown as PresentationData);
      setSlides((slidesRes.data as unknown as SlideItem[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar apresentação");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (presenterMode) return;
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCurrentIndex((i) => Math.max(i - 1, 0));
    }
  }, [slides.length, presenterMode]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSlideUpdate = (slideId: string, update: { title?: string; subtitle?: string; content?: any }) => {
    // Update local state immediately
    setSlides(prev => prev.map(s => {
      if (s.id !== slideId) return s;
      return {
        ...s,
        title: update.title !== undefined ? update.title : s.title,
        subtitle: update.subtitle !== undefined ? update.subtitle : s.subtitle,
        content: update.content !== undefined ? update.content : s.content,
      };
    }));
    // Track pending changes
    setPendingChanges(prev => ({
      ...prev,
      [slideId]: {
        ...prev[slideId],
        ...(update.title !== undefined && { title: update.title }),
        ...(update.subtitle !== undefined && { subtitle: update.subtitle }),
        ...(update.content !== undefined && { content: update.content }),
      },
    }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingChanges);
    if (entries.length === 0) {
      toast.info("Nenhuma alteração para salvar");
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        entries.map(([id, changes]) =>
          supabase.from("slide_items").update(changes as any).eq("id", id)
        )
      );
      setPendingChanges({});
      toast.success(`${entries.length} slide(s) salvo(s)`);
      setEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm("Remover este slide?")) return;
    try {
      await supabase.from("slide_items").delete().eq("id", slideId);
      const updated = slides.filter((s) => s.id !== slideId);
      setSlides(updated);
      if (currentIndex >= updated.length) setCurrentIndex(Math.max(0, updated.length - 1));
      await supabase.from("slide_presentations").update({ slide_count: updated.length } as any).eq("id", presentationId);
      toast.success("Slide removido");
    } catch (err) {
      toast.error("Erro ao remover slide");
    }
  };

  const handleDuplicateSlide = async (slide: SlideItem) => {
    try {
      const { data, error } = await supabase
        .from("slide_items")
        .insert({
          presentation_id: presentationId,
          slide_number: slides.length + 1,
          slide_type: slide.slide_type,
          title: slide.title,
          subtitle: slide.subtitle,
          content: slide.content,
          speaker_notes: slide.speaker_notes,
          layout_type: slide.layout_type,
          sort_order: slide.sort_order + 1,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const newSlides = [...slides];
      newSlides.splice(currentIndex + 1, 0, data as unknown as SlideItem);
      setSlides(newSlides);
      setCurrentIndex(currentIndex + 1);
      await supabase.from("slide_presentations").update({ slide_count: newSlides.length } as any).eq("id", presentationId);
      toast.success("Slide duplicado");
    } catch (err) {
      toast.error("Erro ao duplicar");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (presenterMode) {
    return (
      <SlidePresenterMode
        slides={slides}
        presentationTitle={presentation?.title || ""}
        onExit={() => setPresenterMode(false)}
      />
    );
  }

  if (showPDFExport) {
    return (
      <SlidePDFExport
        slides={slides}
        presentationTitle={presentation?.title || ""}
        onBack={() => setShowPDFExport(false)}
      />
    );
  }

  const currentSlide = slides[currentIndex];
  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col" ref={containerRef}>
      {/* Toolbar */}
      <div className="border-b bg-card px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-semibold line-clamp-1">{presentation?.title}</h2>
            <p className="text-xs text-muted-foreground">{slides.length} slides</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditing(false); setPendingChanges({}); loadData(); }}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Cancelar</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAll}
                disabled={saving || !hasChanges}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">Salvar {hasChanges ? `(${Object.keys(pendingChanges).length})` : ""}</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Edit3 className="h-4 w-4" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowGrid(!showGrid)} className="gap-1.5">
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPresenterMode(true)} className="gap-1.5">
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">Apresentar</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowPDFExport(true)} className="gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        /* Edit Mode - Full slide list */
        <div className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
            {slides.map((slide, i) => (
              <div key={slide.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full w-7 h-7 flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      {slide.slide_type}
                    </span>
                    {pendingChanges[slide.id] && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                        editado
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicateSlide(slide)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSlide(slide.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden shadow-lg border border-border/50 cursor-text">
                  <SlideRenderer
                    slide={slide}
                    scale={Math.min((typeof window !== "undefined" ? Math.min(window.innerWidth - 80, 1100) : 1100) / 1920, 0.58)}
                    editable
                    onUpdate={(update) => handleSlideUpdate(slide.id, update)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : showGrid ? (
        /* Grid View */
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:shadow-lg ${
                  i === currentIndex ? "border-primary shadow-md" : "border-border/50"
                }`}
                onClick={() => { setCurrentIndex(i); setShowGrid(false); }}
              >
                <div className="aspect-video">
                  <SlideRenderer slide={slide} scale={0.15} />
                </div>
                <div className="p-2 bg-card">
                  <p className="text-xs font-medium truncate">{slide.title || `Slide ${i + 1}`}</p>
                  <p className="text-[10px] text-muted-foreground">{i + 1} / {slides.length}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Slide View */
        <div className="flex-1 flex">
          <div className="w-48 border-r bg-muted/30 overflow-y-auto hidden lg:block">
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className={`p-2 cursor-pointer border-b transition-colors ${
                  i === currentIndex ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50"
                }`}
                onClick={() => setCurrentIndex(i)}
              >
                <div className="aspect-video rounded overflow-hidden mb-1">
                  <SlideRenderer slide={slide} scale={0.09} />
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{i + 1}. {slide.title || "Sem título"}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4 bg-muted/20 relative">
              {currentIndex > 0 && (
                <Button variant="ghost" size="icon" className="absolute left-2 z-10 bg-card/80 shadow-sm" onClick={() => setCurrentIndex((i) => i - 1)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              {currentIndex < slides.length - 1 && (
                <Button variant="ghost" size="icon" className="absolute right-2 z-10 bg-card/80 shadow-sm" onClick={() => setCurrentIndex((i) => i + 1)}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
              <div
                key={currentSlide?.id}
                className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl"
                style={{
                  animation: "slideIn 0.4s ease-out",
                }}
              >
                {currentSlide && <SlideRenderer slide={currentSlide} scale={1} />}
              </div>
              <style>{`
                @keyframes slideIn {
                  0% { opacity: 0; transform: scale(0.97); }
                  100% { opacity: 1; transform: scale(1); }
                }
              `}</style>
            </div>

            <div className="border-t bg-card px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{currentIndex + 1} / {slides.length}</span>
                {currentSlide && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{currentSlide.slide_type}</span>
                )}
              </div>
              {currentSlide && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicateSlide(currentSlide)} className="gap-1 text-xs">
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSlide(currentSlide.id)} className="gap-1 text-xs text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </div>
              )}
            </div>

            {currentSlide?.speaker_notes && (
              <div className="border-t bg-muted/30 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notas do Apresentador</p>
                <p className="text-sm">{currentSlide.speaker_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
