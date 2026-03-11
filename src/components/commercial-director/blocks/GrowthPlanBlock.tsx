import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GrowthAction {
  action: string;
  impact: string;
  description: string;
}

interface GrowthPlanBlockProps {
  growthPlan: GrowthAction[];
  projectId: string;
}

const IMPACT_COLORS: Record<string, string> = {
  alto: "bg-red-100 text-red-700",
  médio: "bg-yellow-100 text-yellow-700",
  baixo: "bg-green-100 text-green-700",
};

export const GrowthPlanBlock = ({ growthPlan, projectId }: GrowthPlanBlockProps) => {
  const createTask = async (action: GrowthAction) => {
    try {
      const { error } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        title: action.action,
        description: `[Diretor Comercial IA] ${action.description}\n\nImpacto: ${action.impact}`,
        status: "pending",
        sort_order: 999,
        is_internal: false,
      });
      if (error) throw error;
      toast.success(`Ação "${action.action}" criada como tarefa!`);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Plano de Crescimento Recomendado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {growthPlan.map((item, i) => (
            <div key={i} className="flex items-start gap-4 border rounded-lg p-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{item.action}</h4>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${IMPACT_COLORS[item.impact?.toLowerCase()] || "bg-muted text-muted-foreground"}`}>
                    Impacto {item.impact}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                onClick={() => createTask(item)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Criar ação
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
