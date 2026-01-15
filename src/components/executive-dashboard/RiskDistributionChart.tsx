import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { AlertTriangle } from "lucide-react";

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
    { name: "Saudável (80-100)", value: distribution.healthy, color: "#22c55e", key: "healthy" },
    { name: "Atenção (60-79)", value: distribution.attention, color: "#eab308", key: "attention" },
    { name: "Alto Risco (40-59)", value: distribution.highRisk, color: "#f97316", key: "highRisk" },
    { name: "Crítico (0-39)", value: distribution.critical, color: "#ef4444", key: "critical" },
  ].filter(item => item.value > 0);

  const total = distribution.healthy + distribution.attention + distribution.highRisk + distribution.critical;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium" style={{ color: item.payload.color }}>{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {item.value} projetos ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Distribuição de Risco
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                onClick={(data) => onSegmentClick?.(data.key)}
                className="cursor-pointer"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value, entry: any) => (
                  <span className="text-xs">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 text-center">
          <div className="p-2 rounded bg-red-50 border border-red-200">
            <div className="text-2xl font-bold text-red-600">
              {distribution.critical + distribution.highRisk}
            </div>
            <div className="text-xs text-red-600">Em risco</div>
          </div>
          <div className="p-2 rounded bg-green-50 border border-green-200">
            <div className="text-2xl font-bold text-green-600">
              {distribution.healthy + distribution.attention}
            </div>
            <div className="text-xs text-green-600">Estáveis</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
