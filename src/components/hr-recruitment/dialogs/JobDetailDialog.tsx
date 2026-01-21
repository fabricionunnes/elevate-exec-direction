import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABELS, PIPELINE_STAGES } from "../types";

interface JobDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    title: string;
    area: string;
    job_type: string;
    description: string | null;
    requirements: string | null;
    status: string;
    created_at: string;
    target_date: string | null;
    sla_days: number | null;
    responsible_rh_id: string | null;
    consultant_id: string | null;
    internal_notes: string | null;
    company_name: string;
    project_name: string;
    candidates_count: number;
    project_id: string;
  };
  staff: { id: string; name: string; role: string }[];
  canEdit: boolean;
  onUpdate: () => void;
}

export function JobDetailDialog({
  open,
  onOpenChange,
  job,
  staff,
  canEdit,
  onUpdate,
}: JobDetailDialogProps) {
  const navigate = useNavigate();
  const [candidatesByStage, setCandidatesByStage] = useState<Record<string, number>>({});
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  // Load candidates by stage
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const { data, error } = await supabase
          .from("candidates")
          .select("current_stage")
          .eq("job_opening_id", job.id)
          .eq("status", "active");

        if (error) throw error;

        const stageCount: Record<string, number> = {};
        (data || []).forEach((c) => {
          stageCount[c.current_stage] = (stageCount[c.current_stage] || 0) + 1;
        });
        setCandidatesByStage(stageCount);
      } catch (error) {
        console.error("Error loading candidates:", error);
      } finally {
        setLoadingCandidates(false);
      }
    };
    loadCandidates();
  }, [job.id]);

  const handleGoToProject = () => {
    onOpenChange(false);
    navigate(`/onboarding-tasks/projeto/${job.project_id}?tab=rh`);
  };

  const daysOpen = differenceInDays(new Date(), new Date(job.created_at));

  const getStatusColor = (s: string) => {
    switch (s) {
      case "open": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "in_progress": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "paused": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "closed": return "bg-gray-500/10 text-gray-600 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {job.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
            <TabsTrigger value="pipeline" className="flex-1">Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{job.company_name}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Projeto</Label>
                <span className="font-medium">{job.project_name}</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Área</Label>
                <span>{job.area}</span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Badge variant="outline">{job.job_type}</Badge>
              </div>
            </div>

            {/* Status and metrics */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <Badge variant="outline" className={cn("text-sm", getStatusColor(job.status))}>
                  {JOB_STATUS_LABELS[job.status] || job.status}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Status</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold">{daysOpen}</span>
                </div>
                <p className="text-xs text-muted-foreground">Dias em aberto</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold">{job.candidates_count}</span>
                </div>
                <p className="text-xs text-muted-foreground">Candidatos</p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data de abertura</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(job.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>
              {job.target_date && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data alvo</Label>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>{format(new Date(job.target_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {job.description && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descrição
                </Label>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                  {job.description}
                </p>
              </div>
            )}

            {/* Requirements */}
            {job.requirements && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Requisitos</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                  {job.requirements}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4 mt-4">
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage) => {
                const count = candidatesByStage[stage.key] || 0;
                return (
                  <div
                    key={stage.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderLeftColor: stage.color, borderLeftWidth: 4 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium">{stage.name}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                );
              })}
            </div>
          </TabsContent>

        </Tabs>

        <div className="pt-4 border-t">
          <Button onClick={handleGoToProject} variant="outline" className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Ir para o projeto (RH)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
