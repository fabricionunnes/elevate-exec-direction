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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Search, Building2, MessageSquareHeart, ChevronDown, ChevronRight, Calendar, Star } from "lucide-react";

interface MeetingCSATData {
  meetingId: string;
  surveyId: string;
  accessToken: string;
  meetingTitle: string;
  meetingDate: string;
  score: number | null;
  responseDate: string | null;
  status: string | null;
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchCSATData();
    }
  }, [open]);

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
        setLoading(false);
        return;
      }

      // Get all CSAT surveys with their responses and meeting info
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
        
        const meetingData: MeetingCSATData = {
          meetingId: meeting.id,
          surveyId: survey.id,
          accessToken: survey.access_token,
          meetingTitle: meeting.meeting_title,
          meetingDate: meeting.meeting_date,
          score: response?.score ?? null,
          responseDate: response?.responded_at ?? null,
          status: survey.status,
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
      }).filter(c => c.totalSurveys > 0); // Only show companies with CSAT surveys

      // Sort by company name
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

  const copyLink = (accessToken: string) => {
    navigator.clipboard.writeText(getCSATLink(accessToken));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Painel CSAT - Todas as Empresas
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[60vh] pr-4">
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
                                {/* Average Score */}
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">CSAT Médio:</span>
                                  <span className={`px-2 py-0.5 rounded font-medium ${getScoreColor(item.averageScore)}`}>
                                    {item.averageScore?.toFixed(1) ?? "—"}
                                  </span>
                                </div>
                                
                                {/* Responses */}
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Respostas:</span>
                                  <span className="font-medium">
                                    {item.totalResponses}/{item.totalSurveys}
                                  </span>
                                </div>
                                
                                {/* Meetings count */}
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
                                  copyLink(meeting.accessToken);
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
      </DialogContent>
    </Dialog>
  );
}