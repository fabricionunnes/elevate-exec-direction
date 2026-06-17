import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PhoneCall, FileText, Clock, Search, ExternalLink, Loader2, Mic } from "lucide-react";
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
  lead_id: string;
  agent_staff_id: string | null;
  lead?: { name: string; company: string | null } | null;
}

const dispLabel: Record<string, string> = {
  qualificado: "Qualificado", agendou_reuniao: "Agendou reunião", retornar_depois: "Retornar",
  sem_interesse: "Sem interesse", nao_qualificado: "Não qualificado", nao_atendeu: "Não atendeu",
  atendida: "Atendida", voicemail: "Caixa postal", sem_transcricao: "Sem transcrição",
};
function fmtDur(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function DialerCallsHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyRecorded, setOnlyRecorded] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("crm_calls")
      .select("id, created_at, answered_at, duration_seconds, ai_summary, ai_disposition, transcription, recording_url, notes, lead_id, agent_staff_id, lead:crm_leads(name, company)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (onlyRecorded) q = q.not("recording_url", "is", null);
    const [{ data }, { data: staffData }] = await Promise.all([
      q,
      supabase.from("onboarding_staff").select("id, name"),
    ]);
    const sm: Record<string, string> = {};
    (staffData || []).forEach((s: any) => { sm[s.id] = s.name; });
    setStaff(sm);
    setCalls((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [onlyRecorded]);

  const filtered = calls.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.lead?.name || "").toLowerCase().includes(s) || (c.lead?.company || "").toLowerCase().includes(s);
  });

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por lead/empresa…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button size="sm" variant={onlyRecorded ? "default" : "outline"} className="gap-1.5" onClick={() => setOnlyRecorded((v) => !v)}>
          <Mic className="h-4 w-4" /> Só com gravação
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} ligações</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <PhoneCall className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma ligação ainda.</p>
        </div>
      ) : (
        <Accordion type="multiple" className="w-full">
          {filtered.map((c) => (
            <AccordionItem key={c.id} value={c.id}>
              <AccordionTrigger className="hover:no-underline py-2.5">
                <div className="flex items-center gap-3 w-full pr-2 text-left">
                  <span className="text-muted-foreground text-[11px] min-w-[110px]">
                    {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  <span className="font-medium text-sm truncate flex-1">{c.lead?.company || c.lead?.name || "Lead"}</span>
                  {c.recording_url && <Mic className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  {c.ai_disposition && <Badge variant="outline" className="text-[9px] h-5 shrink-0">{dispLabel[c.ai_disposition] || c.ai_disposition}</Badge>}
                  <span className="flex items-center gap-1 text-muted-foreground text-[11px] shrink-0"><Clock className="h-3 w-3" /> {fmtDur(c.duration_seconds)}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{c.agent_staff_id ? staff[c.agent_staff_id] : ""}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-1">
                  <Link to={`/crm/leads/${c.lead_id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    Abrir lead <ExternalLink className="h-3 w-3" />
                  </Link>
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
                  {!c.recording_url && !c.ai_summary && !c.transcription && (
                    <p className="text-xs text-muted-foreground italic">Sem gravação (não atendida ou em processamento).</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
