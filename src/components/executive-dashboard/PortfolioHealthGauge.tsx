import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

interface PortfolioHealthGaugeProps {
  score: number;
  previousScore?: number;
  totalProjects: number;
}

export function PortfolioHealthGauge({ score, previousScore, totalProjects }: PortfolioHealthGaugeProps) {
  const getScoreColor = (value: number) => {
    if (value >= 80) return "#22c55e"; // green
    if (value >= 60) return "#eab308"; // yellow
    if (value >= 40) return "#f97316"; // orange
    return "#ef4444"; // red
  };

  const getScoreLabel = (value: number) => {
    if (value >= 80) return "Saudável";
    if (value >= 60) return "Atenção";
    if (value >= 40) return "Alto Risco";
    return "Crítico";
  };

  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  
  // Calculate rotation for gauge needle (0-180 degrees)
  const rotation = (score / 100) * 180;
  
  const trend = previousScore !== undefined ? score - previousScore : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Saúde do Portfólio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Gauge visualization */}
          <div className="relative w-48 h-24 mb-4">
            {/* Background arc */}
            <svg className="w-full h-full" viewBox="0 0 100 50">
              {/* Gradient arcs for different zones */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Critical zone (0-40) */}
              <path
                d="M 10 50 A 40 40 0 0 1 26 22"
                fill="none"
                stroke="#ef4444"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.3"
              />
              {/* High risk zone (40-60) */}
              <path
                d="M 26 22 A 40 40 0 0 1 50 10"
                fill="none"
                stroke="#f97316"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.3"
              />
              {/* Attention zone (60-80) */}
              <path
                d="M 50 10 A 40 40 0 0 1 74 22"
                fill="none"
                stroke="#eab308"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.3"
              />
              {/* Healthy zone (80-100) */}
              <path
                d="M 74 22 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#22c55e"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.3"
              />
              {/* Needle */}
              <g transform={`rotate(${rotation - 90}, 50, 50)`}>
                <line
                  x1="50"
                  y1="50"
                  x2="50"
                  y2="15"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="50" cy="50" r="5" fill={color} />
              </g>
            </svg>
          </div>

          {/* Score display */}
          <div className="text-center">
            <div className="text-4xl font-bold" style={{ color }}>
              {score.toFixed(0)}
            </div>
            <div className="text-sm font-medium" style={{ color }}>
              {label}
            </div>
            {previousScore !== undefined && (
              <div className={`text-xs mt-1 ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                {trend >= 0 ? "+" : ""}{trend.toFixed(1)} vs mês anterior
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              Baseado em {totalProjects} projetos ativos
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
