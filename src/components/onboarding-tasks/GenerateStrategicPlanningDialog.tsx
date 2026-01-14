import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Check, Copy, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface CompanyData {
  id: string;
  name: string;
  segment: string | null;
  website: string | null;
  instagram: string | null;
  company_description: string | null;
  main_challenges: string | null;
  goals_short_term: string | null;
  goals_long_term: string | null;
  target_audience: string | null;
  competitors: string | null;
  sales_team_size: string | null;
  conversion_rate: string | null;
  average_ticket: string | null;
  acquisition_channels: string | null;
  has_structured_process: string | null;
  crm_usage: string | null;
  has_sales_goals: string | null;
  swot_strengths: string | null;
  swot_weaknesses: string | null;
  swot_opportunities: string | null;
  swot_threats: string | null;
  commercial_structure: string | null;
  growth_target: string | null;
  tools_used: string | null;
  objectives_with_unv: string | null;
  key_results: string | null;
  growth_expectation_3m: string | null;
  growth_expectation_6m: string | null;
  growth_expectation_12m: string | null;
}

interface GenerateStrategicPlanningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyData: CompanyData;
  projectId?: string;
  onTaskCreated?: () => void;
}

export const GenerateStrategicPlanningDialog = ({
  open,
  onOpenChange,
  companyData,
  projectId,
  onTaskCreated,
}: GenerateStrategicPlanningDialogProps) => {
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setContent("");
      setIsComplete(false);
      setTaskCreated(false);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  const handleGenerate = async () => {
    setGenerating(true);
    setContent("");
    setIsComplete(false);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategic-planning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            briefingData: companyData,
            companyName: companyData.name,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        }
        if (response.status === 402) {
          throw new Error("Créditos insuficientes. Por favor, adicione créditos à sua conta.");
        }
        throw new Error("Erro ao gerar planejamento estratégico");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            setIsComplete(true);
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              setContent((prev) => prev + deltaContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setIsComplete(true);
    } catch (error: any) {
      console.error("Error generating strategic planning:", error);
      toast.error(error.message || "Erro ao gerar planejamento estratégico");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Planejamento copiado para a área de transferência");
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-estrategico-${companyData.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Arquivo baixado com sucesso");
  };

  const handleCreateTask = async () => {
    if (!projectId) {
      toast.error("Projeto não encontrado");
      return;
    }

    setCreatingTask(true);
    try {
      // Get the project to find the product/service
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .select("product_id")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      let productId = project.product_id;

      // Check if product_id is a UUID or a name
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (productId && !uuidRegex.test(productId)) {
        // It's a name, fetch the actual UUID
        const { data: service, error: serviceError } = await supabase
          .from("onboarding_services")
          .select("id")
          .ilike("name", productId)
          .maybeSingle();

        if (serviceError) {
          console.error("Error fetching service by name:", serviceError);
        } else if (service) {
          productId = service.id;
        }
      }

      if (!productId) {
        toast.error("Produto não encontrado para o projeto");
        return;
      }

      // Find or create a phase for strategic planning
      let phaseId: string | null = null;

      // Check if there's a phase with "planejamento" in the name
      const { data: existingPhases, error: phasesError } = await supabase
        .from("onboarding_service_phases")
        .select("id, name")
        .eq("service_id", productId)
        .ilike("name", "%planejamento%")
        .limit(1);

      if (phasesError) throw phasesError;

      if (existingPhases && existingPhases.length > 0) {
        phaseId = existingPhases[0].id;
      } else {
        // Get the max sort_order for this service
        const { data: maxOrderData } = await supabase
          .from("onboarding_service_phases")
          .select("sort_order")
          .eq("service_id", productId)
          .order("sort_order", { ascending: false })
          .limit(1);

        const nextOrder = (maxOrderData?.[0]?.sort_order || 0) + 1;

        // Create a new phase for strategic planning
        const { data: newPhase, error: createPhaseError } = await supabase
          .from("onboarding_service_phases")
          .insert({
            service_id: productId,
            name: "Planejamento Estratégico",
            description: "Fase de planejamento estratégico comercial",
            sort_order: nextOrder,
          })
          .select()
          .single();

        if (createPhaseError) throw createPhaseError;
        phaseId = newPhase.id;
      }

      // Create the task
      const { error: taskError } = await supabase.from("onboarding_tasks").insert({
        project_id: projectId,
        phase_id: phaseId,
        title: "Planejamento Estratégico",
        description: content,
        status: "pending",
        priority: "high",
      });

      if (taskError) throw taskError;

      setTaskCreated(true);
      toast.success("Tarefa 'Planejamento Estratégico' criada com sucesso!");
      onTaskCreated?.();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Planejamento Estratégico - {companyData.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {!content && !generating ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <FileText className="h-16 w-16 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-center max-w-md">
                Clique no botão abaixo para gerar o planejamento estratégico com base nos dados do briefing da empresa.
              </p>
              <Button onClick={handleGenerate} size="lg" className="mt-4">
                <FileText className="h-4 w-4 mr-2" />
                Gerar Planejamento Estratégico
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 border rounded-lg p-4" ref={scrollRef}>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  <ReactMarkdown>{content || "Gerando..."}</ReactMarkdown>
                </div>
                {generating && (
                  <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Gerando planejamento...</span>
                  </div>
                )}
              </ScrollArea>

              {isComplete && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </Button>
                  {projectId && !taskCreated && (
                    <Button size="sm" onClick={handleCreateTask} disabled={creatingTask}>
                      {creatingTask ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Criar Tarefa na Jornada
                        </>
                      )}
                    </Button>
                  )}
                  {taskCreated && (
                    <span className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Tarefa criada!
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
                    Gerar Novamente
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
