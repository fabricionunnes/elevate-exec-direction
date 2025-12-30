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
  link: string;
  carColor: string;
}

const allServices: JourneyStep[] = [
  { id: "core", name: "UNV Core", shortName: "Core", objective: "Estruturar sua operação comercial do zero", icon: Target, link: "/core", carColor: "#ef4444" },
  { id: "control", name: "UNV Control", shortName: "Control", objective: "Direção comercial contínua e previsibilidade", icon: Compass, link: "/control", carColor: "#3b82f6" },
  { id: "sales-acceleration", name: "UNV Sales Acceleration", shortName: "Acceleration", objective: "Acelerar resultados com acompanhamento", icon: TrendingUp, link: "/sales-acceleration", carColor: "#22c55e" },
  { id: "sales-ops", name: "UNV Sales Ops", shortName: "Sales Ops", objective: "Treinar e capacitar seu time comercial", icon: Users, link: "/sales-ops", carColor: "#f97316" },
  { id: "ads", name: "UNV Ads", shortName: "Ads", objective: "Escalar geração de leads qualificados", icon: Megaphone, link: "/ads", carColor: "#a855f7" },
  { id: "social", name: "UNV Social", shortName: "Social", objective: "Gestão profissional das redes sociais", icon: Share2, link: "/social", carColor: "#ec4899" },
  { id: "ai-sales-system", name: "UNV Sales System", shortName: "Sales System", objective: "Automatizar vendas com IA", icon: Bot, link: "/ai-sales-system", carColor: "#06b6d4" },
  { id: "fractional-cro", name: "UNV Fractional CRO", shortName: "Fractional CRO", objective: "Diretor comercial terceirizado", icon: UserCheck, link: "/fractional-cro", carColor: "#6366f1" },
  { id: "growth-room", name: "UNV Growth Room", shortName: "Growth Room", objective: "Imersões intensivas para destravar", icon: Building2, link: "/growth-room", carColor: "#f59e0b" },
  { id: "partners", name: "UNV Partners", shortName: "Partners", objective: "Grupo estratégico de parceiros UNV", icon: Handshake, link: "/partners", carColor: "#10b981" },
  { id: "execution-partnership", name: "UNV Execution", shortName: "Execution", objective: "Implementação comercial direta", icon: Handshake, link: "/execution-partnership", carColor: "#dc2626" },
  { id: "mastermind", name: "UNV Mastermind", shortName: "Mastermind", objective: "Grupo exclusivo de empresários de elite", icon: Crown, link: "/mastermind", carColor: "#eab308" },
  { id: "le-desir", name: "UNV Le Désir", shortName: "Le Désir", objective: "Posicionamento premium para sua marca", icon: Sparkles, link: "/le-desir", carColor: "#f43f5e" },
  { id: "people", name: "UNV People", shortName: "People", objective: "Gestão de pessoas e cultura", icon: Users, link: "/people", carColor: "#2563eb" },
  { id: "finance", name: "UNV Finance", shortName: "Finance", objective: "Controle financeiro estratégico", icon: DollarSign, link: "/finance", carColor: "#16a34a" },
  { id: "safe", name: "UNV Safe", shortName: "Safe", objective: "Assessoria jurídica preventiva", icon: Shield, link: "/safe", carColor: "#64748b" },
  { id: "leadership", name: "UNV Leadership", shortName: "Leadership", objective: "Desenvolvimento de líderes", icon: UserCheck, link: "/leadership", carColor: "#8b5cf6" }
];

