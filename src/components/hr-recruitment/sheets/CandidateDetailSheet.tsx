import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Phone,
  Linkedin,
  FileText,
  Clock,
  User,
  Users,
  Send,
  Download,
  Brain,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { ScheduleInterviewDialog } from "../dialogs/ScheduleInterviewDialog";
import { InterviewDialog } from "../dialogs/InterviewDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import {
  Candidate,
  HiringHistory,
  Interview,
  DISCResult,
  AIEvaluation,
  PIPELINE_STAGES,
  SOURCE_LABELS,
} from "../types";

interface CandidateDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  canEdit: boolean;
  projectId: string;
  onUpdate: () => void;
}

export function CandidateDetailSheet({
  open,
  onOpenChange,
  candidate,
  canEdit,
  projectId,
  onUpdate,
}: CandidateDetailSheetProps) {
  const [history, setHistory] = useState<HiringHistory[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [discResults, setDiscResults] = useState<DISCResult[]>([]);
  const [aiEvaluations, setAiEvaluations] = useState<AIEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [interviewFeedbackOpen, setInterviewFeedbackOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);

  useEffect(() => {
    if (candidate && open) {
      fetchCandidateData();
    }
  }, [candidate, open]);

  const fetchCandidateData = async () => {
    if (!candidate) return;

    const [historyRes, interviewsRes, discRes, aiRes] = await Promise.all([
      supabase
        .from("hiring_history")
        .select("*, staff:onboarding_staff(name)")
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interviews")
        .select("*, interviewer:onboarding_staff(name)")
        .eq("candidate_id", candidate.id)
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("candidate_disc_results")
        .select("*")
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_ai_evaluations")
        .select("*")
        .eq("candidate_id", candidate.id)
        .order("created_at", { ascending: false }),
    ]);

    setHistory(historyRes.data || []);
    setInterviews(interviewsRes.data || []);
    setDiscResults(discRes.data || []);
    setAiEvaluations(aiRes.data || []);
  };

  const handleStageChange = async (newStage: string) => {
    if (!candidate || !canEdit) return;

    setLoading(true);
    const { error } = await supabase
      .from("candidates")
      .update({ current_stage: newStage })
      .eq("id", candidate.id);

    if (error) {
      toast.error("Erro ao atualizar etapa");
    } else {
      toast.success("Etapa atualizada");
      onUpdate();
      fetchCandidateData();
    }
    setLoading(false);
  };

  const handleSendDISC = async () => {
    if (!candidate) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    let staffId = null;
    
    if (user) {
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", user.id)
        .single();
      staffId = staff?.id;
    }

    const { data, error } = await supabase
      .from("candidate_disc_results")
      .insert({
        candidate_id: candidate.id,
        sent_by: staffId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar avaliação DISC");
    } else {
      const discUrl = `${getPublicBaseUrl()}/?public=hr-disc&token=${encodeURIComponent(
        data.access_token
      )}`;
      await navigator.clipboard.writeText(discUrl);
      toast.success("Link DISC copiado para a área de transferência!");
      fetchCandidateData();
    }
    setLoading(false);
  };

  if (!candidate) return null;

  const currentStage = PIPELINE_STAGES.find(s => s.key === candidate.current_stage);
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {getInitials(candidate.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-xl">{candidate.full_name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  style={{ 
                    backgroundColor: `${currentStage?.color}15`,
                    borderColor: `${currentStage?.color}50`,
                    color: currentStage?.color
                  }}
                >
                  {currentStage?.name}
                </Badge>
                <Badge variant="outline">{SOURCE_LABELS[candidate.source]}</Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4">
          <div className="space-y-4 pr-4">
            {/* Contact Info */}
            <div className="space-y-2">
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="h-4 w-4" />
                {candidate.email}
              </a>
              {candidate.phone && (
                <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Phone className="h-4 w-4" />
                  {candidate.phone}
                </a>
              )}
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Linkedin className="h-4 w-4" />
                  Ver LinkedIn
                </a>
              )}
            </div>

            {/* Stage Selector */}
            {canEdit && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Etapa do Processo</label>
                <Select 
                  value={candidate.current_stage} 
                  onValueChange={handleStageChange}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((stage) => (
                      <SelectItem key={stage.key} value={stage.key}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: stage.color }} 
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Actions */}
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleSendDISC} disabled={loading}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar DISC
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setInterviewDialogOpen(true)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendar Entrevista
                </Button>
              </div>
            )}

            {/* Interview Dialog */}
            {candidate && (
              <ScheduleInterviewDialog
                open={interviewDialogOpen}
                onOpenChange={setInterviewDialogOpen}
                candidateId={candidate.id}
                candidateName={candidate.full_name}
                candidateEmail={candidate.email}
                projectId={projectId}
                onSuccess={() => {
                  fetchCandidateData();
                  onUpdate();
                }}
              />
            )}

            {/* Tabs */}
            <Tabs defaultValue="history" className="mt-6">
              <TabsList className="w-full">
                <TabsTrigger value="history" className="flex-1">Timeline</TabsTrigger>
                <TabsTrigger value="disc" className="flex-1">DISC</TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">IA</TabsTrigger>
                <TabsTrigger value="interviews" className="flex-1">Entrevistas</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-4">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum histórico ainda
                  </p>
                ) : (
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {item.staff && ` • ${(item.staff as any).name}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="disc" className="mt-4">
                {discResults.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum teste DISC realizado
                    </p>
                    {canEdit && (
                      <Button variant="outline" size="sm" className="mt-4" onClick={handleSendDISC}>
                        Enviar DISC
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {discResults.map((disc) => (
                      <div key={disc.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant={disc.status === 'completed' ? 'default' : 'secondary'}>
                            {disc.status === 'completed' ? 'Concluído' : 'Pendente'}
                          </Badge>
                          {disc.dominant_profile && (
                            <span className="text-2xl font-bold text-primary">
                              {disc.dominant_profile}
                            </span>
                          )}
                        </div>
                        {disc.status === 'completed' && (
                          <div className="grid grid-cols-4 gap-2 mt-3">
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-500">{disc.d_score}%</div>
                              <div className="text-xs text-muted-foreground">D</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-yellow-500">{disc.i_score}%</div>
                              <div className="text-xs text-muted-foreground">I</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-500">{disc.s_score}%</div>
                              <div className="text-xs text-muted-foreground">S</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-500">{disc.c_score}%</div>
                              <div className="text-xs text-muted-foreground">C</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ai" className="mt-4">
                {aiEvaluations.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma avaliação da IA ainda
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      A IA analisará automaticamente quando um currículo for enviado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {aiEvaluations.map((evaluation) => (
                      <div key={evaluation.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground">
                            Sugestão da IA (não decisiva)
                          </span>
                          <Badge variant={
                            evaluation.classification === 'high_fit' ? 'default' :
                            evaluation.classification === 'medium_fit' ? 'secondary' : 'destructive'
                          }>
                            {evaluation.classification === 'high_fit' ? 'Alto Fit' :
                             evaluation.classification === 'medium_fit' ? 'Médio Fit' : 'Baixo Fit'}
                          </Badge>
                        </div>
                        <div className="text-3xl font-bold text-center my-4">
                          {evaluation.compatibility_score}%
                        </div>
                        {evaluation.full_analysis && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {evaluation.full_analysis}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="interviews" className="mt-4">
                {interviews.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma entrevista agendada
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interviews.map((interview) => (
                      <div
                        key={interview.id}
                        className={
                          "p-4 border rounded-lg space-y-3 " +
                          (canEdit ? "cursor-pointer hover:bg-muted/30 transition-colors" : "")
                        }
                        onClick={() => {
                          if (!canEdit) return;
                          setEditingInterview(interview);
                          setInterviewFeedbackOpen(true);
                        }}
                        role={canEdit ? "button" : undefined}
                        tabIndex={canEdit ? 0 : -1}
                        onKeyDown={(e) => {
                          if (!canEdit) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditingInterview(interview);
                            setInterviewFeedbackOpen(true);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {interview.interview_type === 'hr' ? 'RH' :
                               interview.interview_type === 'technical' ? 'Técnica' : 
                               interview.interview_type === 'video' ? 'Video' :
                               interview.interview_type === 'phone' ? 'Telefone' :
                               interview.interview_type === 'in_person' ? 'Presencial' : 'Final'}
                            </Badge>
                            {(interview as any).group_session_id && (
                              <Badge variant="secondary" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                Grupo
                              </Badge>
                            )}
                          </div>
                          <Badge variant={
                            interview.status === 'completed' ? 'default' : 
                            interview.status === 'cancelled' ? 'destructive' :
                            interview.status === 'no_show' ? 'destructive' : 'secondary'
                          }>
                            {interview.status === 'completed' ? 'Realizada' : 
                             interview.status === 'scheduled' ? 'Agendada' : 
                             interview.status === 'cancelled' ? 'Cancelada' :
                             interview.status === 'no_show' ? 'Não compareceu' : interview.status}
                          </Badge>
                        </div>
                        
                        {interview.scheduled_at && (
                          <p className="text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(interview.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        
                        {interview.interviewer && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Entrevistador: {(interview.interviewer as any).name}
                          </p>
                        )}

                        {(interview as any).meet_link && (
                          <a 
                            href={(interview as any).meet_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🔗 Link do Google Meet
                          </a>
                        )}
                        
                        {interview.score !== null && (
                          <div className="flex items-center gap-2 p-2 bg-muted rounded">
                            <span className="text-sm text-muted-foreground">Nota:</span>
                            <span className="text-xl font-bold text-primary">{interview.score}/10</span>
                          </div>
                        )}

                        {interview.recommendation && (
                          <Badge variant={
                            interview.recommendation === 'approved' ? 'default' :
                            interview.recommendation === 'talent_pool' ? 'secondary' : 'destructive'
                          }>
                            {interview.recommendation === 'approved' ? '✓ Aprovado' :
                             interview.recommendation === 'talent_pool' ? '⏳ Banco de Talentos' : '✗ Reprovado'}
                          </Badge>
                        )}
                        
                        {interview.strengths && (
                          <div className="text-sm">
                            <span className="font-medium text-green-600">Pontos fortes:</span>
                            <p className="text-muted-foreground">{interview.strengths}</p>
                          </div>
                        )}

                        {interview.concerns && (
                          <div className="text-sm">
                            <span className="font-medium text-orange-600">Pontos de atenção:</span>
                            <p className="text-muted-foreground">{interview.concerns}</p>
                          </div>
                        )}
                        
                        {interview.detailed_feedback && (
                          <div className="text-sm">
                            <span className="font-medium">Parecer detalhado:</span>
                            <p className="text-muted-foreground whitespace-pre-wrap">{interview.detailed_feedback}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    <InterviewDialog
                      open={interviewFeedbackOpen}
                      onOpenChange={(open) => {
                        setInterviewFeedbackOpen(open);
                        if (!open) setEditingInterview(null);
                      }}
                      interview={editingInterview}
                      onSuccess={() => {
                        fetchCandidateData();
                        setInterviewFeedbackOpen(false);
                        setEditingInterview(null);
                        toast.success("Feedback da entrevista salvo!");
                      }}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
