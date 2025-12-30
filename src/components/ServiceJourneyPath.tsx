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
  UserCheck
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
  category: "main" | "operation" | "advanced" | "structure" | "other";
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
    category: "main"
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
    category: "main"
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
    category: "main"
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
    category: "operation"
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
    category: "operation"
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
    category: "operation"
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
    category: "operation"
  },
  {
    id: "fractional-cro",
    name: "UNV Fractional CRO",
    shortName: "Fractional CRO",
    objective: "Diretor comercial terceirizado para sua empresa",
    icon: UserCheck,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500",
    link: "/fractional-cro",
    category: "operation"
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
    category: "advanced"
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
    category: "advanced"
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
    category: "advanced"
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
    category: "advanced"
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
    category: "structure"
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
    category: "structure"
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
    category: "structure"
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
    category: "structure"
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
    category: "other"
  }
];

const categoryInfo = {
  main: { 
    label: "Trilha Principal", 
    description: "Fundação comercial",
    color: "from-red-500 via-blue-500 to-green-500"
  },
  operation: { 
    label: "Operação Comercial", 
    description: "Execução e escala",
    color: "from-orange-500 via-purple-500 to-cyan-500"
  },
  advanced: { 
    label: "Trilha Avançada", 
    description: "Alto impacto",
    color: "from-amber-500 via-emerald-500 to-yellow-500"
  },
  structure: { 
    label: "Estratégia & Estrutura", 
    description: "Base sólida",
    color: "from-rose-500 via-blue-600 to-slate-500"
  },
  other: { 
    label: "Desenvolvimento", 
    description: "Liderança",
    color: "from-violet-500 to-violet-600"
  }
};

export function ServiceJourneyPath() {
  const mainTrail = allServices.filter(s => s.category === "main");
  const operationTrail = allServices.filter(s => s.category === "operation");
  const advancedTrail = allServices.filter(s => s.category === "advanced");
  const structureTrail = allServices.filter(s => s.category === "structure");
  const otherTrail = allServices.filter(s => s.category === "other");

  return (
    <section className="section-padding bg-gradient-to-b from-background via-secondary/30 to-background overflow-hidden">
      <div className="container-premium">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            A Trilha do Crescimento Comercial
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Cada empresa tem uma jornada única. Veja todos os serviços organizados por fase de crescimento.
          </p>
        </div>

        {/* Main Journey Path */}
        <div className="space-y-12">
          {/* Trilha Principal */}
          <TrailSection 
            title={categoryInfo.main.label}
            description={categoryInfo.main.description}
            services={mainTrail}
            gradientColor={categoryInfo.main.color}
            isMainTrail
          />

          {/* Operação Comercial */}
          <TrailSection 
            title={categoryInfo.operation.label}
            description={categoryInfo.operation.description}
            services={operationTrail}
            gradientColor={categoryInfo.operation.color}
          />

          {/* Trilha Avançada */}
          <TrailSection 
            title={categoryInfo.advanced.label}
            description={categoryInfo.advanced.description}
            services={advancedTrail}
            gradientColor={categoryInfo.advanced.color}
          />

          {/* Estratégia & Estrutura */}
          <TrailSection 
            title={categoryInfo.structure.label}
            description={categoryInfo.structure.description}
            services={structureTrail}
            gradientColor={categoryInfo.structure.color}
          />

          {/* Outros */}
          <TrailSection 
            title={categoryInfo.other.label}
            description={categoryInfo.other.description}
            services={otherTrail}
            gradientColor={categoryInfo.other.color}
          />
        </div>
      </div>
    </section>
  );
}

interface TrailSectionProps {
  title: string;
  description: string;
  services: JourneyStep[];
  gradientColor: string;
  isMainTrail?: boolean;
}

function TrailSection({ title, description, services, gradientColor, isMainTrail }: TrailSectionProps) {
  return (
    <div className="relative">
      {/* Section Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className={cn(
          "h-1 w-12 rounded-full bg-gradient-to-r",
          gradientColor
        )} />
        <div>
          <h3 className={cn(
            "font-bold text-foreground",
            isMainTrail ? "text-xl" : "text-lg"
          )}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Trail Container */}
      <div className="relative">
        {/* Connecting line */}
        <div className={cn(
          "absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r opacity-30",
          gradientColor
        )} />
        
        {/* Services */}
        <div className={cn(
          "relative grid gap-4",
          services.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : 
          services.length <= 4 ? "grid-cols-2 md:grid-cols-4" :
          "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        )}>
          {services.map((service, index) => (
            <ServiceNode 
              key={service.id} 
              service={service} 
              index={index}
              isMainTrail={isMainTrail}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ServiceNodeProps {
  service: JourneyStep;
  index: number;
  isMainTrail?: boolean;
}

function ServiceNode({ service, index, isMainTrail }: ServiceNodeProps) {
  const Icon = service.icon;
  
  return (
    <Link 
      to={service.link}
      className="group relative"
    >
      <div className={cn(
        "relative bg-card border border-border rounded-2xl p-4 transition-all duration-300",
        "hover:border-primary/50 hover:shadow-lg hover:-translate-y-1",
        isMainTrail && "p-6"
      )}>
        {/* Step number */}
        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors">
          {index + 1}
        </div>

        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110",
          service.bgColor
        )}>
          <Icon className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <h4 className={cn(
          "font-bold text-foreground mb-1",
          isMainTrail ? "text-base" : "text-sm"
        )}>
          {service.shortName}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {service.objective}
        </p>

        {/* Arrow indicator */}
        <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Ver detalhes <ArrowRight className="h-3 w-3" />
        </div>

        {/* Connector arrow for main trail */}
        {isMainTrail && index < 2 && (
          <div className="hidden sm:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
            <ArrowRight className={cn("h-5 w-5", service.color)} />
          </div>
        )}
      </div>
    </Link>
  );
}
