import { useState, useEffect, useCallback } from "react";
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
  Star,
  Rocket,
  Trophy,
  Heart,
  PartyPopper,
  Eye,
  EyeOff,
  Lightbulb,
  MessageCircle,
  AlertTriangle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ProductOnboarding, PresenterNote } from "@/data/onboardingContent";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

// Import slide images
import slideIntro from "@/assets/onboarding/slide-intro.jpg";
import slideDeliverables from "@/assets/onboarding/slide-deliverables.jpg";
import slideExpectations from "@/assets/onboarding/slide-expectations.jpg";
import slideNextsteps from "@/assets/onboarding/slide-nextsteps.jpg";

interface OnboardingSlideViewerProps {
  onboarding: ProductOnboarding;
}

const slideTypeConfig = {
  intro: {
    icon: Rocket,
    gradient: "from-primary via-primary/80 to-blue-600",
    bgPattern: "radial-gradient(circle at 20% 80%, rgba(196, 30, 58, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(10, 34, 64, 0.2) 0%, transparent 50%)",
    accentIcon: Sparkles,
    image: slideIntro,
    emoji: "🚀",
  },
  deliverable: {
    icon: Trophy,
    gradient: "from-emerald-500 via-emerald-600 to-teal-600",
    bgPattern: "radial-gradient(circle at 10% 90%, rgba(16, 185, 129, 0.15) 0%, transparent 50%), radial-gradient(circle at 90% 10%, rgba(20, 184, 166, 0.15) 0%, transparent 50%)",
    accentIcon: Zap,
    image: slideDeliverables,
    emoji: "🏆",
  },
  cadence: {
    icon: Clock,
    gradient: "from-blue-500 via-blue-600 to-indigo-600",
    bgPattern: "radial-gradient(circle at 30% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)",
    accentIcon: TrendingUp,
    image: slideDeliverables,
    emoji: "⏰",
  },
  expectations: {
    icon: Target,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    bgPattern: "radial-gradient(circle at 25% 75%, rgba(245, 158, 11, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 25%, rgba(239, 68, 68, 0.15) 0%, transparent 50%)",
    accentIcon: Star,
    image: slideExpectations,
    emoji: "🎯",
  },
  "next-steps": {
    icon: Heart,
    gradient: "from-violet-500 via-purple-600 to-fuchsia-600",
    bgPattern: "radial-gradient(circle at 15% 85%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 85% 15%, rgba(192, 38, 211, 0.15) 0%, transparent 50%)",
    accentIcon: PartyPopper,
    image: slideNextsteps,
    emoji: "💪",
  },
};

// Motivational phrases for each slide type
const motivationalPhrases = {
  intro: [
    "Vamos nessa jornada juntos! 🤝",
    "Seu sucesso começa aqui!",
    "Prontos para transformar resultados?",
  ],
  deliverable: [
    "Olha só o que preparamos pra você!",
    "Isso tudo é seu!",
    "Cada item aqui foi pensado pra você crescer!",
  ],
  cadence: [
    "A consistência é o segredo!",
    "Juntos, vamos manter o ritmo!",
  ],
  expectations: [
    "Você no controle dos resultados!",
    "A transformação acontece aqui!",
    "O futuro do seu comercial!",
  ],
  "next-steps": [
    "Agora é com a gente!",
    "Só falta dar o primeiro passo!",
    "Vamos juntos construir isso!",
  ],
};

