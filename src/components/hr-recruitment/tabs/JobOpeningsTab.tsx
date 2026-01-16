import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Briefcase, 
  MapPin, 
  Users,
  MoreVertical,
  Edit,
  Pause,
  Play,
  XCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { JobOpening, JOB_STATUS_LABELS } from "../types";
import { JobOpeningDialog } from "../dialogs/JobOpeningDialog";

interface JobOpeningsTabProps {
  projectId: string;
  companyId?: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function JobOpeningsTab({ projectId, companyId, canEdit, onUpdate }: JobOpeningsTabProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);

  useEffect(() => {
    fetchJobs();
  }, [projectId]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_openings")
      .select(`
        *,
        candidates:candidates(count)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Erro ao carregar vagas");
    } else {
      const jobsWithCount = (data || []).map((job: any) => ({
        ...job,
        candidates_count: job.candidates?.[0]?.count || 0,
      }));
      setJobs(jobsWithCount);
    }
    setLoading(false);
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    const { error } = await supabase
      .from("job_openings")
      .update({ 
        status: newStatus,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : null
      })
      .eq("id", jobId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success("Status atualizado");
      fetchJobs();
      onUpdate();
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(search.toLowerCase()) ||
    job.area.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'paused': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'closed': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vagas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {canEdit && (
          <Button onClick={() => { setEditingJob(null); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Vaga
          </Button>
        )}
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma vaga encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {search ? "Tente uma busca diferente" : "Crie sua primeira vaga para começar"}
          </p>
          {canEdit && !search && (
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Vaga
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg line-clamp-1">{job.title}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{job.area}</span>
                      <span>•</span>
                      <span>{job.job_type}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingJob(job); setShowDialog(true); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {job.status !== 'paused' && job.status !== 'closed' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'paused')}>
                            <Pause className="h-4 w-4 mr-2" />
                            Pausar
                          </DropdownMenuItem>
                        )}
                        {job.status === 'paused' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'open')}>
                            <Play className="h-4 w-4 mr-2" />
                            Reabrir
                          </DropdownMenuItem>
                        )}
                        {job.status !== 'closed' && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(job.id, 'closed')}
                            className="text-destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Encerrar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getStatusColor(job.status)}>
                    {JOB_STATUS_LABELS[job.status]}
                  </Badge>
                  {job.seniority && (
                    <Badge variant="secondary">{job.seniority}</Badge>
                  )}
                  {job.contract_model && (
                    <Badge variant="outline">{job.contract_model}</Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {job.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{job.is_remote ? 'Remoto' : job.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{job.candidates_count || 0} candidatos</span>
                  </div>
                </div>

                {job.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {job.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <JobOpeningDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        projectId={projectId}
        companyId={companyId}
        job={editingJob}
        onSuccess={() => {
          fetchJobs();
          onUpdate();
          setShowDialog(false);
          setEditingJob(null);
        }}
      />
    </div>
  );
}
