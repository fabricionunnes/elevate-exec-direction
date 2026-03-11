import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock } from "lucide-react";
import type { AnalysisData } from "../CommercialDirectorModule";

interface AnalysisHistoryBlockProps {
  projectId: string;
  onSelectAnalysis: (analysis: AnalysisData) => void;
}

export const AnalysisHistoryBlock = ({ projectId, onSelectAnalysis }: AnalysisHistoryBlockProps) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [projectId]);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("commercial_director_analyses")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) setHistory(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Histórico de Análises
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma análise anterior encontrada.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() =>
                  onSelectAnalysis({
                    id: item.id,
                    created_at: item.created_at,
                    commercial_score: item.commercial_score || 0,
                    score_classification: item.score_classification || "",
                    diagnosis: item.diagnosis || {},
                    radar: item.radar || [],
                    insights: item.insights || [],
                    growth_plan: item.growth_plan || [],
                    priorities: item.priorities || [],
                    forecast: item.forecast || {},
                  })
                }
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(item.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score: {item.commercial_score} — {item.score_classification}
                  </p>
                </div>
                <Button variant="ghost" size="sm">Ver</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
