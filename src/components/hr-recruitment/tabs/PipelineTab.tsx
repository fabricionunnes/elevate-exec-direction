import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { Candidate, PIPELINE_STAGES } from "../types";
import { CandidateDetailSheet } from "../sheets/CandidateDetailSheet";

interface PipelineTabProps {
  projectId: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function PipelineTab({ projectId, canEdit, onUpdate }: PipelineTabProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);
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
        .select("*, job_opening:job_openings(id, title)")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("updated_at", { ascending: false }),
      supabase
        .from("job_openings")
        .select("id, title")
        .eq("project_id", projectId)
        .in("status", ["open", "in_progress"]),
    ]);

    setCandidates(candidatesRes.data || []);
    setJobs(jobsRes.data || []);
    setLoading(false);
  };

  const filteredCandidates = candidates.filter(
    (c) => selectedJob === "all" || c.job_opening_id === selectedJob
  );

  const getCandidatesByStage = (stageKey: string) => {
    return filteredCandidates.filter((c) => c.current_stage === stageKey);
  };

  const handleDragStart = (e: React.DragEvent, candidate: Candidate) => {
    if (!canEdit) return;
    setDraggedCandidate(candidate);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    if (!canEdit || !draggedCandidate) return;

    if (draggedCandidate.current_stage === stageKey) {
      setDraggedCandidate(null);
      return;
    }

    // Optimistic update
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === draggedCandidate.id ? { ...c, current_stage: stageKey } : c
      )
    );

    const { error } = await supabase
      .from("candidates")
      .update({ current_stage: stageKey })
      .eq("id", draggedCandidate.id);

    if (error) {
      toast.error("Erro ao mover candidato");
      fetchData(); // Revert on error
    } else {
      toast.success("Candidato movido");
      onUpdate();
    }

    setDraggedCandidate(null);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={selectedJob} onValueChange={setSelectedJob}>
          <SelectTrigger className="w-64">
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{filteredCandidates.length} candidatos</span>
        </div>
      </div>

      {/* Pipeline Board */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: "fit-content" }}>
          {PIPELINE_STAGES.map((stage) => {
            const stageCandidates = getCandidatesByStage(stage.key);
            return (
              <div
                key={stage.key}
                className="w-72 flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                <Card className="h-full">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {stageCandidates.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 pt-0">
                    <div className="space-y-2 min-h-[200px]">
                      {stageCandidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          draggable={canEdit}
                          onDragStart={(e) => handleDragStart(e, candidate)}
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setShowDetailSheet(true);
                          }}
                          className={`
                            p-3 bg-card border rounded-lg cursor-pointer
                            hover:shadow-md transition-shadow
                            ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}
                            ${draggedCandidate?.id === candidate.id ? "opacity-50" : ""}
                          `}
                        >
                          <div className="flex items-start gap-2">
                            {canEdit && (
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                            )}
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(candidate.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {candidate.full_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {candidate.email}
                              </p>
                              {candidate.job_opening && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {(candidate.job_opening as any).title}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {stageCandidates.length === 0 && (
                        <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                          Arraste candidatos aqui
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

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
