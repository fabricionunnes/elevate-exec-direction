// Avaliação do candidato em UM link só: DISC + Fit Cultural em sequência.
// Rota: /avaliacao?candidate=&tenant= . Submete pras duas edges (disc + culture).
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, ArrowLeft, Compass, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { discQuestions } from "@/data/discQuestions";
import { CULTURE_QUESTIONS, CULTURE_OPEN_QUESTION, CULTURE_SCALE } from "@/data/cultureQuestions";

interface DiscAnswer { questionId: number; most: string; least: string; }

export default function ProfileAssessmentPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenant");
  const candidateId = searchParams.get("candidate");

  const [step, setStep] = useState<"form" | "disc" | "culture_quiz" | "culture_open" | "done">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identityLocked, setIdentityLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // DISC
  const [dIdx, setDIdx] = useState(0);
  const [dAnswers, setDAnswers] = useState<DiscAnswer[]>([]);
  const [most, setMost] = useState<string | null>(null);
  const [least, setLeast] = useState<string | null>(null);

  // Cultura
  const [cIdx, setCIdx] = useState(0);
  const [cAnswers, setCAnswers] = useState<Record<number, number>>({});
  const [open, setOpen] = useState("");

  useEffect(() => {
    if (!candidateId) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("profile-candidate-public-info", { body: { candidateId } });
      const c = (data as any)?.candidate;
      if (!error && c) {
        if (c.full_name) { setName(c.full_name); setIdentityLocked(true); }
        if (c.email) setEmail(c.email);
      }
    })();
  }, [candidateId]);

  const dq = discQuestions[dIdx];
  const cq = CULTURE_QUESTIONS[cIdx];
  const cAnswered = Object.keys(cAnswers).length;

  const discNext = () => {
    if (!most || !least) { toast.error("Marque o que MAIS e o que MENOS combina"); return; }
    const next = [...dAnswers];
    const i = next.findIndex((a) => a.questionId === dq.id);
    const ans = { questionId: dq.id, most, least };
    if (i >= 0) next[i] = ans; else next.push(ans);
    setDAnswers(next);
    if (dIdx < discQuestions.length - 1) {
      const n = dIdx + 1;
      setDIdx(n);
      const prev = next.find((a) => a.questionId === discQuestions[n].id);
      setMost(prev?.most ?? null); setLeast(prev?.least ?? null);
    } else {
      setStep("culture_quiz");
    }
  };
  const discPrev = () => {
    if (dIdx === 0) return;
    const n = dIdx - 1; setDIdx(n);
    const prev = dAnswers.find((a) => a.questionId === discQuestions[n].id);
    setMost(prev?.most ?? null); setLeast(prev?.least ?? null);
  };

  const cPick = (value: number) => {
    setCAnswers((p) => ({ ...p, [cq.id]: value }));
    setTimeout(() => {
      if (cIdx < CULTURE_QUESTIONS.length - 1) setCIdx((x) => x + 1);
      else setStep("culture_open");
    }, 160);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      // DISC
      const scores = { D: 0, I: 0, S: 0, C: 0 };
      dAnswers.forEach((a) => { scores[a.most as keyof typeof scores] += 2; scores[a.least as keyof typeof scores] -= 1; });
      const max = discQuestions.length * 2, min = discQuestions.length * -1, range = max - min;
      const norm = {
        D: Math.round(((scores.D - min) / range) * 100), I: Math.round(((scores.I - min) / range) * 100),
        S: Math.round(((scores.S - min) / range) * 100), C: Math.round(((scores.C - min) / range) * 100),
      };
      const dominant = (Object.entries(norm).sort((a, b) => b[1] - a[1])[0][0]) as "D" | "I" | "S" | "C";
      const culturePayload = CULTURE_QUESTIONS.map((qq) => ({ id: qq.id, pillar: qq.pillar, reverse: qq.reverse, value: cAnswers[qq.id] }));

      const [discRes, cultRes] = await Promise.allSettled([
        supabase.functions.invoke("profile-disc-public-submit", { body: { tenantId, candidateId, name: name.trim(), email: email.trim() || null, scores: norm, dominant, rawAnswers: dAnswers } }),
        supabase.functions.invoke("profile-culture-public-submit", { body: { tenantId, candidateId, name: name.trim(), email: email.trim() || null, answers: culturePayload, openAnswer: open.trim() } }),
      ]);
      const discOk = discRes.status === "fulfilled" && !(discRes.value as any)?.error;
      const cultOk = cultRes.status === "fulfilled" && !(cultRes.value as any)?.error;
      if (!discOk && !cultOk) throw new Error("Não consegui enviar as respostas");
      setStep("done");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
            <h2 className="text-2xl font-bold mb-2">Avaliação concluída!</h2>
            <p className="text-muted-foreground">Obrigado, {name.split(" ")[0]}. Recebemos suas respostas. Boa sorte no processo!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* indicador de fase */}
        {step !== "form" && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full", step === "disc" ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground")}><Brain className="w-3 h-3" />Parte 1 · DISC</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full", step.startsWith("culture") ? "bg-teal-500/15 text-teal-500 font-semibold" : "text-muted-foreground")}><Compass className="w-3 h-3" />Parte 2 · Cultural</span>
          </div>
        )}

        {step === "form" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Avaliação do candidato</CardTitle>
              <CardDescription>Duas partes rápidas: perfil comportamental (DISC) + fit cultural. Leva ~12 minutos no total.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" readOnly={identityLocked} className={identityLocked ? "opacity-80" : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (opcional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <Button className="w-full" size="lg" disabled={!name.trim()} onClick={() => setStep("disc")}>Começar <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </CardContent>
          </Card>
        )}

        {step === "disc" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Pergunta {dIdx + 1} de {discQuestions.length}</span>
                <span>{Math.round(((dIdx) / discQuestions.length) * 100)}%</span>
              </div>
              <Progress value={(dIdx / discQuestions.length) * 100} />
              <CardDescription className="pt-2">Marque o que <strong className="text-green-500">MAIS</strong> e o que <strong className="text-red-500">MENOS</strong> combina com você.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dq.options.map((o) => (
                <div key={o.profile} className={cn("flex items-center justify-between p-3 border rounded-lg transition-all", most === o.profile && "border-green-500 bg-green-500/10", least === o.profile && "border-red-500 bg-red-500/10")}>
                  <span className="font-medium">{o.text}</span>
                  <div className="flex gap-2">
                    <Button variant={most === o.profile ? "default" : "outline"} size="sm" className={cn(most === o.profile && "bg-green-500 hover:bg-green-600")} onClick={() => { if (least === o.profile) setLeast(null); setMost(o.profile); }}>+ Mais</Button>
                    <Button variant={least === o.profile ? "default" : "outline"} size="sm" className={cn(least === o.profile && "bg-red-500 hover:bg-red-600")} onClick={() => { if (most === o.profile) setMost(null); setLeast(o.profile); }}>- Menos</Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={discPrev} disabled={dIdx === 0} className="gap-1"><ArrowLeft className="h-4 w-4" />Voltar</Button>
                <Button onClick={discNext} className="gap-1">{dIdx < discQuestions.length - 1 ? "Próxima" : "Ir para parte 2"}<ArrowRight className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "culture_quiz" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Afirmação {cIdx + 1} de {CULTURE_QUESTIONS.length}</span>
                <span>{Math.round((cAnswered / CULTURE_QUESTIONS.length) * 100)}%</span>
              </div>
              <Progress value={(cAnswered / CULTURE_QUESTIONS.length) * 100} />
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-lg font-medium text-center min-h-[56px] flex items-center justify-center">{cq.text}</p>
              <div className="space-y-2">
                {CULTURE_SCALE.map((s) => (
                  <button key={s.value} onClick={() => cPick(s.value)}
                    className={cn("w-full text-left px-4 py-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5", cAnswers[cq.id] === s.value ? "border-primary bg-primary/10 font-medium" : "border-border")}>
                    {s.label}
                  </button>
                ))}
              </div>
              {cIdx > 0 && <Button variant="ghost" size="sm" onClick={() => setCIdx((x) => x - 1)} className="gap-1"><ArrowLeft className="h-4 w-4" />Voltar</Button>}
            </CardContent>
          </Card>
        )}

        {step === "culture_open" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Última pergunta</CardTitle>
              <CardDescription>{CULTURE_OPEN_QUESTION}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={open} onChange={(e) => setOpen(e.target.value)} rows={7} placeholder="Escreva sua resposta aqui..." />
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setStep("culture_quiz"); setCIdx(CULTURE_QUESTIONS.length - 1); }} className="gap-1"><ArrowLeft className="h-4 w-4" />Voltar</Button>
                <Button size="lg" disabled={submitting || open.trim().length < 10} onClick={submit}>
                  {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>) : (<><CheckCircle2 className="h-4 w-4 mr-2" />Enviar avaliação</>)}
                </Button>
              </div>
              {open.trim().length < 10 && <p className="text-[11px] text-muted-foreground text-right">Escreva pelo menos uma frase.</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
