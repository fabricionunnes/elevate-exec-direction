import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { dialerAudioSrc } from "@/lib/dialer/audio";
import { GraduationCap, Loader2, ThumbsUp, AlertTriangle, Lightbulb, Sparkles, RefreshCw, ExternalLink, Trophy, MessageSquareQuote } from "lucide-react";

type Range = "today" | "7d" | "30d";

interface QaFeedback { resumo?: string | null; pontos_fortes?: string[]; pontos_melhorar?: string[]; dica_principal?: string | null; frase_modelo?: string | null }
interface Call {
  id: string; created_at: string; agent_staff_id: string | null; qa_score: number | null;
  qa_feedback: QaFeedback | null; duration_seconds: number | null; recording_url: string | null;
  transcription: string | null; lead_id: string; lead?: { name: string; company: string | null } | null;
}

const scoreColor = (n: number | null) => n == null ? "text-muted-foreground" : n >= 8 ? "text-emerald-500" : n >= 6 ? "text-amber-500" : "text-red-500";
const scoreBg = (n: number | null) => n == null ? "bg-muted" : n >= 8 ? "bg-emerald-500/15 text-emerald-600" : n >= 6 ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600";
function rangeStart(r: Range): string {
  const now = new Date();
  if (r === "today") { now.setHours(0, 0, 0, 0); return now.toISOString(); }
  return new Date(Date.now() - (r === "7d" ? 7 : 30) * 86400000).toISOString();
}

