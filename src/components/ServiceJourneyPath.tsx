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
  Sparkles,
  DollarSign,
  Shield,
  Bot,
  UserCheck,
  Flag
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
}

const allServices: JourneyStep[] = [
  // Trilha Principal
  {
    id: "core",
    name: "UNV Core",
    shortName: "Core",
    objective: "Estruturar sua operação comercial do zero",
    icon: Target,
    color: "text-red-500",
    bgColor: "bg-red-500",
    link: "/core"
  },
  {
    id: "control",
    name: "UNV Control",
    shortName: "Control",
    objective: "Direção comercial contínua e previsibilidade",
    icon: Compass,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    link: "/control"
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    shortName: "Acceleration",
    objective: "Acelerar resultados com acompanhamento individual",
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500",
    link: "/sales-acceleration"
  },
  // Operação Comercial
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    shortName: "Sales Ops",
    objective: "Treinar e capacitar seu time comercial",
    icon: Users,
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    link: "/sales-ops"
  },
  {
    id: "ads",
    name: "UNV Ads",
    shortName: "Ads",
    objective: "Escalar geração de leads qualificados",
    icon: Megaphone,
    color: "text-purple-500",
    bgColor: "bg-purple-500",
    link: "/ads"
  },
  {
    id: "social",
    name: "UNV Social",
    shortName: "Social",
    objective: "Gestão profissional das redes sociais",
    icon: Share2,
    color: "text-pink-500",
    bgColor: "bg-pink-500",
    link: "/social"
  },
  {
    id: "ai-sales-system",
    name: "UNV Sales System",
    shortName: "Sales System",
    objective: "Automatizar vendas com inteligência artificial",
    icon: Bot,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500",
    link: "/ai-sales-system"
  },
  {
    id: "fractional-cro",
    name: "UNV Fractional CRO",
    shortName: "Fractional CRO",
    objective: "Diretor comercial terceirizado",
    icon: UserCheck,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500",
    link: "/fractional-cro"
  },
  // Trilha Avançada
  {
    id: "growth-room",
    name: "UNV Growth Room",
    shortName: "Growth Room",
    objective: "Imersões intensivas para destravar crescimento",
    icon: Building2,
    color: "text-amber-500",
    bgColor: "bg-amber-500",
    link: "/growth-room"
  },
  {
    id: "partners",
    name: "UNV Partners",
    shortName: "Partners",
    objective: "Grupo estratégico de parceiros UNV",
    icon: Handshake,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
    link: "/partners"
  },
  {
    id: "execution-partnership",
    name: "UNV Execution Partnership",
    shortName: "Execution",
    objective: "Implementação comercial direta em 3 meses",
    icon: Handshake,
    color: "text-red-600",
    bgColor: "bg-red-600",
    link: "/execution-partnership"
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    shortName: "Mastermind",
    objective: "Grupo exclusivo de empresários de elite",
    icon: Crown,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    link: "/mastermind"
  },
  // Estratégia & Estrutura
  {
    id: "le-desir",
    name: "UNV Le Désir",
    shortName: "Le Désir",
    objective: "Posicionamento premium para sua marca",
    icon: Sparkles,
    color: "text-rose-500",
    bgColor: "bg-rose-500",
    link: "/le-desir"
  },
  {
    id: "people",
    name: "UNV People",
    shortName: "People",
    objective: "Gestão de pessoas e cultura organizacional",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-600",
    link: "/people"
  },
  {
    id: "finance",
    name: "UNV Finance",
    shortName: "Finance",
    objective: "Controle financeiro estratégico",
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-600",
    link: "/finance"
  },
  {
    id: "safe",
    name: "UNV Safe",
    shortName: "Safe",
    objective: "Assessoria jurídica preventiva",
    icon: Shield,
    color: "text-slate-500",
    bgColor: "bg-slate-500",
    link: "/safe"
  },
  // Outros
  {
    id: "leadership",
    name: "UNV Leadership",
    shortName: "Leadership",
    objective: "Desenvolvimento de líderes intermediários",
    icon: UserCheck,
    color: "text-violet-500",
    bgColor: "bg-violet-500",
    link: "/leadership"
  }
];

