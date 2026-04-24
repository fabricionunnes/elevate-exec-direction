import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { discQuestions } from "@/data/discQuestions";
import { CheckCircle2, ArrowRight, ArrowLeft, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

interface Answer {
  questionId: number;
  most: string;
  least: string;
}

export default function PublicProfileDISCPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenant");

  const [step, setStep] = useState<"form" | "test" | "done">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentMost, setCurrentMost] = useState<string | null>(null);
  const [currentLeast, setCurrentLeast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startTest = () => {
    if (!name.trim()) return toast.error("Informe seu nome");
    setStep("test");
  };

  const handleNext = () => {
    if (!currentMost || !currentLeast) {
      toast.error("Selecione o que MAIS e o que MENOS combina com você");
      return;
    }
    const next = [...answers];
    const idx = next.findIndex((a) => a.questionId === discQuestions[currentQuestion].id);
    const ans = { questionId: discQuestions[currentQuestion].id, most: currentMost, least: currentLeast };
    if (idx >= 0) next[idx] = ans;
    else next.push(ans);
    setAnswers(next);

    if (currentQuestion < discQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      const prev = next.find((a) => a.questionId === discQuestions[currentQuestion + 1].id);
      setCurrentMost(prev?.most ?? null);
      setCurrentLeast(prev?.least ?? null);
    } else {
      submit(next);
    }
  };

  const handlePrev = () => {
    if (currentQuestion === 0) return;
    setCurrentQuestion(currentQuestion - 1);
    const prev = answers.find((a) => a.questionId === discQuestions[currentQuestion - 1].id);
    setCurrentMost(prev?.most ?? null);
    setCurrentLeast(prev?.least ?? null);
  };

  const submit = async (final: Answer[]) => {
    setSubmitting(true);
    try {
      const scores = { D: 0, I: 0, S: 0, C: 0 };
      final.forEach((a) => {
        scores[a.most as keyof typeof scores] += 2;
        scores[a.least as keyof typeof scores] -= 1;
      });
      const max = discQuestions.length * 2;
      const min = discQuestions.length * -1;
      const range = max - min;
      const norm = {
        D: Math.round(((scores.D - min) / range) * 100),
        I: Math.round(((scores.I - min) / range) * 100),
        S: Math.round(((scores.S - min) / range) * 100),
        C: Math.round(((scores.C - min) / range) * 100),
      };
      const dominant = (Object.entries(norm).sort((a, b) => b[1] - a[1])[0][0]) as "D" | "I" | "S" | "C";

      const { error } = await supabase.functions.invoke("profile-disc-public-submit", {
        body: {
          tenantId,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          scores: norm,
          dominant,
          rawAnswers: final,
        },
      });
      if (error) throw error;
      setStep("done");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Obrigado!</h2>
            <p className="text-muted-foreground">
              Sua avaliação DISC foi enviada com sucesso. Você pode fechar esta janela.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Brain className="w-10 h-10 text-primary" />
            </div>
            <CardTitle>Teste DISC — Perfil Comportamental</CardTitle>
            <CardDescription>
              Responda 28 questões rápidas para descobrir seu perfil. Leva ~7 minutos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <Button className="w-full mt-2" onClick={startTest}>
              Iniciar teste <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = discQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / discQuestions.length) * 100;
  const isLast = currentQuestion === discQuestions.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Brain className="w-7 h-7" />
            <h1 className="text-2xl font-bold">Teste DISC</h1>
          </div>
          <p className="text-white/70 text-sm">{name}</p>
        </div>

        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Pergunta {currentQuestion + 1} de {discQuestions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escolha as opções</CardTitle>
            <CardDescription>
              Marque o que <strong className="text-green-500">MAIS</strong> e o que <strong className="text-red-500">MENOS</strong> combina com você.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {question.options.map((option) => (
                <div
                  key={option.profile}
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-lg transition-all",
                    currentMost === option.profile && "border-green-500 bg-green-500/10",
                    currentLeast === option.profile && "border-red-500 bg-red-500/10",
                  )}
                >
                  <span className="font-medium">{option.text}</span>
                  <div className="flex gap-2">
                    <Button
                      variant={currentMost === option.profile ? "default" : "outline"}
                      size="sm"
                      className={cn(currentMost === option.profile && "bg-green-500 hover:bg-green-600")}
                      onClick={() => {
                        if (currentLeast === option.profile) setCurrentLeast(null);
                        setCurrentMost(option.profile);
                      }}
                    >
                      + Mais
                    </Button>
                    <Button
                      variant={currentLeast === option.profile ? "default" : "outline"}
                      size="sm"
                      className={cn(currentLeast === option.profile && "bg-red-500 hover:bg-red-600")}
                      onClick={() => {
                        if (currentMost === option.profile) setCurrentMost(null);
                        setCurrentLeast(option.profile);
                      }}
                    >
                      - Menos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentQuestion === 0 || submitting}
            className="text-white border-white/30 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Anterior
          </Button>
          <Button
            onClick={handleNext}
            disabled={!currentMost || !currentLeast || submitting}
            className={isLast ? "bg-green-500 hover:bg-green-600" : ""}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
            ) : isLast ? (
              <>Finalizar <CheckCircle2 className="w-4 h-4 ml-2" /></>
            ) : (
              <>Próxima <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
