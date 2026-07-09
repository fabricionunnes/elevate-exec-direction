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
import { CheckCircle2, ArrowRight, ArrowLeft, Compass, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CULTURE_QUESTIONS, CULTURE_OPEN_QUESTION, CULTURE_SCALE } from "@/data/cultureQuestions";

export default function ProfileCulturePublicPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenant");
  const candidateId = searchParams.get("candidate");

  const [step, setStep] = useState<"form" | "quiz" | "open" | "done">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identityLocked, setIdentityLocked] = useState(false);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [open, setOpen] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const q = CULTURE_QUESTIONS[current];
  const answeredCount = Object.keys(answers).length;

  const pick = (value: number) => {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    setTimeout(() => {
      if (current < CULTURE_QUESTIONS.length - 1) setCurrent((c) => c + 1);
      else setStep("open");
    }, 180);
  };

  const submit = async () => {
    if (answeredCount < CULTURE_QUESTIONS.length) { toast.error("Responda todas as afirmações"); return; }
    setSubmitting(true);
    try {
      const payload = CULTURE_QUESTIONS.map((qq) => ({ id: qq.id, pillar: qq.pillar, reverse: qq.reverse, value: answers[qq.id] }));
      const { data, error } = await supabase.functions.invoke("profile-culture-public-submit", {
        body: { tenantId, candidateId, name: name.trim(), email: email.trim() || null, answers: payload, openAnswer: open.trim() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
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
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Teste concluído!</h2>
            <p className="text-muted-foreground">Obrigado, {name.split(" ")[0]}. Recebemos suas respostas. Boa sorte no processo!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {step === "form" && (
          <Card>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Compass className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Teste de Fit Cultural</CardTitle>
              <CardDescription>{CULTURE_QUESTIONS.length} afirmações rápidas + 1 pergunta. Leva ~5 minutos.</CardDescription>
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
              <Button className="w-full" size="lg" disabled={!name.trim()} onClick={() => setStep("quiz")}>
                Começar <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "quiz" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Afirmação {current + 1} de {CULTURE_QUESTIONS.length}</span>
                <span>{Math.round((answeredCount / CULTURE_QUESTIONS.length) * 100)}%</span>
              </div>
              <Progress value={(answeredCount / CULTURE_QUESTIONS.length) * 100} />
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-lg font-medium text-center min-h-[56px] flex items-center justify-center">{q.text}</p>
              <div className="space-y-2">
                {CULTURE_SCALE.map((s) => (
                  <button key={s.value} onClick={() => pick(s.value)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5",
                      answers[q.id] === s.value ? "border-primary bg-primary/10 font-medium" : "border-border"
                    )}>
                    {s.label}
                  </button>
                ))}
              </div>
              {current > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCurrent((c) => c - 1)} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {step === "open" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Última pergunta</CardTitle>
              <CardDescription>{CULTURE_OPEN_QUESTION}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={open} onChange={(e) => setOpen(e.target.value)} rows={7} placeholder="Escreva sua resposta aqui..." />
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setStep("quiz"); setCurrent(CULTURE_QUESTIONS.length - 1); }} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button size="lg" disabled={submitting || open.trim().length < 10} onClick={submit}>
                  {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>) : (<><CheckCircle2 className="h-4 w-4 mr-2" />Enviar respostas</>)}
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
