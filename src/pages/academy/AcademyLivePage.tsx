import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Radio, CalendarCheck, Video, Users, CheckCircle2, Clock, ExternalLink, PlayCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { AcademyUserContext } from "./AcademyLayout";
import {
  iaDb, loadMySubscription, fmtDateTime, LIVE_KIND_LABEL, CALL_STATUS_LABEL,
  type IaSubscription, type IaLiveSession, type IaLiveRegistration,
} from "@/lib/academy/iaAcademy";

// Encontros ao Vivo do UNV IA Academy:
// - sessão individual de planejamento (1:1 com o Fabrício) na entrada
// - hotseat mensal em grupo + aulas de implementação ao vivo (gravação vira aula)

export const AcademyLivePage = () => {
  const userContext = useOutletContext<AcademyUserContext>();
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<IaSubscription | null>(null);
  const [sessions, setSessions] = useState<IaLiveSession[]>([]);
  const [regs, setRegs] = useState<Record<string, IaLiveRegistration>>({});

  // pedido da sessão 1:1
  const [callOpen, setCallOpen] = useState(false);
  const [callPrefs, setCallPrefs] = useState("");
  const [savingCall, setSavingCall] = useState(false);

  // inscrição no encontro
  const [regSession, setRegSession] = useState<IaLiveSession | null>(null);
  const [regQuestion, setRegQuestion] = useState("");
  const [regWantsHotseat, setRegWantsHotseat] = useState(false);
  const [savingReg, setSavingReg] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userContext.onboardingUserId]);

  const load = async () => {
    try {
      const [mySub, { data: sess }] = await Promise.all([
        loadMySubscription(userContext.onboardingUserId),
        iaDb.from("ia_academy_live_sessions").select("*").neq("status", "cancelled").order("scheduled_at", { ascending: true }),
      ]);
      setSub(mySub);
      setSessions((sess as IaLiveSession[]) || []);
      if (userContext.onboardingUserId) {
        const { data: myRegs } = await iaDb
          .from("ia_academy_live_registrations")
          .select("*")
          .eq("onboarding_user_id", userContext.onboardingUserId);
        const map: Record<string, IaLiveRegistration> = {};
        ((myRegs as IaLiveRegistration[]) || []).forEach((r) => { map[r.session_id] = r; });
        setRegs(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const requestCall = async () => {
    if (!sub) return;
    setSavingCall(true);
    try {
      const { error } = await iaDb
        .from("ia_academy_subscriptions")
        .update({
          onboarding_call_status: "requested",
          onboarding_call_requested_at: new Date().toISOString(),
          onboarding_call_preferences: callPrefs.trim() || null,
        })
        .eq("id", sub.id);
      if (error) throw error;
      toast.success("Pedido enviado. O time UNV confirma o horário no seu WhatsApp.");
      setCallOpen(false);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Não consegui enviar o pedido agora");
    } finally {
      setSavingCall(false);
    }
  };

  const openRegister = (s: IaLiveSession) => {
    const existing = regs[s.id];
    setRegSession(s);
    setRegQuestion(existing?.question || "");
    setRegWantsHotseat(existing?.wants_hotseat || false);
  };

  const saveRegistration = async () => {
    if (!regSession || !userContext.onboardingUserId) return;
    setSavingReg(true);
    try {
      const { error } = await iaDb.from("ia_academy_live_registrations").upsert(
        {
          session_id: regSession.id,
          onboarding_user_id: userContext.onboardingUserId,
          question: regQuestion.trim() || null,
          wants_hotseat: regWantsHotseat,
          status: "registered",
        },
        { onConflict: "session_id,onboarding_user_id" },
      );
      if (error) throw error;
      toast.success("Inscrição confirmada");
      setRegSession(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Não consegui salvar a inscrição");
    } finally {
      setSavingReg(false);
    }
  };

  const cancelRegistration = async (s: IaLiveSession) => {
    const r = regs[s.id];
    if (!r) return;
    await iaDb.from("ia_academy_live_registrations").update({ status: "cancelled" }).eq("id", r.id);
    toast.success("Inscrição cancelada");
    load();
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const now = Date.now();
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at).getTime() >= now - 3 * 3600000 && s.status !== "done");
  const past = sessions.filter((s) => !upcoming.includes(s)).reverse();
  const callStatus = sub?.onboarding_call_status || "pending";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Radio className="h-7 w-7 text-primary" /> Encontros ao Vivo
        </h1>
        <p className="text-muted-foreground mt-1">
          Sua sessão individual de planejamento e o hotseat mensal em grupo com o Fabrício.
        </p>
      </div>

      {/* Sessão individual */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5 text-primary shrink-0" /> Sessão individual de planejamento
            {sub && <Badge variant={callStatus === "done" ? "default" : "secondary"} className="ml-auto">{CALL_STATUS_LABEL[callStatus]}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sub ? (
            <p className="text-sm text-muted-foreground">
              A sessão individual faz parte da assinatura UNV IA Academy. Se você é cliente UNV, fale com o seu consultor pra agendar.
              {" "}Ainda não é assinante? <a className="underline text-primary" href="/unviaacademy/">Conheça o programa</a>.
            </p>
          ) : callStatus === "pending" ? (
            <>
              <p className="text-sm">
                É a sua primeira aula: ao vivo, 1:1 com o Fabrício, pra montar o planejamento de IA da sua empresa e já iniciar as ações. Leve o Mapa das 5 tarefas (Trilha 0, aula 1) e os números do seu funil.
              </p>
              <Button onClick={() => setCallOpen(true)}>
                <CalendarCheck className="h-4 w-4 mr-2" /> Solicitar minha sessão
              </Button>
            </>
          ) : callStatus === "requested" ? (
            <p className="text-sm">
              Pedido enviado em {fmtDateTime(sub.onboarding_call_requested_at)}. O time UNV confirma o horário no seu WhatsApp.
              {sub.onboarding_call_preferences && <span className="block text-muted-foreground mt-1">Seus horários: {sub.onboarding_call_preferences}</span>}
            </p>
          ) : callStatus === "scheduled" ? (
            <div className="space-y-3">
              <p className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Agendada para <strong>{fmtDateTime(sub.onboarding_call_at)}</strong></p>
              {sub.onboarding_call_meeting_url && (
                <Button asChild>
                  <a href={sub.onboarding_call_meeting_url} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4 mr-2" /> Entrar na sala
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Realizada em {fmtDateTime(sub.onboarding_call_at)}</p>
              {sub.onboarding_call_plan_md && (
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Seu plano de IA</p>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{sub.onboarding_call_plan_md}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximos encontros */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Users className="h-5 w-5" /> Próximos encontros</h2>
        {upcoming.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum encontro agendado ainda. O hotseat mensal é publicado aqui e avisado no seu WhatsApp.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((s) => {
              const r = regs[s.id];
              const registered = r && r.status !== "cancelled";
              const isLive = s.status === "live";
              return (
                <Card key={s.id} className={isLive ? "border-red-500/50" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Badge variant="outline" className="mb-2">{LIVE_KIND_LABEL[s.kind]}</Badge>
                        <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
                      </div>
                      {isLive && <Badge className="bg-red-600 animate-pulse shrink-0">AO VIVO</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                      <Clock className="h-4 w-4 shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{fmtDateTime(s.scheduled_at)} · {s.duration_minutes} min · com {s.host_name}</span>
                    </p>
                    {s.description && <p className="text-sm">{s.description}</p>}
                    {registered && r.question && (
                      <p className="text-xs rounded-md bg-muted px-3 py-2"><MessageSquare className="inline h-3 w-3 mr-1" />Seu caso: {r.question}{r.wants_hotseat && " · pediu a cadeira quente"}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {registered && s.meeting_url && (
                        <Button asChild size="sm">
                          <a href={s.meeting_url} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4 mr-1" /> Entrar</a>
                        </Button>
                      )}
                      {userContext.onboardingUserId && (
                        registered ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openRegister(s)}>Editar caso</Button>
                            <Button size="sm" variant="ghost" onClick={() => cancelRegistration(s)}>Cancelar inscrição</Button>
                          </>
                        ) : (
                          <Button size="sm" variant={s.meeting_url ? "outline" : "default"} onClick={() => openRegister(s)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Inscrever-me
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Gravações */}
      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><PlayCircle className="h-5 w-5" /> Encontros anteriores</h2>
          <div className="space-y-2">
            {past.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{LIVE_KIND_LABEL[s.kind]} · {fmtDateTime(s.scheduled_at)}</p>
                </div>
                {s.recording_lesson_id ? (
                  <Button asChild size="sm" variant="outline" className="shrink-0"><Link to={`/academy/lesson/${s.recording_lesson_id}`}><PlayCircle className="h-4 w-4 mr-1" /> Assistir</Link></Button>
                ) : s.recording_url ? (
                  <Button asChild size="sm" variant="outline" className="shrink-0"><a href={s.recording_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Gravação</a></Button>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">Gravação em breve</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog: pedir sessão 1:1 */}
      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Solicitar sessão individual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Diga 2 ou 3 horários que funcionam pra você (dias e faixas). O time UNV confirma no WhatsApp.</p>
            <Textarea
              value={callPrefs}
              onChange={(e) => setCallPrefs(e.target.value)}
              placeholder="Ex.: terça ou quinta à tarde, a partir das 14h"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallOpen(false)}>Voltar</Button>
            <Button onClick={requestCall} disabled={savingCall}>{savingCall ? "Enviando..." : "Enviar pedido"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: inscrição */}
      <Dialog open={!!regSession} onOpenChange={(o) => !o && setRegSession(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="break-words pr-6">{regSession?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Qual caso ou dúvida você quer levar?</label>
              <Textarea
                className="mt-1"
                value={regQuestion}
                onChange={(e) => setRegQuestion(e.target.value)}
                placeholder="Ex.: meu agente SDR está qualificando lead fora do ICP. Quero revisar o prompt ao vivo."
                rows={4}
              />
            </div>
            {regSession?.kind === "hotseat" && (
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox checked={regWantsHotseat} onCheckedChange={(v) => setRegWantsHotseat(!!v)} className="mt-0.5" />
                <span>Quero a cadeira quente: apresentar o meu caso na tela pro Fabrício revisar ao vivo.</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegSession(null)}>Voltar</Button>
            <Button onClick={saveRegistration} disabled={savingReg}>{savingReg ? "Salvando..." : "Confirmar inscrição"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyLivePage;
