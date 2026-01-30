import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";

interface JobOpening {
  id: string;
  title: string;
  status: string;
  project_id: string;
  candidates_count: number;
  company_name: string | null;
  project_name: string;
}

interface AssignToJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  onSuccess?: () => void;
}

export function AssignToJobDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  onSuccess,
}: AssignToJobDialogProps) {
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (open) {
      fetchOpenJobs();
      setSelectedJobId("");
    }
  }, [open]);

  const fetchOpenJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_openings")
        .select(`
          id,
          title,
          status,
          project_id,
          candidates_count,
          project:onboarding_projects(
            id,
            product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedJobs: JobOpening[] = (data || []).map((job: any) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        project_id: job.project_id,
        candidates_count: job.candidates_count || 0,
        company_name: job.project?.company?.name || null,
        project_name: job.project?.product_name || "Projeto",
      }));

      setJobs(mappedJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Erro ao carregar vagas");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedJobId) {
      toast.error("Selecione uma vaga");
      return;
    }

    setAssigning(true);
    try {
      const selectedJob = jobs.find((j) => j.id === selectedJobId);
      if (!selectedJob) throw new Error("Vaga não encontrada");

      // Update candidate: assign to job and move to 'new' stage
      const { error } = await supabase
        .from("candidates")
        .update({
          job_opening_id: selectedJobId,
          project_id: selectedJob.project_id,
          current_stage: "new",
          talent_pool_notes: null, // Clear talent pool notes when moving out
        })
        .eq("id", candidateId);

      if (error) throw error;

      // Count will be recalculated based on actual candidates
      // No need to manually increment since candidates_count can be a computed value
      try {
        // Update job candidates count
        const { count } = await supabase
          .from("candidates")
          .select("*", { count: "exact", head: true })
          .eq("job_opening_id", selectedJobId);

        if (count !== null) {
          await supabase
            .from("job_openings")
            .update({ candidates_count: count } as any)
            .eq("id", selectedJobId);
        }
      } catch (e) {
        // Silently fail - count will be recalculated on next page load
        console.log("Could not update candidates count");
      }

      // Log history
      const { data: staff } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (staff) {
        await supabase.from("hiring_history").insert({
          candidate_id: candidateId,
          action: "assigned_to_job",
          description: `Candidato movido do Banco de Talentos para a vaga "${selectedJob.title}" em ${selectedJob.company_name || selectedJob.project_name}`,
          performed_by_staff_id: staff.id,
          new_value: selectedJob.title,
        });
      }

      toast.success(`${candidateName} foi vinculado(a) à vaga "${selectedJob.title}"`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error assigning candidate:", error);
      toast.error("Erro ao vincular candidato à vaga");
    } finally {
      setAssigning(false);
    }
  };

  // Group jobs by company
  const jobsByCompany = jobs.reduce(
    (acc, job) => {
      const key = job.company_name || "Sem empresa";
      if (!acc[key]) acc[key] = [];
      acc[key].push(job);
      return acc;
    },
    {} as Record<string, JobOpening[]>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Vincular a uma Vaga
          </DialogTitle>
          <DialogDescription>
            Selecione uma vaga em aberto para incluir{" "}
            <strong>{candidateName}</strong> no processo seletivo.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma vaga em aberto encontrada</p>
            </div>
          ) : (
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma vaga..." />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {Object.entries(jobsByCompany).map(([companyName, companyJobs]) => (
                  <div key={companyName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/50 sticky top-0">
                      <Building2 className="h-3 w-3" />
                      {companyName}
                    </div>
                    {companyJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{job.title}</span>
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Users className="h-3 w-3" />
                            {job.candidates_count}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedJobId || assigning}
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              "Vincular à Vaga"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
