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
  Flag,
  Trophy
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
  carColor: string;
}

const allServices: JourneyStep[] = [
  {
    id: "core",
    name: "UNV Core",
    shortName: "Core",
    objective: "Estruturar sua operação comercial do zero",
    icon: Target,
    color: "text-red-500",
    bgColor: "bg-red-500",
    link: "/core",
    carColor: "#ef4444"
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
    carColor: "#3b82f6"
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
    carColor: "#22c55e"
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
    carColor: "#f97316"
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
    carColor: "#a855f7"
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
    carColor: "#ec4899"
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
    carColor: "#06b6d4"
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
    carColor: "#6366f1"
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
    carColor: "#f59e0b"
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
    carColor: "#10b981"
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
    carColor: "#dc2626"
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
    carColor: "#eab308"
  },
  {
    id: "le-desir",
    name: "UNV Le Désir",
    shortName: "Le Désir",
    objective: "Posicionamento premium para sua marca",
    icon: Sparkles,
    color: "text-rose-500",
    bgColor: "bg-rose-500",
    link: "/le-desir",
    carColor: "#f43f5e"
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
    carColor: "#2563eb"
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
    carColor: "#16a34a"
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
    carColor: "#64748b"
  },
  {
    id: "leadership",
    name: "UNV Leadership",
    shortName: "Leadership",
    objective: "Desenvolvimento de líderes intermediários",
    icon: UserCheck,
    color: "text-violet-500",
    bgColor: "bg-violet-500",
    link: "/leadership",
    carColor: "#8b5cf6"
  }
];

export function ServiceJourneyPath() {
  return (
    <section className="section-padding bg-gradient-to-b from-background via-secondary/10 to-background overflow-hidden">
      <div className="container-premium">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Flag className="h-4 w-4" />
            Grande Prêmio do Crescimento
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            A Corrida para o Sucesso Comercial
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            17 etapas para cruzar a linha de chegada. Cada serviço te aproxima do pódio.
          </p>
        </div>

        {/* Racing Track */}
        <div className="relative">
          {/* Start Line */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/20 to-foreground/40" />
            <div className="flex items-center gap-2 px-6 py-3 bg-card border-2 border-dashed border-foreground/30 rounded-full">
              <Flag className="h-5 w-5 text-green-500" />
              <span className="font-bold text-foreground uppercase tracking-wider text-sm">Largada</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-foreground/20 to-foreground/40" />
          </div>

          {/* Track with Cars */}
          <div className="relative">
            {/* Track SVG Background */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none opacity-20" 
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <defs>
                <pattern id="trackPattern" patternUnits="userSpaceOnUse" width="20" height="20">
                  <rect width="10" height="10" fill="currentColor" className="text-foreground/10" />
                  <rect x="10" y="10" width="10" height="10" fill="currentColor" className="text-foreground/10" />
                </pattern>
              </defs>
            </svg>

            {/* Services as Race Cars */}
            <div className="space-y-4 md:space-y-6">
              {allServices.map((service, index) => (
                <RaceCarNode 
                  key={service.id}
                  service={service}
                  position={index + 1}
                  isLast={index === allServices.length - 1}
                  direction={index % 2 === 0 ? 'right' : 'left'}
                />
              ))}
            </div>
          </div>

          {/* Finish Line */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/20 to-foreground/40" />
            <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/50 rounded-full">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="font-bold text-yellow-500 uppercase tracking-wider text-sm">Chegada</span>
              <div className="flex gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-2 h-4",
                      i % 2 === 0 ? "bg-foreground" : "bg-background border border-foreground/30"
                    )} 
                  />
                ))}
              </div>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-foreground/20 to-foreground/40" />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Clique em qualquer carro para conhecer o serviço e acelerar sua jornada
          </p>
        </div>
      </div>
    </section>
  );
}

interface RaceCarNodeProps {
  service: JourneyStep;
  position: number;
  isLast: boolean;
  direction: 'left' | 'right';
}

function RaceCarNode({ service, position, isLast, direction }: RaceCarNodeProps) {
  const Icon = service.icon;
  
  return (
    <div className={cn(
      "relative flex items-center gap-4 group",
      direction === 'left' ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Track line connecting to next */}
      {!isLast && (
        <div className={cn(
          "absolute top-full left-1/2 w-0.5 h-4 md:h-6 -translate-x-1/2",
          "bg-gradient-to-b from-foreground/20 to-foreground/5"
        )} />
      )}
      
      {/* Position Number */}
      <div className={cn(
        "hidden md:flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-lg shrink-0 transition-all duration-300",
        "bg-background border-foreground/20 text-muted-foreground",
        "group-hover:border-primary group-hover:text-primary group-hover:scale-110"
      )}>
        {position}
      </div>
      
      {/* Race Car Card */}
      <Link 
        to={service.link}
        className={cn(
          "flex-1 relative overflow-hidden rounded-2xl border transition-all duration-300",
          "bg-card hover:bg-card/80 border-border hover:border-primary/50",
          "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
          "group/card"
        )}
      >
        {/* Speed lines effect */}
        <div className={cn(
          "absolute inset-y-0 w-32 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500",
          direction === 'left' ? "right-0 bg-gradient-to-l" : "left-0 bg-gradient-to-r",
          "from-transparent via-primary/5 to-transparent"
        )} />
        
        <div className={cn(
          "relative flex items-center gap-4 p-4 md:p-5",
          direction === 'left' ? "flex-row-reverse" : "flex-row"
        )}>
          {/* Car Icon */}
          <div className="relative shrink-0">
            {/* Glow */}
            <div 
              className="absolute -inset-2 rounded-full blur-xl opacity-0 group-hover/card:opacity-50 transition-opacity duration-300"
              style={{ backgroundColor: service.carColor }}
            />
            
            {/* Car body */}
            <div 
              className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover/card:scale-110"
              style={{ backgroundColor: service.carColor }}
            >
              <Icon className="h-7 w-7 md:h-8 md:w-8 text-white" />
              
              {/* Racing number */}
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background shadow-md flex items-center justify-center text-xs font-bold border border-border">
                {position}
              </div>
              
              {/* Winner crown for last position */}
              {isLast && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Trophy className="h-5 w-5 text-yellow-500 drop-shadow-lg" />
                </div>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className={cn(
            "flex-1 min-w-0",
            direction === 'left' ? "text-right" : "text-left"
          )}>
            <h4 className={cn("font-bold text-base md:text-lg", service.color)}>
              {service.name}
            </h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {service.objective}
            </p>
          </div>
          
          {/* Arrow */}
          <div className={cn(
            "shrink-0 p-2 rounded-full transition-all duration-300",
            "bg-primary/10 text-primary",
            "group-hover/card:bg-primary group-hover/card:text-primary-foreground",
            direction === 'left' && "rotate-180"
          )}>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div 
          className="h-1 w-full opacity-60 group-hover/card:opacity-100 transition-opacity"
          style={{ backgroundColor: service.carColor }}
        />
      </Link>
    </div>
  );
}
