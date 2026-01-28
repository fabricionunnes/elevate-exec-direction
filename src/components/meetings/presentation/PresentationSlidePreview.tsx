import { cn } from "@/lib/utils";
import type { PresentationSlide, SlideContent } from "./types";
import { 
  MessageSquare, 
  Lightbulb, 
  TrendingUp,
  Target,
  BarChart3,
  CheckCircle2,
  Award,
  Briefcase,
  PieChart,
  ArrowRight,
  Zap,
  Star
} from "lucide-react";
import unvLogoSlides from "@/assets/unv-logo-slides.png";

interface PresentationSlidePreviewProps {
  slide: PresentationSlide;
  companyName?: string;
  isActive?: boolean;
  onClick?: () => void;
  size?: "small" | "large";
}

// UNV Brand colors
const UNV_COLORS = {
  blue: {
    dark: "#1E3A5F",
    primary: "#2A4A6F",
    gradient: "linear-gradient(135deg, #1E3A5F 0%, #2A4A6F 50%, #3A5A7F 100%)"
  },
  red: {
    primary: "#E63946",
    gradient: "linear-gradient(135deg, #C62B38 0%, #E63946 50%, #EF5A67 100%)"
  },
  gold: {
    primary: "#D4AF37"
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

export function PresentationSlidePreview({
  slide,
  companyName,
  isActive,
  onClick,
  size = "small",
}: PresentationSlidePreviewProps) {
  const content = slide.content as SlideContent;
  const isLarge = size === "large";
  const SlideIcon = getSlideIcon(slide.slide_type, slide.interactive_type);

  const renderCoverSlide = () => (
    <div 
      className="h-full flex flex-col items-center justify-center text-center p-3 relative overflow-hidden"
      style={{ background: UNV_COLORS.blue.gradient }}
    >
      {/* Decorative circle */}
      <div 
        className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-20"
        style={{ backgroundColor: UNV_COLORS.red.primary }}
      />
      
      {/* UNV Logo */}
      <div className="mb-2 bg-white/90 rounded px-2 py-1">
        <img 
          src={unvLogoSlides} 
          alt="UNV" 
          className={cn(
            "object-contain",
            isLarge ? "h-12" : "h-6"
          )}
        />
      </div>
      
      {companyName && (
        <div className="text-[8px] text-white/70 mb-2">
          {companyName}
        </div>
      )}
      
      <h1 
        className={cn(
          "font-bold leading-tight text-white",
          isLarge ? "text-base" : "text-[10px]"
        )}
      >
        {slide.title}
      </h1>
      
      {slide.subtitle && (
        <p className="text-[8px] text-white/70 mt-1">
          {slide.subtitle}
        </p>
      )}
      
      {/* Bottom accent */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ background: UNV_COLORS.red.gradient }}
      />
    </div>
  );

  const renderInteractiveSlide = () => (
    <div 
      className="h-full flex flex-col p-3 relative overflow-hidden"
      style={{ 
        background: slide.interactive_type === "highlight" 
          ? UNV_COLORS.red.gradient 
          : '#F8F9FA'
      }}
    >
      {/* Interactive indicator */}
      <div 
        className={cn(
          "flex items-center gap-1 text-[7px] font-bold mb-2 tracking-wider",
          slide.interactive_type === "highlight" ? "text-white/80" : ""
        )}
        style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.red.primary }}
      >
        {SlideIcon && <SlideIcon className="h-2.5 w-2.5" />}
        {slide.interactive_type === "question" && "PERGUNTA"}
        {slide.interactive_type === "reflection" && "REFLEXÃO"}
        {slide.interactive_type === "decision" && "DECISÃO"}
        {slide.interactive_type === "highlight" && "DESTAQUE"}
      </div>

      {/* Question or highlight */}
      {content.question && (
        <div 
          className={cn(
            "font-semibold leading-tight flex-1 flex items-center",
            isLarge ? "text-xs" : "text-[9px]",
            slide.interactive_type === "highlight" ? "text-white" : ""
          )}
          style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.blue.dark }}
        >
          {content.question}
        </div>
      )}

      {content.highlight && !content.metric_value && (
        <div 
          className={cn(
            "font-black text-center my-auto",
            isLarge ? "text-lg" : "text-sm",
            slide.interactive_type === "highlight" ? "text-white" : ""
          )}
          style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.red.primary }}
        >
          {content.highlight}
        </div>
      )}

      {/* Options for decision slides */}
      {content.options && (
        <div className="flex gap-1.5 mt-auto">
          {content.options.map((option, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded text-center py-0.5 font-medium text-white",
                isLarge ? "text-[9px]" : "text-[7px]"
              )}
              style={{ 
                background: i === 0 ? UNV_COLORS.blue.gradient : UNV_COLORS.red.gradient,
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}

      {/* Metric highlight */}
      {content.metric_value && (
        <div className="text-center my-auto">
          <div 
            className={cn(
              "font-black",
              isLarge ? "text-xl" : "text-base",
              slide.interactive_type === "highlight" ? "text-white" : ""
            )}
            style={{ color: slide.interactive_type === "highlight" ? undefined : UNV_COLORS.red.primary }}
          >
            {content.metric_value}
          </div>
          {content.metric_label && (
            <div 
              className={cn(
                "text-[8px]",
                slide.interactive_type === "highlight" ? "text-white/70" : "text-muted-foreground"
              )}
            >
              {content.metric_label}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderContentSlide = () => (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Header */}
      <div 
        className="px-3 py-2"
        style={{ background: UNV_COLORS.blue.gradient }}
      >
        <div className="flex items-center gap-1.5">
          {SlideIcon && (
            <div 
              className="w-4 h-4 rounded flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              <SlideIcon className="h-2.5 w-2.5 text-white" />
            </div>
          )}
          <h2 
            className={cn(
              "font-semibold leading-tight line-clamp-1 text-white",
              isLarge ? "text-sm" : "text-[9px]"
            )}
          >
            {slide.title}
          </h2>
        </div>
        
        {/* Red accent line */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: UNV_COLORS.red.gradient }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 p-2 bg-white">
        {/* Bullets */}
        {content.bullets && content.bullets.length > 0 && (
          <ul className="space-y-0.5">
            {content.bullets.slice(0, isLarge ? 5 : 3).map((bullet, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <div 
                  className="w-3 h-3 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: UNV_COLORS.red.gradient }}
                >
                  <span className="text-white text-[6px] font-bold">{i + 1}</span>
                </div>
                <span 
                  className={cn(
                    "leading-tight line-clamp-1",
                    isLarge ? "text-xs" : "text-[7px]"
                  )}
                  style={{ color: UNV_COLORS.blue.dark }}
                >
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Text content */}
        {content.text && !content.bullets?.length && (
          <p 
            className={cn(
              "leading-tight line-clamp-3",
              isLarge ? "text-xs" : "text-[7px]"
            )}
            style={{ color: UNV_COLORS.blue.dark }}
          >
            {content.text}
          </p>
        )}
      </div>
      
      {/* Footer with logo */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-t">
        <img 
          src={unvLogoSlides} 
          alt="UNV" 
          className="h-4 object-contain"
        />
        <div className="flex items-center gap-0.5">
          {[UNV_COLORS.blue.dark, UNV_COLORS.red.primary, UNV_COLORS.gold.primary].map((color, i) => (
            <div 
              key={i}
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-white rounded-lg border-2 transition-all overflow-hidden shadow-sm",
        isLarge ? "aspect-[16/9] w-full" : "aspect-[16/9] w-full cursor-pointer hover:shadow-lg hover:scale-[1.02]",
        isActive ? "border-primary ring-2 ring-primary/20" : "border-border/50",
        onClick && "cursor-pointer"
      )}
    >
      {/* Slide number badge */}
      <div 
        className="absolute top-1.5 right-1.5 z-10 text-[7px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm"
        style={{ background: UNV_COLORS.blue.gradient }}
      >
        {slide.slide_number}
      </div>

      {/* Content */}
      {slide.slide_type === "cover" 
        ? renderCoverSlide()
        : slide.is_interactive
        ? renderInteractiveSlide()
        : renderContentSlide()
      }
    </div>
  );
}