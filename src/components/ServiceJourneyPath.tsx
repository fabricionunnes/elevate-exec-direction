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
      className="w-14 h-6 md:w-20 md:h-8 drop-shadow-lg"
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
  // Track path - serpentine circuit going down the page
  const trackPath = `
    M 10 8
    L 90 8
    Q 98 8 98 16
    L 98 22
    Q 98 30 90 30
    L 10 30
    Q 2 30 2 38
    L 2 44
    Q 2 52 10 52
    L 90 52
    Q 98 52 98 60
    L 98 66
    Q 98 74 90 74
    L 10 74
    Q 2 74 2 82
    L 2 88
    Q 2 96 10 96
    L 50 96
  `;

  // Car positions ON the track path (matching the path coordinates)
  const carPositions = [
    { x: 18, y: 8, rotation: 0 },    // 1 - Core (primeira reta, indo para direita)
    { x: 40, y: 8, rotation: 0 },    // 2 - Control
    { x: 65, y: 8, rotation: 0 },    // 3 - Acceleration
    { x: 88, y: 8, rotation: 0 },    // 4 - Sales Ops
    { x: 98, y: 19, rotation: 90 },  // 5 - Ads (curva descendo)
    { x: 82, y: 30, rotation: 180 }, // 6 - Social (segunda reta, indo para esquerda)
    { x: 55, y: 30, rotation: 180 }, // 7 - Sales System
    { x: 28, y: 30, rotation: 180 }, // 8 - Fractional CRO
    { x: 2, y: 41, rotation: 90 },   // 9 - Growth Room (curva descendo)
    { x: 20, y: 52, rotation: 0 },   // 10 - Partners (terceira reta, indo para direita)
    { x: 50, y: 52, rotation: 0 },   // 11 - Execution
    { x: 80, y: 52, rotation: 0 },   // 12 - Mastermind
    { x: 98, y: 63, rotation: 90 },  // 13 - Le Désir (curva descendo)
    { x: 75, y: 74, rotation: 180 }, // 14 - People (quarta reta, indo para esquerda)
    { x: 45, y: 74, rotation: 180 }, // 15 - Finance
    { x: 2, y: 85, rotation: 90 },   // 16 - Safe (curva descendo)
    { x: 35, y: 96, rotation: 0 },   // 17 - Leadership (reta final)
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
        <div className="hidden lg:block relative" style={{ height: '1400px' }}>
          <svg 
            className="absolute inset-0 w-full h-full" 
            viewBox="0 0 100 104"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Track gradient */}
              <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#374151" />
                <stop offset="100%" stopColor="#1f2937" />
              </linearGradient>
              
              {/* Glow effect */}
              <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Track outer edge (red border) */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
            />

            {/* Track surface (dark asphalt) */}
            <path
              d={trackPath}
              fill="none"
              stroke="url(#trackGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#trackGlow)"
            />

            {/* Track white edge lines */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.15"
            />

            {/* Track center dashed line */}
            <path
              d={trackPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.3"
              strokeLinecap="round"
              strokeDasharray="3 3"
              opacity="0.6"
            />

            {/* Start/Finish line checkered pattern */}
            <g>
              <rect x="8" y="5" width="2" height="2" fill="white" />
              <rect x="10" y="5" width="2" height="2" fill="black" />
              <rect x="8" y="7" width="2" height="2" fill="black" />
              <rect x="10" y="7" width="2" height="2" fill="white" />
              <rect x="8" y="9" width="2" height="2" fill="white" />
              <rect x="10" y="9" width="2" height="2" fill="black" />
              <rect x="8" y="11" width="2" height="2" fill="black" />
              <rect x="10" y="11" width="2" height="2" fill="white" />
            </g>

            {/* F1 Cars on track */}
            {allServices.map((service, index) => {
              const pos = carPositions[index];
              return (
                <g key={service.id} transform={`translate(${pos.x}, ${pos.y})`}>
                  {/* Car shadow */}
                  <ellipse cx="0" cy="1" rx="3" ry="1" fill="black" opacity="0.3" />
                  {/* Car body */}
                  <g transform={`rotate(${pos.rotation})`}>
                    {/* Main body */}
                    <ellipse cx="0" cy="0" rx="4" ry="1.5" fill={service.carColor} />
                    {/* Cockpit */}
                    <ellipse cx="-0.5" cy="0" rx="1.2" ry="0.8" fill="#1a1a1a" />
                    {/* Helmet */}
                    <circle cx="-0.5" cy="0" r="0.5" fill="white" />
                    {/* Front wing */}
                    <rect x="3.5" y="-1.2" width="0.8" height="2.4" rx="0.2" fill={service.carColor} />
                    {/* Rear wing */}
                    <rect x="-4.5" y="-1.5" width="0.6" height="3" rx="0.2" fill={service.carColor} />
                    <rect x="-5" y="-1" width="0.8" height="2" rx="0.2" fill="#1a1a1a" />
                    {/* Wheels */}
                    <ellipse cx="2.5" cy="-1.8" rx="0.8" ry="0.5" fill="#1a1a1a" />
                    <ellipse cx="2.5" cy="1.8" rx="0.8" ry="0.5" fill="#1a1a1a" />
                    <ellipse cx="-2" cy="-2" rx="1" ry="0.5" fill="#1a1a1a" />
                    <ellipse cx="-2" cy="2" rx="1" ry="0.5" fill="#1a1a1a" />
                  </g>
                  {/* Number above car */}
                  <text y="-4" textAnchor="middle" fontSize="2.5" fill="white" fontWeight="bold" className="select-none">{index + 1}</text>
                </g>
              );
            })}

            {/* Finish checkered flag at end */}
            <g transform="translate(50, 96)">
              <rect x="-3" y="-1" width="1.5" height="1.5" fill="white" />
              <rect x="-1.5" y="-1" width="1.5" height="1.5" fill="black" />
              <rect x="0" y="-1" width="1.5" height="1.5" fill="white" />
              <rect x="-3" y="0.5" width="1.5" height="1.5" fill="black" />
              <rect x="-1.5" y="0.5" width="1.5" height="1.5" fill="white" />
              <rect x="0" y="0.5" width="1.5" height="1.5" fill="black" />
            </g>
          </svg>

          {/* Start marker */}
          <div className="absolute left-[5%] top-[3%] flex items-center gap-2 bg-green-500/20 border border-green-500/50 rounded-full px-3 py-1.5">
            <Flag className="h-4 w-4 text-green-500" />
            <span className="text-xs font-bold text-green-500 uppercase">Largada</span>
          </div>

          {/* Finish marker */}
          <div className="absolute left-[45%] bottom-[3%] flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full px-3 py-1.5">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-500 uppercase">Chegada</span>
          </div>

          {/* Clickable areas for each car */}
          {allServices.map((service, index) => {
            const pos = carPositions[index];
            return (
              <Link
                key={service.id}
                to={service.link}
                className="absolute group"
                style={{
                  left: `${pos.x}%`,
                  top: `${(pos.y / 104) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Invisible clickable area */}
                <div className="w-16 h-12 md:w-20 md:h-14" />
                
                {/* Tooltip on hover */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
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
