import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Stethoscope } from "lucide-react";

interface DiagnosisBlockProps {
  diagnosis: Record<string, { status: string; detail: string }>;
  score: number;
  classification: string;
}

const STATUS_COLORS: Record<string, string> = {
  adequado: "text-green-600 bg-green-50",
  alto: "text-green-600 bg-green-50",
  alta: "text-green-600 bg-green-50",
  acelerado: "text-green-600 bg-green-50",
  "abaixo do ideal": "text-yellow-600 bg-yellow-50",
  médio: "text-yellow-600 bg-yellow-50",
  média: "text-yellow-600 bg-yellow-50",
  moderada: "text-yellow-600 bg-yellow-50",
  estável: "text-yellow-600 bg-yellow-50",
  desacelerando: "text-red-600 bg-red-50",
  crítico: "text-red-600 bg-red-50",
  baixo: "text-red-600 bg-red-50",
  baixa: "text-red-600 bg-red-50",
};

const LABELS: Record<string, string> = {
  lead_generation: "Geração de Leads",
  sales_conversion: "Conversão de Vendas",
  average_ticket: "Ticket Médio",
  revenue_growth: "Crescimento de Receita",
  sales_predictability: "Previsibilidade de Vendas",
  commercial_efficiency: "Eficiência Comercial",
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 30) return "text-yellow-600";
  return "text-red-600";
};

const getProgressColor = (score: number) => {
  if (score >= 80) return "[&>div]:bg-green-500";
  if (score >= 60) return "[&>div]:bg-blue-500";
  if (score >= 30) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
};

export const DiagnosisBlock = ({ diagnosis, score, classification }: DiagnosisBlockProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Stethoscope className="h-5 w-5 text-primary" />
          Diagnóstico Comercial da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score */}
        <div className="bg-muted/30 rounded-xl p-6 text-center space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Score Comercial da Empresa</p>
          <p className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</p>
          <Progress value={score} className={`h-3 max-w-xs mx-auto ${getProgressColor(score)}`} />
          <p className="text-sm font-semibold capitalize">{classification}</p>
          <div className="flex justify-center gap-4 text-[10px] text-muted-foreground mt-2">
            <span>0-30: Desestruturada</span>
            <span>30-60: Inicial</span>
            <span>60-80: Organizada</span>
            <span>80-100: Estruturada</span>
          </div>
        </div>

        {/* Diagnosis items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(diagnosis).map(([key, value]) => {
            const statusClass = STATUS_COLORS[value.status?.toLowerCase()] || "text-muted-foreground bg-muted/50";
            return (
              <div key={key} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{LABELS[key] || key}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}`}>
                    {value.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{value.detail}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
