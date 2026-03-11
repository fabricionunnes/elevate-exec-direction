import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface ForecastBlockProps {
  forecast: {
    current_month_forecast: number;
    goal_probability: number;
    analysis: string;
  };
}

export const ForecastBlock = ({ forecast }: ForecastBlockProps) => {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const probColor =
    forecast.goal_probability >= 70 ? "text-green-600" :
    forecast.goal_probability >= 40 ? "text-yellow-600" : "text-red-600";

  const probBg =
    forecast.goal_probability >= 70 ? "[&>div]:bg-green-500" :
    forecast.goal_probability >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-blue-600" />
          Previsão de Faturamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-muted/30 rounded-xl p-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground">Previsão do Mês Atual</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(forecast.current_month_forecast)}
            </p>
          </div>
          <div className="bg-muted/30 rounded-xl p-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground">Probabilidade de Atingir a Meta</p>
            <p className={`text-3xl font-bold ${probColor}`}>{forecast.goal_probability}%</p>
            <Progress value={forecast.goal_probability} className={`h-2 ${probBg}`} />
          </div>
        </div>
        {forecast.analysis && (
          <p className="text-sm text-muted-foreground mt-4 bg-muted/20 rounded-lg p-4">
            {forecast.analysis}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
