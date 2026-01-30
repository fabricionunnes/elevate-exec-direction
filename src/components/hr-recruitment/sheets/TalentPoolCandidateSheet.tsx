import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Linkedin,
  FileText,
  Clock,
  Star,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  History,
  User,
  Sparkles,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AssignToJobDialog } from "@/components/hr-recruitment/dialogs/AssignToJobDialog";

interface TalentCandidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  linkedin_url?: string | null;
  talent_pool_notes: string | null;
  talent_pool_added_at: string | null;
  ai_summary: string | null;
  ai_match_score: number | null;
  created_at: string;
  disc_profile: string | null;
  project: {
    id: string;
    product_name: string;
    company: {
      id: string;
      name: string;
    } | null;
  } | null;
  last_job: {
    title: string;
  } | null;
  resumes: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_size: number | null;
    is_primary: boolean;
    created_at: string;
  }>;
}

interface DISCResult {
  id: string;
  status: string;
  dominant_profile: string | null;
  d_score: number | null;
  i_score: number | null;
  s_score: number | null;
  c_score: number | null;
  interpretation: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Interview {
  id: string;
  interview_type: string;
  scheduled_at: string | null;
  status: string;
  score: number | null;
  strengths: string | null;
  detailed_feedback: string | null;
}

interface TalentPoolCandidateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: TalentCandidate | null;
  onCandidateAssigned?: () => void;
}

