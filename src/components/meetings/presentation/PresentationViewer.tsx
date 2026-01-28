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
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  MessageSquare,
  Zap,
  Award,
  Briefcase,
  PieChart,
  Star,
  Timer,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Check
} from "lucide-react";
import confetti from "canvas-confetti";
import type { PresentationSlide, SlideContent } from "./types";
import unvLogoSlides from "@/assets/unv-logo-slides.png";

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
  
  // Interactive states
  const [revealedBullets, setRevealedBullets] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAllContent, setShowAllContent] = useState(false);
  const [highlightedBullet, setHighlightedBullet] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
      // Reset interactive states when changing slides
      setRevealedBullets([]);
      setSelectedOption(null);
      setHighlightedBullet(null);
      setHasTriggeredConfetti(false);
    }
  }, [slides.length]);

  const nextSlide = useCallback(() => goToSlide(currentSlide + 1), [currentSlide, goToSlide]);
  const prevSlide = useCallback(() => goToSlide(currentSlide - 1), [currentSlide, goToSlide]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Format timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Trigger confetti for highlight slides
  const triggerConfetti = useCallback(() => {
    if (hasTriggeredConfetti) return;
    setHasTriggeredConfetti(true);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [UNV_COLORS.blue.dark, UNV_COLORS.red.primary, UNV_COLORS.gold.primary]
    });
  }, [hasTriggeredConfetti]);

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
        case "r":
          // Reveal next bullet
          const slide = slides[currentSlide];
          const content = slide.content as SlideContent;
          if (content.bullets && revealedBullets.length < content.bullets.length) {
            setRevealedBullets([...revealedBullets, revealedBullets.length]);
          }
          break;
        case "a":
          // Reveal all
          setShowAllContent(true);
          const currentContent = slides[currentSlide].content as SlideContent;
          if (currentContent.bullets) {
            setRevealedBullets(currentContent.bullets.map((_, i) => i));
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, nextSlide, prevSlide, goToSlide, slides, currentSlide, isFullscreen, onOpenChange, revealedBullets]);

  // Reset states on open
  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
      setRevealedBullets([]);
      setSelectedOption(null);
      setShowAllContent(false);
      setHighlightedBullet(null);
      setTimerSeconds(0);
      setTimerActive(false);
      setHasTriggeredConfetti(false);
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

  // Reveal next bullet
  const revealNextBullet = () => {
    if (content.bullets && revealedBullets.length < content.bullets.length) {
      setRevealedBullets([...revealedBullets, revealedBullets.length]);
    }
  };

  // Reveal all bullets
  const revealAllBullets = () => {
    if (content.bullets) {
      setRevealedBullets(content.bullets.map((_, i) => i));
      setShowAllContent(true);
    }
  };

  // Reset reveal state
  const resetReveal = () => {
    setRevealedBullets([]);
    setShowAllContent(false);
    setHighlightedBullet(null);
  };

  // Select option in decision slides
  const handleOptionSelect = (index: number) => {
    setSelectedOption(index);
    
    // Celebration effect
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: index === 0 
        ? [UNV_COLORS.blue.dark, UNV_COLORS.blue.primary, UNV_COLORS.blue.light]
        : [UNV_COLORS.red.dark, UNV_COLORS.red.primary, UNV_COLORS.red.light]
    });
  };

  // UNV Logo Component - now using actual image
  const UNVLogo = ({ size = "md" }: { size?: "sm" | "md" | "lg"; variant?: "full" | "icon" }) => {
    const heights = {
      sm: "h-8",
      md: "h-12",
      lg: "h-20"
    };
    
    return (
      <img 
        src={unvLogoSlides} 
        alt="Universidade Nacional de Vendas" 
        className={cn("object-contain", heights[size])}
      />
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
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10 animate-pulse"
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
          className="flex items-center justify-center rounded-2xl px-8 py-4 shadow-2xl cursor-pointer transition-transform hover:scale-105"
          style={{ 
            background: UNV_COLORS.neutral.white,
            boxShadow: `0 20px 60px -10px rgba(0,0,0,0.4)`
          }}
          onClick={() => {
            confetti({
              particleCount: 80,
              spread: 100,
              origin: { y: 0.4 },
              colors: [UNV_COLORS.blue.dark, UNV_COLORS.red.primary, UNV_COLORS.gold.primary]
            });
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
        className="px-6 py-2 rounded-full mb-8 cursor-pointer transition-all hover:scale-105 hover:bg-white/20"
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
      
      {/* Click hint */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/50 text-sm animate-bounce">
        <Sparkles className="w-4 h-4" />
        Clique no logo para celebrar!
      </div>
      
      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: UNV_COLORS.red.gradient }} />
    </div>
  );

  const renderInteractiveSlide = () => {
    const isHighlight = slide.interactive_type === "highlight";
    
    // Auto-trigger confetti for highlight slides with metrics
    if (isHighlight && content.metric_value && !hasTriggeredConfetti) {
      setTimeout(triggerConfetti, 500);
    }
    
    return (
      <div 
        className="relative flex flex-col items-center justify-center h-full px-8 overflow-hidden"
        style={{ 
          background: isHighlight 
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
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95"
            style={{ 
              background: isHighlight 
                ? 'rgba(255,255,255,0.2)' 
                : UNV_COLORS.red.gradient 
            }}
            onClick={() => {
              if (isHighlight && content.metric_value) {
                triggerConfetti();
              }
            }}
          >
            <SlideIcon 
              className="w-10 h-10 text-white" 
            />
          </div>
          <span 
            className={cn(
              "text-sm font-bold tracking-widest uppercase",
              isHighlight ? "text-white/80" : ""
            )}
            style={{ color: isHighlight ? undefined : UNV_COLORS.red.primary }}
          >
            {slide.interactive_type === "question" && "💭 PERGUNTA ESTRATÉGICA"}
            {slide.interactive_type === "reflection" && "🔍 MOMENTO DE REFLEXÃO"}
            {slide.interactive_type === "decision" && "⚖️ ESCOLHA UMA OPÇÃO"}
            {slide.interactive_type === "highlight" && "📊 DESTAQUE"}
          </span>
        </div>

        {content.question && (
          <h2 
            className={cn(
              "text-3xl md:text-5xl font-bold text-center leading-tight max-w-4xl",
              isHighlight ? "text-white" : ""
            )}
            style={{ color: isHighlight ? undefined : UNV_COLORS.blue.dark }}
          >
            {content.question}
          </h2>
        )}

        {content.highlight && !content.metric_value && (
          <div 
            className={cn(
              "text-5xl md:text-7xl font-black mt-6 cursor-pointer transition-transform hover:scale-105",
              isHighlight ? "text-white" : ""
            )}
            style={{ color: isHighlight ? undefined : UNV_COLORS.red.primary }}
            onClick={triggerConfetti}
          >
            {content.highlight}
          </div>
        )}

        {content.metric_value && (
          <div 
            className="text-center mt-8 cursor-pointer transition-transform hover:scale-105"
            onClick={triggerConfetti}
          >
            <div 
              className={cn(
                "text-7xl md:text-9xl font-black animate-scale-in",
                isHighlight ? "text-white" : ""
              )}
              style={{ 
                color: isHighlight ? undefined : UNV_COLORS.red.primary,
                textShadow: isHighlight ? '0 4px 20px rgba(0,0,0,0.3)' : undefined
              }}
            >
              {content.metric_value}
            </div>
            {content.metric_label && (
              <div 
                className={cn(
                  "text-2xl mt-4 font-medium",
                  isHighlight ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {content.metric_label}
              </div>
            )}
            <div className="mt-4 text-sm opacity-50">
              Clique para celebrar! 🎉
            </div>
          </div>
        )}

        {/* Decision options - Interactive */}
        {content.options && content.options.length > 0 && (
          <div className="flex flex-col items-center mt-12">
            <div className="text-sm mb-4 opacity-60">
              👆 Clique em uma opção para selecionar
            </div>
            <div className="flex gap-8">
              {content.options.map((option, i) => (
                <div
                  key={i}
                  onClick={() => handleOptionSelect(i)}
                  className={cn(
                    "px-10 py-6 rounded-2xl text-xl font-bold transition-all cursor-pointer shadow-lg relative overflow-hidden",
                    selectedOption === i 
                      ? "scale-110 ring-4 ring-white/50" 
                      : "hover:scale-105 hover:shadow-xl"
                  )}
                  style={{ 
                    background: i === 0 ? UNV_COLORS.blue.gradient : UNV_COLORS.red.gradient,
                    color: UNV_COLORS.neutral.white,
                  }}
                >
                  {selectedOption === i && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-6 h-6 text-white animate-scale-in" />
                    </div>
                  )}
                  <span className="opacity-60 mr-2">{i === 0 ? 'A' : 'B'}.</span>
                  {option}
                </div>
              ))}
            </div>
            {selectedOption !== null && (
              <div className="mt-6 text-lg font-medium animate-fade-in" style={{ color: UNV_COLORS.blue.dark }}>
                ✨ Você escolheu a Opção {selectedOption === 0 ? 'A' : 'B'}!
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderContentSlide = () => {
    const bulletsToShow = showAllContent 
      ? content.bullets 
      : content.bullets?.filter((_, i) => revealedBullets.includes(i));
    
    const hasMoreBullets = content.bullets && revealedBullets.length < content.bullets.length && !showAllContent;
    
    return (
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
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 cursor-pointer transition-transform hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            onClick={revealNextBullet}
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
              <>
                {/* Reveal controls */}
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revealNextBullet}
                    disabled={!hasMoreBullets}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Revelar próximo ({revealedBullets.length}/{content.bullets.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={revealAllBullets}
                    disabled={showAllContent}
                    className="gap-2"
                  >
                    <EyeOff className="w-4 h-4" />
                    Mostrar todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetReveal}
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resetar
                  </Button>
                  <div className="text-sm text-muted-foreground ml-auto">
                    Dica: Pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">R</kbd> para revelar
                  </div>
                </div>
                
                <ul className="space-y-5">
                  {(showAllContent ? content.bullets : bulletsToShow)?.map((bullet, i) => (
                    <li 
                      key={i} 
                      className={cn(
                        "flex items-start gap-5 p-4 rounded-xl transition-all cursor-pointer",
                        highlightedBullet === i 
                          ? "bg-white shadow-lg scale-[1.02]" 
                          : "hover:bg-white hover:shadow-md",
                        !showAllContent && revealedBullets.includes(i) && "animate-fade-in"
                      )}
                      onClick={() => setHighlightedBullet(highlightedBullet === i ? null : i)}
                    >
                      <div 
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform",
                          highlightedBullet === i && "scale-110"
                        )}
                        style={{ background: highlightedBullet === i ? UNV_COLORS.gold.gradient : UNV_COLORS.red.gradient }}
                      >
                        <span className="text-white font-bold">{i + 1}</span>
                      </div>
                      <span 
                        className={cn(
                          "text-xl md:text-2xl leading-relaxed pt-1 transition-colors",
                          highlightedBullet === i ? "font-semibold" : ""
                        )}
                        style={{ color: UNV_COLORS.blue.dark }}
                      >
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
                
                {hasMoreBullets && (
                  <div 
                    className="mt-6 p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all hover:bg-white/50"
                    style={{ borderColor: UNV_COLORS.blue.light }}
                    onClick={revealNextBullet}
                  >
                    <span className="text-muted-foreground">
                      + {content.bullets.length - revealedBullets.length} itens ocultos - clique para revelar
                    </span>
                  </div>
                )}
              </>
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
  };

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

            <div className="flex items-center gap-2">
              {/* Timer */}
              <div className="flex items-center gap-2 mr-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimerActive(!timerActive)}
                  className={cn(
                    "text-white/70 hover:text-white hover:bg-white/10 gap-2",
                    timerActive && "text-green-400"
                  )}
                >
                  <Timer className="h-4 w-4" />
                  {formatTime(timerSeconds)}
                </Button>
                {timerSeconds > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setTimerSeconds(0);
                      setTimerActive(false);
                    }}
                    className="text-white/50 hover:text-white hover:bg-white/10 h-6 w-6"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
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
                    i === currentSlide ? "w-8" : "w-2 hover:opacity-70 hover:w-4"
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