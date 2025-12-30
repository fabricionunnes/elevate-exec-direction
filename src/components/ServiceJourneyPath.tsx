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
  { id: "core", name: "UNV Core", shortName: "Core", objective: "Estruturar sua operação comercial do zero", icon: Target, link: "/core", carColor: "#dc2626" },
  { id: "control", name: "UNV Control", shortName: "Control", objective: "Direção comercial contínua e previsibilidade", icon: Compass, link: "/control", carColor: "#2563eb" },
  { id: "sales-acceleration", name: "UNV Sales Acceleration", shortName: "Acceleration", objective: "Acelerar resultados com acompanhamento", icon: TrendingUp, link: "/sales-acceleration", carColor: "#16a34a" },
  { id: "sales-ops", name: "UNV Sales Ops", shortName: "Sales Ops", objective: "Treinar e capacitar seu time comercial", icon: Users, link: "/sales-ops", carColor: "#ea580c" },
  { id: "ads", name: "UNV Ads", shortName: "Ads", objective: "Escalar geração de leads qualificados", icon: Megaphone, link: "/ads", carColor: "#7c3aed" },
  { id: "social", name: "UNV Social", shortName: "Social", objective: "Gestão profissional das redes sociais", icon: Share2, link: "/social", carColor: "#db2777" },
  { id: "ai-sales-system", name: "UNV Sales System", shortName: "Sales System", objective: "Automatizar vendas com IA", icon: Bot, link: "/ai-sales-system", carColor: "#0891b2" },
  { id: "fractional-cro", name: "UNV Fractional CRO", shortName: "Fractional CRO", objective: "Diretor comercial terceirizado", icon: UserCheck, link: "/fractional-cro", carColor: "#4f46e5" },
  { id: "growth-room", name: "UNV Growth Room", shortName: "Growth Room", objective: "Imersões intensivas para destravar", icon: Building2, link: "/growth-room", carColor: "#d97706" },
  { id: "partners", name: "UNV Partners", shortName: "Partners", objective: "Grupo estratégico de parceiros UNV", icon: Handshake, link: "/partners", carColor: "#059669" },
  { id: "execution-partnership", name: "UNV Execution", shortName: "Execution", objective: "Implementação comercial direta", icon: Handshake, link: "/execution-partnership", carColor: "#b91c1c" },
  { id: "mastermind", name: "UNV Mastermind", shortName: "Mastermind", objective: "Grupo exclusivo de empresários de elite", icon: Crown, link: "/mastermind", carColor: "#ca8a04" },
  { id: "le-desir", name: "UNV Le Désir", shortName: "Le Désir", objective: "Posicionamento premium para sua marca", icon: Sparkles, link: "/le-desir", carColor: "#e11d48" },
  { id: "people", name: "UNV People", shortName: "People", objective: "Gestão de pessoas e cultura", icon: Users, link: "/people", carColor: "#1d4ed8" },
  { id: "finance", name: "UNV Finance", shortName: "Finance", objective: "Controle financeiro estratégico", icon: DollarSign, link: "/finance", carColor: "#15803d" },
  { id: "safe", name: "UNV Safe", shortName: "Safe", objective: "Assessoria jurídica preventiva", icon: Shield, link: "/safe", carColor: "#475569" },
  { id: "leadership", name: "UNV Leadership", shortName: "Leadership", objective: "Desenvolvimento de líderes", icon: UserCheck, link: "/leadership", carColor: "#7c3aed" }
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

  // Smooth F1 circuit path
  const trackPath = `
    M 50 18
    L 78 18
    C 88 18, 92 22, 92 32
    L 92 50
    C 92 58, 88 65, 80 70
    L 65 78
    C 55 84, 45 92, 35 100
    C 22 110, 10 108, 10 95
    L 10 82
    C 10 72, 15 65, 22 60
    L 28 55
    C 35 50, 35 42, 28 36
    L 22 30
    C 15 24, 18 18, 28 18
    L 50 18
  `;

  // Car positions following the track precisely
  const carPositions = [
    { x: 54, y: 18, rotation: 0 },      // 1
    { x: 72, y: 18, rotation: 0 },      // 2
    { x: 88, y: 22, rotation: 45 },     // 3
    { x: 92, y: 38, rotation: 90 },     // 4
    { x: 92, y: 54, rotation: 90 },     // 5
    { x: 85, y: 68, rotation: 135 },    // 6
    { x: 70, y: 76, rotation: 160 },    // 7
    { x: 52, y: 86, rotation: 200 },    // 8
    { x: 35, y: 98, rotation: 225 },    // 9
    { x: 18, y: 105, rotation: 250 },   // 10
    { x: 10, y: 92, rotation: 270 },    // 11
    { x: 10, y: 78, rotation: 270 },    // 12
    { x: 18, y: 65, rotation: 315 },    // 13
    { x: 28, y: 52, rotation: 270 },    // 14
    { x: 30, y: 40, rotation: 220 },    // 15
    { x: 22, y: 28, rotation: 315 },    // 16
    { x: 38, y: 18, rotation: 0 },      // 17
  ];

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background to-secondary/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
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
        <div className="hidden lg:block relative mx-auto rounded-3xl overflow-hidden shadow-2xl" style={{ maxWidth: '1000px', height: '800px', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)' }}>
          {/* Track container with padding */}
          <div className="absolute inset-4">
            <svg 
              className="w-full h-full" 
              viewBox="0 0 100 120"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Track asphalt gradient */}
                <linearGradient id="asphaltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4b5563" />
                  <stop offset="50%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#1f2937" />
                </linearGradient>
                
                {/* Outer curb red/white pattern */}
                <pattern id="curbOuter" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                  <rect width="1.5" height="3" fill="#dc2626" />
                  <rect x="1.5" width="1.5" height="3" fill="#ffffff" />
                </pattern>

                {/* Inner curb pattern */}
                <pattern id="curbInner" patternUnits="userSpaceOnUse" width="2" height="2" patternTransform="rotate(45)">
                  <rect width="1" height="2" fill="#dc2626" />
                  <rect x="1" width="1" height="2" fill="#ffffff" />
                </pattern>

                {/* Drop shadow */}
                <filter id="trackShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.3" />
                </filter>

                {/* Car glow */}
                <filter id="carGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Track shadow */}
              <path
                d={trackPath}
                fill="none"
                stroke="rgba(0,0,0,0.2)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="translate(1, 2)"
              />

              {/* Outer curb (red/white) */}
              <path
                d={trackPath}
                fill="none"
                stroke="url(#curbOuter)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* White edge line */}
              <path
                d={trackPath}
                fill="none"
                stroke="#ffffff"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Track surface (asphalt) */}
              <path
                d={trackPath}
                fill="none"
                stroke="url(#asphaltGradient)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Center dashed line */}
              <path
                d={trackPath}
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.4"
                strokeLinecap="round"
                strokeDasharray="2 2"
                opacity="0.7"
              />

              {/* Start/Finish line */}
              <g transform="translate(48, 14)">
                {[...Array(8)].map((_, i) => (
                  <g key={i}>
                    <rect x={i * 0.8} y="0" width="0.8" height="0.8" fill={i % 2 === 0 ? "#fff" : "#000"} />
                    <rect x={i * 0.8} y="0.8" width="0.8" height="0.8" fill={i % 2 === 1 ? "#fff" : "#000"} />
                    <rect x={i * 0.8} y="1.6" width="0.8" height="0.8" fill={i % 2 === 0 ? "#fff" : "#000"} />
                    <rect x={i * 0.8} y="2.4" width="0.8" height="0.8" fill={i % 2 === 1 ? "#fff" : "#000"} />
                    <rect x={i * 0.8} y="3.2" width="0.8" height="0.8" fill={i % 2 === 0 ? "#fff" : "#000"} />
                    <rect x={i * 0.8} y="4" width="0.8" height="0.8" fill={i % 2 === 1 ? "#fff" : "#000"} />
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
                    {/* Hover highlight */}
                    {isHovered && (
                      <circle cx="0" cy="0" r="6" fill={service.carColor} opacity="0.3" filter="url(#carGlow)" />
                    )}
                    
                    {/* Car shadow */}
                    <ellipse 
                      cx="0.5" 
                      cy="0.8" 
                      rx="3.5" 
                      ry="1.2" 
                      fill="rgba(0,0,0,0.4)"
                      transform={`rotate(${pos.rotation})`}
                    />
                    
                    {/* F1 Car */}
                    <g transform={`rotate(${pos.rotation}) scale(${isHovered ? 1.2 : 1})`} style={{ transition: 'transform 0.15s ease-out' }}>
                      {/* Rear wing */}
                      <rect x="-4" y="-1.3" width="0.8" height="2.6" rx="0.1" fill="#1a1a1a" />
                      <rect x="-4.3" y="-1" width="0.4" height="2" fill={service.carColor} />
                      
                      {/* Rear wheels */}
                      <ellipse cx="-2.2" cy="-1.8" rx="1" ry="0.5" fill="#1a1a1a" />
                      <ellipse cx="-2.2" cy="1.8" rx="1" ry="0.5" fill="#1a1a1a" />
                      
                      {/* Main body */}
                      <path 
                        d="M -3 0 Q -2.5 -1.3, 0 -1.3 L 2.5 -0.8 Q 3.5 -0.4, 3.5 0 Q 3.5 0.4, 2.5 0.8 L 0 1.3 Q -2.5 1.3, -3 0 Z" 
                        fill={service.carColor}
                      />
                      
                      {/* Cockpit */}
                      <ellipse cx="0" cy="0" rx="1.3" ry="0.8" fill="#0f0f0f" />
                      
                      {/* Driver helmet */}
                      <circle cx="0" cy="0" r="0.5" fill="#fff" />
                      <path d="M -0.3 -0.3 Q 0 -0.5, 0.3 -0.3 L 0.3 0 Q 0 0.2, -0.3 0 Z" fill={service.carColor} />
                      
                      {/* Front wing */}
                      <rect x="3" y="-1.6" width="0.6" height="3.2" rx="0.1" fill={service.carColor} />
                      
                      {/* Front wheels */}
                      <ellipse cx="2.2" cy="-1.7" rx="0.8" ry="0.45" fill="#1a1a1a" />
                      <ellipse cx="2.2" cy="1.7" rx="0.8" ry="0.45" fill="#1a1a1a" />
                      
                      {/* Number circle */}
                      <circle cx="0" cy="0" r="0.6" fill="transparent" />
                    </g>
                    
                    {/* Number badge above car */}
                    <g transform="translate(0, -5)">
                      <rect x="-2" y="-1.2" width="4" height="2.4" rx="1.2" fill={service.carColor} />
                      <text y="0.5" textAnchor="middle" fontSize="1.6" fill="white" fontWeight="bold">{index + 1}</text>
                    </g>
                  </g>
                );
              })}

              {/* Track title */}
              <text x="50" y="8" textAnchor="middle" fontSize="3" fill="#1f2937" fontWeight="bold" letterSpacing="0.2">CIRCUITO UNV</text>
              <text x="50" y="11" textAnchor="middle" fontSize="1.2" fill="#6b7280">17 SERVIÇOS • SUA JORNADA DE CRESCIMENTO</text>
            </svg>
          </div>

          {/* Start label */}
          <div className="absolute left-[52%] top-[12%] -translate-x-1/2 flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-1.5 shadow-lg z-10">
            <Flag className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Largada</span>
          </div>

          {/* Floating tooltip */}
          {hoveredCar !== null && (
            <div 
              className="absolute z-50 pointer-events-none animate-fade-in"
              style={{
                left: `${(carPositions[hoveredCar].x / 100) * 100 + 4}%`,
                top: `${(carPositions[hoveredCar].y / 120) * 100 + 3}%`,
                transform: 'translate(-50%, -130%)'
              }}
            >
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xl min-w-[240px]">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: allServices[hoveredCar].carColor }}
                  >
                    {(() => {
                      const IconComponent = allServices[hoveredCar].icon;
                      return <IconComponent className="h-6 w-6 text-white" />;
                    })()}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Posição {hoveredCar + 1}</div>
                    <h4 className="font-bold text-gray-900">{allServices[hoveredCar].name}</h4>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{allServices[hoveredCar].objective}</p>
                <Link 
                  to={allServices[hoveredCar].link}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 pointer-events-auto"
                  style={{ backgroundColor: allServices[hoveredCar].carColor }}
                >
                  Conhecer serviço
                  <Trophy className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Car legend - Desktop */}
        <div className="hidden lg:block mt-10">
          <div className="grid grid-cols-6 gap-4 max-w-5xl mx-auto">
            {allServices.map((service, index) => (
              <Link 
                key={service.id}
                to={service.link}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-all group"
                onMouseEnter={() => setHoveredCar(index)}
                onMouseLeave={() => setHoveredCar(null)}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: service.carColor }}
                >
                  {index + 1}
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{service.shortName}</span>
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
