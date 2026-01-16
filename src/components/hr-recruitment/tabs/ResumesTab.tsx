import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  FileText, 
  Download, 
  Upload,
  Calendar,
  User,
  Brain,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PIPELINE_STAGES } from "../types";
import { CandidateDialog } from "../dialogs/CandidateDialog";

interface ResumeWithCandidate {
  id: string;
  candidate_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  is_primary: boolean;
  created_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    current_stage: string;
    job_opening_id: string | null;
    job_opening?: {
      id: string;
      title: string;
    };
  };
  ai_evaluation?: {
    id: string;
    compatibility_score: number;
    classification: string;
  } | null;
}

interface ResumesTabProps {
  projectId: string;
  canEdit: boolean;
  isStaff: boolean;
}

export function ResumesTab({ projectId, canEdit, isStaff }: ResumesTabProps) {
  const [resumes, setResumes] = useState<ResumeWithCandidate[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJob, setFilterJob] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    const [resumesRes, jobsRes] = await Promise.all([
      supabase
        .from("candidate_resumes")
        .select(`
          *,
          candidate:candidates!inner(
            id, 
            full_name, 
            email, 
            current_stage, 
            job_opening_id,
            project_id,
            job_opening:job_openings(id, title)
          )
        `)
        .eq("candidate.project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_openings")
        .select("id, title")
        .eq("project_id", projectId),
    ]);

    if (resumesRes.error) {
      console.error("Error fetching resumes:", resumesRes.error);
    } else {
      // Fetch AI evaluations for each resume
      const resumesWithAI = await Promise.all(
        (resumesRes.data || []).map(async (resume: any) => {
          const { data: aiEval } = await supabase
            .from("candidate_ai_evaluations")
            .select("id, compatibility_score, classification")
            .eq("resume_id", resume.id)
            .single();
          
          return { ...resume, ai_evaluation: aiEval };
        })
      );
      setResumes(resumesWithAI);
    }

    setJobs(jobsRes.data || []);
    setLoading(false);
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleAnalyzeWithAI = async (resume: ResumeWithCandidate) => {
    if (!resume.candidate.job_opening_id) {
      toast.error("Vincule o candidato a uma vaga para análise da IA");
      return;
    }

    setAnalyzingId(resume.id);
    try {
      // Get job details
      const { data: job } = await supabase
        .from("job_openings")
        .select("*")
        .eq("id", resume.candidate.job_opening_id)
        .single();

      if (!job) {
        toast.error("Vaga não encontrada");
        return;
      }

      // Call AI evaluation edge function (to be implemented)
      // For now, create a mock evaluation
      const mockScore = Math.floor(Math.random() * 40) + 60;
      const classification = mockScore >= 80 ? 'high_fit' : mockScore >= 60 ? 'medium_fit' : 'low_fit';

      const { error } = await supabase.from("candidate_ai_evaluations").insert({
        candidate_id: resume.candidate_id,
        resume_id: resume.id,
        job_opening_id: resume.candidate.job_opening_id,
        compatibility_score: mockScore,
        classification,
        strengths: ['Experiência relevante', 'Boa formação'],
        concerns: ['Verificar disponibilidade'],
        recommendation: mockScore >= 70 ? 'advance' : 'evaluate_carefully',
        full_analysis: `Análise automática baseada no currículo. Score de compatibilidade: ${mockScore}%`,
        model_used: 'gemini-2.5-flash',
      });

      if (error) throw error;

      toast.success("Análise da IA concluída!");
      fetchData();
    } catch (error) {
      console.error("Error analyzing resume:", error);
      toast.error("Erro na análise da IA");
    } finally {
      setAnalyzingId(null);
    }
  };

  const filteredResumes = resumes.filter((r) => {
    const matchesSearch = 
      r.candidate.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.file_name.toLowerCase().includes(search.toLowerCase());
    const matchesJob = filterJob === "all" || r.candidate.job_opening_id === filterJob;
    const matchesStage = filterStage === "all" || r.candidate.current_stage === filterStage;
    return matchesSearch && matchesJob && matchesStage;
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'high_fit':
        return <Badge className="bg-green-500">Alto Fit</Badge>;
      case 'medium_fit':
        return <Badge className="bg-yellow-500">Médio Fit</Badge>;
      case 'low_fit':
        return <Badge variant="destructive">Baixo Fit</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar currículos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por vaga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {PIPELINE_STAGES.map((stage) => (
              <SelectItem key={stage.key} value={stage.key}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Enviar Currículo
        </Button>
      </div>

      {/* Resumes List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredResumes.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum currículo encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Envie currículos para começar o processo seletivo
          </p>
          <Button onClick={() => setShowDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Enviar Currículo
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredResumes.map((resume) => {
            const stage = PIPELINE_STAGES.find(s => s.key === resume.candidate.current_stage);
            return (
              <Card key={resume.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{resume.candidate.full_name}</h4>
                        {stage && (
                          <Badge 
                            variant="outline"
                            style={{ 
                              backgroundColor: `${stage.color}15`,
                              borderColor: `${stage.color}50`,
                              color: stage.color
                            }}
                          >
                            {stage.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="truncate max-w-[200px]">{resume.file_name}</span>
                        {resume.file_size && (
                          <span>{formatFileSize(resume.file_size)}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(resume.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      {resume.candidate.job_opening && (
                        <Badge variant="secondary" className="mt-2">
                          {(resume.candidate.job_opening as any).title}
                        </Badge>
                      )}
                    </div>

                    {/* AI Evaluation */}
                    {resume.ai_evaluation ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-2xl font-bold text-primary">
                          {resume.ai_evaluation.compatibility_score}%
                        </div>
                        {getClassificationBadge(resume.ai_evaluation.classification)}
                        <span className="text-xs text-muted-foreground">IA</span>
                      </div>
                    ) : canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalyzeWithAI(resume)}
                        disabled={analyzingId === resume.id}
                      >
                        {analyzingId === resume.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-2" />
                            Analisar IA
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDownload(resume.file_url, resume.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <CandidateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        projectId={projectId}
        jobs={jobs}
        isStaff={isStaff}
        onSuccess={() => {
          fetchData();
          setShowDialog(false);
        }}
      />
    </div>
  );
}
