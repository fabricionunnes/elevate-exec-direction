import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Mail,
  Phone,
  FileText,
  Eye,
  Linkedin
} from "lucide-react";
import { toast } from "sonner";
import { Candidate, PIPELINE_STAGES, SOURCE_LABELS, STATUS_LABELS } from "../types";
import { CandidateDialog } from "../dialogs/CandidateDialog";
import { CandidateDetailSheet } from "../sheets/CandidateDetailSheet";

interface CandidatesTabProps {
  projectId: string;
  canEdit: boolean;
  isStaff: boolean;
  onUpdate: () => void;
}

export function CandidatesTab({ projectId, canEdit, isStaff, onUpdate }: CandidatesTabProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJob, setFilterJob] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    const [candidatesRes, jobsRes] = await Promise.all([
      supabase
        .from("candidates")
        .select(`
          *,
          job_opening:job_openings(id, title),
          resumes:candidate_resumes(*)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("job_openings")
        .select("id, title")
        .eq("project_id", projectId)
        .in("status", ["open", "in_progress"]),
    ]);

    if (candidatesRes.error) {
      console.error("Error fetching candidates:", candidatesRes.error);
    } else {
      setCandidates(candidatesRes.data || []);
    }

    setJobs(jobsRes.data || []);
    setLoading(false);
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesJob = filterJob === "all" || c.job_opening_id === filterJob;
    const matchesStage = filterStage === "all" || c.current_stage === filterStage;
    return matchesSearch && matchesJob && matchesStage;
  });

  const getStageInfo = (stageKey: string) => {
    return PIPELINE_STAGES.find((s) => s.key === stageKey) || { name: stageKey, color: "#6366f1" };
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar candidatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="w-full sm:w-48">
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
          <SelectTrigger className="w-full sm:w-48">
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
        {(canEdit || !isStaff) && (
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {isStaff ? "Novo Candidato" : "Enviar Currículo"}
          </Button>
        )}
      </div>

      {/* Candidates List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCandidates.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum candidato encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {search || filterJob !== "all" || filterStage !== "all"
              ? "Tente ajustar os filtros"
              : "Adicione o primeiro candidato para começar"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map((candidate) => {
            const stageInfo = getStageInfo(candidate.current_stage);
            return (
              <Card 
                key={candidate.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedCandidate(candidate);
                  setShowDetailSheet(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(candidate.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{candidate.full_name}</h4>
                        <Badge 
                          variant="outline"
                          style={{ 
                            backgroundColor: `${stageInfo.color}15`,
                            borderColor: `${stageInfo.color}50`,
                            color: stageInfo.color
                          }}
                        >
                          {stageInfo.name}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {candidate.email}
                        </span>
                        {candidate.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {candidate.phone}
                          </span>
                        )}
                        {candidate.linkedin_url && (
                          <Linkedin className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {candidate.job_opening && (
                        <Badge variant="secondary" className="text-xs">
                          {(candidate.job_opening as any).title}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {SOURCE_LABELS[candidate.source]}
                      </Badge>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCandidate(candidate);
                        setShowDetailSheet(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <CandidateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        projectId={projectId}
        jobs={jobs}
        isStaff={isStaff}
        onSuccess={() => {
          fetchData();
          onUpdate();
          setShowDialog(false);
        }}
      />

      <CandidateDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        candidate={selectedCandidate}
        canEdit={canEdit}
        projectId={projectId}
        onUpdate={() => {
          fetchData();
          onUpdate();
        }}
      />
    </div>
  );
}
