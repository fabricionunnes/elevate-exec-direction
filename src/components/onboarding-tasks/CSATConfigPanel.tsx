import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings2, 
  Save, 
  Copy, 
  ExternalLink,
  Star,
  Calendar,
  User,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface CSATConfig {
  id: string;
  project_id: string;
  is_active: boolean;
  send_type: 'automatic' | 'manual';
  send_timing: 'immediate' | '1_hour' | '1_day';
  main_question: string;
  scale_min: number;
  scale_max: number;
  open_question: string;
  link_reusable: boolean;
}

interface CSATSurvey {
  id: string;
  meeting_id: string;
  access_token: string;
  status: 'pending' | 'sent' | 'waiting' | 'responded' | 'expired';
  sent_at: string | null;
  created_at: string;
  meeting?: {
    meeting_title: string | null;
    meeting_date: string | null;
    subject: string | null;
  };
  task?: {
    id: string;
    title: string;
    status: string;
  } | null;
  response?: CSATResponse | null;
}

interface CSATResponse {
  id: string;
  score: number;
  feedback: string | null;
  respondent_name: string | null;
  responded_at: string;
}

interface CSATConfigPanelProps {
  projectId: string;
  userRole?: 'admin' | 'cs' | 'consultant';
}

export function CSATConfigPanel({ projectId, userRole }: CSATConfigPanelProps) {
  const [config, setConfig] = useState<CSATConfig | null>(null);
  const [surveys, setSurveys] = useState<CSATSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = userRole === 'admin' || userRole === 'cs';

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      // Fetch config
      const { data: configData, error: configError } = await supabase
        .from('csat_configs')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (configError) throw configError;
      
      if (configData) {
        setConfig(configData as CSATConfig);
      } else {
        // Create default config if none exists
        const { data: newConfig, error: createError } = await supabase
          .from('csat_configs')
          .insert({
            project_id: projectId,
            is_active: false,
            send_type: 'automatic',
            send_timing: 'immediate',
            main_question: 'De 1 a 5, o quanto você ficou satisfeito com a reunião de hoje?',
            scale_min: 1,
            scale_max: 5,
            open_question: 'O que podemos melhorar?',
            link_reusable: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        setConfig(newConfig as CSATConfig);
      }

      // Fetch surveys with responses
      const { data: surveysData, error: surveysError } = await supabase
        .from('csat_surveys')
        .select(`
          *,
          meeting:onboarding_meeting_notes(meeting_title, meeting_date, subject),
          task:onboarding_tasks(id, title, status)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (surveysError) throw surveysError;

      // Fetch responses for these surveys
      const surveyIds = surveysData?.map(s => s.id) || [];
      if (surveyIds.length > 0) {
        const { data: responsesData } = await supabase
          .from('csat_responses')
          .select('*')
          .in('survey_id', surveyIds);

        const responsesMap = new Map(responsesData?.map(r => [r.survey_id, r]) || []);
        
        setSurveys(surveysData?.map(s => ({
          ...s,
          response: responsesMap.get(s.id) || null
        })) as CSATSurvey[] || []);
      } else {
        setSurveys([]);
      }
    } catch (error) {
      console.error('Error fetching CSAT data:', error);
      toast.error('Erro ao carregar configurações CSAT');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('csat_configs')
        .update({
          is_active: config.is_active,
          send_type: config.send_type,
          send_timing: config.send_timing,
          main_question: config.main_question,
          open_question: config.open_question,
          link_reusable: config.link_reusable,
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('Configurações salvas com sucesso');
    } catch (error) {
      console.error('Error saving CSAT config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const getSurveyLink = (survey: CSATSurvey) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/csat?token=${survey.access_token}`;
  };

  const copySurveyLink = (survey: CSATSurvey) => {
    navigator.clipboard.writeText(getSurveyLink(survey));
    toast.success('Link copiado para a área de transferência');
  };

  const updateSurveyStatus = async (surveyId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'sent' || status === 'waiting') {
        updates.sent_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('csat_surveys')
        .update(updates)
        .eq('id', surveyId);

      if (error) throw error;
      
      fetchData();
      toast.success('Status atualizado');
    } catch (error) {
      console.error('Error updating survey status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getScoreColor = (score: number) => {
    if (score <= 2) return 'bg-destructive text-destructive-foreground';
    if (score === 3) return 'bg-yellow-500 text-white';
    return 'bg-green-500 text-white';
  };

  const getScoreLabel = (score: number) => {
    if (score <= 2) return 'Detrator';
    if (score === 3) return 'Neutro';
    return 'Promotor';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'sent':
        return <Badge variant="secondary"><Send className="h-3 w-3 mr-1" />Enviada</Badge>;
      case 'waiting':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
      case 'responded':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Respondida</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expirada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate CSAT stats
  const calculateStats = () => {
    const respondedSurveys = surveys.filter(s => s.response);
    if (respondedSurveys.length === 0) return { average: null, total: 0, detractors: 0, neutrals: 0, promoters: 0 };

    const scores = respondedSurveys.map(s => s.response!.score);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      average: average.toFixed(1),
      total: respondedSurveys.length,
      detractors: scores.filter(s => s <= 2).length,
      neutrals: scores.filter(s => s === 3).length,
      promoters: scores.filter(s => s >= 4).length,
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Carregando configurações CSAT...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Configurações da Pesquisa CSAT
            </CardTitle>
            <CardDescription>
              Configure como e quando a pesquisa CSAT será enviada após reuniões
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pesquisa CSAT Ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativa, tarefas serão criadas automaticamente após reuniões
                </p>
              </div>
              <Switch
                checked={config?.is_active || false}
                onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, is_active: checked } : null)}
              />
            </div>

            <Separator />

            {/* Send Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Envio</Label>
                <Select
                  value={config?.send_type || 'automatic'}
                  onValueChange={(value: 'automatic' | 'manual') => 
                    setConfig(prev => prev ? { ...prev, send_type: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automático após reunião</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tempo para Envio</Label>
                <Select
                  value={config?.send_timing || 'immediate'}
                  onValueChange={(value: 'immediate' | '1_hour' | '1_day') => 
                    setConfig(prev => prev ? { ...prev, send_timing: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Imediato</SelectItem>
                    <SelectItem value="1_hour">1 hora após</SelectItem>
                    <SelectItem value="1_day">1 dia após</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Questions */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pergunta Principal</Label>
                <Textarea
                  value={config?.main_question || ''}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, main_question: e.target.value } : null)}
                  placeholder="De 1 a 5, o quanto você ficou satisfeito com a reunião de hoje?"
                />
                <p className="text-xs text-muted-foreground">
                  Escala: 1 a 5 (1-2 Detrator, 3 Neutro, 4-5 Promotor)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Pergunta Aberta (opcional)</Label>
                <Textarea
                  value={config?.open_question || ''}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, open_question: e.target.value } : null)}
                  placeholder="O que podemos melhorar?"
                />
              </div>
            </div>

            <Separator />

            {/* Link Settings */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Links Reutilizáveis</Label>
                <p className="text-sm text-muted-foreground">
                  Permitir que o mesmo link seja usado mais de uma vez
                </p>
              </div>
              <Switch
                checked={config?.link_reusable || false}
                onCheckedChange={(checked) => setConfig(prev => prev ? { ...prev, link_reusable: checked } : null)}
              />
            </div>

            <Button onClick={handleSaveConfig} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CSAT Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">CSAT Médio</p>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-3xl font-bold px-3 py-1 rounded-lg ${
                  stats.average ? getScoreColor(parseFloat(stats.average)) : 'bg-muted'
                }`}>
                  {stats.average || '--'}
                </span>
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total de Respostas</p>
              <span className="text-3xl font-bold text-primary">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Promotores (4-5)</p>
              <span className="text-3xl font-bold text-green-500">{stats.promoters}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Detratores (1-2)</p>
              <span className="text-3xl font-bold text-destructive">{stats.detractors}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Surveys List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Pesquisas CSAT
          </CardTitle>
          <CardDescription>
            Pesquisas geradas a partir de reuniões realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {surveys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma pesquisa CSAT gerada ainda.</p>
              <p className="text-sm mt-1">Pesquisas serão criadas automaticamente quando reuniões forem finalizadas.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {surveys.map((survey) => (
                  <div key={survey.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(survey.status)}
                          {survey.response && (
                            <Badge className={getScoreColor(survey.response.score)}>
                              Nota {survey.response.score} - {getScoreLabel(survey.response.score)}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium">
                          {survey.meeting?.meeting_title || 'Reunião'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {survey.meeting?.meeting_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(survey.meeting.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                          {survey.response?.respondent_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {survey.response.respondent_name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copySurveyLink(survey)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={getSurveyLink(survey)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    {survey.response?.feedback && (
                      <div className="bg-muted rounded-lg p-3 mt-3">
                        <p className="text-xs text-muted-foreground mb-1">Feedback:</p>
                        <p className="text-sm">{survey.response.feedback}</p>
                      </div>
                    )}

                    {survey.status !== 'responded' && canEdit && (
                      <div className="flex items-center gap-2 mt-3">
                        <p className="text-xs text-muted-foreground mr-2">Alterar status:</p>
                        {survey.status === 'pending' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateSurveyStatus(survey.id, 'sent')}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Marcar como Enviada
                          </Button>
                        )}
                        {(survey.status === 'sent' || survey.status === 'pending') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => updateSurveyStatus(survey.id, 'waiting')}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Aguardando Resposta
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
