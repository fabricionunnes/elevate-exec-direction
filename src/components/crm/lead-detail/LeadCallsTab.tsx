import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PhoneCall, PhoneIncoming, PhoneOutgoing, FileText, Clock, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dialerAudioSrc } from "@/lib/dialer/audio";

interface Call {
  id: string;
  created_at: string;
  answered_at: string | null;
  duration_seconds: number | null;
  direction: string | null;
  status: string | null;
  ai_summary: string | null;
  ai_disposition: string | null;
  ai_qualification: string | null;
  transcription: string | null;
  recording_url: string | null;
  notes: string | null;
  agent: { name: string } | null;
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

/** Aba Ligações do lead: histórico do discador com gravação, transcrição, resumo e qualificação da IA. */
export function LeadCallsTab({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      // crm_calls não tem FK de agent_staff_id -> onboarding_staff, então o nome
      // do agente é resolvido numa segunda consulta e mapeado por id.
      const { data } = await supabase
        .from("crm_calls")
        .select("id, created_at, answered_at, duration_seconds, direction, status, ai_summary, ai_disposition, ai_qualification, transcription, recording_url, notes, agent_staff_id")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      const rows = (data || []) as any[];
      const staffIds = [...new Set(rows.map((r) => r.agent_staff_id).filter(Boolean))];
      let nameById: Record<string, string> = {};
      if (staffIds.length) {
        const { data: staff } = await supabase
          .from("onboarding_staff").select("id, name").in("id", staffIds);
        (staff || []).forEach((s: any) => { nameById[s.id] = s.name; });
      }
      if (!active) return;
      setCalls(rows.map((r) => ({ ...r, agent: r.agent_staff_id ? { name: nameById[r.agent_staff_id] || "" } : null })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [leadId]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (calls.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <PhoneCall className="h-10 w-10 mx-auto mb-3 opacity-40" />
        Nenhuma ligação registrada para este lead ainda.
      </div>
    );
  }

  const withRecording = calls.filter((c) => c.recording_url).length;

  return (
    <div className="p-4 sm:p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-4">
        <PhoneCall className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Ligações do discador</span>
        <Badge variant="secondary">{calls.length}</Badge>
        {withRecording > 0 && (
          <span className="text-xs text-muted-foreground">· {withRecording} com gravação</span>
        )}
      </div>

      <Accordion type="multiple" className="w-full space-y-2">
        {calls.map((c) => {
          const outbound = (c.direction || "outbound") !== "inbound";
          return (
            <AccordionItem key={c.id} value={c.id} className="border rounded-md px-3">
              <AccordionTrigger className="text-xs hover:no-underline py-2.5">
                <div className="flex items-center gap-3 w-full pr-2">
                  {outbound
                    ? <PhoneOutgoing className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    : <PhoneIncoming className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  <span className="text-muted-foreground text-[11px] min-w-[110px] text-left">
                    {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  {c.agent?.name && (
                    <span className="hidden sm:flex items-center gap-1 text-muted-foreground text-[10px]">
                      <User className="h-3 w-3" /> {c.agent.name}
                    </span>
                  )}
                  {c.ai_disposition && (
                    <Badge variant="outline" className="text-[9px] h-5">{dispLabel[c.ai_disposition] || c.ai_disposition}</Badge>
                  )}
                  {c.recording_url && (
                    <Badge variant="secondary" className="text-[9px] h-5">gravação</Badge>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground text-[10px] ml-auto">
                    <Clock className="h-3 w-3" /> {fmtDur(c.duration_seconds)}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-1 pb-2">
                  {c.recording_url && (
                    <audio controls preload="none" className="w-full h-9">
                      <source src={dialerAudioSrc(c.id)} type="audio/mpeg" />
                    </audio>
                  )}
                  {!c.recording_url && (c.transcription || c.ai_summary) && (
                    <p className="text-[11px] text-muted-foreground italic">Gravação removida pela política de retenção (30 dias). Transcrição mantida.</p>
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
          );
        })}
      </Accordion>
    </div>
  );
}
