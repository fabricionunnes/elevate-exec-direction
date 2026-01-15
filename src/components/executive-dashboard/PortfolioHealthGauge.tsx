import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";

interface PortfolioHealthGaugeProps {
  score: number;
  previousScore?: number;
  totalProjects: number;
}

export function PortfolioHealthGauge({ score, previousScore, totalProjects }: PortfolioHealthGaugeProps) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return { main: "#22c55e", light: "#86efac", gradient: "from-emerald-400 to-emerald-600" };
    if (value >= 60) return { main: "#eab308", light: "#fde047", gradient: "from-amber-400 to-amber-600" };
    if (value >= 40) return { main: "#f97316", light: "#fdba74", gradient: "from-orange-400 to-orange-600" };
    return { main: "#ef4444", light: "#fca5a5", gradient: "from-rose-400 to-rose-600" };
  };

  const getScoreLabel = (value: number) => {
    if (value >= 80) return "Saudável";
    if (value >= 60) return "Atenção";
    if (value >= 40) return "Alto Risco";
    return "Crítico";
  };

  const colors = getScoreColor(score);
  const label = getScoreLabel(score);
  
  // Calculate rotation for gauge needle (0-180 degrees)
  const rotation = (score / 100) * 180;
  
  const trend = previousScore !== undefined ? score - previousScore : 0;

  // Create arc segments for 3D effect
  const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = 50 + radius * Math.cos(Math.PI - startRad);
    const y1 = 50 - radius * Math.sin(Math.PI - startRad);
    const x2 = 50 + radius * Math.cos(Math.PI - endRad);
    const y2 = 50 - radius * Math.sin(Math.PI - endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Background decorations */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl" />
      
      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          Saúde do Portfólio
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="flex flex-col items-center">
          {/* 3D Gauge visualization */}
          <motion.div 
            className="relative w-56 h-28 mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <svg className="w-full h-full" viewBox="0 0 100 55">
              {/* Drop shadow filter */}
              <defs>
                <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                </filter>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="40%" stopColor="#f97316" />
                  <stop offset="60%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
                <linearGradient id="gaugeProgress" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={colors.light} />
                  <stop offset="100%" stopColor={colors.main} />
                </linearGradient>
                {/* 3D effect gradient */}
                <linearGradient id="gauge3D" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="white" stopOpacity="0" />
                  <stop offset="100%" stopColor="black" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              
              {/* Background arc with 3D effect */}
              <path
                d={createArcPath(0, 180, 38)}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
                strokeLinecap="round"
                filter="url(#gaugeShadow)"
              />
              
              {/* 3D highlight on background */}
              <path
                d={createArcPath(0, 180, 38)}
                fill="none"
                stroke="url(#gauge3D)"
                strokeWidth="12"
                strokeLinecap="round"
                opacity="0.5"
              />
              
              {/* Colored segments */}
              <path d={createArcPath(0, 36, 38)} fill="none" stroke="#fee2e2" strokeWidth="10" strokeLinecap="round" />
              <path d={createArcPath(36, 72, 38)} fill="none" stroke="#ffedd5" strokeWidth="10" strokeLinecap="round" />
              <path d={createArcPath(72, 108, 38)} fill="none" stroke="#fef9c3" strokeWidth="10" strokeLinecap="round" />
              <path d={createArcPath(108, 144, 38)} fill="none" stroke="#dcfce7" strokeWidth="10" strokeLinecap="round" />
              <path d={createArcPath(144, 180, 38)} fill="none" stroke="#bbf7d0" strokeWidth="10" strokeLinecap="round" />
              
              {/* Progress arc */}
              <motion.path
                d={createArcPath(0, rotation, 38)}
                fill="none"
                stroke="url(#gaugeProgress)"
                strokeWidth="10"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
              
              {/* Needle with 3D effect */}
              <motion.g 
                initial={{ rotate: -90 }}
                animate={{ rotate: rotation - 90 }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ transformOrigin: "50px 50px" }}
              >
                {/* Needle shadow */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="18"
                  stroke="rgba(0,0,0,0.2)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  transform="translate(2, 2)"
                />
                {/* Needle body */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="18"
                  stroke={colors.main}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Needle highlight */}
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="20"
                  stroke={colors.light}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                {/* Center circle with 3D effect */}
                <circle cx="50" cy="50" r="8" fill={colors.main} filter="url(#gaugeShadow)" />
                <circle cx="50" cy="50" r="6" fill={`url(#gaugeProgress)`} />
                <circle cx="48" cy="48" r="2" fill="white" opacity="0.4" />
              </motion.g>
              
              {/* Scale markers */}
              {[0, 20, 40, 60, 80, 100].map((val, i) => {
                const angle = (val / 100) * 180;
                const rad = (angle * Math.PI) / 180;
                const x = 50 + 46 * Math.cos(Math.PI - rad);
                const y = 50 - 46 * Math.sin(Math.PI - rad);
                return (
                  <text
                    key={i}
                    x={x}
                    y={y}
                    fontSize="5"
                    fill="#9ca3af"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {val}
                  </text>
                );
              })}
            </svg>
          </motion.div>

          {/* Score display with glassmorphism */}
          <motion.div 
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className={`text-5xl font-bold bg-gradient-to-br ${colors.gradient} bg-clip-text text-transparent`}>
              {score.toFixed(0)}
            </div>
            <div className={`text-sm font-semibold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
              {label}
            </div>
            {previousScore !== undefined && (
              <div className={`text-xs mt-1 font-medium ${trend >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {trend >= 0 ? "↑" : "↓"} {trend >= 0 ? "+" : ""}{trend.toFixed(1)} vs mês anterior
              </div>
            )}
            <div className="text-xs text-muted-foreground/70 mt-2 px-3 py-1 rounded-full bg-muted/50 inline-block">
              Baseado em {totalProjects} projetos ativos
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
