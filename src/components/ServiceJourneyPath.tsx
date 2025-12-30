import { Link } from "react-router-dom";
import { 
  Target, 
  Compass, 
  TrendingUp, 
  Users, 
  Megaphone, 
  Share2, 
  Building2, 
  Handshake, 
  Crown,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JourneyStep {
  id: string;
  name: string;
  shortName: string;
  objective: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  link: string;
  phase: "start" | "growth" | "scale" | "elite";
}

const journeySteps: JourneyStep[] = [
  {
    id: "core",
    name: "UNV Core",
    shortName: "Core",
    objective: "Estruturar sua operação comercial do zero",
    icon: Target,
    color: "text-red-500",
    bgColor: "bg-red-500",
    link: "/core",
    phase: "start"
  },
  {
    id: "control",
    name: "UNV Control",
    shortName: "Control",
    objective: "Ter direção comercial contínua e previsibilidade",
    icon: Compass,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    link: "/control",
    phase: "start"
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    shortName: "Acceleration",
    objective: "Acelerar resultados com acompanhamento individual",
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500",
    link: "/sales-acceleration",
    phase: "growth"
  },
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    shortName: "Sales Ops",
    objective: "Treinar e capacitar seu time comercial",
    icon: Users,
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    link: "/sales-ops",
    phase: "growth"
  },
  {
    id: "ads",
    name: "UNV Ads",
    shortName: "Ads",
    objective: "Escalar geração de leads qualificados",
    icon: Megaphone,
    color: "text-purple-500",
    bgColor: "bg-purple-500",
    link: "/ads",
    phase: "growth"
  },
  {
    id: "growth-room",
    name: "UNV Growth Room",
    shortName: "Growth Room",
    objective: "Imersões intensivas para destravar crescimento",
    icon: Building2,
    color: "text-amber-500",
    bgColor: "bg-amber-500",
    link: "/growth-room",
    phase: "scale"
  },
  {
    id: "partners",
    name: "UNV Partners",
    shortName: "Partners",
    objective: "Entrar no grupo estratégico de parceiros UNV",
    icon: Handshake,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
    link: "/partners",
    phase: "scale"
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    shortName: "Mastermind",
    objective: "Fazer parte do grupo exclusivo de empresários de elite",
    icon: Crown,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    link: "/mastermind",
    phase: "elite"
  }
];

const phaseLabels = {
  start: { label: "INÍCIO", description: "Estruturação" },
  growth: { label: "CRESCIMENTO", description: "Aceleração" },
  scale: { label: "ESCALA", description: "Expansão" },
  elite: { label: "ELITE", description: "Excelência" }
};

