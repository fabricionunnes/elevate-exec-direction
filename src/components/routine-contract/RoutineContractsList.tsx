import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { generateRoutinePDF } from "./RoutinePDFGenerator";
import { toast } from "sonner";

interface Props {
  projectId: string;
  isAdmin: boolean;
  selectedContractId?: string | null;
}

interface RoutineTask {
  time?: string;
  task: string;
  priority?: string;
}

interface Indicator {
  name: string;
  target: string;
  frequency: string;
}

export const RoutineContractsList = ({ projectId, isAdmin }: Props) => {
  const [viewingContract, setViewingContract] = useState<any | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["routine-contracts", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_contracts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleGeneratePDF = async (contract: any) => {
    setGeneratingPdf(contract.id);
    try {
      await generateRoutinePDF(contract);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (!contracts?.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Nenhum contrato gerado ainda. Use a aba "Ajuste IA" para criar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract) => (
        <Card key={contract.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-medium">{contract.employee_name}</p>
                <p className="text-sm text-muted-foreground">
                  {contract.employee_role || "Sem cargo"} • {contract.employee_department || "Sem setor"} •{" "}
                  {format(new Date(contract.created_at), "dd/MM/yyyy")}
                </p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={contract.status === "final" ? "default" : "secondary"}>
                    {contract.status === "final" ? "Final" : "Rascunho"}
                  </Badge>
                  {contract.generated_by_ai && <Badge variant="outline">IA</Badge>}
                  <Badge variant="outline">v{contract.version_number}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewingContract(contract)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Ver
                </Button>
                <Button size="sm" onClick={() => handleGeneratePDF(contract)} disabled={generatingPdf === contract.id}>
                  {generatingPdf === contract.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* View Contract Dialog */}
      <Dialog open={!!viewingContract} onOpenChange={() => setViewingContract(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato de Rotina — {viewingContract?.employee_name}</DialogTitle>
          </DialogHeader>
          {viewingContract && (
            <div className="space-y-6 text-sm">
              <div>
                <h4 className="font-semibold mb-1">Dados</h4>
                <p>Cargo: {viewingContract.employee_role || "—"}</p>
                <p>Setor: {viewingContract.employee_department || "—"}</p>
                <p>Responsável: {viewingContract.direct_manager || "—"}</p>
              </div>

              {viewingContract.introduction && (
                <div>
                  <h4 className="font-semibold mb-1">Introdução</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">{viewingContract.introduction}</p>
                </div>
              )}

              {(viewingContract.daily_routine as RoutineTask[])?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Rotina Diária</h4>
                  <div className="space-y-1">
                    {(viewingContract.daily_routine as RoutineTask[]).map((t: RoutineTask, i: number) => (
                      <div key={i} className="flex gap-2">
                        {t.time && <span className="text-muted-foreground w-14">{t.time}</span>}
                        <span>{t.task}</span>
                        {t.priority && <Badge variant="outline" className="text-xs">{t.priority}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(viewingContract.weekly_routine as RoutineTask[])?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Rotina Semanal</h4>
                  <div className="space-y-1">
                    {(viewingContract.weekly_routine as RoutineTask[]).map((t: RoutineTask, i: number) => (
                      <div key={i} className="flex gap-2">
                        {t.time && <span className="text-muted-foreground w-20">{t.time}</span>}
                        <span>{t.task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(viewingContract.performance_indicators as Indicator[])?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Indicadores de Performance</h4>
                  <div className="space-y-1">
                    {(viewingContract.performance_indicators as Indicator[]).map((ind: Indicator, i: number) => (
                      <div key={i} className="flex gap-3">
                        <span className="font-medium">{ind.name}</span>
                        <span className="text-muted-foreground">Meta: {ind.target}</span>
                        <span className="text-muted-foreground">({ind.frequency})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingContract.responsibilities && (
                <div>
                  <h4 className="font-semibold mb-1">Responsabilidades</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">{viewingContract.responsibilities}</p>
                </div>
              )}

              {viewingContract.observations && (
                <div>
                  <h4 className="font-semibold mb-1">Observações</h4>
                  <p className="whitespace-pre-wrap text-muted-foreground">{viewingContract.observations}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
