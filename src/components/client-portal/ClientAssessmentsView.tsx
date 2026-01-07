import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AssessmentReportSheet } from "@/components/assessments/AssessmentReportSheet";

interface ClientAssessmentsViewProps {
  projectId: string;
}

interface Cycle {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
}

interface DISCResponse {
  id: string;
  respondent_name: string;
  primary_profile: string | null;
  secondary_profile: string | null;
  dominance_score: number;
  influence_score: number;
  steadiness_score: number;
  conscientiousness_score: number;
}

interface Evaluation360 {
  id: string;
  evaluator_name: string;
  relationship: string;
  leadership_score: number | null;
  communication_score: number | null;
  teamwork_score: number | null;
  proactivity_score: number | null;
  results_delivery_score: number | null;
  conflict_management_score: number | null;
  strengths: string | null;
  improvements: string | null;
  additional_comments: string | null;
}

export function ClientAssessmentsView({ projectId }: ClientAssessmentsViewProps) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  useEffect(() => {
    fetchCycles();
  }, [projectId]);

  const fetchCycles = async () => {
    try {
      const { data, error } = await supabase
        .from("assessment_cycles")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCycles(data || []);
    } catch (error) {
      console.error("Error fetching cycles:", error);
    } finally {
      setLoading(false);
    }
  };

  const openReports = (cycle: Cycle) => {
    setSelectedCycle(cycle);
    setIsReportsOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma avaliação disponível</h3>
          <p className="text-sm text-muted-foreground">
            Quando houver ciclos de avaliação para seu projeto, eles aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        Avaliações
      </h2>

      <div className="grid gap-3">
        {cycles.map((cycle) => (
          <Card 
            key={cycle.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openReports(cycle)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={cycle.type === "disc" ? "default" : "secondary"}>
                      {cycle.type === "disc" ? "DISC" : "360°"}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={
                        cycle.status === "active" 
                          ? "border-green-500 text-green-600" 
                          : "border-muted"
                      }
                    >
                      {cycle.status === "active" ? "Ativo" : "Encerrado"}
                    </Badge>
                  </div>
                  <h3 className="font-medium truncate">{cycle.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Criado em {format(new Date(cycle.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reports Sheet */}
      {selectedCycle && (
        <AssessmentReportSheet
          open={isReportsOpen}
          onOpenChange={setIsReportsOpen}
          cycleId={selectedCycle.id}
          cycleTitle={selectedCycle.title}
        />
      )}
    </div>
  );
}
