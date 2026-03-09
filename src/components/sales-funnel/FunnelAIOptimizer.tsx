import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Lightbulb, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Stage {
  id: string;
  name: string;
  stage_type: string;
  expected_conversion_rate: number | null;
  expected_avg_time_days: number | null;
  sort_order: number;
}

interface Connection {
  from_stage_id: string;
  to_stage_id: string;
}

interface Insight {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical" | "success";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funnelId: string;
  stages: Stage[];
  connections: Connection[];
}

export function FunnelAIOptimizer({ open, onOpenChange, funnelId, stages, connections }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-sales-funnel", {
        body: { funnelId, stages, connections },
      });

      if (error) throw error;
      setInsights(data?.insights || generateLocalInsights());
      setAnalyzed(true);
    } catch {
      // Fallback to local analysis
      setInsights(generateLocalInsights());
      setAnalyzed(true);
    } finally {
      setLoading(false);
    }
  };

  const generateLocalInsights = (): Insight[] => {
    const results: Insight[] = [];
    const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

    // Check for too many stages
    if (sorted.length > 8) {
      results.push({
        title: "Funil com muitas etapas",
        description: `O funil possui ${sorted.length} etapas. Considere simplificar para reduzir o ciclo de vendas e diminuir a perda de leads entre etapas.`,
        severity: "warning",
      });
    }

    // Check low conversions
    sorted.forEach((stage, idx) => {
      if (stage.expected_conversion_rate && stage.expected_conversion_rate < 20) {
        results.push({
          title: `Gargalo em "${stage.name}"`,
          description: `A taxa de conversão de ${stage.expected_conversion_rate}% está muito baixa. Revise os critérios desta etapa e considere melhorar a qualificação antes dela.`,
          severity: "critical",
        });
      }
    });

    // Check for missing conversion rates
    const withoutRate = sorted.filter(s => !s.expected_conversion_rate);
    if (withoutRate.length > 0) {
      results.push({
        title: "Etapas sem taxa de conversão",
        description: `${withoutRate.length} etapa(s) não possuem taxa de conversão definida: ${withoutRate.map(s => s.name).join(", ")}. Defina para melhor análise.`,
        severity: "info",
      });
    }

    // Check long stages
    sorted.forEach(stage => {
      if (stage.expected_avg_time_days && stage.expected_avg_time_days > 14) {
        results.push({
          title: `"${stage.name}" é muito lenta`,
          description: `O tempo médio de ${stage.expected_avg_time_days} dias nesta etapa pode estar esfriando os leads. Considere automações ou follow-ups mais frequentes.`,
          severity: "warning",
        });
      }
    });

    // Check for no post-sale
    if (!sorted.some(s => s.stage_type === "post_sale")) {
      results.push({
        title: "Sem etapa de pós-venda",
        description: "Adicione uma etapa de pós-venda para acompanhar a satisfação e gerar indicações.",
        severity: "info",
      });
    }

    if (results.length === 0) {
      results.push({
        title: "Funil bem estruturado!",
        description: "Não foram encontrados problemas significativos na estrutura do seu funil.",
        severity: "success",
      });
    }

    return results;
  };

  const severityConfig = {
    critical: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20", badge: "destructive" as const },
    warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950/20", badge: "secondary" as const },
    info: { icon: Lightbulb, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", badge: "secondary" as const },
    success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/20", badge: "default" as const },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            IA de Otimização de Funil
          </DialogTitle>
        </DialogHeader>

        {!analyzed ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p className="text-muted-foreground mb-4">
              A IA analisará a estrutura do seu funil, conversões, perdas e gargalos para gerar sugestões de otimização.
            </p>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              {loading ? "Analisando..." : "Analisar Funil"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{insights.length} sugestão(ões) encontrada(s)</p>
              <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reanalisar"}
              </Button>
            </div>
            {insights.map((insight, idx) => {
              const config = severityConfig[insight.severity];
              const Icon = config.icon;
              return (
                <Card key={idx} className={config.bg}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                      <div>
                        <p className="font-medium text-sm">{insight.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
