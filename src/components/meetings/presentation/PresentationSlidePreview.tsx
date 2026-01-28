import { cn } from "@/lib/utils";
import type { PresentationSlide, SlideContent } from "./types";
import { 
  MessageSquare, 
  Lightbulb, 
  ArrowLeftRight, 
  TrendingUp,
  Target,
  FileText,
  BarChart3,
  CheckCircle2,
  Quote
} from "lucide-react";

interface PresentationSlidePreviewProps {
  slide: PresentationSlide;
  companyName?: string;
  isActive?: boolean;
  onClick?: () => void;
  size?: "small" | "large";
}

// UNV Brand colors
const UNV_BLUE = "#1E3A5F";
const UNV_RED = "#E63946";

const getSlideTypeIcon = (type: string) => {
  switch (type) {
    case "cover":
      return null;
    case "context":
      return FileText;
    case "objective":
      return Target;
    case "status":
    case "data":
      return BarChart3;
    case "insight":
      return Lightbulb;
    case "proposal":
      return CheckCircle2;
    case "next_steps":
      return CheckCircle2;
    case "interactive":
      return MessageSquare;
    default:
      return FileText;
  }
};

const getInteractiveIcon = (type?: string) => {
  switch (type) {
    case "question":
      return MessageSquare;
    case "reflection":
      return Quote;
    case "decision":
      return ArrowLeftRight;
    case "highlight":
      return TrendingUp;
    default:
      return MessageSquare;
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
  const SlideIcon = slide.is_interactive 
    ? getInteractiveIcon(slide.interactive_type)
    : getSlideTypeIcon(slide.slide_type);

  const renderCoverSlide = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      {/* UNV Logo placeholder */}
      <div 
        className="text-xs font-bold mb-2"
        style={{ color: UNV_BLUE }}
      >
        UNIVERSIDADE VENDAS
      </div>
      
      {companyName && (
        <div className="text-[10px] text-muted-foreground mb-3">
          {companyName}
        </div>
      )}
      
      <h1 
        className={cn(
          "font-bold leading-tight",
          isLarge ? "text-lg" : "text-[11px]"
        )}
        style={{ color: UNV_BLUE }}
      >
        {slide.title}
      </h1>
      
      {slide.subtitle && (
        <p className="text-[9px] text-muted-foreground mt-1">
          {slide.subtitle}
        </p>
      )}
    </div>
  );

  const renderInteractiveSlide = () => (
    <div className="h-full flex flex-col p-3">
      {/* Interactive indicator */}
      <div 
        className="flex items-center gap-1 text-[8px] font-medium mb-2"
        style={{ color: UNV_RED }}
      >
        {SlideIcon && <SlideIcon className="h-3 w-3" />}
        {slide.interactive_type === "question" && "PERGUNTA ESTRATÉGICA"}
        {slide.interactive_type === "reflection" && "MOMENTO DE REFLEXÃO"}
        {slide.interactive_type === "decision" && "DECISÃO"}
        {slide.interactive_type === "highlight" && "DESTAQUE"}
      </div>

      {/* Question or highlight */}
      {content.question && (
        <div 
          className={cn(
            "font-semibold leading-tight",
            isLarge ? "text-sm" : "text-[10px]"
          )}
          style={{ color: UNV_BLUE }}
        >
          {content.question}
        </div>
      )}

      {content.highlight && (
        <div 
          className={cn(
            "font-bold text-center my-auto",
            isLarge ? "text-xl" : "text-sm"
          )}
          style={{ color: UNV_RED }}
        >
          {content.highlight}
        </div>
      )}

      {/* Options for decision slides */}
      {content.options && (
        <div className="flex gap-2 mt-auto">
          {content.options.map((option, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded border text-center py-1",
                isLarge ? "text-xs" : "text-[8px]"
              )}
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

      {/* Metric highlight */}
      {content.metric_value && (
        <div className="text-center my-auto">
          <div 
            className={cn("font-bold", isLarge ? "text-2xl" : "text-lg")}
            style={{ color: UNV_RED }}
          >
            {content.metric_value}
          </div>
          {content.metric_label && (
            <div className="text-[9px] text-muted-foreground">
              {content.metric_label}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderContentSlide = () => (
    <div className="h-full flex flex-col p-3">
      {/* Title with icon */}
      <div className="flex items-center gap-1.5 mb-2">
        {SlideIcon && (
          <SlideIcon 
            className="h-3 w-3 flex-shrink-0"
            style={{ color: UNV_BLUE }}
          />
        )}
        <h2 
          className={cn(
            "font-semibold leading-tight line-clamp-1",
            isLarge ? "text-sm" : "text-[10px]"
          )}
          style={{ color: UNV_BLUE }}
        >
          {slide.title}
        </h2>
      </div>

      {/* Subtitle */}
      {slide.subtitle && (
        <p className="text-[8px] text-muted-foreground mb-2 line-clamp-1">
          {slide.subtitle}
        </p>
      )}

      {/* Bullets */}
      {content.bullets && content.bullets.length > 0 && (
        <ul className="space-y-0.5 flex-1">
          {content.bullets.slice(0, isLarge ? 6 : 4).map((bullet, i) => (
            <li key={i} className="flex items-start gap-1">
              <span 
                className="w-1 h-1 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: UNV_RED }}
              />
              <span 
                className={cn(
                  "leading-tight line-clamp-2",
                  isLarge ? "text-xs" : "text-[8px]"
                )}
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
            "leading-tight line-clamp-4",
            isLarge ? "text-xs" : "text-[8px]"
          )}
        >
          {content.text}
        </p>
      )}
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-white rounded border-2 transition-all overflow-hidden",
        isLarge ? "aspect-[16/9] w-full" : "aspect-[16/9] w-full cursor-pointer hover:shadow-md",
        isActive ? "border-primary ring-2 ring-primary/20" : "border-border",
        onClick && "cursor-pointer"
      )}
    >
      {/* Slide number badge */}
      <div 
        className="absolute top-1 right-1 text-[8px] px-1 rounded text-white"
        style={{ backgroundColor: UNV_BLUE }}
      >
        {slide.slide_number}
      </div>

      {/* Accent bar */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: slide.is_interactive ? UNV_RED : UNV_BLUE }}
      />

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