// Positions for the winding path - desktop
const desktopPositions = [
  { x: 10, y: 5 },    // Core
  { x: 30, y: 8 },    // Control
  { x: 50, y: 5 },    // Acceleration
  { x: 70, y: 12 },   // Sales Ops
  { x: 88, y: 8 },    // Ads
  { x: 85, y: 22 },   // Social
  { x: 65, y: 26 },   // Sales System
  { x: 45, y: 22 },   // Fractional CRO
  { x: 25, y: 28 },   // Growth Room
  { x: 10, y: 35 },   // Partners
  { x: 25, y: 42 },   // Execution
  { x: 48, y: 38 },   // Mastermind
  { x: 70, y: 44 },   // Le Désir
  { x: 88, y: 50 },   // People
  { x: 70, y: 58 },   // Finance
  { x: 48, y: 62 },   // Safe
  { x: 25, y: 58 },   // Leadership
];

export function ServiceJourneyPath() {
  return (
    <section className="section-padding bg-gradient-to-b from-background via-secondary/20 to-background overflow-hidden">
      <div className="container-premium">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Flag className="h-4 w-4" />
            Sua Jornada de Crescimento
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            A Trilha do Crescimento Comercial
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            17 serviços organizados para transformar sua operação comercial. Clique em cada ponto para conhecer.
          </p>
        </div>

        {/* Desktop Path */}
        <div className="hidden lg:block relative" style={{ height: '1400px' }}>
          {/* SVG Path */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none" 
            viewBox="0 0 100 70"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Glow filter */}
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="15%" stopColor="#3b82f6" />
                <stop offset="30%" stopColor="#22c55e" />
                <stop offset="45%" stopColor="#f97316" />
                <stop offset="60%" stopColor="#a855f7" />
                <stop offset="75%" stopColor="#f59e0b" />
                <stop offset="90%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Main curved path */}
            <path
              d={`
                M ${desktopPositions[0].x} ${desktopPositions[0].y}
                Q ${desktopPositions[0].x + 10} ${desktopPositions[0].y}, ${desktopPositions[1].x} ${desktopPositions[1].y}
                Q ${desktopPositions[1].x + 10} ${desktopPositions[1].y - 2}, ${desktopPositions[2].x} ${desktopPositions[2].y}
                Q ${desktopPositions[2].x + 10} ${desktopPositions[2].y + 5}, ${desktopPositions[3].x} ${desktopPositions[3].y}
                Q ${desktopPositions[3].x + 10} ${desktopPositions[3].y - 2}, ${desktopPositions[4].x} ${desktopPositions[4].y}
                Q ${desktopPositions[4].x + 2} ${desktopPositions[4].y + 8}, ${desktopPositions[5].x} ${desktopPositions[5].y}
                Q ${desktopPositions[5].x - 10} ${desktopPositions[5].y + 2}, ${desktopPositions[6].x} ${desktopPositions[6].y}
                Q ${desktopPositions[6].x - 10} ${desktopPositions[6].y - 2}, ${desktopPositions[7].x} ${desktopPositions[7].y}
                Q ${desktopPositions[7].x - 10} ${desktopPositions[7].y + 4}, ${desktopPositions[8].x} ${desktopPositions[8].y}
                Q ${desktopPositions[8].x - 8} ${desktopPositions[8].y + 4}, ${desktopPositions[9].x} ${desktopPositions[9].y}
                Q ${desktopPositions[9].x + 8} ${desktopPositions[9].y + 5}, ${desktopPositions[10].x} ${desktopPositions[10].y}
                Q ${desktopPositions[10].x + 12} ${desktopPositions[10].y - 2}, ${desktopPositions[11].x} ${desktopPositions[11].y}
                Q ${desktopPositions[11].x + 12} ${desktopPositions[11].y + 4}, ${desktopPositions[12].x} ${desktopPositions[12].y}
                Q ${desktopPositions[12].x + 10} ${desktopPositions[12].y + 4}, ${desktopPositions[13].x} ${desktopPositions[13].y}
                Q ${desktopPositions[13].x - 8} ${desktopPositions[13].y + 5}, ${desktopPositions[14].x} ${desktopPositions[14].y}
                Q ${desktopPositions[14].x - 12} ${desktopPositions[14].y + 2}, ${desktopPositions[15].x} ${desktopPositions[15].y}
                Q ${desktopPositions[15].x - 12} ${desktopPositions[15].y - 2}, ${desktopPositions[16].x} ${desktopPositions[16].y}
              `}
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="0.4"
              strokeLinecap="round"
              strokeDasharray="1 0.5"
              filter="url(#glow)"
              className="animate-pulse"
            />
            
            {/* Glow path */}
            <path
              d={`
                M ${desktopPositions[0].x} ${desktopPositions[0].y}
                Q ${desktopPositions[0].x + 10} ${desktopPositions[0].y}, ${desktopPositions[1].x} ${desktopPositions[1].y}
                Q ${desktopPositions[1].x + 10} ${desktopPositions[1].y - 2}, ${desktopPositions[2].x} ${desktopPositions[2].y}
                Q ${desktopPositions[2].x + 10} ${desktopPositions[2].y + 5}, ${desktopPositions[3].x} ${desktopPositions[3].y}
                Q ${desktopPositions[3].x + 10} ${desktopPositions[3].y - 2}, ${desktopPositions[4].x} ${desktopPositions[4].y}
                Q ${desktopPositions[4].x + 2} ${desktopPositions[4].y + 8}, ${desktopPositions[5].x} ${desktopPositions[5].y}
                Q ${desktopPositions[5].x - 10} ${desktopPositions[5].y + 2}, ${desktopPositions[6].x} ${desktopPositions[6].y}
                Q ${desktopPositions[6].x - 10} ${desktopPositions[6].y - 2}, ${desktopPositions[7].x} ${desktopPositions[7].y}
                Q ${desktopPositions[7].x - 10} ${desktopPositions[7].y + 4}, ${desktopPositions[8].x} ${desktopPositions[8].y}
                Q ${desktopPositions[8].x - 8} ${desktopPositions[8].y + 4}, ${desktopPositions[9].x} ${desktopPositions[9].y}
                Q ${desktopPositions[9].x + 8} ${desktopPositions[9].y + 5}, ${desktopPositions[10].x} ${desktopPositions[10].y}
                Q ${desktopPositions[10].x + 12} ${desktopPositions[10].y - 2}, ${desktopPositions[11].x} ${desktopPositions[11].y}
                Q ${desktopPositions[11].x + 12} ${desktopPositions[11].y + 4}, ${desktopPositions[12].x} ${desktopPositions[12].y}
                Q ${desktopPositions[12].x + 10} ${desktopPositions[12].y + 4}, ${desktopPositions[13].x} ${desktopPositions[13].y}
                Q ${desktopPositions[13].x - 8} ${desktopPositions[13].y + 5}, ${desktopPositions[14].x} ${desktopPositions[14].y}
                Q ${desktopPositions[14].x - 12} ${desktopPositions[14].y + 2}, ${desktopPositions[15].x} ${desktopPositions[15].y}
                Q ${desktopPositions[15].x - 12} ${desktopPositions[15].y - 2}, ${desktopPositions[16].x} ${desktopPositions[16].y}
              `}
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.15"
            />
          </svg>

          {/* Service Nodes */}
          {allServices.map((service, index) => (
            <DesktopNode 
              key={service.id}
              service={service}
              position={desktopPositions[index]}
              number={index + 1}
              isLast={index === allServices.length - 1}
            />
          ))}

          {/* Phase Labels */}
          <div className="absolute left-4 top-[3%] text-left">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Fase 1</span>
              <p className="text-xs text-muted-foreground">Trilha Principal</p>
            </div>
          </div>
          <div className="absolute right-4 top-[28%] text-right">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-purple-500 uppercase tracking-wider">Fase 2</span>
              <p className="text-xs text-muted-foreground">Operação Comercial</p>
            </div>
          </div>
          <div className="absolute left-4 top-[52%] text-left">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Fase 3</span>
              <p className="text-xs text-muted-foreground">Trilha Avançada</p>
            </div>
          </div>
          <div className="absolute right-4 top-[78%] text-right">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Fase 4</span>
              <p className="text-xs text-muted-foreground">Estratégia & Estrutura</p>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Path */}
        <div className="lg:hidden">
          <div className="relative">
            {/* Vertical gradient line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-red-500 via-purple-500 via-amber-500 via-emerald-500 to-violet-500" />
            
            {/* Steps */}
            <div className="space-y-4">
              {allServices.map((service, index) => (
                <MobileNode 
                  key={service.id} 
                  service={service} 
                  number={index + 1}
                  isLast={index === allServices.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 lg:mt-4 flex flex-wrap justify-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Principal</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Operação</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Avançada</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Estrutura</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface DesktopNodeProps {
  service: JourneyStep;
  position: { x: number; y: number };
  number: number;
  isLast?: boolean;
}

function DesktopNode({ service, position, number, isLast }: DesktopNodeProps) {
  const Icon = service.icon;
  
  return (
    <Link 
      to={service.link}
      className="absolute group"
      style={{ 
        left: `${position.x}%`, 
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Glow effect on hover */}
        <div className={cn(
          "absolute -inset-4 rounded-full blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-300",
          service.bgColor
        )} />
        
        {/* Main circle */}
        <div className={cn(
          "relative w-14 h-14 xl:w-16 xl:h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
          "group-hover:scale-125 group-hover:shadow-2xl border-4 border-background",
          service.bgColor
        )}>
          <Icon className="h-6 w-6 xl:h-7 xl:w-7 text-white" />
          
          {/* Number badge */}
          <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-background shadow-md flex items-center justify-center text-xs font-bold text-foreground border border-border">
            {number}
          </div>
          
          {/* Crown for last step */}
          {isLast && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Crown className="h-5 w-5 text-yellow-400 drop-shadow-lg" />
            </div>
          )}
        </div>
        
        {/* Info card on hover */}
        <div className="absolute top-full mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30 transform scale-95 group-hover:scale-100">
          <div className="bg-card border border-border rounded-xl p-4 shadow-2xl min-w-[220px] text-center">
            <h4 className={cn("font-bold text-sm", service.color)}>{service.name}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{service.objective}</p>
            <div className="mt-3 flex items-center justify-center gap-1 text-xs text-primary font-semibold">
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
        
        {/* Label */}
        <span className="mt-2 text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap bg-background/80 px-2 py-0.5 rounded-full">
          {service.shortName}
        </span>
      </div>
    </Link>
  );
}

interface MobileNodeProps {
  service: JourneyStep;
  number: number;
  isLast?: boolean;
}

function MobileNode({ service, number, isLast }: MobileNodeProps) {
  const Icon = service.icon;
  
  return (
    <Link to={service.link} className="relative flex items-start gap-4 group">
      {/* Circle on the line */}
      <div className={cn(
        "relative z-10 w-16 h-16 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 border-4 border-background shadow-lg",
        "group-hover:scale-110",
        service.bgColor
      )}>
        <Icon className="h-7 w-7 text-white" />
        <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-background shadow flex items-center justify-center text-xs font-bold border border-border">
          {number}
        </div>
        {isLast && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 bg-card border border-border rounded-xl p-4 group-hover:border-primary/50 group-hover:shadow-lg transition-all duration-300">
        <h4 className={cn("font-bold", service.color)}>{service.name}</h4>
        <p className="text-sm text-muted-foreground mt-1">{service.objective}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
          Ver detalhes <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}
