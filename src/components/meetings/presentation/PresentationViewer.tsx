import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Maximize2,
  Minimize2,
  Home
} from "lucide-react";
import type { PresentationSlide, SlideContent } from "./types";

// UNV Brand colors
const UNV_BLUE = "#1E3A5F";
const UNV_RED = "#E63946";

interface PresentationViewerProps {
  slides: PresentationSlide[];
  companyName: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PresentationViewer({
  slides,
  companyName,
  title,
  open,
  onOpenChange,
}: PresentationViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  }, [slides.length]);

  const nextSlide = useCallback(() => goToSlide(currentSlide + 1), [currentSlide, goToSlide]);
  const prevSlide = useCallback(() => goToSlide(currentSlide - 1), [currentSlide, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          nextSlide();
          break;
        case "ArrowLeft":
          prevSlide();
          break;
        case "Home":
          goToSlide(0);
          break;
        case "End":
          goToSlide(slides.length - 1);
          break;
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onOpenChange(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, nextSlide, prevSlide, goToSlide, slides.length, isFullscreen, onOpenChange]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
    }
  }, [open]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (!slides.length) return null;

  const slide = slides[currentSlide];
  const content = slide.content as SlideContent;

  const renderSlideContent = () => {
    if (slide.slide_type === "cover") {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          {/* UNV Logo */}
          <div 
            className="text-2xl font-bold tracking-wider mb-4"
            style={{ color: UNV_BLUE }}
          >
            UNIVERSIDADE VENDAS
          </div>
          
          <div className="text-lg text-muted-foreground mb-8">
            {companyName}
          </div>
          
          <h1 
            className="text-4xl md:text-5xl font-bold leading-tight max-w-4xl"
            style={{ color: UNV_BLUE }}
          >
            {slide.title}
          </h1>
          
          {slide.subtitle && (
            <p className="text-xl text-muted-foreground mt-4">
              {slide.subtitle}
            </p>
          )}
        </div>
      );
    }

    if (slide.is_interactive) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-8 max-w-4xl mx-auto">
          {/* Interactive type badge */}
          <div 
            className="text-sm font-semibold tracking-wider mb-8"
            style={{ color: UNV_RED }}
          >
            {slide.interactive_type === "question" && "💭 PERGUNTA ESTRATÉGICA"}
            {slide.interactive_type === "reflection" && "🔍 MOMENTO DE REFLEXÃO"}
            {slide.interactive_type === "decision" && "⚖️ DECISÃO"}
            {slide.interactive_type === "highlight" && "📊 DESTAQUE"}
          </div>

          {content.question && (
            <h2 
              className="text-3xl md:text-4xl font-bold text-center leading-tight"
              style={{ color: UNV_BLUE }}
            >
              {content.question}
            </h2>
          )}

          {content.highlight && (
            <div 
              className="text-5xl md:text-7xl font-bold"
              style={{ color: UNV_RED }}
            >
              {content.highlight}
            </div>
          )}

          {content.metric_value && (
            <div className="text-center">
              <div 
                className="text-6xl md:text-8xl font-bold"
                style={{ color: UNV_RED }}
              >
                {content.metric_value}
              </div>
              {content.metric_label && (
                <div className="text-xl text-muted-foreground mt-4">
                  {content.metric_label}
                </div>
              )}
            </div>
          )}

          {content.options && (
            <div className="flex gap-6 mt-12">
              {content.options.map((option, i) => (
                <div
                  key={i}
                  className="px-8 py-4 rounded-lg border-2 text-xl font-semibold"
                  style={{ 
                    borderColor: i === 0 ? UNV_BLUE : UNV_RED,
                    color: i === 0 ? UNV_BLUE : UNV_RED,
                  }}
                >
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Regular content slide
    return (
      <div className="flex flex-col h-full px-12 py-8 max-w-5xl mx-auto">
        {/* Title */}
        <h2 
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ color: UNV_BLUE }}
        >
          {slide.title}
        </h2>

        {slide.subtitle && (
          <p className="text-lg text-muted-foreground mb-6">
            {slide.subtitle}
          </p>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center">
          {content.bullets && content.bullets.length > 0 && (
            <ul className="space-y-4">
              {content.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span 
                    className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
                    style={{ backgroundColor: UNV_RED }}
                  />
                  <span className="text-xl md:text-2xl leading-relaxed">
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {content.text && !content.bullets?.length && (
            <p className="text-xl md:text-2xl leading-relaxed">
              {content.text}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 rounded-none">
        {/* Main slide area */}
        <div 
          className="relative w-full h-full flex flex-col"
          style={{ backgroundColor: "#FAFAFA" }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
            <div className="flex items-center gap-4">
              <span 
                className="font-bold"
                style={{ color: UNV_BLUE }}
              >
                UNV
              </span>
              <span className="text-sm text-muted-foreground">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goToSlide(0)}
              >
                <Home className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Slide content */}
          <div className="flex-1 overflow-hidden">
            {/* Left accent bar */}
            <div 
              className="absolute left-0 top-12 bottom-16 w-2"
              style={{ backgroundColor: slide.is_interactive ? UNV_RED : UNV_BLUE }}
            />
            
            {renderSlideContent()}
          </div>

          {/* Navigation bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t">
            <Button
              variant="outline"
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {/* Slide indicators */}
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentSlide ? "w-6" : "hover:opacity-70"
                  )}
                  style={{ 
                    backgroundColor: i === currentSlide ? UNV_RED : "#CBD5E1"
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {currentSlide + 1} / {slides.length}
              </span>
              <Button
                onClick={nextSlide}
                disabled={currentSlide === slides.length - 1}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
