import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  Briefcase, 
  Users, 
  GitBranch,
  Search,
  ExternalLink,
  FileText,
  Star,
  Copy,
  Plus,
  UserPlus
} from "lucide-react";
import { usePipelineStages } from "@/components/hr-recruitment/hooks/usePipelineStages";
import { ClientCandidateDetailSheet } from "./ClientCandidateDetailSheet";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { JobOpeningDialog } from "@/components/hr-recruitment/dialogs/JobOpeningDialog";
import { CandidateDialog } from "@/components/hr-recruitment/dialogs/CandidateDialog";

interface JobOpening {
  id: string;
  title: string;
  area: string;
  job_type: string;
  status: string;
  location: string | null;
  candidates_count?: number;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  current_stage: string;
  status: string;
  source: string;
  job_opening?: { id: string; title: string } | null;
  resumes?: { id: string }[];
  disc_results?: { id: string; status: string; dominant_profile: string | null }[];
}

interface ClientHRViewProps {
  projectId: string;
}

export function ClientHRView({ projectId }: ClientHRViewProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchJobs, setSearchJobs] = useState("");
  const [searchCandidates, setSearchCandidates] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [showCandidateDialog, setShowCandidateDialog] = useState(false);
  
  const { stages: pipelineStages } = usePipelineStages(projectId);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: jobsData } = await supabase
      .from("job_openings")
      .select(`*, candidates:candidates(count)`)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (jobsData) {
      setJobs(jobsData.map(j => ({
        ...j,
        candidates_count: j.candidates?.[0]?.count || 0
      })));
    }

    const { data: candidatesData } = await supabase
      .from("candidates")
      .select(`
        *,
        job_opening:job_openings(id, title),
        resumes:candidate_resumes(id),
        disc_results:candidate_disc_results(id, status, dominant_profile)
      `)
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (candidatesData) {
      setCandidates(candidatesData as unknown as Candidate[]);
    }

    setLoading(false);
  };

  const copyJobLink = async (jobId: string) => {
    const url = `${getPublicBaseUrl()}/#/job-application?job=${jobId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500/10 text-green-700";
      case "paused": return "bg-yellow-500/10 text-yellow-700";
      case "closed": return "bg-red-500/10 text-red-700";
      default: return "bg-gray-500/10 text-gray-700";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open": return "Aberta";
      case "paused": return "Pausada";
      case "closed": return "Encerrada";
      default: return status;
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const getStageName = (key: string) => pipelineStages.find(s => s.key === key)?.name || key;
  const getStageColor = (key: string) => pipelineStages.find(s => s.key === key)?.color || "#6366f1";

  const filteredJobs = jobs.filter(j => j.title.toLowerCase().includes(searchJobs.toLowerCase()));
  const filteredCandidates = candidates.filter(c => c.full_name.toLowerCase().includes(searchCandidates.toLowerCase()));
  const candidatesByStage = pipelineStages.map(stage => ({
    ...stage,
    candidates: candidates.filter(c => c.current_stage === stage.key)
  }));

  // Prepare jobs list for candidate dialog
  const jobsForCandidateDialog = jobs.filter(j => j.status === "open").map(j => ({
    id: j.id,
    title: j.title
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recrutamento</h2>
          <p className="text-muted-foreground">Acompanhe o processo seletivo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCandidateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Adicionar Candidato</span>
          </Button>
          <Button onClick={() => setShowJobDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nova Vaga</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="jobs"><Briefcase className="h-4 w-4 mr-2" />Vagas</TabsTrigger>
          <TabsTrigger value="candidates"><Users className="h-4 w-4 mr-2" />Candidatos</TabsTrigger>
          <TabsTrigger value="pipeline"><GitBranch className="h-4 w-4 mr-2" />Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar vagas..." value={searchJobs} onChange={(e) => setSearchJobs(e.target.value)} className="pl-10" />
            </div>
            <Button className="sm:hidden" size="icon" onClick={() => setShowJobDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">{[1, 2].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-24 bg-muted rounded" /></CardContent></Card>)}</div>
          ) : filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Nenhuma vaga</h3>
                <p className="text-sm text-muted-foreground mb-4">Crie sua primeira vaga para começar a receber candidatos</p>
                <Button onClick={() => setShowJobDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Vaga
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredJobs.map(job => (
                <Card key={job.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{job.title}</h4>
                        <p className="text-sm text-muted-foreground">{job.area} • {job.job_type}</p>
                      </div>
                      <Badge className={getStatusColor(job.status)}>{getStatusLabel(job.status)}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <span><Users className="h-3.5 w-3.5 inline mr-1" />{job.candidates_count} candidatos</span>
                    </div>
                    {job.status === "open" && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => copyJobLink(job.id)}><Copy className="h-3.5 w-3.5 mr-1" />Copiar Link</Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(`${getPublicBaseUrl()}/#/job-application?job=${job.id}`, "_blank")}><ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="candidates" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar candidatos..." value={searchCandidates} onChange={(e) => setSearchCandidates(e.target.value)} className="pl-10" />
            </div>
            <Button className="sm:hidden" size="icon" onClick={() => setShowCandidateDialog(true)}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-16 bg-muted rounded" /></CardContent></Card>)}</div>
          ) : filteredCandidates.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Nenhum candidato</h3>
                <p className="text-sm text-muted-foreground mb-4">Adicione candidatos manualmente ou compartilhe o link das vagas</p>
                <Button onClick={() => setShowCandidateDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Candidato
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredCandidates.map(candidate => (
                <Card key={candidate.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCandidate(candidate)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar><AvatarFallback className="bg-primary/10 text-primary">{getInitials(candidate.full_name)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{candidate.full_name}</h4>
                          <Badge variant="outline" style={{ borderColor: getStageColor(candidate.current_stage), color: getStageColor(candidate.current_stage) }}>{getStageName(candidate.current_stage)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{candidate.job_opening?.title || "Sem vaga vinculada"}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-3">
                        {candidate.resumes && candidate.resumes.length > 0 && <FileText className="h-4 w-4 text-green-500" />}
                        {candidate.disc_results && candidate.disc_results.length > 0 && <Star className={`h-4 w-4 ${candidate.disc_results[0].status === 'completed' ? 'text-yellow-500' : 'text-muted-foreground'}`} />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline">
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" style={{ minWidth: pipelineStages.length * 280 }}>
              {candidatesByStage.map(stage => (
                <div key={stage.id} className="w-64 flex-shrink-0">
                  <div className="flex items-center gap-2 p-3 rounded-t-lg" style={{ backgroundColor: `${stage.color}20` }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-medium text-sm">{stage.name}</span>
                    <Badge variant="secondary" className="ml-auto">{stage.candidates.length}</Badge>
                  </div>
                  <div className="bg-muted/30 rounded-b-lg p-2 min-h-[200px] space-y-2">
                    {stage.candidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum candidato</p>
                    ) : stage.candidates.map(candidate => (
                      <Card key={candidate.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCandidate(candidate)}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(candidate.full_name)}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{candidate.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{candidate.job_opening?.title || "—"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <ClientCandidateDetailSheet
        open={!!selectedCandidate}
        onOpenChange={(open) => !open && setSelectedCandidate(null)}
        candidate={selectedCandidate}
        projectId={projectId}
        pipelineStages={pipelineStages}
      />

      <JobOpeningDialog
        open={showJobDialog}
        onOpenChange={setShowJobDialog}
        projectId={projectId}
        job={null}
        onSuccess={() => {
          fetchData();
          setShowJobDialog(false);
        }}
      />

      <CandidateDialog
        open={showCandidateDialog}
        onOpenChange={setShowCandidateDialog}
        projectId={projectId}
        jobs={jobsForCandidateDialog}
        isStaff={false}
        onSuccess={() => {
          fetchData();
          setShowCandidateDialog(false);
        }}
      />
    </div>
  );
}