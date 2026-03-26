import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, Smartphone, StickyNote } from "lucide-react";

interface SlideData {
  id: string;
  slide_type: string;
  title: string | null;
  content: any;
  speaker_notes: string | null;
  sort_order: number;
}

export default function SlideRemoteControlPage() {
  const { code } = useParams<{ code: string }>();
  const [session, setSession] = useState<any>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [presentationTitle, setPresentationTitle] = useState("");
  const [showNotes, setShowNotes] = useState(true);
  const touchRef = useRef(0);

  // Get bullet count for a slide
  const getBulletCount = useCallback((slide: SlideData | undefined) => {
    if (!slide) return 0;
    const content = slide.content || {};
    if (content.bullets?.length) return content.bullets.length;
    if (content.framework_steps?.length) return content.framework_steps.length;
    return 0;
  }, []);

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
        setCurrentStep((sess as any).current_step || 0);

        // Get presentation info and slides
        const { data: pres } = await supabase
          .from("slide_presentations")
          .select("title")
          .eq("id", sess.presentation_id)
          .maybeSingle();

        if (pres) setPresentationTitle(pres.title);

        // Load all slides for bullet counts and speaker notes
        const { data: slideData } = await supabase
          .from("slide_items")
          .select("id, slide_type, title, content, speaker_notes, sort_order")
          .eq("presentation_id", sess.presentation_id)
          .order("sort_order");

        setSlides((slideData as unknown as SlideData[]) || []);
      } catch {
        setError("Erro ao conectar.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [code]);

  // Listen for realtime updates (from presenter screen)
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
          setCurrentSlide(payload.new.current_slide ?? 0);
          setCurrentStep(payload.new.current_step ?? 0);
          if (!payload.new.is_active) {
            setError("Sessão encerrada pelo apresentador.");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // Send update to DB
  const syncRemote = useCallback(async (slideIdx: number, stepIdx: number) => {
    if (!session) return;
    await supabase
      .from("slide_remote_sessions")
      .update({ current_slide: slideIdx, current_step: stepIdx, updated_at: new Date().toISOString() } as any)
      .eq("id", session.id);
  }, [session]);

  // Advance: step through bullets first, then next slide
  const goNext = useCallback(() => {
    const current = slides[currentSlide];
    const totalBullets = getBulletCount(current);

    if (totalBullets > 0 && currentStep < totalBullets) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      syncRemote(currentSlide, newStep);
    } else if (currentSlide < slides.length - 1) {
      const newSlide = currentSlide + 1;
      setCurrentSlide(newSlide);
      setCurrentStep(0);
      syncRemote(newSlide, 0);
    }
  }, [slides, currentSlide, currentStep, getBulletCount, syncRemote]);

  // Go back: reverse through bullets, then previous slide
  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      syncRemote(currentSlide, newStep);
    } else if (currentSlide > 0) {
      const prevSlide = currentSlide - 1;
      const prevBullets = getBulletCount(slides[prevSlide]);
      setCurrentSlide(prevSlide);
      setCurrentStep(prevBullets);
      syncRemote(prevSlide, prevBullets);
    }
  }, [slides, currentSlide, currentStep, getBulletCount, syncRemote]);

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

  const slideCount = slides.length;
  const progress = slideCount > 0 ? ((currentSlide + 1) / slideCount) * 100 : 0;
  const currentSlideData = slides[currentSlide];
  const speakerNotes = currentSlideData?.speaker_notes;
  const totalBullets = getBulletCount(currentSlideData);
  const isFirstStep = currentSlide === 0 && currentStep === 0;
  const isLastStep = currentSlide >= slideCount - 1 && currentStep >= totalBullets;

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
      <div className="px-4 pt-6 pb-2 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Smartphone className="h-4 w-4 text-[#C81E1E]" />
          <span className="text-[10px] font-bold text-[#C81E1E] uppercase tracking-widest">Controle Remoto</span>
        </div>
        <h1 className="text-white text-sm font-semibold truncate">{presentationTitle}</h1>
      </div>

      {/* Speaker notes - PROMINENT, right after header */}
      {showNotes && (
        <div className="px-4 pt-2 pb-1">
          <div className="bg-white/[0.07] border border-white/10 rounded-2xl p-5 max-h-[40vh] overflow-y-auto">
            {speakerNotes ? (
              <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap font-medium">{speakerNotes}</p>
            ) : (
              <p className="text-white/30 text-sm italic text-center">Sem anotações para este slide</p>
            )}
          </div>
        </div>
      )}

      {/* Slide info & controls */}
      <div className="px-4 flex-1 flex flex-col items-center justify-center gap-3">
        {/* Slide number & title */}
        <div className="text-center">
          <div className="text-5xl font-black text-white/90">{currentSlide + 1}</div>
          <div className="text-white/40 text-sm mt-0.5">de {slideCount}</div>
          {currentSlideData?.title && (
            <p className="text-white/60 text-xs mt-1.5 max-w-[250px] truncate">{currentSlideData.title}</p>
          )}
        </div>

        {/* Step indicator */}
        {totalBullets > 0 && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalBullets }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-300"
                style={{
                  width: i < currentStep ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i < currentStep ? "#C81E1E" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
        )}

        {/* Progress */}
        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
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
            disabled={isFirstStep}
          >
            <ChevronLeft className="h-10 w-10 text-white" />
          </button>
          <button
            className="w-20 h-20 rounded-2xl bg-[#C81E1E] hover:bg-[#D42828] active:bg-[#B01818] flex items-center justify-center transition-all disabled:opacity-30 shadow-lg shadow-red-900/30"
            onClick={goNext}
            disabled={isLastStep}
          >
            <ChevronRight className="h-10 w-10 text-white" />
          </button>
        </div>
      </div>

      {/* Toggle notes button */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${
            showNotes ? "bg-white/10 text-white/70" : "bg-white/5 text-white/40"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" />
          {showNotes ? "Ocultar anotações" : "Ver anotações"}
        </button>
      </div>

      {/* Swipe hint */}
      <div className="text-center pb-4">
        <p className="text-white/20 text-[10px]">Deslize ou use os botões</p>
      </div>
    </div>
  );
}
