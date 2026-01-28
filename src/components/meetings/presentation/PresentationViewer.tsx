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
  Home,
  Target,
  TrendingUp,
  Users,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  MessageSquare,
  Zap,
  Award,
  Briefcase,
  PieChart,
  LineChart,
  Clock,
  Star
} from "lucide-react";
import type { PresentationSlide, SlideContent } from "./types";

// UNV Brand colors - Enhanced palette
const UNV_COLORS = {
  blue: {
    dark: "#1E3A5F",
    primary: "#2A4A6F",
    light: "#3A5A7F",
    lighter: "#4A6A8F",
    gradient: "linear-gradient(135deg, #1E3A5F 0%, #2A4A6F 50%, #3A5A7F 100%)"
  },
  red: {
    primary: "#E63946",
    light: "#EF5A67",
    dark: "#C62B38",
    gradient: "linear-gradient(135deg, #C62B38 0%, #E63946 50%, #EF5A67 100%)"
  },
  gold: {
    primary: "#D4AF37",
    light: "#E4BF47",
    gradient: "linear-gradient(135deg, #C49F27 0%, #D4AF37 50%, #E4BF47 100%)"
  },
  neutral: {
    white: "#FFFFFF",
    offWhite: "#F8F9FA",
    lightGray: "#E9ECEF",
    gray: "#6C757D"
  }
};