export const OnboardingSlideViewer = ({ onboarding }: OnboardingSlideViewerProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [visibleItems, setVisibleItems] = useState<number[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPresenterNotes, setShowPresenterNotes] = useState(false);
  const navigate = useNavigate();
  const slides = onboarding.slides;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  // Fire confetti celebration
  const celebrate = useCallback(() => {
    const duration = 2000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#C41E3A', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#C41E3A', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
      });
    }, 250);

    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  }, []);

  // Small celebration when advancing
  const smallCelebrate = useCallback(() => {
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { x: 0.9, y: 0.9 },
      colors: ['#C41E3A', '#10B981', '#3B82F6'],
      zIndex: 9999,
    });
  }, []);

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
    
    // Small celebration when moving forward
    if (dir === "next") {
      smallCelebrate();
    }
    
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

  const handleComplete = () => {
    celebrate();
    setTimeout(() => navigate("/onboarding"), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "ArrowLeft") goToPrev();
  };

  const currentSlideData = slides[currentSlide];
  const config = slideTypeConfig[currentSlideData.type];
  const SlideIcon = config.icon;
  const AccentIcon = config.accentIcon;
  const phrases = motivationalPhrases[currentSlideData.type];
  const randomPhrase = phrases[currentSlide % phrases.length];

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
      
      {/* Floating particles - more dynamic */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute rounded-full",
              i % 2 === 0 ? "w-3 h-3 bg-primary/30" : "w-2 h-2 bg-emerald-500/20"
            )}
            style={{
              left: `${10 + i * 12}%`,
              top: `${15 + (i % 4) * 20}%`,
              animation: `pulse ${2 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}

      {/* Header */}
      <header className="relative border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-primary/10 transition-colors h-8 w-8 p-0"
              asChild
            >
              <Link to="/onboarding">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-bold text-base bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
                <span>{config.emoji}</span>
                {onboarding.productName}
              </h1>
              <p className="text-xs text-muted-foreground">{onboarding.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Presenter Notes Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPresenterNotes(!showPresenterNotes)}
              className={cn(
                "gap-2 h-8 text-xs transition-colors",
                showPresenterNotes 
                  ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/30" 
                  : "hover:bg-muted"
              )}
            >
              {showPresenterNotes ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Notas CS</span>
            </Button>

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
      <main className="relative flex-1 flex items-center justify-center p-2 md:p-4">
        <div
          className={cn(
            "w-full max-w-6xl transition-all duration-300 ease-out",
            isAnimating && direction === "next" && "translate-x-8 opacity-0",
            isAnimating && direction === "prev" && "-translate-x-8 opacity-0"
          )}
        >
          {/* Slide Card */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl">
            {/* Two-column layout */}
            <div className="flex flex-col lg:flex-row">
              {/* Image Column */}
              <div className="relative lg:w-1/3 h-32 lg:h-auto min-h-[180px]">
                <img 
                  src={config.image} 
                  alt={currentSlideData.title}
                  className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-transparent via-transparent",
                  "to-card lg:to-card"
                )} />
                
                {/* Icon overlay with pulse animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={cn(
                    "p-4 rounded-xl bg-white/20 backdrop-blur-sm shadow-xl",
                    "transition-all duration-500 hover:scale-110",
                    "animate-pulse"
                  )}>
                    <SlideIcon className="h-10 w-10 lg:h-12 lg:w-12 text-white drop-shadow-lg" />
                  </div>
                </div>

                {/* Motivational badge */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className={cn(
                    "px-3 py-2 rounded-lg bg-white/90 backdrop-blur-sm",
                    "text-gray-800 font-medium text-xs text-center",
                    "shadow-lg border border-white/50"
                  )}>
                    {randomPhrase}
                  </div>
                </div>
              </div>

              {/* Content Column */}
              <div className="lg:w-2/3 bg-card flex flex-col">
                {/* Header with energetic styling */}
                <div className={cn(
                  "p-4 lg:p-5 bg-gradient-to-r text-white relative overflow-hidden",
                  config.gradient
                )}>
                  {/* Animated shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-pulse" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <AccentIcon className="h-4 w-4 animate-bounce" />
                      <span className="text-xs font-medium text-white/90">
                        {currentSlideData.type === "intro" && "🎬 Vamos começar!"}
                        {currentSlideData.type === "deliverable" && "🎁 O que é seu!"}
                        {currentSlideData.type === "cadence" && "📅 Nossa rotina"}
                        {currentSlideData.type === "expectations" && "🎯 Seus resultados"}
                        {currentSlideData.type === "next-steps" && "🚀 Bora!"}
                      </span>
                    </div>
                    <h2 className="text-lg lg:text-xl font-bold">
                      {currentSlideData.title}
                    </h2>
                  </div>
                </div>

                {/* Content Items with engaging animations */}
                <div className="p-4 lg:p-6">
                  <div className="grid gap-2">
                    {currentSlideData.content.map((item, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg",
                          "bg-gradient-to-r from-muted/50 to-muted/30",
                          "border border-border/50",
                          "transition-all duration-500 ease-out",
                          "hover:scale-[1.02] hover:shadow-md hover:border-primary/30",
                          visibleItems.includes(index)
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 translate-x-8"
                        )}
                        style={{ transitionDelay: `${index * 50}ms` }}
                      >
                        {/* Animated number indicator */}
                        <div className={cn(
                          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                          "bg-gradient-to-br text-white font-bold text-xs shadow-md",
                          "transition-transform duration-300 hover:scale-110 hover:rotate-12",
                          config.gradient
                        )}>
                          {index + 1}
                        </div>
                        
                        {/* Content */}
                        <p className="flex-1 text-foreground leading-snug text-sm">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Presenter Notes Panel */}
            {showPresenterNotes && currentSlideData.presenterNotes && (
              <div className="lg:w-80 bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                  <Lightbulb className="h-4 w-4" />
                  Notas do Apresentador
                </div>
                
                {/* Main Tip */}
                <div className="bg-white/80 dark:bg-amber-900/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                    💡 {currentSlideData.presenterNotes.tip}
                  </p>
                </div>

                {/* Talking Points */}
                {currentSlideData.presenterNotes.talkingPoints && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Pergunte / Fale sobre:
                    </div>
                    <ul className="space-y-1">
                      {currentSlideData.presenterNotes.talkingPoints.map((point, i) => (
                        <li 
                          key={i}
                          className="text-xs text-amber-800 dark:text-amber-200 pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-amber-500"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Watch Out */}
                {currentSlideData.presenterNotes.watchOut && (
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2.5 border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {currentSlideData.presenterNotes.watchOut}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Navigation - more engaging buttons */}
      <footer className="relative border-t border-border/40 bg-card/80 backdrop-blur-xl sticky bottom-0">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={goToPrev}
            disabled={currentSlide === 0 || isAnimating}
            className="gap-2 min-w-[120px] transition-all hover:gap-3"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
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
              onClick={handleComplete} 
              className={cn(
                "gap-2 min-w-[140px] bg-gradient-to-r shadow-lg",
                "hover:shadow-xl hover:scale-105 transition-all",
                "animate-pulse",
                config.gradient
              )}
            >
              <PartyPopper className="h-4 w-4" />
              Vamos Juntos!
            </Button>
          ) : (
            <Button 
              onClick={goToNext}
              disabled={isAnimating}
              className={cn(
                "gap-2 min-w-[120px] bg-gradient-to-r shadow-lg",
                "hover:shadow-xl hover:gap-3 transition-all group",
                config.gradient
              )}
            >
              Continuar
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
