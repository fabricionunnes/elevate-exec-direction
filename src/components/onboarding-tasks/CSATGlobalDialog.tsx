import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Search, Building2, MessageSquareHeart, ChevronDown, ChevronRight, Calendar, Star, Clock, CheckCircle2 } from "lucide-react";

interface MeetingCSATData {
  meetingId: string;
  surveyId: string | null;
  accessToken: string | null;
  meetingTitle: string;
  meetingDate: string;
  score: number | null;
  responseDate: string | null;
  status: string | null;
  companyName: string;
  projectId: string;
  productName: string;
}

interface CompanyCSATData {
  companyId: string;
  companyName: string;
  projectId: string;
  productName: string;
  averageScore: number | null;
  totalResponses: number;
  totalSurveys: number;
  meetings: MeetingCSATData[];
}

interface CSATGlobalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CSATGlobalDialog({ open, onOpenChange }: CSATGlobalDialogProps) {
  const [data, setData] = useState<CompanyCSATData[]>([]);
  const [todayMeetings, setTodayMeetings] = useState<MeetingCSATData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("today");

  useEffect(() => {
    if (open) {
      fetchCSATData();
    }
  }, [open]);

  const createSurveyForMeeting = async (meetingId: string, projectId: string): Promise<{ surveyId: string; accessToken: string } | null> => {
    try {
      const { data: newSurvey, error } = await supabase
        .from("csat_surveys")
        .insert({
          meeting_id: meetingId,
          project_id: projectId,
        })
        .select("id, access_token")
        .single();

      if (error) throw error;
      return { surveyId: newSurvey.id, accessToken: newSurvey.access_token };
    } catch (error) {
      console.error("Error creating survey:", error);
      toast.error("Erro ao criar pesquisa CSAT");
      return null;
    }
  };

