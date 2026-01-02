import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle, Star } from 'lucide-react';

export default function NPSSurveyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('project');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [projectInfo, setProjectInfo] = useState<{ product_name: string; company_name?: string } | null>(null);
  
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [whatCanImprove, setWhatCanImprove] = useState('');
  const [wouldRecommendWhy, setWouldRecommendWhy] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');

  useEffect(() => {
    const fetchProjectInfo = async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('onboarding_projects')
          .select(`
            product_name,
            onboarding_company_id,
            onboarding_companies(name)
          `)
          .eq('id', projectId)
          .single();

        if (error) throw error;

        setProjectInfo({
          product_name: data.product_name,
          company_name: (data.onboarding_companies as any)?.name
        });
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectInfo();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (score === null) {
      toast.error('Por favor, selecione uma nota de 0 a 10');
      return;
    }

    if (!projectId) {
      toast.error('Link inválido');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('onboarding_nps_responses')
        .insert({
          project_id: projectId,
          score,
          feedback: feedback.trim() || null,
          what_can_improve: whatCanImprove.trim() || null,
          would_recommend_why: wouldRecommendWhy.trim() || null,
          respondent_name: respondentName.trim() || null,
          respondent_email: respondentEmail.trim() || null,
        });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Obrigado pelo seu feedback!');
    } catch (error) {
      console.error('Error submitting NPS:', error);
      toast.error('Erro ao enviar pesquisa. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (value: number) => {
    if (value <= 6) return 'bg-destructive text-destructive-foreground';
    if (value <= 8) return 'bg-yellow-500 text-white';
    return 'bg-green-500 text-white';
  };

  const getScoreLabel = (value: number) => {
    if (value <= 6) return 'Detrator';
    if (value <= 8) return 'Neutro';
    return 'Promotor';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!projectId || !projectInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Link Inválido</CardTitle>
            <CardDescription>
              Este link de pesquisa NPS não é válido ou expirou.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-green-600">Obrigado!</CardTitle>
            <CardDescription className="text-base">
              Sua avaliação foi registrada com sucesso. Agradecemos o seu feedback, ele é muito importante para continuarmos melhorando nossos serviços.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center border-b">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Pesquisa de Satisfação</CardTitle>
            <CardDescription className="text-base">
              {projectInfo.company_name && (
                <span className="font-medium text-foreground">{projectInfo.company_name}</span>
              )}
              {projectInfo.company_name && ' • '}
              {projectInfo.product_name}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* NPS Score Question */}
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossos serviços para um amigo ou colega?
                  <span className="text-destructive ml-1">*</span>
                </Label>
                
                <div className="flex flex-wrap gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScore(value)}
                      className={`
                        h-12 w-12 rounded-lg font-semibold text-lg transition-all
                        ${score === value 
                          ? getScoreColor(value) + ' ring-2 ring-offset-2 ring-primary scale-110' 
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                        }
                      `}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                
                <div className="flex justify-between text-sm text-muted-foreground px-1">
                  <span>Pouco provável</span>
                  <span>Muito provável</span>
                </div>

                {score !== null && (
                  <div className={`text-center py-2 px-4 rounded-lg ${getScoreColor(score)}`}>
                    Você é um <strong>{getScoreLabel(score)}</strong> (Nota: {score})
                  </div>
                )}
              </div>

              {/* Why would recommend */}
              <div className="space-y-2">
                <Label htmlFor="wouldRecommendWhy">
                  Por que você deu essa nota?
                </Label>
                <Textarea
                  id="wouldRecommendWhy"
                  value={wouldRecommendWhy}
                  onChange={(e) => setWouldRecommendWhy(e.target.value)}
                  placeholder="Conte-nos o motivo da sua avaliação..."
                  rows={3}
                />
              </div>

              {/* What can improve */}
              <div className="space-y-2">
                <Label htmlFor="whatCanImprove">
                  O que podemos melhorar?
                </Label>
                <Textarea
                  id="whatCanImprove"
                  value={whatCanImprove}
                  onChange={(e) => setWhatCanImprove(e.target.value)}
                  placeholder="Sugestões de melhoria..."
                  rows={3}
                />
              </div>

              {/* General feedback */}
              <div className="space-y-2">
                <Label htmlFor="feedback">
                  Comentários adicionais (opcional)
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Qualquer outro comentário que queira compartilhar..."
                  rows={3}
                />
              </div>

              {/* Respondent info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="respondentName">Seu nome (opcional)</Label>
                  <Input
                    id="respondentName"
                    value={respondentName}
                    onChange={(e) => setRespondentName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="respondentEmail">Seu e-mail (opcional)</Label>
                  <Input
                    id="respondentEmail"
                    type="email"
                    value={respondentEmail}
                    onChange={(e) => setRespondentEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitting || score === null}
              >
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Esta pesquisa é anônima e seus dados são tratados com confidencialidade.
        </p>
      </div>
    </div>
  );
}
