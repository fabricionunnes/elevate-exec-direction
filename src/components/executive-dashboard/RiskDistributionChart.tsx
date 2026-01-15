import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface RiskDistribution {
  healthy: number;
  attention: number;
  highRisk: number;
  critical: number;
}

interface RiskDistributionChartProps {
  distribution: RiskDistribution;
  onSegmentClick?: (riskLevel: string) => void;
}

export function RiskDistributionChart({ distribution, onSegmentClick }: RiskDistributionChartProps) {
  const data = [
    { name: "Saudável (80-100)", value: distribution.healthy, color: "#22c55e", lightColor: "#86efac", key: "healthy" },
    { name: "Atenção (60-79)", value: distribution.attention, color: "#eab308", lightColor: "#fde047", key: "attention" },
    { name: "Alto Risco (40-59)", value: distribution.highRisk, color: "#f97316", lightColor: "#fdba74", key: "highRisk" },
    { name: "Crítico (0-39)", value: distribution.critical, color: "#ef4444", lightColor: "#fca5a5", key: "critical" },
  ].filter(item => item.value > 0);

  const total = distribution.healthy + distribution.attention + distribution.highRisk + distribution.critical;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full shadow-sm" 
              style={{ backgroundColor: item.payload.color }}
            />
            <p className="font-semibold text-sm">{item.name}</p>
          </div>
          <p className="text-lg font-bold" style={{ color: item.payload.color }}>
            {item.value} projetos ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (total === 0) {
    return (
      <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            Distribuição de Risco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum projeto com Health Score calculado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background via-background to-muted/20">
      {/* Background decorations */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-amber-500/5 to-transparent rounded-full blur-3xl" />
      
      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          Distribuição de Risco
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <motion.div 
          className="h-[180px]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`gradient-${entry.key}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={entry.lightColor} />
                    <stop offset="100%" stopColor={entry.color} />
                  </linearGradient>
                ))}
                <filter id="shadow3d" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.3" />
                </filter>
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                onClick={(data) => onSegmentClick?.(data.key)}
                className="cursor-pointer"
                stroke="none"
                filter="url(#shadow3d)"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#gradient-${entry.key})`}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
        
        {/* Legend with 3D badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {data.map((item, index) => (
            <motion.div 
              key={index}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 * index }}
            >
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-sm"
                style={{ 
                  background: `linear-gradient(135deg, ${item.lightColor}, ${item.color})` 
                }}
              />
              <span className="text-muted-foreground">{item.name.split(" ")[0]}</span>
            </motion.div>
          ))}
        </div>
        
        {/* Summary cards with glassmorphism */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <motion.div 
            className="relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-200/50"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative z-10 text-center">
              <div className="text-2xl font-bold bg-gradient-to-br from-rose-500 to-orange-500 bg-clip-text text-transparent">
                {distribution.critical + distribution.highRisk}
              </div>
              <div className="text-xs text-rose-600/80 font-medium">Em risco</div>
            </div>
          </motion.div>
          <motion.div 
            className="relative overflow-hidden p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/50"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative z-10 text-center">
              <div className="text-2xl font-bold bg-gradient-to-br from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                {distribution.healthy + distribution.attention}
              </div>
              <div className="text-xs text-emerald-600/80 font-medium">Estáveis</div>
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
