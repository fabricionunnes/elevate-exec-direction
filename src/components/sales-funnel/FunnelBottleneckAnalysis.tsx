import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, AlertCircle, CheckCircle2, TrendingDown, Clock } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  expected_conversion_rate: number | null;
  expected_avg_time_days: number | null;
  sort_order: number;
}

interface Connection {
  from_stage_id: string;
  to_stage_id: string;
  conversion_rate: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
  connections: Connection[];
}

export function FunnelBottleneckAnalysis({ open, onOpenChange, stages, connections }: Props) {
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  const getStatus = (rate: number | null): { status: "critical" | "warning" | "healthy"; label: string; color: string } => {
    if (!rate) return { status: "healthy", label: "Sem dados", color: "text-muted-foreground" };
    if (rate < 20) return { status: "critical", label: "🔴 Gargalo crítico", color: "text-red-500" };
    if (rate < 50) return { status: "warning", label: "🟡 Atenção", color: "text-yellow-500" };
    return { status: "healthy", label: "🟢 Saudável", color: "text-green-500" };
  };

  const slowestStage = sortedStages.reduce<Stage | null>((prev, curr) => {
    if (!curr.expected_avg_time_days) return prev;
    if (!prev || !prev.expected_avg_time_days) return curr;
    return curr.expected_avg_time_days > prev.expected_avg_time_days ? curr : prev;
  }, null);

  const worstConversion = sortedStages.reduce<Stage | null>((prev, curr) => {
    if (!curr.expected_conversion_rate) return prev;
    if (!prev || !prev.expected_conversion_rate) return curr;
    return curr.expected_conversion_rate < prev.expected_conversion_rate ? curr : prev;
  }, null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Mapa de Gargalos
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {worstConversion && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-medium text-red-600">Menor conversão</span>
                </div>
                <p className="font-semibold text-sm">{worstConversion.name}</p>
                <p className="text-xs text-red-500">{worstConversion.expected_conversion_rate}%</p>
              </CardContent>
            </Card>
          )}
          {slowestStage && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium text-yellow-600">Mais lenta</span>
                </div>
                <p className="font-semibold text-sm">{slowestStage.name}</p>
                <p className="text-xs text-yellow-500">{slowestStage.expected_avg_time_days} dias</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stage Analysis */}
        <div className="space-y-3">
          {sortedStages.map((stage, idx) => {
            const { status, label, color } = getStatus(stage.expected_conversion_rate);
            return (
              <Card key={stage.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                      <span className="font-medium text-sm">{stage.name}</span>
                    </div>
                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Taxa de conversão</p>
                      <div className="flex items-center gap-2">
                        <Progress value={stage.expected_conversion_rate || 0} className="h-2 flex-1" />
                        <span className="text-xs font-medium">{stage.expected_conversion_rate || "—"}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tempo médio</p>
                      <span className="text-sm font-medium">{stage.expected_avg_time_days || "—"} dias</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {sortedStages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Adicione etapas com taxas de conversão para ver a análise de gargalos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
