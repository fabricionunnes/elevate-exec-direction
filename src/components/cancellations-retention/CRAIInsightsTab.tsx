import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Brain, Lightbulb, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  projects: any[];
  companies: any[];
  retentionAttempts: any[];
}

export function CRAIInsightsTab({ projects, companies, retentionAttempts }: Props) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const cancelled = projects.filter(p => p.status === "closed" && p.churn_date);
      const active = companies.filter(c => c.status === "active");
      const inNotice = projects.filter(p => p.status === "cancellation_signaled" || p.status === "notice_period");

      // Build summary data
      const reasonCounts: Record<string, number> = {};
      cancelled.forEach(p => {
        const r = p.churn_reason || "não_informado";
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      });

      const segmentCounts: Record<string, { churned: number; active: number }> = {};
      companies.forEach(c => {
        const seg = c.segment || "sem_segmento";
        if (!segmentCounts[seg]) segmentCounts[seg] = { churned: 0, active: 0 };
        if (c.status === "active") segmentCounts[seg].active++;
        else segmentCounts[seg].churned++;
      });

      const consultantData: Record<string, { churned: number; retained: number }> = {};
      cancelled.forEach(p => {
        const name = p.consultant_name || p.cs_name || "sem_consultor";
        if (!consultantData[name]) consultantData[name] = { churned: 0, retained: 0 };
        consultantData[name].churned++;
      });
      retentionAttempts.filter(r => r.result === "retained").forEach(r => {
        const name = r.staff_name || "sem_consultor";
        if (!consultantData[name]) consultantData[name] = { churned: 0, retained: 0 };
        consultantData[name].retained++;
      });

      const summaryData = {
        total_active: active.length,
        total_cancelled: cancelled.length,
        in_notice: inNotice.length,
        retention_attempts: retentionAttempts.length,
        retained: retentionAttempts.filter(r => r.result === "retained").length,
        reasons: reasonCounts,
        segments: segmentCounts,
        consultants: consultantData,
      };

      const { data, error: fnError } = await supabase.functions.invoke("retention-ai-insights", {
        body: { summaryData },
      });

      if (fnError) throw fnError;
      setInsights(data?.insights || "Sem insights disponíveis.");
    } catch (err: any) {
      console.error(err);
      setError("Erro ao gerar insights: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">IA de Retenção UNV</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Análise inteligente de padrões de cancelamento e oportunidades de retenção
                </p>
              </div>
            </div>
            <Button onClick={generateInsights} disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando...</>
              ) : insights ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Reanalisar</>
              ) : (
                <><Lightbulb className="h-4 w-4 mr-2" /> Gerar Insights</>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Analisando dados de cancelamento e retenção...</p>
          </div>
        </div>
      )}

      {insights && !loading && (
        <Card>
          <CardContent className="p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {!insights && !loading && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Clique em "Gerar Insights" para começar</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A IA analisará os dados de cancelamento, retenção, segmentos e consultores para gerar
              recomendações estratégicas personalizadas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
