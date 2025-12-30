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
  phase: 'main' | 'operation' | 'advanced' | 'structure' | 'other';
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
    link: "/core",
    phase: 'main'
  },
  {
    id: "control",
    name: "UNV Control",
    shortName: "Control",
    objective: "Direção comercial contínua e previsibilidade",
    icon: Compass,
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    link: "/control",
    phase: 'main'
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
    phase: 'main'
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
    link: "/sales-ops",
    phase: 'operation'
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
    phase: 'operation'
  },
  {
    id: "social",
    name: "UNV Social",
    shortName: "Social",
    objective: "Gestão profissional das redes sociais",
    icon: Share2,
    color: "text-pink-500",
    bgColor: "bg-pink-500",
    link: "/social",
    phase: 'operation'
  },
  {
    id: "ai-sales-system",
    name: "UNV Sales System",
    shortName: "Sales System",
    objective: "Automatizar vendas com inteligência artificial",
    icon: Bot,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500",
    link: "/ai-sales-system",
    phase: 'operation'
  },
  {
    id: "fractional-cro",
    name: "UNV Fractional CRO",
    shortName: "Fractional CRO",
    objective: "Diretor comercial terceirizado",
    icon: UserCheck,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500",
    link: "/fractional-cro",
    phase: 'operation'
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
    link: "/growth-room",
    phase: 'advanced'
  },
  {
    id: "partners",
    name: "UNV Partners",
    shortName: "Partners",
    objective: "Grupo estratégico de parceiros UNV",
    icon: Handshake,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500",
    link: "/partners",
    phase: 'advanced'
  },
  {
    id: "execution-partnership",
    name: "UNV Execution Partnership",
    shortName: "Execution",
    objective: "Implementação comercial direta em 3 meses",
    icon: Handshake,
    color: "text-red-600",
    bgColor: "bg-red-600",
    link: "/execution-partnership",
    phase: 'advanced'
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    shortName: "Mastermind",
    objective: "Grupo exclusivo de empresários de elite",
    icon: Crown,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    link: "/mastermind",
    phase: 'advanced'
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
    link: "/le-desir",
    phase: 'structure'
  },
  {
    id: "people",
    name: "UNV People",
    shortName: "People",
    objective: "Gestão de pessoas e cultura organizacional",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-600",
    link: "/people",
    phase: 'structure'
  },
  {
    id: "finance",
    name: "UNV Finance",
    shortName: "Finance",
    objective: "Controle financeiro estratégico",
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-600",
    link: "/finance",
    phase: 'structure'
  },
  {
    id: "safe",
    name: "UNV Safe",
    shortName: "Safe",
    objective: "Assessoria jurídica preventiva",
    icon: Shield,
    color: "text-slate-500",
    bgColor: "bg-slate-500",
    link: "/safe",
    phase: 'structure'
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
    link: "/leadership",
    phase: 'other'
  }
];

// Unified winding path positions - continuous flow
const desktopPositions = [
  { x: 8, y: 4 },     // 1. Core
  { x: 25, y: 7 },    // 2. Control
  { x: 45, y: 4 },    // 3. Acceleration
  { x: 65, y: 9 },    // 4. Sales Ops
  { x: 85, y: 5 },    // 5. Ads
  { x: 92, y: 16 },   // 6. Social
  { x: 78, y: 22 },   // 7. Sales System
  { x: 58, y: 19 },   // 8. Fractional CRO
  { x: 38, y: 25 },   // 9. Growth Room
  { x: 18, y: 22 },   // 10. Partners
  { x: 8, y: 34 },    // 11. Execution
  { x: 22, y: 42 },   // 12. Mastermind
  { x: 42, y: 38 },   // 13. Le Désir
  { x: 62, y: 44 },   // 14. People
  { x: 82, y: 40 },   // 15. Finance
  { x: 92, y: 52 },   // 16. Safe
  { x: 75, y: 58 },   // 17. Leadership
];

// Generate smooth curved path through all points
function generateSmoothPath(positions: { x: number; y: number }[]): string {
  if (positions.length < 2) return "";
  
  let path = `M ${positions[0].x} ${positions[0].y}`;
  
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    
    // Calculate control points for smooth curves
    const midX = (prev.x + curr.x) / 2;
    const cpX1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) * 0.5;
    const cpY2 = curr.y;
    
    // Use cubic bezier for smoother curves
    path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
  }
  
  return path;
}