export function TalentPoolCandidateSheet({
  open,
  onOpenChange,
  candidate,
  onCandidateAssigned,
}: TalentPoolCandidateSheetProps) {
  const [discResults, setDiscResults] = useState<DISCResult[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  useEffect(() => {
    if (open && candidate) {
      fetchCandidateData();
    }
  }, [open, candidate?.id]);

  const fetchCandidateData = async () => {
    if (!candidate) return;
    setLoading(true);

    try {
      const [discRes, historyRes] = await Promise.all([
        supabase
          .from("candidate_disc_results")
          .select("*")
          .eq("candidate_id", candidate.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("hiring_history")
          .select("*")
          .eq("candidate_id", candidate.id)
          .order("created_at", { ascending: false }),
      ]);

      // Fetch interviews separately - using raw query since table may not be in types
      let interviewsData: Interview[] = [];
      try {
        const { data } = await supabase
          .from("candidate_interviews" as any)
          .select("id, interview_type, scheduled_at, status, score, strengths, detailed_feedback")
          .eq("candidate_id", candidate.id)
          .order("scheduled_at", { ascending: false });
        
        if (data) {
          interviewsData = data as unknown as Interview[];
        }
      } catch (e) {
        console.log("Interviews table may not exist:", e);
      }

      if (discRes.data) setDiscResults(discRes.data);
      if (historyRes.data) setHistory(historyRes.data);
      setInterviews(interviewsData);
    } catch (error) {
      console.error("Error fetching candidate data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const getDISCColor = (profile: string | null) => {
    switch (profile) {
      case "D":
        return "bg-red-500";
      case "I":
        return "bg-yellow-500";
      case "S":
        return "bg-green-500";
      case "C":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  if (!candidate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg bg-amber-100 text-amber-700">
                {getInitials(candidate.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate flex items-center gap-2">
                {candidate.full_name}
                <Star className="h-5 w-5 text-amber-500" />
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {candidate.disc_profile && (
                  <Badge
                    className={`${getDISCColor(candidate.disc_profile)} text-white`}
                  >
                    DISC: {candidate.disc_profile}
                  </Badge>
                )}
                {candidate.ai_match_score && (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    {candidate.ai_match_score}%
                  </Badge>
                )}
                {candidate.project?.company && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {candidate.project.company.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Action Button */}
        <div className="py-3 border-b">
          <Button 
            onClick={() => setShowAssignDialog(true)}
            className="w-full gap-2"
          >
            <Briefcase className="h-4 w-4" />
            Vincular a uma Vaga
          </Button>
        </div>

        {/* Contact Info */}
        <div className="py-4 border-b space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{candidate.email}</span>
          </div>
          {candidate.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{candidate.phone}</span>
            </div>
          )}
          {candidate.linkedin_url && (
            <div className="flex items-center gap-2 text-sm">
              <Linkedin className="h-4 w-4 text-muted-foreground" />
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                LinkedIn
              </a>
            </div>
          )}
          {candidate.talent_pool_added_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                No banco desde{" "}
                {format(new Date(candidate.talent_pool_added_at), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </span>
            </div>
          )}
        </div>

        <Tabs defaultValue="disc" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="disc" className="text-xs">
              <Star className="h-3.5 w-3.5 mr-1" />
              DISC
            </TabsTrigger>
            <TabsTrigger value="resumes" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Currículo
            </TabsTrigger>
            <TabsTrigger value="interviews" className="text-xs">
              <User className="h-3.5 w-3.5 mr-1" />
              Entrevistas
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3.5 w-3.5 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* DISC Tab */}
            <TabsContent value="disc" className="m-0 space-y-3">
              {discResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum teste DISC realizado</p>
                </div>
              ) : (
                discResults.map((disc) => (
                  <Card key={disc.id}>
                    <CardContent className="p-4">
                      {disc.status === "completed" ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getDISCColor(disc.dominant_profile)}`}
                              >
                                {disc.dominant_profile}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Perfil Dominante: {disc.dominant_profile}
                                </span>
                                {disc.completed_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Completado em{" "}
                                    {format(
                                      new Date(disc.completed_at),
                                      "dd/MM/yyyy",
                                      { locale: ptBR }
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </div>

                          {/* DISC Scores */}
                          <div className="space-y-2">
                            {[
                              { k: "D", s: disc.d_score, c: "bg-red-500", l: "Dominância" },
                              { k: "I", s: disc.i_score, c: "bg-yellow-500", l: "Influência" },
                              { k: "S", s: disc.s_score, c: "bg-green-500", l: "Estabilidade" },
                              { k: "C", s: disc.c_score, c: "bg-blue-500", l: "Conformidade" },
                            ].map((item) => (
                              <div key={item.k} className="flex items-center gap-2">
                                <span className="w-6 font-bold text-sm">{item.k}</span>
                                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${item.c} transition-all`}
                                    style={{ width: `${item.s || 0}%` }}
                                  />
                                </div>
                                <span className="w-12 text-sm text-right">
                                  {item.s || 0}%
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Interpretation */}
                          {disc.interpretation && (
                            <div className="pt-3 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Interpretação
                              </p>
                              <p className="text-sm">{disc.interpretation}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <Clock className="h-5 w-5" />
                          <div>
                            <span>Teste pendente</span>
                            <p className="text-xs">
                              Enviado em{" "}
                              {format(new Date(disc.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}

              {/* AI Summary */}
              {candidate.ai_summary && (
                <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-700 dark:text-purple-300">
                        Resumo IA
                      </span>
                    </div>
                    <p className="text-sm">{candidate.ai_summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Talent Pool Notes */}
              {candidate.talent_pool_notes && (
                <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-700 dark:text-amber-300">
                        Observações do Banco de Talentos
                      </span>
                    </div>
                    <p className="text-sm">{candidate.talent_pool_notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Resumes Tab */}
            <TabsContent value="resumes" className="m-0 space-y-2">
              {candidate.resumes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum currículo anexado</p>
                </div>
              ) : (
                candidate.resumes.map((resume) => (
                  <Card key={resume.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{resume.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(resume.file_size)}
                          {resume.created_at && (
                            <>
                              {" • "}
                              {format(new Date(resume.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(resume.file_url, resume.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Interviews Tab */}
            <TabsContent value="interviews" className="m-0 space-y-2">
              {interviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma entrevista realizada</p>
                </div>
              ) : (
                interviews.map((interview) => (
                  <Card key={interview.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{interview.interview_type}</Badge>
                          {interview.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        {interview.scheduled_at && (
                          <span className="text-sm text-muted-foreground">
                            {format(
                              new Date(interview.scheduled_at),
                              "dd/MM/yyyy HH:mm",
                              { locale: ptBR }
                            )}
                          </span>
                        )}
                      </div>
                      {interview.status === "completed" && interview.score !== null && (
                        <div className="space-y-2 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Nota:</span>
                            <Badge
                              className={
                                interview.score >= 7 ? "bg-green-500" : "bg-yellow-500"
                              }
                            >
                              {interview.score}/10
                            </Badge>
                          </div>
                          {interview.strengths && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                Pontos Fortes
                              </p>
                              <p className="text-sm">{interview.strengths}</p>
                            </div>
                          )}
                          {interview.detailed_feedback && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">
                                Parecer
                              </p>
                              <p className="text-sm">{interview.detailed_feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="m-0">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Nenhum histórico registrado</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="relative pl-10">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm">{item.description || item.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Assign to Job Dialog */}
        <AssignToJobDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          candidateId={candidate.id}
          candidateName={candidate.full_name}
          onSuccess={() => {
            onOpenChange(false);
            onCandidateAssigned?.();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