// F1 Car SVG Component
function F1Car({ color, number, rotation = 0 }: { color: string; number: number; rotation?: number }) {
  return (
    <svg 
      viewBox="0 0 60 24" 
      className="w-12 h-5 md:w-16 md:h-6 drop-shadow-lg"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Car body */}
      <ellipse cx="30" cy="12" rx="28" ry="8" fill={color} />
      {/* Cockpit */}
      <ellipse cx="24" cy="12" rx="8" ry="5" fill="#1a1a1a" />
      {/* Driver helmet */}
      <circle cx="24" cy="11" r="3" fill="#ffffff" />
      {/* Front wing */}
      <rect x="54" y="4" width="4" height="16" rx="1" fill={color} />
      {/* Rear wing */}
      <rect x="0" y="2" width="3" height="20" rx="1" fill={color} />
      <rect x="-2" y="6" width="6" height="12" rx="1" fill="#1a1a1a" />
      {/* Front wheels */}
      <ellipse cx="48" cy="4" rx="4" ry="3" fill="#1a1a1a" />
      <ellipse cx="48" cy="20" rx="4" ry="3" fill="#1a1a1a" />
      {/* Rear wheels */}
      <ellipse cx="10" cy="3" rx="5" ry="3" fill="#1a1a1a" />
      <ellipse cx="10" cy="21" rx="5" ry="3" fill="#1a1a1a" />
      {/* Number */}
      <text x="34" y="15" fontSize="8" fill="white" fontWeight="bold">{number}</text>
    </svg>
  );
}

// Checkered flag pattern
function CheckeredFlag() {
  return (
    <div className="flex">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex flex-col">
          <div className={cn("w-3 h-3", i % 2 === 0 ? "bg-foreground" : "bg-background border border-foreground/20")} />
          <div className={cn("w-3 h-3", i % 2 === 1 ? "bg-foreground" : "bg-background border border-foreground/20")} />
        </div>
      ))}
    </div>
  );
}

