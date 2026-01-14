import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Check, Copy, Download, Target, TrendingUp, ListChecks } from "lucide-react";

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

// Parse the content into structured sections
const parseContent = (content: string) => {
  const sections = {
    resumo: "",
    swot: {
      forcas: [] as string[],
      fraquezas: [] as string[],
      oportunidades: [] as string[],
      ameacas: [] as string[],
    },
    cronograma: [] as { title: string; subactions: string[] }[],
  };

  // Split by blocks
  const lines = content.split("\n");
  let currentSection = "";
  let currentSwotQuadrant = "";
  let currentAction: { title: string; subactions: string[] } | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Detect main blocks
    if (trimmedLine.includes("BLOCO 1") || trimmedLine.includes("RESUMO COMPLETO")) {
      currentSection = "resumo";
      continue;
    }
    if (trimmedLine.includes("BLOCO 2") || trimmedLine.includes("ANÁLISE SWOT")) {
      currentSection = "swot";
      continue;
    }
    if (trimmedLine.includes("BLOCO 3") || trimmedLine.includes("CRONOGRAMA")) {
      currentSection = "cronograma";
      continue;
    }

    // Handle SWOT quadrants
    if (currentSection === "swot") {
      if (trimmedLine === "FORÇAS" || trimmedLine.startsWith("FORÇAS")) {
        currentSwotQuadrant = "forcas";
        continue;
      }
      if (trimmedLine === "FRAQUEZAS" || trimmedLine.startsWith("FRAQUEZAS")) {
        currentSwotQuadrant = "fraquezas";
        continue;
      }
      if (trimmedLine === "OPORTUNIDADES" || trimmedLine.startsWith("OPORTUNIDADES")) {
        currentSwotQuadrant = "oportunidades";
        continue;
      }
      if (trimmedLine === "AMEAÇAS" || trimmedLine.startsWith("AMEAÇAS")) {
        currentSwotQuadrant = "ameacas";
        continue;
      }

      // Add items to current quadrant
      if (currentSwotQuadrant && trimmedLine.match(/^\d+\./)) {
        const item = trimmedLine.replace(/^\d+\.\s*/, "");
        if (item && currentSwotQuadrant in sections.swot) {
          (sections.swot as any)[currentSwotQuadrant].push(item);
        }
      }
    }

    // Handle resumo
    if (currentSection === "resumo") {
      if (trimmedLine) {
        sections.resumo += line + "\n";
      }
    }

    // Handle cronograma
    if (currentSection === "cronograma") {
      // Check if it's a main action (numbered)
      const mainActionMatch = trimmedLine.match(/^(\d+)\.\s*(.+)/);
      if (mainActionMatch) {
        if (currentAction) {
          sections.cronograma.push(currentAction);
        }
        currentAction = { title: mainActionMatch[2], subactions: [] };
      } else if (currentAction && trimmedLine && !trimmedLine.match(/^BLOCO/)) {
        // It's a subaction
        const subaction = trimmedLine.replace(/^[-•]\s*/, "").replace(/^[a-z]\)\s*/, "");
        if (subaction) {
          currentAction.subactions.push(subaction);
        }
      }
    }
  }

  // Push last action
  if (currentAction) {
    sections.cronograma.push(currentAction);
  }

  return sections;
};

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
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .select("product_id")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      let productId = project.product_id;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (productId && !uuidRegex.test(productId)) {
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

      let phaseId: string | null = null;

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
        const { data: maxOrderData } = await supabase
          .from("onboarding_service_phases")
          .select("sort_order")
          .eq("service_id", productId)
          .order("sort_order", { ascending: false })
          .limit(1);

        const nextOrder = (maxOrderData?.[0]?.sort_order || 0) + 1;

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

  const parsedContent = isComplete ? parseContent(content) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Planejamento Estratégico - {companyData.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
          {!content && !generating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <FileText className="h-16 w-16 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-center max-w-md">
                Clique no botão abaixo para gerar o planejamento estratégico com base nos dados do briefing da empresa.
              </p>
              <Button onClick={handleGenerate} size="lg" className="mt-4">
                <FileText className="h-4 w-4 mr-2" />
                Gerar Planejamento Estratégico
              </Button>
            </div>
          ) : isComplete && parsedContent ? (
            <div className="p-6 space-y-6">
              {/* Resumo Section */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Resumo da Empresa</h3>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                    {parsedContent.resumo.trim()}
                  </pre>
                </div>
              </div>

              {/* SWOT Section */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Análise SWOT</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Forças */}
                    <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4">
                      <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Forças
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.forcas.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-green-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Fraquezas */}
                    <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-4">
                      <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Fraquezas
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.fraquezas.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Oportunidades */}
                    <div className="rounded-lg border-2 border-blue-500/30 bg-blue-500/5 p-4">
                      <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Oportunidades
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.oportunidades.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-blue-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Ameaças */}
                    <div className="rounded-lg border-2 border-orange-500/30 bg-orange-500/5 p-4">
                      <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Ameaças
                      </h4>
                      <ol className="space-y-2 text-sm">
                        {parsedContent.swot.ameacas.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-orange-600 font-medium shrink-0">{i + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cronograma Section */}
              <div className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Cronograma de Ações</h3>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    {parsedContent.cronograma.map((action, i) => (
                      <div key={i} className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{action.title}</h4>
                            {action.subactions.length > 0 && (
                              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                {action.subactions.map((sub, j) => (
                                  <li key={j} className="flex items-start gap-2">
                                    <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                    <span>{sub}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-lg border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {content || "Gerando..."}
                </pre>
                {generating && (
                  <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Gerando planejamento...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {(isComplete || generating) && (
          <div className="shrink-0 flex flex-wrap gap-2 p-4 border-t bg-muted/30">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!isComplete}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!isComplete}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            {projectId && !taskCreated && (
              <Button size="sm" onClick={handleCreateTask} disabled={creatingTask || !isComplete}>
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
      </DialogContent>
    </Dialog>
  );
};
