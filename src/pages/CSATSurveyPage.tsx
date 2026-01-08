import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface SurveyContext {
  surveyId: string;
  meetingId: string;
  projectId: string;
  meetingTitle: string | null;
  meetingDate: string | null;
  project: {
    product_name: string;
    company_name: string | null;
  };
}

const CSATSurveyPage = () => {
  const [searchParams] = useSearchParams();

  const getHashParams = () => {
    const hash = window.location.hash || "";
    const idx = hash.indexOf("?");
    return new URLSearchParams(idx >= 0 ? hash.slice(idx + 1) : "");
  };

  const hashParams = getHashParams();
  const token = searchParams.get('token') || hashParams.get('token');
  const meetingParam = searchParams.get('meeting') || hashParams.get('meeting');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<SurveyContext | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [respondentName, setRespondentName] = useState('');

  useEffect(() => {
    if (token || meetingParam) {
      fetchSurveyContext();
    } else {
      setError('Link de pesquisa inválido');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, meetingParam]);

  const fetchSurveyContext = async () => {
    try {
      const effectiveToken = token;
      if (!effectiveToken) {
        setError('Link de pesquisa inválido');
        return;
      }

      const { data, error } = await supabase.functions.invoke('csat-public', {
        body: { action: 'get', token: effectiveToken },
      });

      if (error) {
        console.error('csat-public get error:', error);
        setError('Pesquisa não encontrada. Solicite um novo link.');
        return;
      }

      if (data?.alreadyResponded) {
        setError('Esta pesquisa já foi respondida');
        return;
      }

      setCtx(data);
    } catch (err) {
      console.error('Error fetching CSAT context:', err);
      setError('Erro ao carregar pesquisa');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (score === null || !ctx) {
      toast.error('Por favor, selecione uma nota');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('csat-public', {
        body: {
          action: 'submit',
          token: token,
          score,
          feedback: feedback || null,
          respondentName: respondentName || null,
        },
      });

      if (error) {
        console.error('csat-public submit error:', error);
        toast.error('Erro ao enviar resposta');
        return;
      }

      if (data?.error === 'already_responded') {
        setError('Esta pesquisa já foi respondida');
        return;
      }

      setSubmitted(true);
      toast.success('Obrigado pelo seu feedback!');
    } catch (err: any) {
      console.error('Error submitting response:', err);
      toast.error('Erro ao enviar resposta');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (value: number, selectedScore: number | null) => {
    if (selectedScore === value) {
      if (value <= 2) return 'bg-destructive text-destructive-foreground border-destructive';
      if (value === 3) return 'bg-yellow-500 text-white border-yellow-500';
      return 'bg-green-500 text-white border-green-500';
    }
    return 'bg-background hover:bg-muted border-border';
  };

  const getScoreLabel = (value: number) => {
    if (value <= 2) return 'Insatisfeito';
    if (value === 3) return 'Neutro';
    if (value === 4) return 'Satisfeito';
    return 'Muito Satisfeito';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Carregando pesquisa...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">Ops!</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-full max-w-md">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Obrigado!</h2>
              <p className="text-muted-foreground">
                Sua resposta foi registrada com sucesso. Agradecemos seu feedback!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Star className="h-6 w-6 text-yellow-500" />
              <span className="text-xl font-semibold">Pesquisa de Satisfação</span>
            </div>
            <CardTitle className="text-lg">
              {ctx?.project.company_name || ctx?.project.product_name}
            </CardTitle>
            {ctx?.meetingTitle && (
              <CardDescription>
                Reunião: {ctx.meetingTitle}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Main Question */}
            <div className="space-y-4">
              <Label className="text-base font-medium block text-center">
                De 1 a 5, o quanto você ficou satisfeito com a reunião de hoje?
              </Label>

              {/* Score Selection */}
              <div className="flex justify-center gap-2 flex-wrap">
                {[1, 2, 3, 4, 5].map((value) => (
                  <motion.button
                    key={value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setScore(value)}
                    className={`w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-colors ${getScoreColor(value, score)}`}
                  >
                    <span className="text-xl font-bold">{value}</span>
                  </motion.button>
                ))}
              </div>

              {/* Score labels */}
              <div className="flex justify-between text-xs text-muted-foreground px-2">
                <span>Insatisfeito</span>
                <span>Muito Satisfeito</span>
              </div>

              {score !== null && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm font-medium"
                >
                  {getScoreLabel(score)}
                </motion.p>
              )}
            </div>

            {/* Open Question */}
            <div className="space-y-2">
              <Label htmlFor="feedback">O que podemos melhorar?</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Seu feedback nos ajuda a melhorar..."
                rows={3}
              />
            </div>

            {/* Respondent Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Seu nome (opcional)</Label>
              <Input
                id="name"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Como podemos te chamar?"
              />
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || score === null}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Resposta'
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by UNV Nexus
        </p>
      </motion.div>
    </div>
  );
};

export default CSATSurveyPage;