export function ServiceJourneyPath() {
  // Track path for the racing circuit - one continuous winding path
  const trackPath = `
    M 50 30
    L 85 30
    Q 95 30 95 45
    L 95 80
    Q 95 95 80 95
    L 20 95
    Q 5 95 5 110
    L 5 145
    Q 5 160 20 160
    L 80 160
    Q 95 160 95 175
    L 95 210
    Q 95 225 80 225
    L 20 225
    Q 5 225 5 240
    L 5 275
    Q 5 290 20 290
    L 80 290
    Q 95 290 95 305
    L 95 340
    Q 95 355 80 355
    L 50 355
  `;

  // Positions along the track for each car (percentage along path)
  const carPositions = [
    { x: 15, y: 5, rotation: 0 },    // 1
    { x: 45, y: 5, rotation: 0 },    // 2
    { x: 75, y: 5, rotation: 0 },    // 3
    { x: 92, y: 12, rotation: 90 },  // 4
    { x: 92, y: 22, rotation: 90 },  // 5
    { x: 75, y: 30, rotation: 180 }, // 6
    { x: 45, y: 30, rotation: 180 }, // 7
    { x: 15, y: 30, rotation: 180 }, // 8
    { x: 8, y: 38, rotation: 90 },   // 9
    { x: 8, y: 48, rotation: 90 },   // 10
    { x: 25, y: 55, rotation: 0 },   // 11
    { x: 55, y: 55, rotation: 0 },   // 12
    { x: 85, y: 55, rotation: 0 },   // 13
    { x: 92, y: 65, rotation: 90 },  // 14
    { x: 75, y: 75, rotation: 180 }, // 15
    { x: 45, y: 75, rotation: 180 }, // 16
    { x: 25, y: 85, rotation: 180 }, // 17 - Finish
  ];

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

        {/* Racing Track - Desktop */}
        <div className="hidden lg:block relative" style={{ height: '1600px' }}>
          <svg 
            className="absolute inset-0 w-full h-full" 
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Track gradient */}
              <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#374151" />
                <stop offset="100%" stopColor="#1f2937" />
              </linearGradient>
              
              {/* Glow effect */}
              <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Racing stripes pattern */}
              <pattern id="racingStripes" patternUnits="userSpaceOnUse" width="2" height="2">
                <rect width="1" height="2" fill="#ef4444" opacity="0.3" />
              </pattern>
            </defs>

            {/* Track outer edge */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
            />

            {/* Track surface */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#trackGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#trackGlow)"
            />

            {/* Track center line (dashed) */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="2 2"
              opacity="0.5"
            />

            {/* Track inner edge */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="0.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
            />

            {/* Start line */}
            <line x1="48" y1="28" x2="48" y2="32" stroke="white" strokeWidth="0.5" />
            <line x1="49" y1="28" x2="49" y2="32" stroke="black" strokeWidth="0.5" />
            <line x1="50" y1="28" x2="50" y2="32" stroke="white" strokeWidth="0.5" />
            <line x1="51" y1="28" x2="51" y2="32" stroke="black" strokeWidth="0.5" />
            <line x1="52" y1="28" x2="52" y2="32" stroke="white" strokeWidth="0.5" />
          </svg>

          {/* Start/Finish markers */}
          <div className="absolute left-[8%] top-[2%] flex items-center gap-2">
            <Flag className="h-6 w-6 text-green-500" />
            <span className="text-sm font-bold text-green-500 uppercase">Largada</span>
          </div>

          {/* F1 Cars positioned on track */}
          {allServices.map((service, index) => (
            <CarOnTrack
              key={service.id}
              service={service}
              position={carPositions[index]}
              number={index + 1}
              isLast={index === allServices.length - 1}
            />
          ))}

          {/* Finish line marker */}
          <div className="absolute left-[20%] bottom-[8%] flex items-center gap-3">
            <CheckeredFlag />
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <span className="text-sm font-bold text-yellow-500 uppercase">Chegada</span>
            </div>
          </div>
        </div>

        {/* Mobile version - vertical list with car styling */}
        <div className="lg:hidden space-y-3">
          {/* Start */}
          <div className="flex items-center justify-center gap-3 py-4">
            <Flag className="h-5 w-5 text-green-500" />
            <span className="font-bold text-green-500 uppercase text-sm">Largada</span>
          </div>

          {allServices.map((service, index) => (
            <MobileCarCard
              key={service.id}
              service={service}
              number={index + 1}
              isLast={index === allServices.length - 1}
            />
          ))}

          {/* Finish */}
          <div className="flex items-center justify-center gap-3 py-4">
            <CheckeredFlag />
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="font-bold text-yellow-500 uppercase text-sm">Chegada</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Clique em qualquer carro para conhecer o serviço
          </p>
        </div>
      </div>
    </section>
  );
}

interface CarOnTrackProps {
  service: JourneyStep;
  position: { x: number; y: number; rotation: number };
  number: number;
  isLast: boolean;
}

function CarOnTrack({ service, position, number, isLast }: CarOnTrackProps) {
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
      {/* Hover glow */}
      <div 
        className="absolute -inset-4 rounded-full blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-300"
        style={{ backgroundColor: service.carColor }}
      />
      
      {/* F1 Car */}
      <div className="relative transition-transform duration-300 group-hover:scale-125">
        <F1Car color={service.carColor} number={number} rotation={position.rotation} />
        
        {/* Trophy for last */}
        {isLast && (
          <Trophy className="absolute -top-4 left-1/2 -translate-x-1/2 h-5 w-5 text-yellow-500 animate-bounce" />
        )}
      </div>
      
      {/* Info tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
        <div className="bg-card border border-border rounded-xl p-4 shadow-2xl min-w-[200px] text-center backdrop-blur-sm">
          <div 
            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ backgroundColor: service.carColor }}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h4 className="font-bold text-sm text-foreground">{service.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">{service.objective}</p>
          <div className="mt-2 text-xs text-primary font-medium">Clique para ver mais →</div>
        </div>
      </div>
    </Link>
  );
}

interface MobileCarCardProps {
  service: JourneyStep;
  number: number;
  isLast: boolean;
}

function MobileCarCard({ service, number, isLast }: MobileCarCardProps) {
  const Icon = service.icon;
  
  return (
    <Link
      to={service.link}
      className="block relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 group"
    >
      {/* Track texture */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative flex items-center gap-4 p-4">
        {/* Car */}
        <div className="relative shrink-0">
          <F1Car color={service.carColor} number={number} />
          {isLast && (
            <Trophy className="absolute -top-3 left-1/2 -translate-x-1/2 h-4 w-4 text-yellow-500" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground">{service.name}</h4>
          <p className="text-sm text-muted-foreground line-clamp-1">{service.objective}</p>
        </div>
        
        {/* Icon */}
        <div 
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: service.carColor }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      
      {/* Bottom accent */}
      <div 
        className="h-1 w-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: service.carColor }}
      />
    </Link>
  );
}