// Get icon for slide type
const getSlideIcon = (slideType: string, interactiveType?: string) => {
  if (interactiveType === "question") return MessageSquare;
  if (interactiveType === "reflection") return Lightbulb;
  if (interactiveType === "decision") return Target;
  if (interactiveType === "highlight") return Star;
  
  switch (slideType) {
    case "cover": return Award;
    case "context": return Briefcase;
    case "objective": return Target;
    case "status": return BarChart3;
    case "data": return PieChart;
    case "insight": return Lightbulb;
    case "proposal": return TrendingUp;
    case "next_steps": return ArrowRight;
    case "closing": return CheckCircle2;
    default: return Zap;
  }
};

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
  const SlideIcon = getSlideIcon(slide.slide_type, slide.interactive_type);

  // UNV Logo Component
  const UNVLogo = ({ size = "md", variant = "full" }: { size?: "sm" | "md" | "lg"; variant?: "full" | "icon" }) => {
    const sizes = {
      sm: { text: "text-sm", icon: 16 },
      md: { text: "text-lg", icon: 24 },
      lg: { text: "text-2xl", icon: 32 }
    };
    
    return (
      <div className="flex items-center gap-2">
        <div 
          className="flex items-center justify-center rounded-lg"
          style={{ 
            background: UNV_COLORS.blue.gradient,
            padding: size === "lg" ? "8px 12px" : size === "md" ? "6px 10px" : "4px 8px"
          }}
        >
          <span className={cn("font-black text-white tracking-wider", sizes[size].text)}>
            UNV
          </span>
        </div>
        {variant === "full" && (
          <div className="flex flex-col">
            <span 
              className={cn("font-bold leading-tight", size === "lg" ? "text-base" : "text-xs")}
              style={{ color: UNV_COLORS.blue.dark }}
            >
              UNIVERSIDADE
            </span>
            <span 
              className={cn("font-bold leading-tight", size === "lg" ? "text-base" : "text-xs")}
              style={{ color: UNV_COLORS.red.primary }}
            >
              VENDAS
            </span>
          </div>
        )}
      </div>
    );
  };

  // Decorative elements
  const DecorativeCorner = ({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) => {
    const positionClasses = {
      "top-left": "top-0 left-0",
      "top-right": "top-0 right-0 rotate-90",
      "bottom-left": "bottom-0 left-0 -rotate-90",
      "bottom-right": "bottom-0 right-0 rotate-180"
    };
    
    return (
      <div className={cn("absolute w-24 h-24 pointer-events-none opacity-20", positionClasses[position])}>
        <svg viewBox="0 0 100 100" fill="none">
          <path 
            d="M0 0 L100 0 L100 20 L20 20 L20 100 L0 100 Z" 
            fill={UNV_COLORS.blue.dark}
          />
        </svg>
      </div>
    );
  };

  const renderCoverSlide = () => (
    <div 
      className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, ${UNV_COLORS.blue.dark} 0%, ${UNV_COLORS.blue.primary} 40%, ${UNV_COLORS.blue.light} 100%)`
      }}
    >
      {/* Decorative circles */}
      <div 
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10"
        style={{ backgroundColor: UNV_COLORS.red.primary }}
      />
      <div 
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-5"
        style={{ backgroundColor: UNV_COLORS.gold.primary }}
      />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(${UNV_COLORS.neutral.white} 1px, transparent 1px),
            linear-gradient(90deg, ${UNV_COLORS.neutral.white} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* UNV Logo */}
      <div className="mb-8 animate-fade-in">
        <div 
          className="flex items-center justify-center rounded-2xl px-8 py-4 shadow-2xl"
          style={{ 
            background: UNV_COLORS.neutral.white,
            boxShadow: `0 20px 60px -10px rgba(0,0,0,0.4)`
          }}
        >
          <UNVLogo size="lg" variant="full" />
        </div>
      </div>
      
      {/* Divider line */}
      <div 
        className="w-32 h-1 rounded-full mb-8"
        style={{ background: UNV_COLORS.red.gradient }}
      />
      
      {/* Company name badge */}
      <div 
        className="px-6 py-2 rounded-full mb-8"
        style={{ 
          backgroundColor: 'rgba(255,255,255,0.15)',
          border: `1px solid rgba(255,255,255,0.3)`
        }}
      >
        <span className="text-white/90 text-lg font-medium tracking-wide">
          {companyName}
        </span>
      </div>
      
      {/* Title */}
      <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight max-w-4xl mb-6 drop-shadow-lg">
        {slide.title}
      </h1>
      
      {slide.subtitle && (
        <p className="text-xl md:text-2xl text-white/80 max-w-2xl">
          {slide.subtitle}
        </p>
      )}
      
      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: UNV_COLORS.red.gradient }} />
    </div>
  );

  const renderInteractiveSlide = () => (
    <div 
      className="relative flex flex-col items-center justify-center h-full px-8 overflow-hidden"
      style={{ 
        background: slide.interactive_type === "highlight" 
          ? `linear-gradient(135deg, ${UNV_COLORS.red.dark} 0%, ${UNV_COLORS.red.primary} 50%, ${UNV_COLORS.red.light} 100%)`
          : `linear-gradient(135deg, ${UNV_COLORS.neutral.offWhite} 0%, ${UNV_COLORS.neutral.white} 100%)`
      }}
    >
      <DecorativeCorner position="top-left" />
      <DecorativeCorner position="bottom-right" />
      
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(${UNV_COLORS.blue.dark} 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }}
      />
      
      {/* Interactive type icon and badge */}
      <div className="flex flex-col items-center mb-8">
        <div 
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
          style={{ 
            background: slide.interactive_type === "highlight" 
              ? 'rgba(255,255,255,0.2)' 
              : UNV_COLORS.red.gradient 
          }}
        >
          <SlideIcon 
            className={cn(
              "w-10 h-10",
              slide.interactive_type === "highlight" ? "text-white" : "text-white"
            )} 
          />
        </div>
        <span 
          className={cn(
            "text-sm font-bold tracking-widest uppercase",
            slide.interactive_type === "highlight" ? "text-white/80" : ""
          )}
          style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.red.primary }}
        >
          {slide.interactive_type === "question" && "💭 PERGUNTA ESTRATÉGICA"}
          {slide.interactive_type === "reflection" && "🔍 MOMENTO DE REFLEXÃO"}
          {slide.interactive_type === "decision" && "⚖️ DECISÃO"}
          {slide.interactive_type === "highlight" && "📊 DESTAQUE"}
        </span>
      </div>

      {content.question && (
        <h2 
          className={cn(
            "text-3xl md:text-5xl font-bold text-center leading-tight max-w-4xl",
            slide.interactive_type === "highlight" ? "text-white" : ""
          )}
          style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.blue.dark }}
        >
          {content.question}
        </h2>
      )}

      {content.highlight && !content.metric_value && (
        <div 
          className={cn(
            "text-5xl md:text-7xl font-black mt-6",
            slide.interactive_type === "highlight" ? "text-white" : ""
          )}
          style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.red.primary }}
        >
          {content.highlight}
        </div>
      )}

      {content.metric_value && (
        <div className="text-center mt-8">
          <div 
            className={cn(
              "text-7xl md:text-9xl font-black",
              slide.interactive_type === "highlight" ? "text-white" : ""
            )}
            style={{ 
              color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.red.primary,
              textShadow: slide.interactive_type === "highlight" ? '0 4px 20px rgba(0,0,0,0.3)' : undefined
            }}
          >
            {content.metric_value}
          </div>
          {content.metric_label && (
            <div 
              className={cn(
                "text-2xl mt-4 font-medium",
                slide.interactive_type === "highlight" ? "text-white/80" : "text-muted-foreground"
              )}
            >
              {content.metric_label}
            </div>
          )}
        </div>
      )}

      {content.options && content.options.length > 0 && (
        <div className="flex gap-8 mt-12">
          {content.options.map((option, i) => (
            <div
              key={i}
              className="px-10 py-6 rounded-2xl text-xl font-bold transition-all hover:scale-105 shadow-lg"
              style={{ 
                background: i === 0 ? UNV_COLORS.blue.gradient : UNV_COLORS.red.gradient,
                color: UNV_COLORS.neutral.white,
              }}
            >
              <span className="opacity-60 mr-2">{i === 0 ? 'A' : 'B'}.</span>
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderContentSlide = () => (
    <div 
      className="relative flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: UNV_COLORS.neutral.offWhite }}
    >
      {/* Header with gradient */}
      <div 
        className="relative px-12 py-8"
        style={{ background: UNV_COLORS.blue.gradient }}
      >
        {/* UNV Logo watermark */}
        <div className="absolute top-4 right-6 opacity-20">
          <div className="flex items-center justify-center rounded px-3 py-1 bg-white/20">
            <span className="font-black text-white text-sm tracking-wider">UNV</span>
          </div>
        </div>
        
        {/* Slide icon */}
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          <SlideIcon className="w-6 h-6 text-white" />
        </div>
        
        {/* Title */}
        <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
          {slide.title}
        </h2>

        {slide.subtitle && (
          <p className="text-lg text-white/80 mt-2">
            {slide.subtitle}
          </p>
        )}
        
        {/* Bottom accent line */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: UNV_COLORS.red.gradient }}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 px-12 py-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {content.bullets && content.bullets.length > 0 && (
            <ul className="space-y-5">
              {content.bullets.map((bullet, i) => (
                <li 
                  key={i} 
                  className="flex items-start gap-5 p-4 rounded-xl transition-all hover:bg-white hover:shadow-md"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: UNV_COLORS.red.gradient }}
                  >
                    <span className="text-white font-bold">{i + 1}</span>
                  </div>
                  <span 
                    className="text-xl md:text-2xl leading-relaxed pt-1"
                    style={{ color: UNV_COLORS.blue.dark }}
                  >
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {content.text && !content.bullets?.length && (
            <div 
              className="text-xl md:text-2xl leading-relaxed p-6 rounded-2xl bg-white shadow-sm"
              style={{ color: UNV_COLORS.blue.dark }}
            >
              {content.text}
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative bottom bar */}
      <div className="flex items-center gap-2 px-12 py-4 bg-white border-t">
        <UNVLogo size="sm" variant="icon" />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ 
                backgroundColor: i === 0 ? UNV_COLORS.blue.dark : 
                                 i === 1 ? UNV_COLORS.red.primary : 
                                 UNV_COLORS.gold.primary 
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderSlideContent = () => {
    if (slide.slide_type === "cover") {
      return renderCoverSlide();
    }

    if (slide.is_interactive) {
      return renderInteractiveSlide();
    }

    return renderContentSlide();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 rounded-none border-0">
        {/* Main slide area */}
        <div className="relative w-full h-full flex flex-col bg-black">
          {/* Top bar */}
          <div 
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ 
              background: UNV_COLORS.blue.gradient,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
          >
            <div className="flex items-center gap-4">
              <UNVLogo size="sm" variant="icon" />
              <div className="h-4 w-px bg-white/20" />
              <span className="text-sm text-white/80 truncate max-w-[300px]">
                {title}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goToSlide(0)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <Home className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white/70 hover:text-white hover:bg-white/10"
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
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Slide content */}
          <div className="flex-1 overflow-hidden">
            {renderSlideContent()}
          </div>

          {/* Navigation bar */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ 
              background: UNV_COLORS.blue.gradient,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
          >
            <Button
              variant="ghost"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="text-white hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {/* Slide indicators */}
            <div className="flex items-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === currentSlide ? "w-8" : "w-2 hover:opacity-70"
                  )}
                  style={{ 
                    backgroundColor: i === currentSlide 
                      ? UNV_COLORS.red.primary 
                      : 'rgba(255,255,255,0.3)'
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60">
                {currentSlide + 1} / {slides.length}
              </span>
              <Button
                onClick={nextSlide}
                disabled={currentSlide === slides.length - 1}
                className="disabled:opacity-30"
                style={{ background: UNV_COLORS.red.gradient }}
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