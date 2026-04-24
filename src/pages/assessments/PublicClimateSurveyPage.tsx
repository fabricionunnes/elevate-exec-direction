import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: number | string;
  type: "enps" | "scale" | "text";
  text: string;
}

export default function PublicClimateSurveyPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [anonymous, setAnonymous] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!surveyId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("profile-climate-public", {
        method: "GET" as any,
        body: undefined,
        // pass survey_id via query string by manually building URL
      });
      // supabase.functions.invoke does not support query string easily — fall back to fetch
      let surveyData: any = null;
      try {
        const fnUrl = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/profile-climate-public?survey_id=${encodeURIComponent(surveyId)}`;
        const resp = await fetch(fnUrl, {
          headers: {
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const json = await resp.json();
        surveyData = json?.survey;
      } catch (_e) {
        // ignore
      }
      if (!surveyData && data?.survey) surveyData = data.survey;
      if (!surveyData) {
        toast.error("Pesquisa não encontrada");
      } else {
        setSurvey(surveyData);
      }
      if (error) console.error(error);
      setLoading(false);
    };
    load();
  }, [surveyId]);

  const setAnswer = (qid: string | number, value: any) => {
    setAnswers((prev) => ({ ...prev, [String(qid)]: value }));
  };

  const submit = async () => {
    if (!survey) return;
    const questions: Question[] = survey.questions || [];
    const enpsQ = questions.find((q) => q.type === "enps");
    const enps_score = enpsQ ? Number(answers[String(enpsQ.id)]) : null;

    setSubmitting(true);
    const fnUrl = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/profile-climate-public`;
    try {
      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          survey_id: survey.id,
          answers,
          enps_score: typeof enps_score === "number" && !isNaN(enps_score) ? enps_score : undefined,
          is_anonymous: anonymous,
          respondent_name: anonymous ? undefined : name,
          respondent_email: anonymous ? undefined : email,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast.error(json?.error || "Erro ao enviar");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-2">
            <p className="text-lg font-semibold">Pesquisa indisponível</p>
            <p className="text-sm text-muted-foreground">O link pode estar incorreto ou a pesquisa foi encerrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (survey.status === "closed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold">Pesquisa encerrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
            <p className="text-xl font-bold">Obrigado!</p>
            <p className="text-sm text-muted-foreground">Sua resposta foi registrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions: Question[] = survey.questions || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Heart className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">{survey.title}</h1>
          <p className="text-sm text-muted-foreground">Sua opinião é fundamental. Leva apenas alguns minutos.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="anon" checked={anonymous} onCheckedChange={(v) => setAnonymous(!!v)} />
              <Label htmlFor="anon" className="text-sm cursor-pointer">Responder anonimamente</Label>
            </div>
            {!anonymous && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="E-mail (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {questions.map((q, idx) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">{idx + 1}. {q.text}</CardTitle>
            </CardHeader>
            <CardContent>
              {q.type === "enps" && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={answers[String(q.id)] === n ? "default" : "outline"}
                      className="w-11 h-11"
                      onClick={() => setAnswer(q.id, n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              )}
              {q.type === "scale" && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={answers[String(q.id)] === n ? "default" : "outline"}
                      className="w-12 h-12"
                      onClick={() => setAnswer(q.id, n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              )}
              {q.type === "text" && (
                <Textarea
                  rows={4}
                  placeholder="Sua resposta…"
                  value={answers[String(q.id)] || ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}
            </CardContent>
          </Card>
        ))}

        <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
          {submitting ? "Enviando…" : "Enviar respostas"}
        </Button>
      </div>
    </div>
  );
}
