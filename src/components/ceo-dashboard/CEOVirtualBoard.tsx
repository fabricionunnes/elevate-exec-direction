import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Send, 
  Loader2, 
  DollarSign, 
  Settings, 
  TrendingUp, 
  Heart,
  Crown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  History,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BoardSession {
  id: string;
  decision_title: string;
  decision_description: string;
  context_data: any;
  consensus_points: string[];
  divergence_points: string[];
  critical_risks: string[];
  opportunities: string[];
  board_summary: string | null;
  final_recommendation: string | null;
  ceo_decision: string | null;
  ceo_notes: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface BoardOpinion {
  id: string;
  session_id: string;
  advisor_role: string;
  advisor_name: string;
  opinion: string;
  risks: string[];
  opportunities: string[];
  suggested_adjustments: string[];
  recommendation: string | null;
  created_at: string;
}

const ADVISOR_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  'CFO': { 
    icon: <DollarSign className="h-5 w-5" />, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100' 
  },
  'COO': { 
    icon: <Settings className="h-5 w-5" />, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-100' 
  },
  'CRO': { 
    icon: <TrendingUp className="h-5 w-5" />, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100' 
  },
  'CPO': { 
    icon: <Heart className="h-5 w-5" />, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-100' 
  },
  'Board Chair': { 
    icon: <Crown className="h-5 w-5" />, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100' 
  },
};

