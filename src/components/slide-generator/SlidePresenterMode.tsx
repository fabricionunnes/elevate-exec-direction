import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Clock, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "./SlideRenderer";

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

interface Props {
  slides: SlideItem[];
  presentationTitle: string;
  onExit: () => void;
}

function getStepCount(slide: SlideItem): number {
  const content = slide.content || {};
  if (content.framework_steps?.length) return content.framework_steps.length;
  if (content.bullets?.length) return content.bullets.length;
  return 0;
}

export function SlidePresenterMode({ slides, presentationTitle, onExit }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0); // 0 = title only, 1+ = bullets revealed
  const [showPresenterView, setShowPresenterView] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [slideStartTime, setSlideStartTime] = useState(Date.now());
  const [slideTime, setSlideTime] = useState(0);
  const [transition, setTransition] = useState<"enter" | "exit" | "idle">("enter");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      setSlideTime(Math.floor((Date.now() - slideStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [slideStartTime]);

  const totalSteps = slides[currentIndex] ? getStepCount(slides[currentIndex]) : 0;

  const animateToSlide = useCallback((newIndex: number) => {
    setTransition("exit");
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setCurrentStep(0);
      setSlideStartTime(Date.now());
      setTransition("enter");
      setTimeout(() => setTransition("idle"), 500);
    }, 300);
  }, []);

  const goNext = useCallback(() => {
    // If there are more bullets to reveal, reveal next
    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
      return;
    }
    // Otherwise go to next slide
    if (currentIndex < slides.length - 1) {
      animateToSlide(currentIndex + 1);
    }
  }, [currentIndex, currentStep, totalSteps, slides.length, animateToSlide]);

  const goPrev = useCallback(() => {
    // If we're partway through bullets, go back one
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      return;
    }
    // Otherwise go to previous slide (show all bullets)
    if (currentIndex > 0) {
      setTransition("exit");
      setTimeout(() => {
        const prevIdx = currentIndex - 1;
        setCurrentIndex(prevIdx);
        setCurrentStep(getStepCount(slides[prevIdx]));
        setSlideStartTime(Date.now());
        setTransition("enter");
        setTimeout(() => setTransition("idle"), 500);
      }, 300);
    }
  }, [currentIndex, currentStep, slides]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onExit();
    if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); goNext(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    if (e.key === "p" || e.key === "P") setShowPresenterView((v) => !v);
  }, [goNext, goPrev, onExit]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!showPresenterView && containerRef.current) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [showPresenterView]);

  // Start with enter animation
  useEffect(() => {
    const t = setTimeout(() => setTransition("idle"), 500);
    return () => clearTimeout(t);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const currentSlide = slides[currentIndex];
  const nextSlide = slides[currentIndex + 1];

  const transitionStyle: React.CSSProperties = {
    transition: "opacity 0.4s ease, transform 0.4s ease",
    opacity: transition === "exit" ? 0 : 1,
    transform: transition === "exit" ? "scale(0.97) translateX(30px)" : transition === "enter" ? "scale(1) translateX(0)" : "none",
  };

  // Progress dots showing bullet progress
  const progressDots = totalSteps > 0 ? (
    <div className="flex items-center gap-1 ml-3">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i < currentStep ? 8 : 6,
            height: i < currentStep ? 8 : 6,
            background: i < currentStep ? "#C81E1E" : "rgba(255,255,255,0.3)",
          }}
        />
      ))}
    </div>
  ) : null;

  if (showPresenterView) {
    return (
      <div className="fixed inset-0 bg-[#0A1931] z-50 flex flex-col" ref={containerRef}>
        <div className="flex items-center justify-between px-4 py-2 bg-black/30">
          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm font-medium">{presentationTitle}</span>
            <span className="text-white text-sm">{currentIndex + 1} / {slides.length}</span>
            {progressDots}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white/70">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-mono">{formatTime(elapsedSeconds)}</span>
              <span className="text-xs text-white/40">({formatTime(slideTime)} neste slide)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPresenterView(false)} className="text-white/70 hover:text-white">
              <Monitor className="h-4 w-4 mr-1" /> Tela Cheia
            </Button>
            <Button variant="ghost" size="icon" onClick={onExit} className="text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          <div className="flex-[2] flex items-center justify-center">
            <div className="w-full max-w-3xl aspect-video rounded-lg overflow-hidden shadow-2xl border border-white/10" style={transitionStyle}>
              <SlideRenderer slide={currentSlide} scale={0.5} visibleBullets={currentStep} />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-shrink-0">
              <p className="text-white/40 text-xs mb-2 uppercase tracking-wider">Próximo Slide</p>
              {nextSlide ? (
                <div className="aspect-video rounded-lg overflow-hidden border border-white/10">
                  <SlideRenderer slide={nextSlide} scale={0.25} />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <span className="text-white/30 text-sm">Último slide</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <p className="text-white/40 text-xs mb-2 uppercase tracking-wider">Notas</p>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-white/80 text-sm leading-relaxed">
                  {currentSlide?.speaker_notes || "Sem anotações para este slide."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 py-3 bg-black/30">
          <Button variant="ghost" onClick={goPrev} disabled={currentIndex === 0 && currentStep === 0} className="text-white/70 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-white font-medium">{currentIndex + 1} / {slides.length}</span>
          {progressDots}
          <Button variant="ghost" onClick={goNext} disabled={currentIndex >= slides.length - 1 && currentStep >= totalSteps} className="text-white/70 hover:text-white">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // Full screen presentation mode
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 cursor-none flex items-center justify-center"
      onClick={goNext}
    >
      <div className="w-full h-full flex items-center justify-center" style={transitionStyle}>
        {currentSlide && (
          <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SlideRenderer
              slide={currentSlide}
              scale={Math.min(window.innerWidth / 1920, window.innerHeight / 1080)}
              visibleBullets={currentStep}
            />
          </div>
        )}
      </div>

      {/* Subtle controls */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 opacity-0 hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); goPrev(); }} className="text-white/70 h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-white/70 text-sm">{currentIndex + 1}/{slides.length}</span>
        {progressDots}
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); goNext(); }} className="text-white/70 h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-white/20" />
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setShowPresenterView(true); }} className="text-white/70 h-8 w-8">
          <Monitor className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onExit(); }} className="text-white/70 h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
