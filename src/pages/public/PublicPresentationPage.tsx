import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "@/components/slide-generator/SlideRenderer";

interface SlideItem {
  id: string;
  slide_type: string;
  title: string | null;
  subtitle: string | null;
  content: any;
  speaker_notes: string | null;
  layout_type: string | null;
  sort_order: number;
}

export default function PublicPresentationPage() {
  const { token } = useParams<{ token: string }>();
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [title, setTitle] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const { data: pres, error: presErr } = await supabase
          .from("slide_presentations")
          .select("id, title")
          .eq("public_share_token", token)
          .eq("is_public", true)
          .maybeSingle();

        if (presErr || !pres) {
          setError("Apresentação não encontrada ou não está pública.");
          setLoading(false);
          return;
        }

        setTitle(pres.title);

        const { data: slideData } = await supabase
          .from("slide_items")
          .select("*")
          .eq("presentation_id", pres.id)
          .order("sort_order");

        setSlides((slideData as unknown as SlideItem[]) || []);
      } catch {
        setError("Erro ao carregar apresentação.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  // Calculate scale
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setScale(Math.min(w / 1920, h / 1080));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [loading]);

  // Keyboard nav
  const goNext = useCallback(() => setCurrentIndex((i) => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch swipe
  const touchRef = useRef(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1931] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A1931] flex items-center justify-center text-center px-4">
        <div>
          <Smartphone className="h-12 w-12 text-white/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Apresentação Indisponível</h1>
          <p className="text-white/60 text-sm">{error || "Nenhum slide encontrado."}</p>
        </div>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  return (
    <div
      className="min-h-screen bg-[#0A1931] flex flex-col select-none"
      onTouchStart={(e) => { touchRef.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchRef.current;
        if (dx < -50) goNext();
        if (dx > 50) goPrev();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/30">
        <h1 className="text-white/80 text-sm font-medium truncate flex-1">{title}</h1>
        <span className="text-white/50 text-sm ml-2">{currentIndex + 1}/{slides.length}</span>
      </div>

      {/* Slide */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={goNext}
      >
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 z-10 text-white/40 hover:text-white hover:bg-white/10 h-12 w-12"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {currentIndex < slides.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 z-10 text-white/40 hover:text-white hover:bg-white/10 h-12 w-12"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {currentSlide && (
          <div className="rounded-lg overflow-hidden shadow-2xl">
            <SlideRenderer slide={currentSlide} scale={scale} />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-[#C81E1E] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