export function CEOVirtualBoard() {
  const [sessions, setSessions] = useState<BoardSession[]>([]);
  const [currentSession, setCurrentSession] = useState<BoardSession | null>(null);
  const [opinions, setOpinions] = useState<BoardOpinion[]>([]);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionDescription, setDecisionDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ceoNotes, setCeoNotes] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (currentSession?.id) {
      fetchOpinions(currentSession.id);
    }
  }, [currentSession?.id]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ceo_board_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Erro ao carregar sessões do Board');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOpinions = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('ceo_board_opinions')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOpinions(data || []);
    } catch (error) {
      console.error('Error fetching opinions:', error);
    }
  };

  const submitToBoard = async () => {
    if (!decisionTitle.trim() || !decisionDescription.trim()) {
      toast.error('Preencha o título e descrição da decisão');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('ceo_board_sessions')
        .insert({
          decision_title: decisionTitle,
          decision_description: decisionDescription,
          status: 'pending'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast.info('Convocando o Board Virtual...');

      // Call edge function to get advisor opinions
      const { data: authData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke('ceo-virtual-board', {
        body: {
          sessionId: session.id,
          decision: `${decisionTitle}\n\n${decisionDescription}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Board Virtual concluiu a análise!');
      
      // Refresh data
      await fetchSessions();
      
      // Load the new session
      const { data: updatedSession } = await supabase
        .from('ceo_board_sessions')
        .select('*')
        .eq('id', session.id)
        .single();
      
      if (updatedSession) {
        setCurrentSession(updatedSession);
        await fetchOpinions(session.id);
      }

      // Clear form
      setDecisionTitle('');
      setDecisionDescription('');

    } catch (error) {
      console.error('Error submitting to board:', error);
      toast.error('Erro ao consultar o Board Virtual');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateCEODecision = async (decision: 'aprovada' | 'ajustada' | 'rejeitada') => {
    if (!currentSession) return;

    try {
      const { error } = await supabase
        .from('ceo_board_sessions')
        .update({
          ceo_decision: decision,
          ceo_notes: ceoNotes
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      toast.success(`Decisão marcada como ${decision}`);
      
      // Refresh
      await fetchSessions();
      const { data: updated } = await supabase
        .from('ceo_board_sessions')
        .select('*')
        .eq('id', currentSession.id)
        .single();
      
      if (updated) {
        setCurrentSession(updated);
      }
    } catch (error) {
      console.error('Error updating decision:', error);
      toast.error('Erro ao salvar decisão');
    }
  };

  const getDecisionBadge = (decision: string | null) => {
    switch (decision) {
      case 'aprovada':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Aprovada</Badge>;
      case 'ajustada':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" /> Ajustada</Badge>;
      case 'rejeitada':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Rejeitada</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Board Virtual
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Conselho Executivo Virtual com 5 Conselheiros IA especializados
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="submit" className="space-y-4">
            <TabsList>
              <TabsTrigger value="submit" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Nova Consulta
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Análise Atual
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* Submit New Decision */}
            <TabsContent value="submit" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Título da Decisão/Dilema
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Ex: Devo aumentar preços em 10%?"
                    value={decisionTitle}
                    onChange={(e) => setDecisionTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Descrição Detalhada
                  </label>
                  <Textarea
                    placeholder="Descreva o contexto, as opções consideradas, as preocupações..."
                    value={decisionDescription}
                    onChange={(e) => setDecisionDescription(e.target.value)}
                    rows={5}
                  />
                </div>
                <Button 
                  onClick={submitToBoard} 
                  disabled={isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Consultando o Board...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      Submeter ao Board Virtual
                    </>
                  )}
                </Button>

                {/* Advisors Preview */}
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {Object.entries(ADVISOR_CONFIG).map(([role, config]) => (
                    <div 
                      key={role}
                      className={`p-3 rounded-lg ${config.bgColor} text-center`}
                    >
                      <div className={`${config.color} flex justify-center mb-1`}>
                        {config.icon}
                      </div>
                      <span className="text-xs font-medium">{role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Current Analysis */}
            <TabsContent value="analysis" className="space-y-4">
              {currentSession ? (
                <div className="space-y-6">
                  {/* Session Header */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{currentSession.decision_title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {currentSession.decision_description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(currentSession.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {getDecisionBadge(currentSession.ceo_decision)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Advisor Opinions */}
                  <div className="grid gap-4">
                    <h4 className="font-semibold">Pareceres dos Conselheiros</h4>
                    {opinions.map((opinion) => {
                      const config = ADVISOR_CONFIG[opinion.advisor_role] || ADVISOR_CONFIG['Board Chair'];
                      return (
                        <Card key={opinion.id}>
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2 rounded-full ${config.bgColor}`}>
                                <span className={config.color}>{config.icon}</span>
                              </div>
                              <div>
                                <span className="font-semibold">{opinion.advisor_name}</span>
                                <span className="text-sm text-muted-foreground ml-2">({opinion.advisor_role})</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <h5 className="text-sm font-medium mb-1">Opinião</h5>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {opinion.opinion}
                                </p>
                              </div>

                              {opinion.risks && opinion.risks.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium mb-1 text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Riscos
                                  </h5>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {opinion.risks.map((risk, i) => (
                                      <li key={i}>{risk}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {opinion.opportunities && opinion.opportunities.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium mb-1 text-green-600 flex items-center gap-1">
                                    <Lightbulb className="h-3 w-3" /> Oportunidades
                                  </h5>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                                    {opinion.opportunities.map((opp, i) => (
                                      <li key={i}>{opp}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {opinion.recommendation && (
                                <div className="bg-muted p-2 rounded">
                                  <h5 className="text-sm font-medium mb-1">Recomendação</h5>
                                  <p className="text-sm">{opinion.recommendation}</p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Board Summary */}
                  {currentSession.status === 'completed' && (
                    <Card className="border-2 border-primary">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-primary" />
                          Resumo do Board
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {currentSession.consensus_points && currentSession.consensus_points.length > 0 && (
                          <div>
                            <h5 className="font-medium text-green-600 mb-2">✓ Pontos de Consenso</h5>
                            <ul className="list-disc list-inside text-sm">
                              {currentSession.consensus_points.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSession.divergence_points && currentSession.divergence_points.length > 0 && (
                          <div>
                            <h5 className="font-medium text-yellow-600 mb-2">⚡ Pontos de Divergência</h5>
                            <ul className="list-disc list-inside text-sm">
                              {currentSession.divergence_points.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSession.critical_risks && currentSession.critical_risks.length > 0 && (
                          <div>
                            <h5 className="font-medium text-red-600 mb-2">⚠️ Riscos Críticos</h5>
                            <ul className="list-disc list-inside text-sm">
                              {currentSession.critical_risks.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSession.opportunities && currentSession.opportunities.length > 0 && (
                          <div>
                            <h5 className="font-medium text-blue-600 mb-2">💡 Oportunidades</h5>
                            <ul className="list-disc list-inside text-sm">
                              {currentSession.opportunities.map((o, i) => (
                                <li key={i}>{o}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSession.board_summary && (
                          <div className="bg-muted p-4 rounded-lg">
                            <h5 className="font-medium mb-2">Síntese Executiva</h5>
                            <p className="text-sm whitespace-pre-wrap">{currentSession.board_summary}</p>
                          </div>
                        )}

                        {currentSession.final_recommendation && (
                          <div className="bg-primary/10 p-4 rounded-lg border border-primary">
                            <h5 className="font-semibold text-primary mb-2">Recomendação Final do Conselho</h5>
                            <p className="text-sm">{currentSession.final_recommendation}</p>
                          </div>
                        )}

                        {/* CEO Decision */}
                        {!currentSession.ceo_decision && (
                          <div className="border-t pt-4 mt-4">
                            <h5 className="font-medium mb-3">Sua Decisão como CEO</h5>
                            <Textarea
                              placeholder="Adicione suas observações (opcional)..."
                              value={ceoNotes}
                              onChange={(e) => setCeoNotes(e.target.value)}
                              rows={2}
                              className="mb-3"
                            />
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => updateCEODecision('aprovada')}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Aprovar
                              </Button>
                              <Button 
                                onClick={() => updateCEODecision('ajustada')}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Ajustar
                              </Button>
                              <Button 
                                onClick={() => updateCEODecision('rejeitada')}
                                className="flex-1 bg-red-600 hover:bg-red-700"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Rejeitar
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma sessão do histórico ou submeta uma nova decisão ao Board</p>
                </div>
              )}
            </TabsContent>

            {/* History */}
            <TabsContent value="history">
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <Card 
                      key={session.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        currentSession?.id === session.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setCurrentSession(session)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">{session.decision_title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {session.decision_description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(session.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getDecisionBadge(session.ceo_decision)}
                            {session.status === 'analyzing' && (
                              <Badge variant="outline">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Analisando
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {sessions.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma sessão do Board ainda</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
