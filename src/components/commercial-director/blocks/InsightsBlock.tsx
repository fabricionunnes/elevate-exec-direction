import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface Insight {
  title: string;
  diagnosis: string;
  probable_cause: string;
  recommendation: string;
}

interface InsightsBlockProps {
  insights: Insight[];
}

export const InsightsBlock = ({ insights }: InsightsBlockProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Insights Automáticos da IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">#{i + 1}</span>
                {insight.title}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/30 rounded p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Diagnóstico</p>
                  <p>{insight.diagnosis}</p>
                </div>
                <div className="bg-muted/30 rounded p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Causa Provável</p>
                  <p>{insight.probable_cause}</p>
                </div>
                <div className="bg-primary/5 rounded p-3 border border-primary/10">
                  <p className="text-xs font-semibold text-primary mb-1">Recomendação</p>
                  <p>{insight.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
