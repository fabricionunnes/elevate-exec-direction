import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, Sparkles, Loader2, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { InstagramInsight } from "../types";

interface InstagramInsightsProps {
  accountId: string;
  projectId: string;
}

export const InstagramInsights = ({ accountId, projectId }: InstagramInsightsProps) => {
  const [insights, setInsights] = useState<InstagramInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      const { data } = await supabase
        .from("instagram_insights_ai")
        .select("*")
        .eq("account_id", accountId)
        .order("generated_at", { ascending: false })
        .limit(20);
      setInsights((data || []) as InstagramInsight[]);
      setLoading(false);
    };
    fetchInsights();
  }, [accountId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: genData, error } = await supabase.functions.invoke("instagram-project-oauth", {
        body: { action: "generate_insights", accountId, projectId },
      });
      if (error) throw error;
      if (genData?.error) throw new Error(genData.error);
      if (!genData?.success) throw new Error(genData?.error || "Erro desconhecido");
      toast.success(`${genData.count || 0} insights gerados com sucesso!`);
      // Refetch
      const { data } = await supabase
        .from("instagram_insights_ai")
        .select("*")
        .eq("account_id", accountId)
        .order("generated_at", { ascending: false })
        .limit(20);
      setInsights((data || []) as InstagramInsight[]);
    } catch (err) {
      toast.error("Erro ao gerar insights");
    } finally {
      setGenerating(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === "high") return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (priority === "medium") return <TrendingUp className="h-4 w-4 text-amber-500" />;
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">IA de Insights do Instagram</h3>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar Insights
        </Button>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum insight gerado ainda.</p>
            <p className="text-sm text-muted-foreground/70 mb-4">Clique em "Gerar Insights" para analisar as métricas do perfil.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight) => (
            <Card key={insight.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getPriorityIcon(insight.priority)}
                  {insight.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {new Date(insight.generated_at).toLocaleDateString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
