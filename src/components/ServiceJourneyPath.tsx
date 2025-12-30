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
import { useState } from "react";

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
  const [hoveredCar, setHoveredCar] = useState<number | null>(null);

  // F1 style circuit path
  const trackPath = `
    M 50 12
    L 80 12
    Q 92 12, 92 24
    L 92 40
    Q 92 50, 82 55
    L 60 65
    Q 45 72, 35 82
    L 20 98
    Q 10 108, 8 100
    L 8 88
    Q 8 78, 18 70
    L 25 62
    Q 30 55, 25 48
    L 18 38
    Q 12 30, 20 22
    L 35 18
    Q 45 15, 50 12
  `;

  // Car positions along the track path - rotation follows the track direction
  const carPositions = [
    { x: 55, y: 12, rotation: 0 },      // 1 - Reta inicial, indo para direita
    { x: 75, y: 12, rotation: 0 },      // 2 - Reta inicial
    { x: 90, y: 18, rotation: 70 },     // 3 - Curva 1, descendo
    { x: 92, y: 34, rotation: 90 },     // 4 - Descendo reto
    { x: 88, y: 48, rotation: 140 },    // 5 - Curva 2, virando para esquerda
    { x: 72, y: 60, rotation: 160 },    // 6 - Indo para esquerda e descendo
    { x: 52, y: 70, rotation: 200 },    // 7 - Curva S
    { x: 38, y: 80, rotation: 220 },    // 8 - Descendo diagonal
    { x: 22, y: 96, rotation: 240 },    // 9 - Curva fechada
    { x: 10, y: 100, rotation: 270 },   // 10 - Virando para cima
    { x: 8, y: 88, rotation: -90 },     // 11 - Subindo
    { x: 12, y: 74, rotation: -60 },    // 12 - Curva S subindo
    { x: 22, y: 62, rotation: -45 },    // 13 - Diagonal subindo
    { x: 26, y: 50, rotation: -90 },    // 14 - Subindo
    { x: 20, y: 38, rotation: -120 },   // 15 - Curva
    { x: 24, y: 24, rotation: -30 },    // 16 - Saindo da curva
    { x: 42, y: 16, rotation: 0 },      // 17 - Voltando para reta de largada
  ];

  return (
    <section className="section-padding bg-gradient-to-b from-background via-secondary/5 to-background overflow-hidden">
      <div className="container-premium">
        {/* Header */}
        <div className="text-center mb-6 md:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Flag className="h-4 w-4" />
            Grande Prêmio do Crescimento
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Circuito UNV
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            17 etapas para cruzar a linha de chegada. Passe o mouse sobre os carros para conhecer cada serviço.
          </p>
        </div>

        {/* Racing Track - Desktop */}
        <div className="hidden lg:block relative w-full" style={{ height: '850px' }}>
          <svg 
            className="w-full h-full" 
            viewBox="0 0 100 115"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Track asphalt gradient */}
              <linearGradient id="asphaltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#52525b" />
                <stop offset="50%" stopColor="#3f3f46" />
                <stop offset="100%" stopColor="#27272a" />
              </linearGradient>
              
              {/* Red curb gradient */}
              <linearGradient id="curbRed" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>

              {/* Glow filter for cars */}
              <filter id="carGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Shadow filter */}
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Background grass texture */}
            <rect x="0" y="0" width="100" height="115" fill="#166534" opacity="0.1" />

            {/* Track outer edge (red curb) */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#curbRed)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* White edge */}
            <path
              d={trackPath}
              fill="none"
              stroke="white"
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />

            {/* Track surface (asphalt) */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#asphaltGradient)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Center dashed line */}
            <path
              d={trackPath}
              fill="none"
              stroke="white"
              strokeWidth="0.2"
              strokeLinecap="round"
              strokeDasharray="1.5 1.5"
              opacity="0.6"
            />

            {/* Start/Finish line checkered pattern */}
            <g transform="translate(49, 9)">
              {[0,1,2,3,4,5].map(i => (
                <g key={i}>
                  <rect x={i * 0.8} y="0" width="0.8" height="0.8" fill={i % 2 === 0 ? "white" : "#1a1a1a"} />
                  <rect x={i * 0.8} y="0.8" width="0.8" height="0.8" fill={i % 2 === 1 ? "white" : "#1a1a1a"} />
                  <rect x={i * 0.8} y="1.6" width="0.8" height="0.8" fill={i % 2 === 0 ? "white" : "#1a1a1a"} />
                  <rect x={i * 0.8} y="2.4" width="0.8" height="0.8" fill={i % 2 === 1 ? "white" : "#1a1a1a"} />
                  <rect x={i * 0.8} y="3.2" width="0.8" height="0.8" fill={i % 2 === 0 ? "white" : "#1a1a1a"} />
                  <rect x={i * 0.8} y="4" width="0.8" height="0.8" fill={i % 2 === 1 ? "white" : "#1a1a1a"} />
                </g>
              ))}
            </g>

            {/* F1 Cars on track */}
            {allServices.map((service, index) => {
              const pos = carPositions[index];
              const isHovered = hoveredCar === index;
              
              return (
                <g 
                  key={service.id} 
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredCar(index)}
                  onMouseLeave={() => setHoveredCar(null)}
                >
                  {/* Hover glow effect */}
                  {isHovered && (
                    <circle cx="0" cy="0" r="5" fill={service.carColor} opacity="0.4" filter="url(#carGlow)" />
                  )}
                  
                  {/* Car shadow */}
                  <ellipse cx="0.3" cy="0.5" rx="3" ry="1" fill="black" opacity="0.3" />
                  
                  {/* Car body */}
                  <g transform={`rotate(${pos.rotation}) scale(${isHovered ? 1.3 : 1})`} style={{ transition: 'transform 0.2s' }}>
                    {/* Main chassis */}
                    <path 
                      d="M -3.5 0 L -2.5 -1.2 L 2.5 -1.2 L 3.5 -0.4 L 3.5 0.4 L 2.5 1.2 L -2.5 1.2 L -3.5 0 Z" 
                      fill={service.carColor}
                      filter="url(#shadow)"
                    />
                    {/* Cockpit */}
                    <ellipse cx="-0.2" cy="0" rx="1.2" ry="0.7" fill="#0a0a0a" />
                    {/* Driver helmet */}
                    <circle cx="-0.2" cy="0" r="0.45" fill="white" />
                    <circle cx="-0.2" cy="-0.1" r="0.25" fill={service.carColor} />
                    {/* Front wing */}
                    <rect x="3" y="-1.5" width="0.6" height="3" rx="0.1" fill={service.carColor} />
                    {/* Rear wing */}
                    <rect x="-4.2" y="-1.3" width="0.7" height="2.6" rx="0.1" fill={service.carColor} />
                    <rect x="-4.5" y="-1" width="0.4" height="2" fill="#1a1a1a" />
                    {/* Wheels */}
                    <ellipse cx="2.2" cy="-1.5" rx="0.7" ry="0.4" fill="#1a1a1a" />
                    <ellipse cx="2.2" cy="1.5" rx="0.7" ry="0.4" fill="#1a1a1a" />
                    <ellipse cx="-2" cy="-1.6" rx="0.8" ry="0.45" fill="#1a1a1a" />
                    <ellipse cx="-2" cy="1.6" rx="0.8" ry="0.45" fill="#1a1a1a" />
                    {/* Number on car */}
                    <circle cx="1" cy="0" r="0.8" fill="white" />
                    <text x="1" y="0.3" textAnchor="middle" fontSize="0.9" fill={service.carColor} fontWeight="bold">{index + 1}</text>
                  </g>
                </g>
              );
            })}

            {/* Track labels */}
            <text x="50" y="6" textAnchor="middle" fontSize="2.5" fill="currentColor" className="text-foreground" fontWeight="bold" letterSpacing="0.3">CIRCUITO UNV</text>
            <text x="50" y="8.5" textAnchor="middle" fontSize="1.2" fill="currentColor" className="text-muted-foreground">17 SERVIÇOS • SUA JORNADA DE CRESCIMENTO</text>
          </svg>

          {/* Floating tooltip */}
          {hoveredCar !== null && (
            <div 
              className="absolute z-50 pointer-events-none animate-fade-in"
              style={{
                left: `${carPositions[hoveredCar].x}%`,
                top: `${(carPositions[hoveredCar].y / 115) * 100}%`,
                transform: 'translate(-50%, -120%)'
              }}
            >
              <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-2xl min-w-[220px]">
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: allServices[hoveredCar].carColor }}
                  >
                    {(() => {
                      const IconComponent = allServices[hoveredCar].icon;
                      return <IconComponent className="h-5 w-5 text-white" />;
                    })()}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Posição {hoveredCar + 1}</div>
                    <h4 className="font-bold text-foreground">{allServices[hoveredCar].name}</h4>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{allServices[hoveredCar].objective}</p>
                <Link 
                  to={allServices[hoveredCar].link}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg text-sm font-medium text-white transition-colors pointer-events-auto"
                  style={{ backgroundColor: allServices[hoveredCar].carColor }}
                >
                  Ver detalhes
                  <Trophy className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Start/Finish labels */}
          <div className="absolute left-[52%] top-[4%] flex items-center gap-2 bg-green-500 text-white rounded-full px-4 py-1.5 shadow-lg">
            <Flag className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Largada</span>
          </div>
        </div>

        {/* Car legend - Desktop */}
        <div className="hidden lg:block mt-8">
          <div className="grid grid-cols-6 gap-3 max-w-4xl mx-auto">
            {allServices.map((service, index) => (
              <Link 
                key={service.id}
                to={service.link}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: service.carColor }}
                >
                  {index + 1}
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">{service.shortName}</span>
              </Link>
            ))}
          </div>
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
      className="block relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 group"
    >
      <div className="relative flex items-center gap-4 p-4">
        {/* Car number */}
        <div 
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform"
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
        <div className="shrink-0 p-2 rounded-full bg-secondary group-hover:bg-primary/10 transition-colors">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
      </div>
      
      {/* Bottom accent */}
      <div 
        className="h-1 w-full opacity-50 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: service.carColor }}
      />
      
      {isLast && (
        <div className="absolute top-3 right-3">
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>
      )}
    </Link>
  );
}
