import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, Smartphone } from "lucide-react";

export default function SlideRemoteControlPage() {
  const { code } = useParams<{ code: string }>();
  const [session, setSession] = useState<any>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [presentationTitle, setPresentationTitle] = useState("");
  const touchRef = useRef(0);

  useEffect(() => {
    if (!code) return;
    const load = async () => {
      try {
        const { data: sess, error: sessErr } = await supabase
          .from("slide_remote_sessions")
          .select("*")
          .eq("session_code", code)
          .eq("is_active", true)
          .maybeSingle();

        if (sessErr || !sess) {
          setError("Sessão de controle remoto não encontrada ou expirada.");
          setLoading(false);
          return;
        }

        setSession(sess);
        setCurrentSlide(sess.current_slide || 0);

        // Get slide count and title
        const { data: pres } = await supabase
          .from("slide_presentations")
          .select("title, slide_count")
          .eq("id", sess.presentation_id)
          .maybeSingle();

        if (pres) {
          setPresentationTitle(pres.title);
          setSlideCount(pres.slide_count || 0);
        }

        // If no slide count, count slides directly
        if (!pres?.slide_count) {
          const { count } = await supabase
            .from("slide_items")
            .select("*", { count: "exact", head: true })
            .eq("presentation_id", sess.presentation_id);
          setSlideCount(count || 0);
        }
      } catch {
        setError("Erro ao conectar.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

  // Listen for realtime updates (from presenter)
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`remote-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "slide_remote_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload: any) => {
          setCurrentSlide(payload.new.current_slide);
          if (!payload.new.is_active) {
            setError("Sessão encerrada pelo apresentador.");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const updateSlide = useCallback(async (newIndex: number) => {
    if (!session || newIndex < 0 || newIndex >= slideCount) return;
    setCurrentSlide(newIndex);
    await supabase
      .from("slide_remote_sessions")
      .update({ current_slide: newIndex, updated_at: new Date().toISOString() } as any)
      .eq("id", session.id);
  }, [session, slideCount]);

  const goNext = useCallback(() => updateSlide(currentSlide + 1), [currentSlide, updateSlide]);
  const goPrev = useCallback(() => updateSlide(currentSlide - 1), [currentSlide, updateSlide]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1931] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A1931] flex items-center justify-center text-center px-6">
        <div>
          <Smartphone className="h-12 w-12 text-white/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Controle Remoto</h1>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const progress = slideCount > 0 ? ((currentSlide + 1) / slideCount) * 100 : 0;

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
      <div className="px-6 pt-8 pb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Smartphone className="h-5 w-5 text-[#C81E1E]" />
          <span className="text-xs font-bold text-[#C81E1E] uppercase tracking-widest">Controle Remoto</span>
        </div>
        <h1 className="text-white text-lg font-semibold truncate">{presentationTitle}</h1>
      </div>

      {/* Slide indicator */}
      <div className="px-6 py-4 flex-1 flex flex-col items-center justify-center gap-8">
        {/* Big slide number */}
        <div className="text-center">
          <div className="text-8xl font-black text-white/90">{currentSlide + 1}</div>
          <div className="text-white/40 text-lg mt-1">de {slideCount}</div>
        </div>

        {/* Progress */}
        <div className="w-full max-w-xs">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C81E1E] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-6">
          <button
            className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-all disabled:opacity-30"
            onClick={goPrev}
            disabled={currentSlide <= 0}
          >
            <ChevronLeft className="h-10 w-10 text-white" />
          </button>
          <button
            className="w-20 h-20 rounded-2xl bg-[#C81E1E] hover:bg-[#D42828] active:bg-[#B01818] flex items-center justify-center transition-all disabled:opacity-30 shadow-lg shadow-red-900/30"
            onClick={goNext}
            disabled={currentSlide >= slideCount - 1}
          >
            <ChevronRight className="h-10 w-10 text-white" />
          </button>
        </div>
      </div>

      {/* Swipe hint */}
      <div className="text-center pb-8">
        <p className="text-white/30 text-xs">Deslize ou use os botões para navegar</p>
      </div>
    </div>
  );
}
