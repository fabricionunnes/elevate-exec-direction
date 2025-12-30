import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  CheckCircle2, 
  Package, 
  Target, 
  Clock, 
  ArrowRight,
  Sparkles,
  Zap,
  TrendingUp,
  Shield,
  Star
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ProductOnboarding } from "@/data/onboardingContent";
import { cn } from "@/lib/utils";

interface OnboardingSlideViewerProps {
  onboarding: ProductOnboarding;
}

const slideTypeConfig = {
  intro: {
    icon: Package,
    gradient: "from-primary via-primary/80 to-blue-600",
    bgPattern: "radial-gradient(circle at 20% 80%, rgba(196, 30, 58, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(10, 34, 64, 0.2) 0%, transparent 50%)",
    accentIcon: Sparkles,
  },
  deliverable: {
    icon: CheckCircle2,
    gradient: "from-emerald-500 via-emerald-600 to-teal-600",
    bgPattern: "radial-gradient(circle at 10% 90%, rgba(16, 185, 129, 0.15) 0%, transparent 50%), radial-gradient(circle at 90% 10%, rgba(20, 184, 166, 0.15) 0%, transparent 50%)",
    accentIcon: Zap,
  },
  cadence: {
    icon: Clock,
    gradient: "from-blue-500 via-blue-600 to-indigo-600",
    bgPattern: "radial-gradient(circle at 30% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)",
    accentIcon: TrendingUp,
  },
  expectations: {
    icon: Target,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    bgPattern: "radial-gradient(circle at 25% 75%, rgba(245, 158, 11, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 25%, rgba(239, 68, 68, 0.15) 0%, transparent 50%)",
    accentIcon: Star,
  },
  "next-steps": {
    icon: ArrowRight,
    gradient: "from-violet-500 via-purple-600 to-fuchsia-600",
    bgPattern: "radial-gradient(circle at 15% 85%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 85% 15%, rgba(192, 38, 211, 0.15) 0%, transparent 50%)",
    accentIcon: Shield,
  },
};

export const OnboardingSlideViewer = ({ onboarding }: OnboardingSlideViewerProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const navigate = useNavigate();
  const slides = onboarding.slides;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  // Animate items appearing one by one
  useEffect(() => {
    setVisibleItems([]);
    const currentContent = slides[currentSlide].content;
    
    currentContent.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems((prev) => [...prev, index]);
      }, 150 * (index + 1));
    });
  }, [currentSlide, slides]);

  const changeSlide = (newSlide: number, dir: "next" | "prev") => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(dir);
    
    setTimeout(() => {
      setCurrentSlide(newSlide);
      setIsAnimating(false);
    }, 300);
  };

  const goToNext = () => {
    if (currentSlide < slides.length - 1) {
      changeSlide(currentSlide + 1, "next");
    }
  };

  const goToPrev = () => {
    if (currentSlide > 0) {
      changeSlide(currentSlide - 1, "prev");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "ArrowLeft") goToPrev();
  };

  const currentSlideData = slides[currentSlide];
  const config = slideTypeConfig[currentSlideData.type];
  const SlideIcon = config.icon;
  const AccentIcon = config.accentIcon;

  return (
    <div
      className="min-h-screen bg-background flex flex-col overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Animated Background */}
      <div 
        className="fixed inset-0 transition-all duration-700 ease-out opacity-50"
        style={{ background: config.bgPattern }}
      />
      
      {/* Floating particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-2 h-2 rounded-full bg-primary/20",
              "animate-pulse"
            )}
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + i * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10 transition-colors"
              asChild
            >
              <Link to="/onboarding">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-bold text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                {onboarding.productName}
              </h1>
              <p className="text-sm text-muted-foreground">{onboarding.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => changeSlide(index, index > currentSlide ? "next" : "prev")}
                  className={cn(
                    "h-2 rounded-full transition-all duration-500",
                    index === currentSlide
                      ? "w-8 bg-gradient-to-r " + config.gradient
                      : index < currentSlide
                      ? "w-2 bg-primary/50"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-muted">
              {currentSlide + 1} / {slides.length}
            </span>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      {/* Main Content */}
      <main className="relative flex-1 flex items-center justify-center p-4 md:p-8">
        <div
          className={cn(
            "w-full max-w-5xl transition-all duration-300 ease-out",
            isAnimating && direction === "next" && "translate-x-8 opacity-0",
            isAnimating && direction === "prev" && "-translate-x-8 opacity-0"
          )}
        >
          {/* Slide Card */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            {/* Gradient Header */}
            <div className={cn(
              "relative p-8 md:p-12 bg-gradient-to-br text-white",
              config.gradient
            )}>
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
              
              <div className="relative flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                {/* Icon Container */}
                <div className="relative">
                  <div className="p-6 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                    <SlideIcon className="h-12 w-12 md:h-16 md:w-16" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 p-2 bg-white/30 backdrop-blur-sm rounded-xl">
                    <AccentIcon className="h-5 w-5" />
                  </div>
                </div>
                
                {/* Title */}
                <div className="flex-1">
                  <h2 className="text-2xl md:text-4xl font-bold mb-2 drop-shadow-lg">
                    {currentSlideData.title}
                  </h2>
                  <p className="text-white/80 text-sm md:text-base">
                    Slide {currentSlide + 1} de {slides.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="bg-card p-6 md:p-10">
              <div className="grid gap-4">
                {currentSlideData.content.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      "group flex items-start gap-4 p-5 rounded-xl",
                      "bg-gradient-to-r from-muted/50 to-muted/30",
                      "border border-border/50 hover:border-primary/30",
                      "transition-all duration-500 ease-out",
                      "hover:shadow-lg hover:shadow-primary/5",
                      "hover:-translate-y-0.5",
                      visibleItems.includes(index)
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 translate-x-8"
                    )}
                    style={{
                      transitionDelay: `${index * 50}ms`,
                    }}
                  >
                    {/* Number indicator */}
                    <div className={cn(
                      "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                      "bg-gradient-to-br text-white font-bold text-sm shadow-lg",
                      "group-hover:scale-110 transition-transform duration-300",
                      config.gradient
                    )}>
                      {index + 1}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-relaxed text-base md:text-lg">
                        {item}
                      </p>
                    </div>
                    
                    {/* Check icon on hover */}
                    <CheckCircle2 className="h-5 w-5 text-primary/0 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="relative border-t border-border/40 bg-card/80 backdrop-blur-xl sticky bottom-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={goToPrev}
            disabled={currentSlide === 0 || isAnimating}
            className="gap-2 min-w-[120px] transition-all hover:gap-3"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          {/* Mobile slide indicators */}
          <div className="flex md:hidden items-center gap-1">
            {slides.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  index === currentSlide
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {currentSlide === slides.length - 1 ? (
            <Button 
              onClick={() => navigate("/onboarding")} 
              className={cn(
                "gap-2 min-w-[120px] bg-gradient-to-r shadow-lg",
                "hover:shadow-xl hover:scale-105 transition-all",
                config.gradient
              )}
            >
              Concluir
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={goToNext}
              disabled={isAnimating}
              className={cn(
                "gap-2 min-w-[120px] bg-gradient-to-r shadow-lg",
                "hover:shadow-xl hover:gap-3 transition-all",
                config.gradient
              )}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
