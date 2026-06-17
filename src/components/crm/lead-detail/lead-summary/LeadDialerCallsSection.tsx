import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PhoneCall, FileText, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dialerAudioSrc } from "@/lib/dialer/audio";

interface Call {
  id: string;
  created_at: string;
  answered_at: string | null;
  duration_seconds: number | null;
  ai_summary: string | null;
  ai_disposition: string | null;
  transcription: string | null;
  recording_url: string | null;
  notes: string | null;
}

const dispLabel: Record<string, string> = {
  qualificado: "Qualificado", agendou_reuniao: "Agendou reunião", retornar_depois: "Retornar",
  sem_interesse: "Sem interesse", nao_qualificado: "Não qualificado", nao_atendeu: "Não atendeu",
  sem_transcricao: "Sem transcrição",
};

function fmtDur(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Ligações do discador no Resumo do lead — gravação, transcrição e qualificação por IA, pro closer. */
export function LeadDialerCallsSection({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("crm_calls")
      .select("id, created_at, answered_at, duration_seconds, ai_summary, ai_disposition, transcription, recording_url, notes")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data }) => {
        if (!active) return;
        setCalls((data || []) as any);
        setLoaded(true);
      });
    return () => { active = false; };
  }, [leadId]);

  if (!loaded || calls.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-primary" />
          Ligações do discador
          <Badge variant="secondary" className="ml-1">{calls.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {calls.map((c) => (
            <AccordionItem key={c.id} value={c.id}>
              <AccordionTrigger className="text-xs hover:no-underline py-2">
                <div className="flex items-center gap-3 w-full pr-2">
                  <span className="text-muted-foreground text-[10px] min-w-[90px]">
                    {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  {c.ai_disposition && (
                    <Badge variant="outline" className="text-[9px] h-5">{dispLabel[c.ai_disposition] || c.ai_disposition}</Badge>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground text-[10px] ml-auto">
                    <Clock className="h-3 w-3" /> {fmtDur(c.duration_seconds)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-1">
                  {c.recording_url && (
                    <audio controls preload="none" className="w-full h-9">
                      <source src={dialerAudioSrc(c.id)} type="audio/mpeg" />
                    </audio>
                  )}
                  {c.ai_summary && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Resumo da IA</p>
                      <p className="text-xs leading-relaxed">{c.ai_summary}</p>
                    </div>
                  )}
                  {c.notes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Anotações</p>
                      <p className="text-xs whitespace-pre-wrap">{c.notes}</p>
                    </div>
                  )}
                  {c.transcription && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="t" className="border-0">
                        <AccordionTrigger className="text-[11px] py-1 text-primary hover:no-underline">
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Ver transcrição completa</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-xs whitespace-pre-wrap text-muted-foreground max-h-72 overflow-auto">{c.transcription}</p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                  {!c.ai_summary && !c.transcription && !c.recording_url && (
                    <p className="text-xs text-muted-foreground italic">Processando gravação e transcrição…</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
