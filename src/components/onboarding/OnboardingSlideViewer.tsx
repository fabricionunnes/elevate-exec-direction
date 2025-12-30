import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Home, CheckCircle2, Package, Target, Clock, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { OnboardingSlide, ProductOnboarding } from "@/data/onboardingContent";
import { cn } from "@/lib/utils";

interface OnboardingSlideViewerProps {
  onboarding: ProductOnboarding;
}

const slideTypeIcons = {
  intro: Package,
  deliverable: CheckCircle2,
  cadence: Clock,
  expectations: Target,
  "next-steps": ArrowRight,
};

const slideTypeColors = {
  intro: "from-primary/20 to-primary/5",
  deliverable: "from-emerald-500/20 to-emerald-500/5",
  cadence: "from-blue-500/20 to-blue-500/5",
  expectations: "from-amber-500/20 to-amber-500/5",
  "next-steps": "from-violet-500/20 to-violet-500/5",
};

export const OnboardingSlideViewer = ({ onboarding }: OnboardingSlideViewerProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const slides = onboarding.slides;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  const goToNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const goToPrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "ArrowLeft") goToPrev();
  };

  const currentSlideData = slides[currentSlide];
  const SlideIcon = slideTypeIcons[currentSlideData.type];
  const slideColor = slideTypeColors[currentSlideData.type];

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
            >
              <Link to="/onboarding">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-lg">{onboarding.productName}</h1>
              <p className="text-sm text-muted-foreground">{onboarding.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{currentSlide + 1} / {slides.length}</span>
          </div>
        </div>
        <Progress value={progress} className="h-1" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Card className={cn(
          "w-full max-w-4xl shadow-xl border-0 bg-gradient-to-br",
          slideColor
        )}>
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-background rounded-full shadow-lg">
                <SlideIcon className="h-10 w-10 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl md:text-3xl font-bold">
              {currentSlideData.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 md:px-12 pb-8">
            <ul className="space-y-4">
              {currentSlideData.content.map((item, index) => (
                <li
                  key={index}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg bg-background/80 backdrop-blur-sm",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground/90 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>

      {/* Footer Navigation */}
      <footer className="border-t border-border/40 bg-card/50 backdrop-blur-sm sticky bottom-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goToPrev}
            disabled={currentSlide === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          {/* Slide Indicators */}
          <div className="hidden md:flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all",
                  index === currentSlide
                    ? "bg-primary w-8"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          {currentSlide === slides.length - 1 ? (
            <Button onClick={() => navigate("/onboarding")} className="gap-2">
              Concluir
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={goToNext} className="gap-2">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