export function ServiceJourneyPath() {
  const pathD = generateSmoothPath(desktopPositions);
  
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
            17 serviços interligados para transformar sua operação comercial. Clique em cada ponto para conhecer.
          </p>
        </div>

        {/* Desktop Unified Path */}
        <div className="hidden lg:block relative" style={{ height: '1300px' }}>
          {/* SVG Path - Single Unified Path with Connections */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none" 
            viewBox="0 0 100 65"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Defs */}
            <defs>
              {/* Glow filter */}
              <filter id="pathGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* Rainbow gradient for unified path */}
              <linearGradient id="unifiedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="18%" stopColor="#3b82f6" />
                <stop offset="30%" stopColor="#22c55e" />
                <stop offset="40%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="60%" stopColor="#ec4899" />
                <stop offset="70%" stopColor="#f59e0b" />
                <stop offset="80%" stopColor="#10b981" />
                <stop offset="90%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>

              {/* Vertical gradient for connecting lines */}
              <linearGradient id="connectGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* Connecting lines between upper and lower trails */}
            {/* Connection: Acceleration (3) to Growth Room (9) */}
            <path
              d="M 45 4 Q 45 15, 38 25"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.5"
            />
            
            {/* Connection: Sales Ops (4) to Partners (10) */}
            <path
              d="M 65 9 Q 40 16, 18 22"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.5"
            />
            
            {/* Connection: Ads (5) to Mastermind (12) */}
            <path
              d="M 85 5 Q 60 24, 22 42"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.4"
            />

            {/* Connection: Social (6) to Le Désir (13) */}
            <path
              d="M 92 16 Q 70 28, 42 38"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.5"
            />

            {/* Connection: Sales System (7) to People (14) */}
            <path
              d="M 78 22 Q 72 34, 62 44"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.5"
            />

            {/* Connection: Fractional CRO (8) to Finance (15) */}
            <path
              d="M 58 19 Q 70 30, 82 40"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.5"
            />

            {/* Connection: Execution (11) to Safe (16) */}
            <path
              d="M 8 34 Q 50 45, 92 52"
              fill="none"
              stroke="url(#connectGradient)"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="1 1"
              opacity="0.4"
            />

            {/* Background glow path */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#unifiedGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.2"
            />
            
            {/* Main gradient path */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#unifiedGradient)"
              strokeWidth="0.5"
              strokeLinecap="round"
              filter="url(#pathGlow)"
            />

            {/* Animated flowing dots on main path */}
            <circle r="0.8" fill="white" opacity="0.8">
              <animateMotion dur="12s" repeatCount="indefinite" path={pathD} />
            </circle>
            <circle r="0.6" fill="white" opacity="0.6">
              <animateMotion dur="12s" repeatCount="indefinite" path={pathD} begin="-4s" />
            </circle>
            <circle r="0.5" fill="white" opacity="0.4">
              <animateMotion dur="12s" repeatCount="indefinite" path={pathD} begin="-8s" />
            </circle>
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

          {/* Floating phase indicators - positioned along the path */}
          <div className="absolute" style={{ left: '16%', top: '1%' }}>
            <PhaseLabel phase="main" label="Trilha Principal" color="red" />
          </div>
          <div className="absolute" style={{ left: '85%', top: '12%' }}>
            <PhaseLabel phase="operation" label="Operação Comercial" color="purple" />
          </div>
          <div className="absolute" style={{ left: '5%', top: '28%' }}>
            <PhaseLabel phase="advanced" label="Trilha Avançada" color="amber" />
          </div>
          <div className="absolute" style={{ left: '55%', top: '52%' }}>
            <PhaseLabel phase="structure" label="Estratégia & Estrutura" color="emerald" />
          </div>
        </div>

        {/* Mobile/Tablet Path */}
        <div className="lg:hidden">
          <div className="relative">
            {/* Continuous vertical gradient line */}
            <div className="absolute left-8 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-red-500 via-purple-500 via-amber-500 via-emerald-500 to-violet-500">
              {/* Animated glow */}
              <div className="absolute inset-0 w-1 rounded-full bg-gradient-to-b from-red-500 via-purple-500 via-amber-500 via-emerald-500 to-violet-500 blur-md animate-pulse" />
            </div>
            
            {/* Steps */}
            <div className="space-y-4">
              {allServices.map((service, index) => (
                <MobileNode 
                  key={service.id} 
                  service={service} 
                  number={index + 1}
                  isLast={index === allServices.length - 1}
                  showPhaseLabel={
                    index === 0 ? 'Trilha Principal' :
                    index === 3 ? 'Operação Comercial' :
                    index === 8 ? 'Trilha Avançada' :
                    index === 12 ? 'Estratégia & Estrutura' :
                    index === 16 ? 'Desenvolvimento' : undefined
                  }
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            <span>Desenvolvimento</span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface PhaseLabelProps {
  phase: string;
  label: string;
  color: 'red' | 'purple' | 'amber' | 'emerald' | 'violet';
}

function PhaseLabel({ label, color }: PhaseLabelProps) {
  const colorClasses = {
    red: 'bg-red-500/10 border-red-500/30 text-red-500',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-500',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    violet: 'bg-violet-500/10 border-violet-500/30 text-violet-500',
  };
  
  return (
    <div className={cn("border rounded-lg px-3 py-1.5 backdrop-blur-sm", colorClasses[color])}>
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </div>
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
        
        {/* Connecting pulse ring */}
        <div className={cn(
          "absolute -inset-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 animate-ping",
          service.bgColor.replace('bg-', 'border-2 border-')
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
              <Crown className="h-5 w-5 text-yellow-400 drop-shadow-lg animate-bounce" />
            </div>
          )}
        </div>
        
        {/* Info card on hover */}
        <div className="absolute top-full mt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30 transform scale-95 group-hover:scale-100">
          <div className="bg-card border border-border rounded-xl p-4 shadow-2xl min-w-[220px] text-center backdrop-blur-sm">
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
  showPhaseLabel?: string;
}

function MobileNode({ service, number, isLast, showPhaseLabel }: MobileNodeProps) {
  const Icon = service.icon;
  
  return (
    <>
      {showPhaseLabel && (
        <div className="ml-20 mb-2 mt-4">
          <span className={cn(
            "text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full",
            service.phase === 'main' && "bg-red-500/10 text-red-500",
            service.phase === 'operation' && "bg-purple-500/10 text-purple-500",
            service.phase === 'advanced' && "bg-amber-500/10 text-amber-500",
            service.phase === 'structure' && "bg-emerald-500/10 text-emerald-500",
            service.phase === 'other' && "bg-violet-500/10 text-violet-500",
          )}>
            {showPhaseLabel}
          </span>
        </div>
      )}
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
              <Crown className="h-5 w-5 text-yellow-500 animate-bounce" />
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
    </>
  );
}
