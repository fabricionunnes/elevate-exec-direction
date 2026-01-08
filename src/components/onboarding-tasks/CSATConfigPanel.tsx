import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy, 
  ExternalLink,
  Star,
  Calendar,
  User,
  MessageSquare,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Meeting {
  id: string;
  meeting_title: string | null;
  meeting_date: string | null;
  subject: string | null;
  is_finalized: boolean;
}

interface CSATSurvey {
  id: string;
  meeting_id: string;
  access_token: string;
  status: string | null;
}

interface CSATResponse {
  id: string;
  meeting_id: string;
  score: number;
  feedback: string | null;
  respondent_name: string | null;
  responded_at: string;
}

interface CSATConfigPanelProps {
  projectId: string;
  userRole?: 'admin' | 'cs' | 'consultant';
}

function generateToken(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function CSATConfigPanel({ projectId }: CSATConfigPanelProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [surveysByMeeting, setSurveysByMeeting] = useState<Map<string, CSATSurvey>>(new Map());
  const [responses, setResponses] = useState<Map<string, CSATResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [creatingMeetingId, setCreatingMeetingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      // Fetch all finalized meetings for this project
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('onboarding_meeting_notes')
        .select('id, meeting_title, meeting_date, subject, is_finalized')
        .eq('project_id', projectId)
        .eq('is_finalized', true)
        .order('meeting_date', { ascending: false });

      if (meetingsError) throw meetingsError;
      setMeetings(meetingsData || []);

      const meetingIds = meetingsData?.map((m) => m.id) || [];

      // Fetch surveys (token links) for these meetings
      if (meetingIds.length > 0) {
        const { data: surveysData } = await supabase
          .from('csat_surveys')
          .select('id, meeting_id, access_token, status')
          .eq('project_id', projectId)
          .in('meeting_id', meetingIds);

        const surveysMap = new Map((surveysData || []).map((s) => [s.meeting_id, s]));
        setSurveysByMeeting(surveysMap);

        // Fetch CSAT responses for these meetings
        const { data: responsesData } = await supabase
          .from('csat_responses')
          .select('*')
          .in('meeting_id', meetingIds);

        const responsesMap = new Map((responsesData || []).map((r) => [r.meeting_id, r]));
        setResponses(responsesMap);
      } else {
        setSurveysByMeeting(new Map());
        setResponses(new Map());
      }
    } catch (error) {
      console.error('Error fetching CSAT data:', error);
      toast.error('Erro ao carregar dados CSAT');
    } finally {
      setLoading(false);
    }
  };

  const getCSATLink = (accessToken: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/#/csat?token=${accessToken}`;
  };

  const ensureSurveyAndCopy = async (meetingId: string) => {
    const existing = surveysByMeeting.get(meetingId);
    if (existing?.access_token) {
      navigator.clipboard.writeText(getCSATLink(existing.access_token));
      toast.success('Link copiado para a área de transferência');
      return;
    }

    setCreatingMeetingId(meetingId);
    try {
      const accessToken = generateToken(16);
      const { data, error } = await supabase
        .from('csat_surveys')
        .insert({
          project_id: projectId,
          meeting_id: meetingId,
          access_token: accessToken,
          status: 'pending',
        })
        .select('id, meeting_id, access_token, status')
        .single();

      if (error) throw error;

      setSurveysByMeeting((prev) => {
        const next = new Map(prev);
        next.set(meetingId, data as any);
        return next;
      });

      navigator.clipboard.writeText(getCSATLink(accessToken));
      toast.success('Link copiado para a área de transferência');
    } catch (e) {
      console.error('Error creating CSAT survey:', e);
      toast.error('Erro ao gerar link');
    } finally {
      setCreatingMeetingId(null);
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

  // Calculate CSAT stats
  const calculateStats = () => {
    const respondedMeetings = Array.from(responses.values());
    if (respondedMeetings.length === 0) return { average: null, total: 0, detractors: 0, neutrals: 0, promoters: 0 };

    const scores = respondedMeetings.map(r => r.score);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      average: average.toFixed(1),
      total: respondedMeetings.length,
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
          Carregando dados CSAT...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Meetings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Reuniões Finalizadas
          </CardTitle>
          <CardDescription>
            Copie o link para enviar a pesquisa CSAT ao cliente após cada reunião
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma reunião finalizada ainda.</p>
              <p className="text-sm mt-1">Finalize reuniões na aba Reuniões para gerar links CSAT.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {meetings.map((meeting) => {
                  const response = responses.get(meeting.id);
                  const hasResponse = !!response;

                  return (
                    <div key={meeting.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {hasResponse ? (
                              <Badge className={getScoreColor(response.score)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Nota {response.score} - {getScoreLabel(response.score)}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Aguardando resposta</Badge>
                            )}
                          </div>
                          
                          <h4 className="font-medium truncate">
                            {meeting.meeting_title || meeting.subject || 'Reunião'}
                          </h4>
                          
                          {meeting.meeting_date && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(meeting.meeting_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>
                          )}

                          {hasResponse && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                              {response.respondent_name && (
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="h-3 w-3" />
                                  <span>{response.respondent_name}</span>
                                </div>
                              )}
                              {response.feedback && (
                                <p className="text-sm text-muted-foreground italic">
                                  "{response.feedback}"
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Respondido em {format(new Date(response.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => ensureSurveyAndCopy(meeting.id)}
                            disabled={creatingMeetingId === meeting.id}
                          >
                            {creatingMeetingId === meeting.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Gerando...
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copiar Link
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!surveysByMeeting.get(meeting.id)?.access_token}
                            onClick={() => {
                              const s = surveysByMeeting.get(meeting.id);
                              if (!s?.access_token) return;
                              window.open(getCSATLink(s.access_token), '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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
