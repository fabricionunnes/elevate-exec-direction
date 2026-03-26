import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  RefreshCw, Target, AlertTriangle, CheckCircle, ArrowRight,
  ShieldAlert, Calendar, User, Clock, Lightbulb, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LeadSummaryData } from "./useLeadSummary";

interface Props {
  data: LeadSummaryData | null;
  loading: boolean;
  onRegenerate: () => void;
}

const PHASE_NAMES: Record<number, string> = {
  1: "Rapport",
  2: "Expectativas",
  3: "Tomadores de Decisão",
  4: "A Razão (A Dor)",
  5: "Cavar (Aprofundar)",
  6: "Tentou (Tentativas)",
  7: "Situação Atual e Desejada",
  8: "Porquê (Motivação)",
  9: "Admissão",
  10: "Compromisso",
  11: "Fechamento Personalizado",
  12: "Preço",
};

export const LeadSummaryGuide = ({ data, loading, onRegenerate }: Props) => {
  if (loading) return <GuideSkeleton />;

  if (!data) return (
    <div className="p-6 text-center text-muted-foreground text-sm">
      Carregando guia de atendimento...
    </div>
  );

  const { ai, lead, meetings } = data;

  if (!ai || ai.error) {
    return (
      <div className="p-6 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
        <p className="text-sm text-muted-foreground">
          Ainda não há histórico suficiente para gerar o guia completo.<br />
          Registre a primeira reunião para ativar esta função.
        </p>
        <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const recommendedPhases = ai.recommended_phases || [];
  // Determine which phase numbers are recommended (not completed)
  const activePhaseNumbers = new Set(
    recommendedPhases.filter((p: any) => !p.is_completed).map((p: any) => p.phase_number)
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            🎯 Guia de Atendimento — {lead.name}
          </h3>
          <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerar Guia
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Etapa: {lead.current_stage || "—"}
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Responsável: {lead.owner || "—"}
          </span>
        </div>
      </div>

      {/* Briefing Pre-Reunião */}
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Briefing Pré-Reunião
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(ai.briefing_alerts || []).map((alert: string, i: number) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-amber-500 font-bold text-sm mt-0.5">⚠️</span>
                <p className="text-xs leading-relaxed">{alert}</p>
              </div>
            ))}
            {(!ai.briefing_alerts || ai.briefing_alerts.length === 0) && (
              <p className="text-xs text-muted-foreground">Sem alertas específicos para este lead.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fases Recomendadas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Fases do Roteiro
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-1">
            Fase atual identificada: <strong>Fase {ai.current_phase} — {ai.current_phase_name || PHASE_NAMES[ai.current_phase]}</strong>
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={recommendedPhases.filter((p: any) => !p.is_completed).map((p: any) => `phase-${p.phase_number}`)}>
            {recommendedPhases.map((phase: any) => {
              const isCompleted = phase.is_completed;
              const isActive = activePhaseNumbers.has(phase.phase_number);
              return (
                <AccordionItem
                  key={phase.phase_number}
                  value={`phase-${phase.phase_number}`}
                  className={cn(
                    "border rounded-lg mb-2 px-1",
                    isCompleted ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20" :
                    isActive ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20" :
                    "border-border"
                  )}
                >
                  <AccordionTrigger className="text-xs hover:no-underline py-2.5 px-2">
                    <div className="flex items-center gap-2 w-full pr-2">
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : isActive ? (
                        <ArrowRight className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-left">
                        FASE {phase.phase_number} — {phase.phase_name || PHASE_NAMES[phase.phase_number]}
                      </span>
                      {isCompleted && <Badge variant="secondary" className="text-[9px] h-4 ml-auto">Concluída</Badge>}
                      {isActive && <Badge className="text-[9px] h-4 ml-auto bg-amber-500">Recomendada</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2 pb-3">
                    <div className="space-y-3">
                      {phase.objective && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Objetivo</p>
                          <p className="text-xs">{phase.objective}</p>
                        </div>
                      )}

                      {phase.ai_insights?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">O que a IA encontrou</p>
                          <div className="space-y-1">
                            {phase.ai_insights.map((insight: string, i: number) => (
                              <div key={i} className="flex gap-2 items-start">
                                <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs">{insight}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {phase.suggested_scripts?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Scripts Sugeridos</p>
                          {phase.suggested_scripts.map((script: string, i: number) => (
                            <div key={i} className="rounded-lg bg-muted/50 p-2.5 mt-1.5 border-l-2 border-primary">
                              <p className="text-xs italic leading-relaxed">"{script}"</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {phase.tips?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Dicas</p>
                          <ul className="space-y-1">
                            {phase.tips.map((tip: string, i: number) => (
                              <li key={i} className="text-xs flex gap-1.5 items-start">
                                <span className="text-primary mt-0.5">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* O Que NÃO Fazer */}
      {ai.dont_do?.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              O Que NÃO Fazer Neste Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ai.dont_do.map((item: string, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-red-500 font-bold text-sm">❌</span>
                  <p className="text-xs">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Próximo Passo */}
      {ai.next_step && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              🎯 Próximo Passo Recomendado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Ação</p>
                <p className="text-xs font-medium mt-1">{ai.next_step.action}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Prazo</p>
                <p className="text-xs font-medium mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ai.next_step.deadline || "A definir"}
                </p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Responsável</p>
                <p className="text-xs font-medium mt-1">{ai.next_step.responsible || lead.owner || "—"}</p>
              </div>
            </div>
            {ai.next_step.ai_note && (
              <div className="mt-3 rounded-lg bg-muted/50 p-2.5 border-l-2 border-primary">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Observação da IA</p>
                <p className="text-xs">{ai.next_step.ai_note}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function GuideSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-4 w-80" />
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3].map(j => <Skeleton key={j} className="h-8 rounded-lg" />)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
