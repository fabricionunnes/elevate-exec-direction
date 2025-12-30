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

// Checkered flag pattern
function CheckeredFlag() {
  return (
    <div className="flex">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col">
          <div className={cn("w-2 h-2", i % 2 === 0 ? "bg-foreground" : "bg-background border border-foreground/20")} />
          <div className={cn("w-2 h-2", i % 2 === 1 ? "bg-foreground" : "bg-background border border-foreground/20")} />
        </div>
      ))}
    </div>
  );
}

export function ServiceJourneyPath() {
  // F1 style circuit path - inspired by real tracks with curves and chicanes
  const trackPath = `
    M 50 15
    L 75 15
    Q 85 15, 88 22
    L 92 35
    Q 95 42, 92 48
    L 85 58
    Q 80 65, 72 68
    L 55 72
    Q 45 74, 38 80
    L 25 95
    Q 18 102, 12 100
    L 8 95
    Q 5 90, 8 85
    L 18 70
    Q 22 64, 20 58
    L 15 48
    Q 12 42, 15 36
    L 22 28
    Q 28 22, 38 22
    L 50 25
    Q 55 26, 55 22
    L 52 18
    Q 50 15, 50 15
  `;

  // Car positions along the track path (x, y coordinates matching the path, rotation angle)
  const carPositions = [
    { x: 50, y: 15, rotation: 0 },      // 1 - Start/Finish straight
    { x: 68, y: 15, rotation: 0 },      // 2
    { x: 85, y: 18, rotation: 45 },     // 3 - First curve
    { x: 91, y: 32, rotation: 80 },     // 4
    { x: 92, y: 45, rotation: 120 },    // 5 - Hairpin
    { x: 86, y: 56, rotation: 150 },    // 6
    { x: 75, y: 66, rotation: 170 },    // 7
    { x: 58, y: 71, rotation: 190 },    // 8
    { x: 42, y: 78, rotation: 220 },    // 9 - Chicane
    { x: 28, y: 92, rotation: 240 },    // 10
    { x: 14, y: 98, rotation: 200 },    // 11 - Tight corner
    { x: 10, y: 88, rotation: -70 },    // 12
    { x: 16, y: 72, rotation: -50 },    // 13
    { x: 18, y: 58, rotation: -100 },   // 14 - S curves
    { x: 16, y: 45, rotation: -60 },    // 15
    { x: 20, y: 32, rotation: -30 },    // 16
    { x: 35, y: 23, rotation: 0 },      // 17 - Back to start
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
            Circuito UNV
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            17 etapas para cruzar a linha de chegada. Cada serviço te aproxima do pódio.
          </p>
        </div>

        {/* Racing Track - Desktop */}
        <div className="hidden lg:block relative mx-auto w-full" style={{ height: '900px' }}>
          <svg 
            className="w-full h-full" 
            viewBox="0 0 100 115"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Track asphalt gradient */}
              <linearGradient id="asphaltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3f3f46" />
                <stop offset="100%" stopColor="#27272a" />
              </linearGradient>
              
              {/* Track border (curb) pattern */}
              <pattern id="curbPattern" patternUnits="userSpaceOnUse" width="4" height="4">
                <rect width="2" height="4" fill="#ef4444" />
                <rect x="2" width="2" height="4" fill="#ffffff" />
              </pattern>

              {/* Glow filter */}
              <filter id="carGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Track outer curb (red/white) */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#curbPattern)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Track surface (asphalt) */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#asphaltGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Track white edge markings */}
            <path
              d={trackPath}
              fill="none"
              stroke="white"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.15"
            />

            {/* Center dashed line */}
            <path
              d={trackPath}
              fill="none"
              stroke="white"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="2 2"
              opacity="0.5"
            />

            {/* Start/Finish line */}
            <line x1="50" y1="12" x2="50" y2="18" stroke="white" strokeWidth="0.8" />
            <g transform="translate(48, 12)">
              {[0,1,2,3].map(i => (
                <g key={i}>
                  <rect x={i * 1} y="0" width="1" height="1" fill={i % 2 === 0 ? "white" : "black"} />
                  <rect x={i * 1} y="1" width="1" height="1" fill={i % 2 === 1 ? "white" : "black"} />
                  <rect x={i * 1} y="2" width="1" height="1" fill={i % 2 === 0 ? "white" : "black"} />
                </g>
              ))}
            </g>

            {/* F1 Cars on track */}
            {allServices.map((service, index) => {
              const pos = carPositions[index];
              return (
                <g key={service.id} transform={`translate(${pos.x}, ${pos.y})`} className="cursor-pointer">
                  {/* Car shadow */}
                  <ellipse cx="0" cy="0.8" rx="2.5" ry="0.8" fill="black" opacity="0.4" />
                  
                  {/* Car body */}
                  <g transform={`rotate(${pos.rotation})`}>
                    {/* Main chassis */}
                    <path 
                      d="M -3 0 L -2 -1 L 2 -1 L 3 -0.3 L 3 0.3 L 2 1 L -2 1 L -3 0 Z" 
                      fill={service.carColor}
                    />
                    {/* Cockpit */}
                    <ellipse cx="0" cy="0" rx="1" ry="0.6" fill="#1a1a1a" />
                    {/* Driver helmet */}
                    <circle cx="0" cy="0" r="0.4" fill="white" />
                    {/* Front wing */}
                    <rect x="2.5" y="-1.2" width="0.5" height="2.4" fill={service.carColor} />
                    {/* Rear wing */}
                    <rect x="-3.5" y="-1" width="0.5" height="2" fill={service.carColor} />
                    {/* Wheels */}
                    <ellipse cx="2" cy="-1.3" rx="0.6" ry="0.35" fill="#1a1a1a" />
                    <ellipse cx="2" cy="1.3" rx="0.6" ry="0.35" fill="#1a1a1a" />
                    <ellipse cx="-1.5" cy="-1.4" rx="0.7" ry="0.4" fill="#1a1a1a" />
                    <ellipse cx="-1.5" cy="1.4" rx="0.7" ry="0.4" fill="#1a1a1a" />
                  </g>
                  
                  {/* Car number */}
                  <circle cx="0" cy="-3" r="1.5" fill="white" stroke={service.carColor} strokeWidth="0.3" />
                  <text y="-2.5" textAnchor="middle" fontSize="1.8" fill={service.carColor} fontWeight="bold">{index + 1}</text>
                </g>
              );
            })}

            {/* Track name */}
            <text x="50" y="8" textAnchor="middle" fontSize="3" fill="currentColor" className="text-muted-foreground" fontWeight="bold">CIRCUITO UNV</text>
          </svg>

          {/* Start marker */}
          <div className="absolute left-[48%] top-[8%] flex items-center gap-2 bg-green-500/20 border border-green-500/50 rounded-full px-3 py-1">
            <Flag className="h-3 w-3 text-green-500" />
            <span className="text-xs font-bold text-green-500 uppercase">Largada</span>
          </div>

          {/* Clickable overlay for each car */}
          {allServices.map((service, index) => {
            const pos = carPositions[index];
            // Convert SVG coordinates to percentage
            const leftPercent = (pos.x / 100) * 100;
            const topPercent = (pos.y / 115) * 100;
            
            return (
              <Link
                key={service.id}
                to={service.link}
                className="absolute group z-10"
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="w-10 h-10 rounded-full hover:bg-white/10 transition-colors" />
                
                {/* Tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none">
                  <div className="bg-card border border-border rounded-xl p-3 shadow-2xl min-w-[180px] text-center backdrop-blur-sm">
                    <div 
                      className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                      style={{ backgroundColor: service.carColor }}
                    >
                      <service.icon className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="font-bold text-sm text-foreground">{service.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{service.objective}</p>
                    <div className="mt-2 text-xs text-primary font-medium">Clique para ver mais →</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Legend - Desktop */}
        <div className="hidden lg:flex justify-center gap-4 mt-6 flex-wrap">
          {allServices.slice(0, 6).map((service, index) => (
            <Link 
              key={service.id}
              to={service.link}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: service.carColor }}
              />
              <span>{index + 1}. {service.shortName}</span>
            </Link>
          ))}
        </div>

        {/* Mobile version */}
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

        {/* Instructions */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Clique em qualquer carro para conhecer o serviço
          </p>
        </div>
      </div>
    </section>
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
      <div className="relative flex items-center gap-4 p-4">
        {/* Car number */}
        <div 
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: service.carColor }}
        >
          {number}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground">{service.name}</h4>
          <p className="text-sm text-muted-foreground line-clamp-1">{service.objective}</p>
        </div>
        
        {/* Icon */}
        <div className="shrink-0 p-2 rounded-full bg-secondary">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
      </div>
      
      {/* Bottom accent */}
      <div 
        className="h-1 w-full opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: service.carColor }}
      />
      
      {isLast && (
        <div className="absolute top-2 right-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
        </div>
      )}
    </Link>
  );
}
