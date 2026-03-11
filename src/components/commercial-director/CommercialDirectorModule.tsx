import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, RefreshCw, History } from "lucide-react";
import { DiagnosisBlock } from "./blocks/DiagnosisBlock";
import { RadarBlock } from "./blocks/RadarBlock";
import { InsightsBlock } from "./blocks/InsightsBlock";
import { GrowthPlanBlock } from "./blocks/GrowthPlanBlock";
import { SimulatorBlock } from "./blocks/SimulatorBlock";
import { ForecastBlock } from "./blocks/ForecastBlock";
import { PrioritiesBlock } from "./blocks/PrioritiesBlock";
import { AnalysisHistoryBlock } from "./blocks/AnalysisHistoryBlock";

interface CommercialDirectorModuleProps {
  projectId: string;
  companyId: string;
  companyName?: string;
}

export interface AnalysisData {
  id?: string;
  created_at?: string;
  commercial_score: number;
  score_classification: string;
  diagnosis: Record<string, { status: string; detail: string }>;
  radar: Array<{
    area: string;
    status: "green" | "yellow" | "red";
    explanation: string;
    analysis: string;
    causes: string;
    recommendation: string;
  }>;
  insights: Array<{
    title: string;
    diagnosis: string;
    probable_cause: string;
    recommendation: string;
  }>;
  growth_plan: Array<{
    action: string;
    impact: string;
    description: string;
  }>;
  priorities: Array<{
    rank: number;
    title: string;
    reason: string;
  }>;
  forecast: {
    current_month_forecast: number;
    goal_probability: number;
    analysis: string;
  };
}

export const CommercialDirectorModule = ({
  projectId,
  companyId,
  companyName,
}: CommercialDirectorModuleProps) => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Load latest analysis on mount
  useEffect(() => {
    loadLatestAnalysis();
  }, [projectId]);

  const loadLatestAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from("commercial_director_analyses")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAnalysis({
          id: data.id,
          created_at: data.created_at,
          commercial_score: data.commercial_score || 0,
          score_classification: data.score_classification || "",
          diagnosis: (data.diagnosis as any) || {},
          radar: (data.radar as any) || [],
          insights: (data.insights as any) || [],
          growth_plan: (data.growth_plan as any) || [],
          priorities: (data.priorities as any) || [],
          forecast: (data.forecast as any) || {},
        });
      }
    } catch (error) {
      console.error("Error loading analysis:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("commercial-director-analysis", {
        body: { companyId, projectId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data);
      toast.success("Análise gerada com sucesso!");
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      toast.error(error.message || "Erro ao gerar análise");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Diretor Comercial IA
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Análise estratégica inteligente baseada nos seus indicadores
          </p>
          {analysis?.created_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Última análise: {new Date(analysis.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Button>
          <Button onClick={generateAnalysis} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Análise do Diretor Comercial IA
              </>
            )}
          </Button>
        </div>
      </div>

      {showHistory && (
        <AnalysisHistoryBlock
          projectId={projectId}
          onSelectAnalysis={(a) => {
            setAnalysis(a);
            setShowHistory(false);
          }}
        />
      )}

      {!analysis ? (
        <div className="text-center py-20 space-y-4">
          <Brain className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <div>
            <h3 className="text-lg font-semibold">Nenhuma análise realizada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Gerar Análise" para que o Diretor Comercial IA analise seus indicadores.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Block 1: Diagnosis */}
          <DiagnosisBlock
            diagnosis={analysis.diagnosis}
            score={analysis.commercial_score}
            classification={analysis.score_classification}
          />

          {/* Block 2: Radar */}
          <RadarBlock radar={analysis.radar} />

          {/* Block 3: Insights */}
          <InsightsBlock insights={analysis.insights} />

          {/* Block 4: Growth Plan */}
          <GrowthPlanBlock
            growthPlan={analysis.growth_plan}
            projectId={projectId}
          />

          {/* Block 5: Simulator */}
          <SimulatorBlock companyId={companyId} />

          {/* Block 6: Forecast */}
          <ForecastBlock forecast={analysis.forecast} />

          {/* Block 7: Priorities */}
          <PrioritiesBlock priorities={analysis.priorities} />
        </div>
      )}
    </div>
  );
};
