import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Plus, 
  Calendar, 
  MessageSquare,
  Star,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { InterviewDialog } from "../dialogs/InterviewDialog";

interface InterviewWithCandidate {
  id: string;
  candidate_id: string;
  interview_type: string;
  scheduled_at: string | null;
  conducted_at: string | null;
  interviewer_name: string | null;
  status: string;
  score: number | null;
  strengths: string | null;
  concerns: string | null;
  detailed_feedback: string | null;
  recommendation: string | null;
  created_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
  };
  interviewer?: {
    name: string;
  };
}

interface InterviewsTabProps {
  projectId: string;
  canEdit: boolean;
}

export function InterviewsTab({ projectId, canEdit }: InterviewsTabProps) {
  const [interviews, setInterviews] = useState<InterviewWithCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingInterview, setEditingInterview] = useState<InterviewWithCandidate | null>(null);

  useEffect(() => {
    fetchInterviews();
  }, [projectId]);

  const fetchInterviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("interviews")
      .select(`
        *,
        candidate:candidates!inner(id, full_name, email, project_id),
        interviewer:onboarding_staff(name)
      `)
      .eq("candidate.project_id", projectId)
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("Error fetching interviews:", error);
    } else {
      setInterviews(data || []);
    }
    setLoading(false);
  };

  const filteredInterviews = interviews.filter((i) => {
    const matchesSearch = 
      i.candidate.full_name.toLowerCase().includes(search.toLowerCase()) ||
      i.candidate.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || i.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'hr': return 'Entrevista RH';
      case 'technical': return 'Entrevista Técnica';
      case 'final': return 'Entrevista Final';
      default: return type;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'no_show': return <XCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendada';
      case 'completed': return 'Realizada';
      case 'cancelled': return 'Cancelada';
      case 'no_show': return 'Não compareceu';
      default: return status;
    }
  };

  const getRecommendationBadge = (rec: string | null) => {
    if (!rec) return null;
    switch (rec) {
      case 'approved':
        return <Badge className="bg-green-500">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'talent_pool':
        return <Badge variant="secondary">Banco de Talentos</Badge>;
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
            placeholder="Buscar por candidato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="completed">Realizadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Interviews List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredInterviews.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma entrevista encontrada</h3>
          <p className="text-muted-foreground">
            Agende entrevistas através do detalhe do candidato
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInterviews.map((interview) => (
            <Card 
              key={interview.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                if (canEdit) {
                  setEditingInterview(interview);
                  setShowDialog(true);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(interview.candidate.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{interview.candidate.full_name}</h4>
                      <Badge variant="outline">{getTypeLabel(interview.interview_type)}</Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {interview.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(interview.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      {(interview.interviewer?.name || interview.interviewer_name) && (
                        <span>
                          Entrevistador: {interview.interviewer?.name || interview.interviewer_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(interview.status)}
                      <span className="text-sm">{getStatusLabel(interview.status)}</span>
                    </div>

                    {interview.score !== null && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">{interview.score}/10</span>
                      </div>
                    )}

                    {getRecommendationBadge(interview.recommendation)}
                  </div>
                </div>

                {interview.status === 'completed' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {interview.strengths && (
                      <div className="p-3 bg-green-500/10 rounded-lg">
                        <p className="text-xs font-medium text-green-600 mb-1">Pontos Fortes</p>
                        <p className="text-sm">{interview.strengths}</p>
                      </div>
                    )}
                    {interview.concerns && (
                      <div className="p-3 bg-yellow-500/10 rounded-lg">
                        <p className="text-xs font-medium text-yellow-600 mb-1">Pontos de Atenção</p>
                        <p className="text-sm">{interview.concerns}</p>
                      </div>
                    )}
                  </div>
                )}

                {interview.detailed_feedback && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{interview.detailed_feedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for editing */}
      <InterviewDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        interview={editingInterview}
        onSuccess={() => {
          fetchInterviews();
          setShowDialog(false);
          setEditingInterview(null);
        }}
      />
    </div>
  );
}
