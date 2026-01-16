import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  Brain,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Target,
  TrendingUp,
  Shield,
  Clock,
  History,
  Send,
  ChevronRight,
  Sparkles,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface BoardSession {
  id: string;
  decision_title: string;
  decision_description: string;
  board_summary: string | null;
  consensus_points: string[] | null;
  divergence_points: string[] | null;
  critical_risks: string[] | null;
  opportunities: string[] | null;
  final_recommendation: string | null;
  context_data: any;
  status: string | null;
  ceo_decision: string | null;
  ceo_notes: string | null;
  completed_at: string | null;
  created_at: string;
}

interface BoardOpinion {
  id: string;
  session_id: string;
  advisor_role: string;
  advisor_name: string;
  opinion: string;
  risks: string[] | null;
  opportunities: string[] | null;
  suggested_adjustments: string[] | null;
  recommendation: string | null;
  created_at: string;
}

interface ClientVirtualBoardProps {
  projectId: string;
  companyId?: string;
  companyName?: string;
}

// Advisor configs with colors adapted for client context
const ADVISOR_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  'Diretor Comercial': { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  'Diretor de Operações': { icon: Target, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'Diretor Financeiro': { icon: Shield, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'Diretor de RH': { icon: Users, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  'CEO Virtual': { icon: Brain, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
};

export function ClientVirtualBoard({ projectId, companyId, companyName }: ClientVirtualBoardProps) {
  const [sessions, setSessions] = useState<BoardSession[]>([]);
  const [currentSession, setCurrentSession] = useState<BoardSession | null>(null);
  const [opinions, setOpinions] = useState<BoardOpinion[]>([]);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionDescription, setDecisionDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ownerNotes, setOwnerNotes] = useState('');
  const [activeTab, setActiveTab] = useState('submit');

  const selectSession = (session: BoardSession) => {
    setCurrentSession(session);
    setActiveTab('analysis');
  };

  useEffect(() => {
    fetchSessions();
  }, [projectId]);

  useEffect(() => {
    if (currentSession?.id) {
      fetchOpinions(currentSession.id);
      setOwnerNotes(currentSession.ceo_notes || '');
    }
  }, [currentSession?.id]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_board_sessions')
        .select('*')
        .eq('project_id', projectId)
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
        .from('client_board_opinions')
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
        .from('client_board_sessions')
        .insert({
          project_id: projectId,
          decision_title: decisionTitle,
          decision_description: decisionDescription,
          status: 'pending'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      toast.info('Convocando o Board Virtual...');

      // Call edge function to get advisor opinions
      const response = await supabase.functions.invoke('client-virtual-board', {
        body: {
          sessionId: session.id,
          projectId: projectId,
          decision: `${decisionTitle}\n\n${decisionDescription}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('Análise do Board concluída!');
      
      // Refresh sessions
      await fetchSessions();
      
      // Select the new session
      const { data: updatedSession } = await supabase
        .from('client_board_sessions')
        .select('*')
        .eq('id', session.id)
        .single();

      if (updatedSession) {
        setCurrentSession(updatedSession);
        setActiveTab('analysis');
      }

      // Clear form
      setDecisionTitle('');
      setDecisionDescription('');
    } catch (error: any) {
      console.error('Error submitting to board:', error);
      toast.error(error?.message || 'Erro ao consultar o Board');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateOwnerDecision = async (decision: 'aprovada' | 'ajustada' | 'rejeitada') => {
    if (!currentSession) return;

    try {
      const { error } = await supabase
        .from('client_board_sessions')
        .update({
          ceo_decision: decision,
          ceo_notes: ownerNotes
        })
        .eq('id', currentSession.id);

      if (error) throw error;

      toast.success('Decisão registrada com sucesso!');
      
      // Update local state
      setCurrentSession(prev => prev ? { ...prev, ceo_decision: decision, ceo_notes: ownerNotes } : null);
      await fetchSessions();
    } catch (error) {
      console.error('Error updating decision:', error);
      toast.error('Erro ao registrar decisão');
    }
  };

  const getDecisionBadge = (decision: string | null) => {
    switch (decision) {
      case 'aprovada':
        return <Badge className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Aprovada</Badge>;
      case 'ajustada':
        return <Badge className="bg-amber-600 gap-1"><AlertTriangle className="h-3 w-3" /> Ajustada</Badge>;
      case 'rejeitada':
        return <Badge className="bg-red-600 gap-1"><XCircle className="h-3 w-3" /> Rejeitada</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
    }
  };

  const getAdvisorConfig = (role: string) => {
    return ADVISOR_CONFIG[role] || { icon: Users, color: 'text-gray-600', bg: 'bg-gray-100' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Board Virtual</CardTitle>
              <p className="text-sm text-muted-foreground">
                Consulte um conselho de diretores virtuais para decisões estratégicas
                {companyName && <span className="font-medium"> - {companyName}</span>}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="submit" className="py-2.5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Send className="h-4 w-4" />
            Nova Consulta
          </TabsTrigger>
          <TabsTrigger value="analysis" className="py-2.5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" disabled={!currentSession}>
            <MessageSquare className="h-4 w-4" />
            Análise
          </TabsTrigger>
          <TabsTrigger value="history" className="py-2.5 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Submit New Decision */}
        <TabsContent value="submit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Submeter Decisão ao Board
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Descreva a decisão ou dilema que deseja consultar com o conselho virtual
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Título da Decisão</label>
                <Input
                  placeholder="Ex: Expansão para novo mercado, Contratação de equipe..."
                  value={decisionTitle}
                  onChange={(e) => setDecisionTitle(e.target.value)}
                  disabled={isAnalyzing}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Descrição Detalhada</label>
                <Textarea
                  placeholder="Descreva o contexto, os prós e contras que você já identificou, e o que espera decidir..."
                  value={decisionDescription}
                  onChange={(e) => setDecisionDescription(e.target.value)}
                  rows={6}
                  disabled={isAnalyzing}
                />
              </div>
              <Button 
                onClick={submitToBoard} 
                disabled={isAnalyzing || !decisionTitle.trim() || !decisionDescription.trim()}
                className="w-full gap-2"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Consultando o Board...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Consultar Board Virtual
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis View */}
        <TabsContent value="analysis" className="space-y-4">
          {currentSession && (
            <>
              {/* Session Info */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{currentSession.decision_title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {currentSession.decision_description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(currentSession.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {getDecisionBadge(currentSession.ceo_decision)}
                  </div>
                </CardHeader>
              </Card>

              {/* Advisor Opinions */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {opinions.map((opinion, index) => {
                    const config = getAdvisorConfig(opinion.advisor_role);
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={opinion.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className={`h-full ${config.bg}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-full ${config.bg}`}>
                                <Icon className={`h-4 w-4 ${config.color}`} />
                              </div>
                              <div>
                                <CardTitle className="text-sm">{opinion.advisor_role}</CardTitle>
                                <p className="text-xs text-muted-foreground">{opinion.advisor_name}</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <p className="text-sm">{opinion.opinion}</p>
                            
                            {opinion.risks && opinion.risks.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-red-600 mb-1">Riscos:</p>
                                <ul className="text-xs space-y-1">
                                  {opinion.risks.map((risk, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <span className="text-red-500 shrink-0">•</span>
                                      <span>{risk}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {opinion.opportunities && opinion.opportunities.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-green-600 mb-1">Oportunidades:</p>
                                <ul className="text-xs space-y-1">
                                  {opinion.opportunities.map((opp, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <span className="text-green-500 shrink-0">•</span>
                                      <span>{opp}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {opinion.recommendation && (
                              <div className="pt-2 border-t">
                                <p className="text-xs font-medium">Recomendação:</p>
                                <p className="text-xs text-muted-foreground italic">{opinion.recommendation}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Board Summary */}
              {currentSession.board_summary && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-amber-500" />
                      Síntese do Board
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">{currentSession.board_summary}</p>

                    {currentSession.consensus_points && currentSession.consensus_points.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-600 mb-2">✅ Pontos de Consenso</h4>
                        <ul className="text-sm space-y-1">
                          {currentSession.consensus_points.map((point, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {currentSession.critical_risks && currentSession.critical_risks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-600 mb-2">⚠️ Riscos Críticos</h4>
                        <ul className="text-sm space-y-1">
                          {currentSession.critical_risks.map((risk, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {currentSession.final_recommendation && (
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Recomendação Final do Board
                        </h4>
                        <p className="text-sm">{currentSession.final_recommendation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Owner Decision */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Sua Decisão
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Registre suas considerações e decisão final..."
                    value={ownerNotes}
                    onChange={(e) => setOwnerNotes(e.target.value)}
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => updateOwnerDecision('aprovada')}
                      variant={currentSession.ceo_decision === 'aprovada' ? 'default' : 'outline'}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      onClick={() => updateOwnerDecision('ajustada')}
                      variant={currentSession.ceo_decision === 'ajustada' ? 'default' : 'outline'}
                      className="gap-2"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Ajustar
                    </Button>
                    <Button
                      onClick={() => updateOwnerDecision('rejeitada')}
                      variant={currentSession.ceo_decision === 'rejeitada' ? 'destructive' : 'outline'}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma consulta ao Board ainda</p>
                <p className="text-sm">Submeta sua primeira decisão para análise</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {sessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      currentSession?.id === session.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => selectSession(session)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{session.decision_title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {session.decision_description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(session.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getDecisionBadge(session.ceo_decision)}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
