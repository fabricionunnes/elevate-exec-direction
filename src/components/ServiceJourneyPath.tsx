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
  description: string;
  price: string;
  category: string;
  icon: React.ElementType;
  link: string;
  carColor: string;
}

const allServices: JourneyStep[] = [
  { id: "core", name: "UNV Core", shortName: "Core", objective: "Estruturar sua operação comercial do zero", description: "Diagnóstico completo + playbook comercial personalizado para sua empresa", price: "R$ 1.997 único", category: "Trilha Principal", icon: Target, link: "/core", carColor: "#dc2626" },
  { id: "control", name: "UNV Control", shortName: "Control", objective: "Direção comercial contínua e previsibilidade", description: "Reuniões mensais de direcionamento + dashboards + rituais de gestão", price: "R$ 5.997/ano", category: "Trilha Principal", icon: Compass, link: "/control", carColor: "#2563eb" },
  { id: "sales-acceleration", name: "UNV Sales Acceleration", shortName: "Acceleration", objective: "Acelerar resultados com acompanhamento", description: "Mentorias semanais + acompanhamento individual do seu comercial", price: "R$ 24.000/ano", category: "Trilha Principal", icon: TrendingUp, link: "/sales-acceleration", carColor: "#16a34a" },
  { id: "sales-ops", name: "UNV Sales Ops", shortName: "Sales Ops", objective: "Treinar e capacitar seu time comercial", description: "Treinamentos práticos + roleplay + certificação para vendedores", price: "R$ 12.000/ano", category: "Operação", icon: Users, link: "/sales-ops", carColor: "#ea580c" },
  { id: "ads", name: "UNV Ads", shortName: "Ads", objective: "Escalar geração de leads qualificados", description: "Gestão completa de tráfego pago + criativos + otimização", price: "A partir de R$ 1.800/mês", category: "Operação", icon: Megaphone, link: "/ads", carColor: "#7c3aed" },
  { id: "social", name: "UNV Social", shortName: "Social", objective: "Gestão profissional das redes sociais", description: "Produção de conteúdo + gestão de perfis + estratégia digital", price: "R$ 1.500/mês", category: "Operação", icon: Share2, link: "/social", carColor: "#db2777" },
  { id: "ai-sales-system", name: "UNV Sales System", shortName: "Sales System", objective: "Automatizar vendas com IA", description: "Chatbots inteligentes + automações + integração com CRM", price: "R$ 297 a R$ 9.997/mês", category: "Operação", icon: Bot, link: "/ai-sales-system", carColor: "#0891b2" },
  { id: "fractional-cro", name: "UNV Fractional CRO", shortName: "Fractional CRO", objective: "Diretor comercial terceirizado", description: "Liderança comercial experiente sem custo de CLT", price: "R$ 4.000/mês + comissão", category: "Operação", icon: UserCheck, link: "/fractional-cro", carColor: "#4f46e5" },
  { id: "growth-room", name: "UNV Growth Room", shortName: "Growth Room", objective: "Imersões intensivas para destravar", description: "3 dias presenciais de imersão com empresários selecionados", price: "R$ 3.997/evento", category: "Avançada", icon: Building2, link: "/growth-room", carColor: "#d97706" },
  { id: "partners", name: "UNV Partners", shortName: "Partners", objective: "Grupo estratégico de parceiros UNV", description: "Comunidade exclusiva + rituais mensais + networking qualificado", price: "R$ 30.000/ano", category: "Avançada", icon: Handshake, link: "/partners", carColor: "#059669" },
  { id: "execution-partnership", name: "UNV Execution", shortName: "Execution", objective: "Implementação comercial direta", description: "Squad UNV implementando sua operação comercial por 3 meses", price: "R$ 40.000 projeto", category: "Avançada", icon: Handshake, link: "/execution-partnership", carColor: "#b91c1c" },
  { id: "mastermind", name: "UNV Mastermind", shortName: "Mastermind", objective: "Grupo exclusivo de empresários de elite", description: "Encontros presenciais + mentoria + acesso à Mansão Empreendedora", price: "R$ 50.000/ano", category: "Avançada", icon: Crown, link: "/mastermind", carColor: "#ca8a04" },
  { id: "le-desir", name: "UNV Le Désir", shortName: "Le Désir", objective: "Posicionamento premium para sua marca", description: "Branding + posicionamento de luxo + estratégia de percepção", price: "R$ 2.000/mês", category: "Estrutura", icon: Sparkles, link: "/le-desir", carColor: "#e11d48" },
  { id: "people", name: "UNV People", shortName: "People", objective: "Gestão de pessoas e cultura", description: "RH estratégico + recrutamento + desenvolvimento de equipe", price: "R$ 2.500 a R$ 6.000/mês", category: "Estrutura", icon: Users, link: "/people", carColor: "#1d4ed8" },
  { id: "finance", name: "UNV Finance", shortName: "Finance", objective: "Controle financeiro estratégico", description: "BPO financeiro + controladoria + dashboards de gestão", price: "R$ 3.000/mês", category: "Estrutura", icon: DollarSign, link: "/finance", carColor: "#15803d" },
  { id: "safe", name: "UNV Safe", shortName: "Safe", objective: "Assessoria jurídica preventiva", description: "Contratos + compliance + proteção legal para sua empresa", price: "R$ 3.000/mês", category: "Estrutura", icon: Shield, link: "/safe", carColor: "#475569" },
  { id: "leadership", name: "UNV Leadership", shortName: "Leadership", objective: "Desenvolvimento de líderes", description: "Programa de formação de líderes comerciais na sua empresa", price: "R$ 10.000/ano", category: "Estrutura", icon: UserCheck, link: "/leadership", carColor: "#7c3aed" }
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
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const [selectedMobileCar, setSelectedMobileCar] = useState<number | null>(null);

  const handleCarMouseLeave = () => {
    // Small delay to allow mouse to reach tooltip
    setTimeout(() => {
      if (!isTooltipHovered) {
        setHoveredCar(null);
      }
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    setIsTooltipHovered(true);
  };

  const handleTooltipMouseLeave = () => {
    setIsTooltipHovered(false);
    setHoveredCar(null);
  };

  const handleMobileCarClick = (index: number) => {
    setSelectedMobileCar(selectedMobileCar === index ? null : index);
  };

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
    <section className="py-16 md:py-24 bg-gradient-to-b from-secondary/20 to-background">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-5">
            <Flag className="h-4 w-4" />
            Grande Prêmio do Crescimento
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Circuito UNV
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            17 etapas para cruzar a linha de chegada. Clique nos carros ou na legenda para conhecer cada serviço.
          </p>
        </div>

        {/* Racing Track - Desktop */}
        <div className="hidden lg:block relative mx-auto rounded-3xl shadow-2xl border border-border/30 overflow-hidden" style={{ maxWidth: '900px', height: '720px' }}>
          {/* Grass background with texture */}
          <div className="absolute inset-0" style={{ 
            background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
          }}>
            {/* Grass texture overlay */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.1) 1px, transparent 0)',
              backgroundSize: '8px 8px'
            }} />
          </div>
          
          {/* Track container */}
          <div className="absolute inset-6">
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
                    onMouseLeave={handleCarMouseLeave}
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

              {/* Remove internal title - will use external labels instead */}
            </svg>
          </div>

          {/* Track title - positioned on the grass */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center z-10">
            <h3 className="text-xl font-bold text-white drop-shadow-lg tracking-wider">CIRCUITO UNV</h3>
            <p className="text-xs text-white/80 drop-shadow">17 serviços • Sua jornada de crescimento</p>
          </div>

          {/* Start label */}
          <div className="absolute left-[52%] top-[16%] -translate-x-1/2 flex items-center gap-2 bg-green-600 text-white rounded-full px-4 py-2 shadow-xl z-10 border-2 border-white/30">
            <Flag className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-wide">Largada</span>
          </div>

          {/* Finish flag - on the track end */}
          <div className="absolute right-[8%] bottom-[38%] flex items-center gap-2 bg-foreground text-background rounded-full px-3 py-1.5 shadow-xl z-10">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-bold uppercase tracking-wide">Meta</span>
          </div>

          {/* Floating tooltip - positioned outside track to avoid clipping */}
          {hoveredCar !== null && (() => {
            const pos = carPositions[hoveredCar];
            // Calculate position and determine if tooltip should show above or below
            const showAbove = pos.y > 30;
            const leftPercent = (pos.x / 100) * 100;
            const topPercent = (pos.y / 120) * 100;
            
            return (
              <div 
                className="absolute z-[100]"
                style={{
                  left: `${Math.max(15, Math.min(85, leftPercent))}%`,
                  top: showAbove ? `${topPercent - 2}%` : `${topPercent + 8}%`,
                  transform: showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
                }}
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
              >
                <div className="bg-background border border-border rounded-2xl p-4 shadow-2xl w-[260px] animate-fade-in">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                      style={{ backgroundColor: allServices[hoveredCar].carColor }}
                    >
                      {(() => {
                        const IconComponent = allServices[hoveredCar].icon;
                        return <IconComponent className="h-6 w-6 text-white" />;
                      })()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground font-medium">Posição {hoveredCar + 1}</div>
                      <h4 className="font-bold text-foreground truncate">{allServices[hoveredCar].name}</h4>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{allServices[hoveredCar].objective}</p>
                  <Link 
                    to={allServices[hoveredCar].link}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: allServices[hoveredCar].carColor }}
                  >
                    Conhecer serviço
                    <Trophy className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Car legend - Desktop - Improved Grid */}
        <div className="hidden lg:block mt-12">
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Trophy className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Legenda do Circuito</h3>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {allServices.map((service, index) => (
                <Link 
                  key={service.id}
                  to={service.link}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 group",
                    hoveredCar === index 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-transparent hover:border-border hover:bg-secondary/30"
                  )}
                  onMouseEnter={() => setHoveredCar(index)}
                  onMouseLeave={handleCarMouseLeave}
                >
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md transition-transform",
                      hoveredCar === index ? "scale-110" : "group-hover:scale-105"
                    )}
                    style={{ backgroundColor: service.carColor }}
                  >
                    {index + 1}
                  </div>
                  <span className={cn(
                    "text-sm font-medium transition-colors truncate",
                    hoveredCar === index ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {service.shortName}
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Clique em qualquer serviço para ver os detalhes completos
            </p>
          </div>
        </div>

        {/* Mobile version - Visual Track */}
        <div className="lg:hidden">
          {/* Mobile Track Container */}
          <div className="relative mx-auto rounded-2xl overflow-hidden shadow-xl" style={{ maxWidth: '360px' }}>
            {/* Grass background */}
            <div className="absolute inset-0 bg-gradient-to-b from-green-400 via-green-500 to-green-600">
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.15) 1px, transparent 0)',
                backgroundSize: '6px 6px'
              }} />
            </div>
            
            {/* Track SVG - Vertical serpentine */}
            <svg className="relative w-full" viewBox="0 0 100 320" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="mobileAsphalt" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4b5563" />
                  <stop offset="50%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#4b5563" />
                </linearGradient>
                <pattern id="mobileCurb" patternUnits="userSpaceOnUse" width="4" height="4">
                  <rect width="2" height="4" fill="#dc2626" />
                  <rect x="2" width="2" height="4" fill="#ffffff" />
                </pattern>
              </defs>

              {/* Track path - serpentine vertical */}
              {(() => {
                const trackPath = `
                  M 50 15
                  L 80 15
                  Q 95 15, 95 30
                  L 95 50
                  Q 95 65, 80 65
                  L 20 65
                  Q 5 65, 5 80
                  L 5 100
                  Q 5 115, 20 115
                  L 80 115
                  Q 95 115, 95 130
                  L 95 150
                  Q 95 165, 80 165
                  L 20 165
                  Q 5 165, 5 180
                  L 5 200
                  Q 5 215, 20 215
                  L 80 215
                  Q 95 215, 95 230
                  L 95 250
                  Q 95 265, 80 265
                  L 20 265
                  Q 5 265, 5 280
                  L 5 305
                `;
                
                return (
                  <>
                    {/* Track shadow */}
                    <path d={trackPath} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" transform="translate(1, 2)" />
                    {/* Curb */}
                    <path d={trackPath} fill="none" stroke="url(#mobileCurb)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    {/* White edge */}
                    <path d={trackPath} fill="none" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Asphalt */}
                    <path d={trackPath} fill="none" stroke="url(#mobileAsphalt)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Center line */}
                    <path d={trackPath} fill="none" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
                  </>
                );
              })()}

              {/* Start/Finish checkered */}
              <g transform="translate(45, 10)">
                {[...Array(5)].map((_, i) => (
                  <g key={i}>
                    <rect x={i * 2} y="0" width="2" height="2" fill={i % 2 === 0 ? "#fff" : "#000"} />
                    <rect x={i * 2} y="2" width="2" height="2" fill={i % 2 === 1 ? "#fff" : "#000"} />
                    <rect x={i * 2} y="4" width="2" height="2" fill={i % 2 === 0 ? "#fff" : "#000"} />
                    <rect x={i * 2} y="6" width="2" height="2" fill={i % 2 === 1 ? "#fff" : "#000"} />
                  </g>
                ))}
              </g>

              {/* Car positions on mobile track - Clickable */}
              {(() => {
                const mobileCarPositions = [
                  { x: 55, y: 15 },    // 1 - start
                  { x: 75, y: 15 },    // 2
                  { x: 92, y: 35 },    // 3
                  { x: 75, y: 65 },    // 4
                  { x: 45, y: 65 },    // 5
                  { x: 8, y: 90 },     // 6
                  { x: 45, y: 115 },   // 7
                  { x: 92, y: 140 },   // 8
                  { x: 45, y: 165 },   // 9
                  { x: 8, y: 190 },    // 10
                  { x: 45, y: 215 },   // 11
                  { x: 92, y: 240 },   // 12
                  { x: 55, y: 265 },   // 13
                  { x: 20, y: 265 },   // 14
                  { x: 8, y: 285 },    // 15
                  { x: 8, y: 305 },    // 16
                ];
                
                return allServices.slice(0, 16).map((service, index) => {
                  const pos = mobileCarPositions[index];
                  const isSelected = selectedMobileCar === index;
                  return (
                    <g 
                      key={service.id} 
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => handleMobileCarClick(index)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Tap area - larger for touch */}
                      <circle r="8" fill="transparent" />
                      {/* Highlight ring */}
                      {isSelected && (
                        <circle r="6" fill={service.carColor} opacity="0.3" />
                      )}
                      {/* Number badge */}
                      <circle r="4.5" fill={service.carColor} stroke={isSelected ? "#fff" : "transparent"} strokeWidth="1" />
                      <text y="1.5" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">{index + 1}</text>
                    </g>
                  );
                });
              })()}

              {/* Car 17 at finish - Clickable */}
              <g 
                transform="translate(8, 315)"
                onClick={() => handleMobileCarClick(16)}
                style={{ cursor: 'pointer' }}
              >
                <circle r="10" fill="transparent" />
                {selectedMobileCar === 16 && (
                  <circle r="7" fill="#fbbf24" opacity="0.3" />
                )}
                <circle r="5" fill="#fbbf24" stroke={selectedMobileCar === 16 ? "#fff" : "transparent"} strokeWidth="1" />
                <text y="1.5" textAnchor="middle" fontSize="4" fill="#000" fontWeight="bold">17</text>
              </g>
            </svg>

            {/* Labels */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 z-10">
              <Flag className="h-3 w-3" />
              LARGADA
            </div>
            <div className="absolute bottom-2 left-2 bg-foreground text-background text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 z-10">
              <Trophy className="h-3 w-3 text-yellow-400" />
              META
            </div>

            {/* Mobile tooltip - positioned near the clicked car */}
            {selectedMobileCar !== null && (() => {
              const mobileCarPositions = [
                { x: 55, y: 15 },    // 1
                { x: 75, y: 15 },    // 2
                { x: 92, y: 35 },    // 3
                { x: 75, y: 65 },    // 4
                { x: 45, y: 65 },    // 5
                { x: 8, y: 90 },     // 6
                { x: 45, y: 115 },   // 7
                { x: 92, y: 140 },   // 8
                { x: 45, y: 165 },   // 9
                { x: 8, y: 190 },    // 10
                { x: 45, y: 215 },   // 11
                { x: 92, y: 240 },   // 12
                { x: 55, y: 265 },   // 13
                { x: 20, y: 265 },   // 14
                { x: 8, y: 285 },    // 15
                { x: 8, y: 305 },    // 16
                { x: 8, y: 315 },    // 17
              ];
              
              const pos = mobileCarPositions[selectedMobileCar];
              const topPercent = (pos.y / 320) * 100;
              const leftPercent = pos.x;
              
              // Determine if tooltip should show above or below based on position
              const showAbove = pos.y > 80;
              // Determine horizontal alignment
              const alignLeft = pos.x > 50;
              
              return (
                <div 
                  className="absolute z-20 w-[85%] max-w-[280px] animate-fade-in"
                  style={{
                    top: showAbove ? `${topPercent - 3}%` : `${topPercent + 5}%`,
                    left: alignLeft ? 'auto' : '8px',
                    right: alignLeft ? '8px' : 'auto',
                    transform: showAbove ? 'translateY(-100%)' : 'translateY(0)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-background border border-border rounded-xl p-3 shadow-2xl">
                    {/* Arrow pointing to car */}
                    <div 
                      className="absolute w-3 h-3 bg-background border-l border-t border-border rotate-45"
                      style={{
                        top: showAbove ? 'auto' : '-6px',
                        bottom: showAbove ? '-6px' : 'auto',
                        left: alignLeft ? 'auto' : `${Math.max(20, Math.min(80, leftPercent))}%`,
                        right: alignLeft ? `${Math.max(10, 100 - leftPercent)}%` : 'auto',
                        transform: showAbove ? 'rotate(-135deg)' : 'rotate(45deg)'
                      }}
                    />
                    <div className="flex items-start gap-3 mb-3">
                      <div 
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0"
                        style={{ backgroundColor: allServices[selectedMobileCar].carColor }}
                      >
                        {(() => {
                          const IconComponent = allServices[selectedMobileCar].icon;
                          return <IconComponent className="h-5 w-5" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span 
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ 
                              backgroundColor: `${allServices[selectedMobileCar].carColor}20`,
                              color: allServices[selectedMobileCar].carColor 
                            }}
                          >
                            {allServices[selectedMobileCar].category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">#{selectedMobileCar + 1}</span>
                        </div>
                        <h4 className="font-bold text-foreground text-sm">{allServices[selectedMobileCar].name}</h4>
                      </div>
                      <button 
                        onClick={() => setSelectedMobileCar(null)}
                        className="shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:bg-secondary/80 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      {allServices[selectedMobileCar].description}
                    </p>
                    
                    {/* Price */}
                    <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg mb-3">
                      <span className="text-xs text-muted-foreground">Investimento:</span>
                      <span className="text-sm font-bold text-foreground">{allServices[selectedMobileCar].price}</span>
                    </div>
                    
                    <Link 
                      to={allServices[selectedMobileCar].link}
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg text-sm font-semibold text-white transition-all active:scale-95"
                      style={{ backgroundColor: allServices[selectedMobileCar].carColor }}
                    >
                      Ver detalhes completos
                      <Trophy className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Mobile Legend */}
          <div className="mt-6 space-y-2">
            <p className="text-center text-sm text-muted-foreground mb-4">
              Toque nos números da pista ou selecione abaixo
            </p>
            {allServices.map((service, index) => (
              <MobileCarCard
                key={service.id}
                service={service}
                number={index + 1}
                isLast={index === allServices.length - 1}
              />
            ))}
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