  const fetchCSATData = async () => {
    setLoading(true);
    try {
      // Get all projects with their companies
      const { data: projects } = await supabase
        .from("onboarding_projects")
        .select(`
          id,
          product_name,
          onboarding_company_id,
          onboarding_companies!inner (
            id,
            name
          )
        `)
        .eq("status", "active");

      if (!projects) {
        setData([]);
        setTodayMeetings([]);
        setLoading(false);
        return;
      }

      const projectMap = new Map(projects.map(p => [p.id, p]));

      // Get all finalized meetings from today
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: todayMeetingsData } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          id,
          meeting_title,
          meeting_date,
          project_id,
          is_finalized
        `)
        .gte("meeting_date", `${today}T00:00:00`)
        .lte("meeting_date", `${today}T23:59:59`)
        .eq("is_finalized", true);

      // Get existing CSAT surveys for today's meetings
      const todayMeetingIds = (todayMeetingsData || []).map(m => m.id);
      const { data: existingSurveys } = await supabase
        .from("csat_surveys")
        .select(`
          id,
          access_token,
          status,
          meeting_id,
          csat_responses (
            score,
            responded_at
          )
        `)
        .in("meeting_id", todayMeetingIds.length > 0 ? todayMeetingIds : ["none"]);

      const surveyByMeeting = new Map((existingSurveys || []).map(s => [s.meeting_id, s]));

      // Build today's meetings list
      const todayMeetingsList: MeetingCSATData[] = (todayMeetingsData || [])
        .filter(m => projectMap.has(m.project_id))
        .map(meeting => {
          const project = projectMap.get(meeting.project_id)!;
          const company = project.onboarding_companies as { id: string; name: string };
          const survey = surveyByMeeting.get(meeting.id);
          const responses = survey?.csat_responses as unknown as { score: number; responded_at: string }[] | null;
          const response = responses?.[0];

          return {
            meetingId: meeting.id,
            surveyId: survey?.id ?? null,
            accessToken: survey?.access_token ?? null,
            meetingTitle: meeting.meeting_title,
            meetingDate: meeting.meeting_date,
            score: response?.score ?? null,
            responseDate: response?.responded_at ?? null,
            status: survey?.status ?? null,
            companyName: company.name,
            projectId: project.id,
            productName: project.product_name,
          };
        })
        .sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());

      setTodayMeetings(todayMeetingsList);

      // Get all CSAT surveys with their responses and meeting info (for history tab)
      const { data: surveys } = await supabase
        .from("csat_surveys")
        .select(`
          id,
          access_token,
          status,
          meeting_id,
          project_id,
          csat_responses (
            score,
            responded_at
          ),
          onboarding_meeting_notes!inner (
            id,
            meeting_title,
            meeting_date
          )
        `)
        .order("created_at", { ascending: false });

      // Group surveys by project
      const surveysByProject = new Map<string, MeetingCSATData[]>();
      
      (surveys || []).forEach((survey) => {
        const meeting = survey.onboarding_meeting_notes as unknown as { id: string; meeting_title: string; meeting_date: string };
        const responses = survey.csat_responses as unknown as { score: number; responded_at: string }[] | null;
        const response = responses?.[0];
        const project = projectMap.get(survey.project_id);
        const company = project?.onboarding_companies as { id: string; name: string } | undefined;
        
        const meetingData: MeetingCSATData = {
          meetingId: meeting.id,
          surveyId: survey.id,
          accessToken: survey.access_token,
          meetingTitle: meeting.meeting_title,
          meetingDate: meeting.meeting_date,
          score: response?.score ?? null,
          responseDate: response?.responded_at ?? null,
          status: survey.status,
          companyName: company?.name ?? "",
          projectId: survey.project_id,
          productName: project?.product_name ?? "",
        };
        
        const existing = surveysByProject.get(survey.project_id) || [];
        existing.push(meetingData);
        surveysByProject.set(survey.project_id, existing);
      });

      const companiesData: CompanyCSATData[] = projects.map((project) => {
        const company = project.onboarding_companies as { id: string; name: string };
        const meetings = surveysByProject.get(project.id) || [];
        
        const scores = meetings.filter(m => m.score !== null).map(m => m.score!);
        
        return {
          companyId: company.id,
          companyName: company.name,
          projectId: project.id,
          productName: project.product_name,
          averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
          totalResponses: scores.length,
          totalSurveys: meetings.length,
          meetings: meetings.sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()),
        };
      }).filter(c => c.totalSurveys > 0);

      companiesData.sort((a, b) => a.companyName.localeCompare(b.companyName));
      
      setData(companiesData);
    } catch (error) {
      console.error("Error fetching CSAT data:", error);
      toast.error("Erro ao carregar dados CSAT");
    } finally {
      setLoading(false);
    }
  };

  const getCSATLink = (accessToken: string) => {
    return `${window.location.origin}/csat?token=${accessToken}`;
  };

  const copyLink = async (meeting: MeetingCSATData) => {
    let token = meeting.accessToken;
    
    // If no survey exists, create one
    if (!token) {
      const result = await createSurveyForMeeting(meeting.meetingId, meeting.projectId);
      if (!result) return;
      token = result.accessToken;
      
      // Update local state
      setTodayMeetings(prev => prev.map(m => 
        m.meetingId === meeting.meetingId 
          ? { ...m, surveyId: result.surveyId, accessToken: result.accessToken }
          : m
      ));
    }
    
    navigator.clipboard.writeText(getCSATLink(token));
    toast.success("Link CSAT copiado!");
  };

  const toggleCompany = (companyKey: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyKey)) {
      newExpanded.delete(companyKey);
    } else {
      newExpanded.add(companyKey);
    }
    setExpandedCompanies(newExpanded);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "bg-muted text-muted-foreground";
    if (score <= 2) return "bg-destructive text-destructive-foreground";
    if (score <= 3) return "bg-yellow-500 text-white";
    return "bg-green-500 text-white";
  };

  const filteredData = data.filter((item) =>
    item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingTodayMeetings = todayMeetings.filter(m => m.score === null);
  const respondedTodayMeetings = todayMeetings.filter(m => m.score !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Painel CSAT
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="today" className="gap-2">
              <Clock className="h-4 w-4" />
              Reuniões de Hoje
              {pendingTodayMeetings.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingTodayMeetings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Building2 className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4">
            <ScrollArea className="h-[55vh] pr-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : todayMeetings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma reunião finalizada hoje</p>
                  <p className="text-sm mt-1">Finalize as reuniões do dia para gerar links CSAT</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending meetings */}
                  {pendingTodayMeetings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Aguardando envio ({pendingTodayMeetings.length})
                      </h4>
                      <div className="space-y-2">
                        {pendingTodayMeetings.map((meeting) => (
                          <div
                            key={meeting.meetingId}
                            className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border border-yellow-500/30"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium truncate">{meeting.companyName}</span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {meeting.productName}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="truncate">{meeting.meetingTitle}</span>
                                <span>•</span>
                                <span>{format(new Date(meeting.meetingDate), "HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                            
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-2 shrink-0"
                              onClick={() => copyLink(meeting)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copiar Link
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Responded meetings */}
                  {respondedTodayMeetings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Já respondidas ({respondedTodayMeetings.length})
                      </h4>
                      <div className="space-y-2">
                        {respondedTodayMeetings.map((meeting) => (
                          <div
                            key={meeting.meetingId}
                            className="flex items-center justify-between gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium truncate">{meeting.companyName}</span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {meeting.productName}
                                </Badge>
                                <Badge className={`${getScoreColor(meeting.score)} text-xs`}>
                                  <Star className="h-3 w-3 mr-1" />
                                  {meeting.score}/5
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="truncate">{meeting.meetingTitle}</span>
                                <span>•</span>
                                <span>{format(new Date(meeting.meetingDate), "HH:mm", { locale: ptBR })}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa ou serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[50vh] pr-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma empresa com pesquisas CSAT encontrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredData.map((item) => {
                    const companyKey = `${item.companyId}-${item.projectId}`;
                    const isExpanded = expandedCompanies.has(companyKey);
                    
                    return (
                      <Collapsible
                        key={companyKey}
                        open={isExpanded}
                        onOpenChange={() => toggleCompany(companyKey)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                    <h4 className="font-medium truncate">{item.companyName}</h4>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {item.productName}
                                    </Badge>
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-3 text-sm ml-6">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">CSAT Médio:</span>
                                      <span className={`px-2 py-0.5 rounded font-medium ${getScoreColor(item.averageScore)}`}>
                                        {item.averageScore?.toFixed(1) ?? "—"}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Respostas:</span>
                                      <span className="font-medium">
                                        {item.totalResponses}/{item.totalSurveys}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Reuniões:</span>
                                      <span className="font-medium">{item.meetings.length}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="border-t bg-muted/30 p-4 space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground mb-3">
                                Histórico de Reuniões
                              </h5>
                              {item.meetings.map((meeting) => (
                                <div
                                  key={meeting.surveyId}
                                  className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-sm font-medium truncate">
                                        {meeting.meetingTitle}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      <span>
                                        {format(new Date(meeting.meetingDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                      </span>
                                      {meeting.score !== null ? (
                                        <>
                                          <span className="flex items-center gap-1">
                                            <Star className="h-3 w-3 text-yellow-500" />
                                            Nota: {meeting.score}/5
                                          </span>
                                          {meeting.responseDate && (
                                            <span>
                                              Respondido: {format(new Date(meeting.responseDate), "dd/MM/yyyy", { locale: ptBR })}
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <Badge variant="outline" className="text-xs">
                                          Aguardando resposta
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyLink(meeting);
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                    Copiar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}