export function DialerCoachPanel() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [range, setRange] = useState<Range>("7d");
  const [agent, setAgent] = useState<string>("all");

  const loadCalls = async () => {
    const since = rangeStart(range);
    const [{ data }, { data: st }] = await Promise.all([
      supabase.from("crm_calls")
        .select("id, created_at, agent_staff_id, qa_score, qa_feedback, duration_seconds, recording_url, transcription, lead_id, lead:crm_leads(name, company)")
        .not("qa_score", "is", null).gte("created_at", since).order("qa_at", { ascending: false }).limit(200),
      supabase.from("onboarding_staff").select("id, name"),
    ]);
    const sm: Record<string, string> = {}; (st || []).forEach((s: any) => { sm[s.id] = s.name; });
    setStaff(sm);
    setCalls((data || []) as any);
    setLoading(false);
  };

  const analyze = async () => {
    setScoring(true);
    // processa em lotes até esvaziar a fila de não-analisadas (limite por chamada)
    for (let i = 0; i < 6; i++) {
      const { data } = await supabase.functions.invoke("dialer-coach", { body: { batch: true, limit: 8 } });
      if (!data || data.error || !data.processed) break;
      await loadCalls();
      if (data.processed < 8) break;
    }
    setScoring(false);
  };

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      await loadCalls();
      if (!on) return;
      void analyze(); // backfill das que ainda não têm nota
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => agent === "all" ? calls : calls.filter((c) => (c.agent_staff_id || "") === agent), [calls, agent]);

  const perAgent = useMemo(() => {
    const by: Record<string, { scores: number[]; melhorar: Record<string, number> }> = {};
    for (const c of calls) {
      if (c.qa_score == null) continue;
      const id = c.agent_staff_id || "—";
      const a = (by[id] ||= { scores: [], melhorar: {} });
      a.scores.push(Number(c.qa_score));
      for (const m of c.qa_feedback?.pontos_melhorar || []) {
        const k = m.trim(); if (k) a.melhorar[k] = (a.melhorar[k] || 0) + 1;
      }
    }
    return Object.entries(by).map(([id, a]) => ({
      id, name: staff[id] || "—",
      avg: a.scores.reduce((s, n) => s + n, 0) / a.scores.length,
      count: a.scores.length,
      topMelhorar: Object.entries(a.melhorar).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => k),
    })).sort((x, y) => y.avg - x.avg);
  }, [calls, staff]);

  const pending = calls.length === 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {(["today", "7d", "30d"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1 text-sm rounded-md transition-colors ${range === r ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              {r === "today" ? "Hoje" : r === "7d" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={analyze} disabled={scoring}>
          {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Analisar ligações
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando coaching…</div>
      ) : (
        <>
          {/* Ranking / nota média por SDR */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {perAgent.map((a, i) => (
              <Card key={a.id} className={`cursor-pointer ${agent === a.id ? "ring-1 ring-primary" : ""}`} onClick={() => setAgent(agent === a.id ? "all" : a.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {i === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                      <span className="font-medium text-sm">{a.name}</span>
                    </div>
                    <span className={`text-2xl font-bold ${scoreColor(a.avg)}`}>{a.avg.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">{a.count} ligações avaliadas · nota média</p>
                  {a.topMelhorar.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Focar em:</p>
                      {a.topMelhorar.map((m, j) => <p key={j} className="text-xs text-foreground/80 leading-snug">• {m}</p>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {perAgent.length === 0 && (
              <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">
                {scoring ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analisando as ligações com IA…</span>
                  : "Ainda não há ligações com conversa transcrita pra avaliar. Assim que houver, a nota e as dicas aparecem aqui."}
              </CardContent></Card>
            )}
          </div>

          {/* Lista de ligações avaliadas */}
          {filtered.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Notas das ligações {agent !== "all" && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setAgent("all")}>(todos)</button>}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Accordion type="multiple" className="w-full">
                  {filtered.map((c) => (
                    <AccordionItem key={c.id} value={c.id} className="px-3">
                      <AccordionTrigger className="hover:no-underline py-2.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <span className={`inline-flex items-center justify-center h-8 w-9 rounded-md text-sm font-bold ${scoreBg(c.qa_score)}`}>{c.qa_score != null ? c.qa_score.toFixed(1) : "—"}</span>
                          <span className="font-medium text-sm truncate flex-1">{c.lead?.company || c.lead?.name || "Lead"}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{c.agent_staff_id ? staff[c.agent_staff_id] : ""}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pl-1 pb-2">
                          {c.qa_feedback?.resumo && <p className="text-sm">{c.qa_feedback.resumo}</p>}
                          <div className="grid sm:grid-cols-2 gap-3">
                            {(c.qa_feedback?.pontos_fortes?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-medium text-emerald-600 flex items-center gap-1 mb-1"><ThumbsUp className="h-3.5 w-3.5" /> Pontos fortes</p>
                                {c.qa_feedback!.pontos_fortes!.map((p, i) => <p key={i} className="text-xs text-foreground/80 leading-snug">• {p}</p>)}
                              </div>
                            )}
                            {(c.qa_feedback?.pontos_melhorar?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-medium text-amber-600 flex items-center gap-1 mb-1"><AlertTriangle className="h-3.5 w-3.5" /> A melhorar</p>
                                {c.qa_feedback!.pontos_melhorar!.map((p, i) => <p key={i} className="text-xs text-foreground/80 leading-snug">• {p}</p>)}
                              </div>
                            )}
                          </div>
                          {c.qa_feedback?.dica_principal && (
                            <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs flex items-start gap-2"><Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> <span><span className="font-medium">Dica principal:</span> {c.qa_feedback.dica_principal}</span></div>
                          )}
                          {c.qa_feedback?.frase_modelo && (
                            <div className="rounded-md border border-border bg-primary/5 p-2.5 text-xs flex items-start gap-2"><MessageSquareQuote className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span className="italic">"{c.qa_feedback.frase_modelo}"</span></div>
                          )}
                          {c.recording_url && (
                            <audio controls preload="none" className="w-full h-9"><source src={dialerAudioSrc(c.id)} type="audio/mpeg" /></audio>
                          )}
                          <Link to={`/crm/leads/${c.lead_id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">Abrir lead <ExternalLink className="h-3 w-3" /></Link>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> Avaliação automática por IA com base na metodologia consultiva da UNV. Só ligações com conversa real (atendidas e transcritas) são avaliadas.</p>
    </div>
  );
}
