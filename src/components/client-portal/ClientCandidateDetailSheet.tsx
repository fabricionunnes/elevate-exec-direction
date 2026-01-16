import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, FileText, Calendar, Star, Clock, CheckCircle2, Download, History, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PipelineStage { id: string; key: string; name: string; color: string; }
interface Candidate { id: string; full_name: string; email: string; phone: string | null; current_stage: string; source: string; job_opening?: { id: string; title: string } | null; }
interface ClientCandidateDetailSheetProps { open: boolean; onOpenChange: (open: boolean) => void; candidate: Candidate | null; projectId: string; pipelineStages: PipelineStage[]; }

export function ClientCandidateDetailSheet({ open, onOpenChange, candidate, projectId, pipelineStages }: ClientCandidateDetailSheetProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [discResults, setDiscResults] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);

  useEffect(() => {
    if (open && candidate) fetchCandidateData();
  }, [open, candidate?.id]);

  const fetchCandidateData = async () => {
    if (!candidate) return;
    const [historyRes, discRes, resumesRes] = await Promise.all([
      supabase.from("hiring_history").select("*").eq("candidate_id", candidate.id).order("created_at", { ascending: false }),
      supabase.from("candidate_disc_results").select("*").eq("candidate_id", candidate.id).order("created_at", { ascending: false }),
      supabase.from("candidate_resumes").select("*").eq("candidate_id", candidate.id).order("created_at", { ascending: false }),
    ]);
    
    // Fetch interviews separately due to table name
    const { data: interviewsData } = await supabase
      .from("candidate_interviews" as any)
      .select("*")
      .eq("candidate_id", candidate.id)
      .order("scheduled_at", { ascending: false });

    if (historyRes.data) setHistory(historyRes.data);
    if (discRes.data) setDiscResults(discRes.data);
    if (resumesRes.data) setResumes(resumesRes.data);
    if (interviewsData) setInterviews(interviewsData);
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const getStageName = (key: string) => pipelineStages.find(s => s.key === key)?.name || key;
  const getStageColor = (key: string) => pipelineStages.find(s => s.key === key)?.color || "#6366f1";
  const getProfileColor = (profile: string | null) => {
    switch (profile) { case "D": return "bg-red-500"; case "I": return "bg-yellow-500"; case "S": return "bg-green-500"; case "C": return "bg-blue-500"; default: return "bg-gray-500"; }
  };
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ""; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!candidate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14"><AvatarFallback className="text-lg bg-primary/10 text-primary">{getInitials(candidate.full_name)}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{candidate.full_name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" style={{ borderColor: getStageColor(candidate.current_stage), color: getStageColor(candidate.current_stage) }}>{getStageName(candidate.current_stage)}</Badge>
                {candidate.job_opening && <span className="text-sm text-muted-foreground truncate">{candidate.job_opening.title}</span>}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 border-b space-y-2">
          <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{candidate.email}</span></div>
          {candidate.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{candidate.phone}</span></div>}
        </div>

        <Tabs defaultValue="resumes" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumes" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Currículo</TabsTrigger>
            <TabsTrigger value="disc" className="text-xs"><Star className="h-3.5 w-3.5 mr-1" />DISC</TabsTrigger>
            <TabsTrigger value="interviews" className="text-xs"><User className="h-3.5 w-3.5 mr-1" />Entrevistas</TabsTrigger>
            <TabsTrigger value="history" className="text-xs"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="resumes" className="m-0 space-y-2">
              {resumes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Nenhum currículo anexado</p></div>
              ) : resumes.map((resume: any) => (
                <Card key={resume.id}><CardContent className="p-4 flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{resume.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(resume.file_size)}</p>
                  </div>
                  <a href={resume.file_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted rounded-lg"><Download className="h-4 w-4" /></a>
                </CardContent></Card>
              ))}
            </TabsContent>

            <TabsContent value="disc" className="m-0 space-y-2">
              {discResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Star className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Nenhum teste DISC</p></div>
              ) : discResults.map((disc: any) => (
                <Card key={disc.id}><CardContent className="p-4">
                  {disc.status === "completed" ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${getProfileColor(disc.dominant_profile)}`}>{disc.dominant_profile}</div>
                        <span className="font-medium">Perfil: {disc.dominant_profile}</span>
                      </div>
                      <div className="space-y-2">
                        {[{ k: "D", s: disc.d_score, c: "bg-red-500" }, { k: "I", s: disc.i_score, c: "bg-yellow-500" }, { k: "S", s: disc.s_score, c: "bg-green-500" }, { k: "C", s: disc.c_score, c: "bg-blue-500" }].map(i => (
                          <div key={i.k} className="flex items-center gap-2"><span className="w-6 font-medium text-sm">{i.k}</span><div className="flex-1 h-3 bg-muted rounded-full overflow-hidden"><div className={`h-full ${i.c}`} style={{ width: `${i.s || 0}%` }} /></div><span className="w-8 text-xs text-right">{i.s || 0}%</span></div>
                        ))}
                      </div>
                      {disc.interpretation && <p className="text-sm text-muted-foreground pt-2 border-t">{disc.interpretation}</p>}
                    </div>
                  ) : <div className="flex items-center gap-3 text-muted-foreground"><Clock className="h-5 w-5" /><span>Pendente</span></div>}
                </CardContent></Card>
              ))}
            </TabsContent>

            <TabsContent value="interviews" className="m-0 space-y-2">
              {interviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Nenhuma entrevista</p></div>
              ) : interviews.map((interview: any) => (
                <Card key={interview.id}><CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{interview.interview_type}</Badge>
                      {interview.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-blue-500" />}
                    </div>
                    {interview.scheduled_at && <span className="text-sm text-muted-foreground">{format(new Date(interview.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                  </div>
                  {interview.status === "completed" && interview.score !== null && (
                    <div className="space-y-2 pt-3 border-t">
                      <div className="flex items-center gap-2"><span className="text-sm font-medium">Nota:</span><Badge className={interview.score >= 7 ? "bg-green-500" : "bg-yellow-500"}>{interview.score}/10</Badge></div>
                      {interview.strengths && <div><p className="text-xs font-medium text-muted-foreground">Pontos Fortes</p><p className="text-sm">{interview.strengths}</p></div>}
                      {interview.detailed_feedback && <div><p className="text-xs font-medium text-muted-foreground">Parecer</p><p className="text-sm">{interview.detailed_feedback}</p></div>}
                    </div>
                  )}
                </CardContent></Card>
              ))}
            </TabsContent>

            <TabsContent value="history" className="m-0">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><History className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Nenhum histórico</p></div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                  <div className="space-y-4">
                    {history.map((item: any) => (
                      <div key={item.id} className="relative pl-10">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm">{item.description || item.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
