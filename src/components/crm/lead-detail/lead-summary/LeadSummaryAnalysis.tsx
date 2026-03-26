import { useState, useEffect } from "react";
import { LeadSummaryData } from "./useLeadSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  Target,
  Lightbulb,
  Star,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface LeadSummaryAnalysisProps {
  data: LeadSummaryData | null;
  loading: boolean;
  leadId: string;
  onRegenerate: (transcriptionId?: string) => void;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-yellow-600";
  if (score >= 4) return "text-orange-600";
  return "text-red-600";
}

function getScoreBg(score: number): string {
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-yellow-500";
  if (score >= 4) return "bg-orange-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 9) return "Excelente";
  if (score >= 7) return "Bom";
  if (score >= 5) return "Regular";
  if (score >= 3) return "Fraco";
  return "Crítico";
}

function ScoreRing({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const radius = size === "lg" ? 40 : 24;
  const stroke = size === "lg" ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const viewBox = size === "lg" ? 100 : 60;
  const center = viewBox / 2;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={viewBox} height={viewBox} viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/30" />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke="currentColor" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" transform={`rotate(-90 ${center} ${center})`}
          className={getScoreColor(score)}
        />
      </svg>
      <span className={`absolute text-${size === "lg" ? "xl" : "xs"} font-bold ${getScoreColor(score)}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export const LeadSummaryAnalysis = ({ data, loading, leadId, onRegenerate }: LeadSummaryAnalysisProps) => {
  const [transcriptions, setTranscriptions] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [selectedTranscription, setSelectedTranscription] = useState<string>("");

  useEffect(() => {
    async function fetchTranscriptions() {
      const { data: ts } = await supabase
        .from("crm_transcriptions")
        .select("id, title, created_at")
        .eq("lead_id", leadId)
        .not("transcription_text", "is", null)
        .order("created_at", { ascending: false });
      setTranscriptions(ts || []);
      if (ts && ts.length > 0 && !selectedTranscription) {
        setSelectedTranscription(ts[0].id);
      }
    }
    fetchTranscriptions();
  }, [leadId]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const ai = data?.ai;
  const generatedAt = data?._generated_at
    ? format(new Date(data._generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  if (ai?.no_transcription || (!data && transcriptions.length === 0)) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-lg">Nenhuma transcrição disponível</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Registre uma transcrição de reunião na aba "Transcrição" para que a IA possa analisar a performance de atendimento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise da Reunião
          </h3>
          {generatedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">Gerado em: {generatedAt}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {transcriptions.length > 1 && (
            <Select value={selectedTranscription} onValueChange={setSelectedTranscription}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Selecionar transcrição" />
              </SelectTrigger>
              <SelectContent>
                {transcriptions.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.title} — {format(new Date(t.created_at), "dd/MM", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => onRegenerate(selectedTranscription)}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {data ? "Regenerar" : "Analisar"}
          </Button>
        </div>
      </div>

      {!data && transcriptions.length > 0 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="h-8 w-8 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              Selecione uma transcrição e clique em <strong>"Analisar"</strong> para gerar a análise com IA.
            </p>
          </CardContent>
        </Card>
      )}

      {ai && !ai.no_transcription && (
        <>
          {/* Overall Score */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-6 flex-wrap">
                <ScoreRing score={ai.overall_score || 0} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-lg">Nota Geral: {(ai.overall_score || 0).toFixed(1)}/10</h4>
                    <Badge variant={ai.overall_score >= 7 ? "default" : ai.overall_score >= 5 ? "secondary" : "destructive"}>
                      {getScoreLabel(ai.overall_score || 0)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ai.overall_feedback}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ai.strengths && ai.strengths.length > 0 && (
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Pontos Fortes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {ai.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {ai.critical_improvements && ai.critical_improvements.length > 0 && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Melhorias Críticas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {ai.critical_improvements.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Phase-by-Phase Analysis */}
          {ai.phases && ai.phases.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Análise por Fase do Roteiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Score overview bar */}
                <div className="grid grid-cols-6 md:grid-cols-12 gap-1.5 mb-4">
                  {ai.phases.map((phase: any) => (
                    <div key={phase.phase_number} className="text-center">
                      <div className={`text-[10px] font-medium ${getScoreColor(phase.score)}`}>
                        {phase.score}
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getScoreBg(phase.score)}`}
                          style={{ width: `${(phase.score / 10) * 100}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">F{phase.phase_number}</div>
                    </div>
                  ))}
                </div>

                <Accordion type="multiple" className="space-y-2">
                  {ai.phases.map((phase: any) => (
                    <AccordionItem
                      key={phase.phase_number}
                      value={`phase-${phase.phase_number}`}
                      className={`rounded-lg border bg-card px-0 ${!phase.applied ? "opacity-60" : ""}`}
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 text-left w-full">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                            phase.score >= 7 ? "bg-green-500/10 text-green-600" :
                            phase.score >= 5 ? "bg-yellow-500/10 text-yellow-600" :
                            "bg-red-500/10 text-red-600"
                          }`}>
                            {phase.score}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Fase {phase.phase_number} — {phase.phase_name}
                              </span>
                              {!phase.applied && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Não aplicada</Badge>
                              )}
                            </div>
                            <Progress value={(phase.score / 10) * 100} className="h-1.5 mt-1.5" />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <p className="text-sm">{phase.feedback}</p>

                        {phase.good_moments && phase.good_moments.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Acertos
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 ml-5">
                              {phase.good_moments.map((m: string, i: number) => (
                                <li key={i} className="list-disc">{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {phase.improvements && phase.improvements.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-orange-600 mb-1 flex items-center gap-1">
                              <Lightbulb className="h-3.5 w-3.5" /> Melhorias
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1 ml-5">
                              {phase.improvements.map((m: string, i: number) => (
                                <li key={i} className="list-disc">{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {phase.suggested_script && (
                          <div>
                            <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                              <Star className="h-3.5 w-3.5" /> Script ideal
                            </p>
                            <div className="bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap border">
                              {phase.suggested_script}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Client Signals */}
          {ai.client_signals && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Sinais do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Nível de interesse:</span>
                  <Badge variant={
                    ai.client_signals.interest_level === "high" ? "default" :
                    ai.client_signals.interest_level === "medium" ? "secondary" : "destructive"
                  }>
                    {ai.client_signals.interest_level === "high" ? "🟢 Alto" :
                     ai.client_signals.interest_level === "medium" ? "🟡 Médio" : "🔴 Baixo"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ai.client_signals.buying_signals?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-1">✅ Sinais de compra</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {ai.client_signals.buying_signals.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5"><span>•</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {ai.client_signals.objection_signals?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-1">⚠️ Sinais de objeção</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {ai.client_signals.objection_signals.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5"><span>•</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {ai.client_signals.emotional_triggers?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-primary mb-1">💡 Gatilhos emocionais</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ai.client_signals.emotional_triggers.map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Missed Opportunities */}
          {ai.missed_opportunities && ai.missed_opportunities.length > 0 && (
            <Card className="border-orange-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-orange-500" />
                  Oportunidades Perdidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {ai.missed_opportunities.map((o: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-orange-500">•</span> {o}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Next Meeting Recommendations */}
          {ai.next_meeting_recommendations && (
            <Card className="border-primary bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  🎯 Recomendações para a Próxima Reunião
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{ai.next_meeting_recommendations}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