export function ServiceJourneyPath() {
  return (
    <section className="section-padding bg-gradient-to-b from-background via-secondary/30 to-background overflow-hidden">
      <div className="container-premium">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            A Trilha do Crescimento Comercial
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Cada empresa tem uma jornada única. Veja o caminho completo para transformar sua operação comercial.
          </p>
        </div>

        {/* Journey Path - Desktop */}
        <div className="hidden lg:block relative">
          {/* Main path line */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none" 
            viewBox="0 0 1200 600"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Curved path */}
            <path
              d="M 100 100 
                 C 200 100, 250 100, 300 150 
                 S 400 250, 500 200 
                 S 650 100, 750 150 
                 S 900 300, 950 250 
                 S 1050 150, 1100 200"
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="12 8"
              className="animate-pulse"
            />
            {/* Glow effect */}
            <path
              d="M 100 100 
                 C 200 100, 250 100, 300 150 
                 S 400 250, 500 200 
                 S 650 100, 750 150 
                 S 900 300, 950 250 
                 S 1050 150, 1100 200"
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="20"
              strokeLinecap="round"
              opacity="0.1"
              filter="blur(8px)"
            />
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="75%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
          </svg>

          {/* Journey steps positioned along the path */}
          <div className="relative h-[500px]">
            {/* Step 1 - Core */}
            <JourneyNode 
              step={journeySteps[0]} 
              position={{ top: "5%", left: "5%" }}
              number={1}
            />
            
            {/* Step 2 - Control */}
            <JourneyNode 
              step={journeySteps[1]} 
              position={{ top: "8%", left: "20%" }}
              number={2}
            />
            
            {/* Step 3 - Sales Acceleration */}
            <JourneyNode 
              step={journeySteps[2]} 
              position={{ top: "25%", left: "32%" }}
              number={3}
            />
            
            {/* Step 4 - Sales Ops */}
            <JourneyNode 
              step={journeySteps[3]} 
              position={{ top: "30%", left: "48%" }}
              number={4}
            />
            
            {/* Step 5 - Ads */}
            <JourneyNode 
              step={journeySteps[4]} 
              position={{ top: "12%", left: "58%" }}
              number={5}
            />
            
            {/* Step 6 - Growth Room */}
            <JourneyNode 
              step={journeySteps[5]} 
              position={{ top: "20%", left: "72%" }}
              number={6}
            />
            
            {/* Step 7 - Partners */}
            <JourneyNode 
              step={journeySteps[6]} 
              position={{ top: "45%", left: "80%" }}
              number={7}
            />
            
            {/* Step 8 - Mastermind */}
            <JourneyNode 
              step={journeySteps[7]} 
              position={{ top: "30%", left: "88%" }}
              number={8}
              isLast
            />
          </div>

          {/* Phase indicators */}
          <div className="flex justify-between mt-8 px-4">
            {Object.entries(phaseLabels).map(([phase, { label, description }]) => (
              <div key={phase} className="text-center">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">{label}</div>
                <div className="text-sm text-muted-foreground">{description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Journey Path - Mobile/Tablet */}
        <div className="lg:hidden">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-green-500 via-amber-500 to-yellow-500 rounded-full" />
            
            {/* Steps */}
            <div className="space-y-6">
              {journeySteps.map((step, index) => (
                <MobileJourneyNode 
                  key={step.id} 
                  step={step} 
                  number={index + 1}
                  isLast={index === journeySteps.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Início</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Crescimento</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Escala</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Elite</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface JourneyNodeProps {
  step: JourneyStep;
  position: { top: string; left: string };
  number: number;
  isLast?: boolean;
}

function JourneyNode({ step, position, number, isLast }: JourneyNodeProps) {
  const Icon = step.icon;
  
  return (
    <Link 
      to={step.link}
      className="absolute group"
      style={{ top: position.top, left: position.left }}
    >
      <div className="relative flex flex-col items-center">
        {/* Glow effect on hover */}
        <div className={cn(
          "absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300",
          step.bgColor
        )} />
        
        {/* Main circle */}
        <div className={cn(
          "relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
          "group-hover:scale-110 group-hover:shadow-xl",
          step.bgColor
        )}>
          <Icon className="h-8 w-8 text-white" />
          
          {/* Number badge */}
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-current flex items-center justify-center text-xs font-bold">
            {number}
          </div>
          
          {/* Crown for last step */}
          {isLast && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
            </div>
          )}
        </div>
        
        {/* Info card on hover */}
        <div className="absolute top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-20">
          <div className="bg-card border border-border rounded-xl p-4 shadow-xl min-w-[200px] text-center">
            <h4 className={cn("font-bold text-sm", step.color)}>{step.name}</h4>
            <p className="text-xs text-muted-foreground mt-1">{step.objective}</p>
            <div className="mt-2 flex items-center justify-center gap-1 text-xs text-primary font-medium">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
        
        {/* Label */}
        <span className="mt-2 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
          {step.shortName}
        </span>
      </div>
    </Link>
  );
}

interface MobileJourneyNodeProps {
  step: JourneyStep;
  number: number;
  isLast?: boolean;
}

function MobileJourneyNode({ step, number, isLast }: MobileJourneyNodeProps) {
  const Icon = step.icon;
  
  return (
    <Link to={step.link} className="relative flex items-start gap-4 group">
      {/* Circle on the line */}
      <div className={cn(
        "relative z-10 w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
        "group-hover:scale-110",
        step.bgColor
      )}>
        <Icon className="h-7 w-7 text-white" />
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center text-xs font-bold">
          {number}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 bg-card border border-border rounded-xl p-4 group-hover:border-primary/50 group-hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
          <h4 className={cn("font-bold", step.color)}>{step.name}</h4>
          {isLast && <Crown className="h-5 w-5 text-yellow-500" />}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{step.objective}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
          Ver detalhes <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}
