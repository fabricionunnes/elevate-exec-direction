import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Copy, 
  ExternalLink,
  Calendar,
  User,
  MessageSquare,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface NPSResponse {
  id: string;
  score: number;
  feedback: string | null;
  what_can_improve: string | null;
  would_recommend_why: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  created_at: string;
}

interface NPSHistoryPanelProps {
  projectId: string;
  currentNps: number | null;
  userRole?: 'admin' | 'cs' | 'consultant';
}

export function NPSHistoryPanel({ projectId, currentNps, userRole }: NPSHistoryPanelProps) {
  const [responses, setResponses] = useState<NPSResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResponses();
  }, [projectId]);

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('onboarding_nps_responses')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching NPS responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNpsLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/nps?project=${projectId}`;
  };

  const copyNpsLink = () => {
    navigator.clipboard.writeText(getNpsLink());
    toast.success('Link copiado para a área de transferência');
  };

  const getScoreColor = (score: number) => {
    if (score <= 6) return 'bg-destructive text-destructive-foreground';
    if (score <= 8) return 'bg-yellow-500 text-white';
    return 'bg-green-500 text-white';
  };

  const getScoreLabel = (score: number) => {
    if (score <= 6) return 'Detrator';
    if (score <= 8) return 'Neutro';
    return 'Promotor';
  };

  const getTrend = () => {
    if (responses.length < 2) return null;
    const latest = responses[0].score;
    const previous = responses[1].score;
    const diff = latest - previous;
    
    if (diff > 0) return { direction: 'up', diff };
    if (diff < 0) return { direction: 'down', diff: Math.abs(diff) };
    return { direction: 'stable', diff: 0 };
  };

  const calculateAverageNps = () => {
    if (responses.length === 0) return null;
    const sum = responses.reduce((acc, r) => acc + r.score, 0);
    return (sum / responses.length).toFixed(1);
  };

  const trend = getTrend();
  const averageNps = calculateAverageNps();
  const canViewNpsLink = userRole === 'admin' || userRole === 'cs';

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando histórico NPS...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* NPS Link Card - Only visible to admin and CS */}
      {canViewNpsLink && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Link da Pesquisa NPS</CardTitle>
            <CardDescription>Compartilhe este link com o cliente para coletar feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate">
                {getNpsLink()}
              </div>
              <Button variant="outline" size="icon" onClick={copyNpsLink}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={getNpsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NPS Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">NPS Atual</p>
              {currentNps !== null ? (
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-3xl font-bold px-3 py-1 rounded-lg ${getScoreColor(currentNps)}`}>
                    {currentNps}
                  </span>
                  {trend && (
                    <span className={`flex items-center text-sm ${
                      trend.direction === 'up' ? 'text-green-600' :
                      trend.direction === 'down' ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {trend.direction === 'up' && <ArrowUp className="h-4 w-4" />}
                      {trend.direction === 'down' && <ArrowDown className="h-4 w-4" />}
                      {trend.direction === 'stable' && <Minus className="h-4 w-4" />}
                      {trend.diff > 0 && `+${trend.diff}`}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-2xl text-muted-foreground">--</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Média Histórica</p>
              <span className="text-3xl font-bold text-primary">
                {averageNps || '--'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total de Respostas</p>
              <span className="text-3xl font-bold text-primary">
                {responses.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NPS History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Respostas</CardTitle>
          <CardDescription>
            Acompanhe a evolução da satisfação do cliente ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma resposta de NPS registrada ainda.</p>
              <p className="text-sm mt-1">Compartilhe o link acima com o cliente.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {responses.map((response, index) => {
                  const prevResponse = responses[index + 1];
                  const scoreDiff = prevResponse ? response.score - prevResponse.score : 0;
                  
                  return (
                    <div key={response.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${getScoreColor(response.score)}`}>
                            {response.score}
                          </div>
                          <div>
                            <Badge variant="outline" className="mb-1">
                              {getScoreLabel(response.score)}
                            </Badge>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(response.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        
                        {scoreDiff !== 0 && (
                          <Badge 
                            variant={scoreDiff > 0 ? 'default' : 'destructive'}
                            className="flex items-center gap-1"
                          >
                            {scoreDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                          </Badge>
                        )}
                      </div>

                      {(response.respondent_name || response.respondent_email) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <User className="h-3 w-3" />
                          {response.respondent_name || response.respondent_email}
                        </div>
                      )}

                      {response.would_recommend_why && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">Por que deu essa nota:</p>
                          <p className="text-sm">{response.would_recommend_why}</p>
                        </div>
                      )}

                      {response.what_can_improve && (
                        <div className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">O que podemos melhorar:</p>
                          <p className="text-sm">{response.what_can_improve}</p>
                        </div>
                      )}

                      {response.feedback && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Comentários adicionais:</p>
                          <p className="text-sm">{response.feedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
