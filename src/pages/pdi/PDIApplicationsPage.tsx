import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { toast } from "sonner";
import { Search, Check, X, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Application {
  id: string;
  cohort_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  company: string | null;
  experience_years: number | null;
  professional_goal: string | null;
  current_challenges: string | null;
  motivation: string | null;
  leadership_level: string | null;
  status: string;
  reviewer_notes: string | null;
  submitted_at: string;
  cohort_name?: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function CommitField({ label, value }: { label: string; value: string | null | undefined }) {
  const isYes = value === "sim";
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${isYes ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {isYes ? "✓" : "✗"}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function PDIApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const fetchApplications = useCallback(async () => {
    const { data: apps } = await supabase
      .from("pdi_applications")
      .select("*")
      .order("submitted_at", { ascending: false });

    const appsList = (apps as any[]) || [];

    // Fetch cohort names
    const cohortIds = [...new Set(appsList.map((a) => a.cohort_id))];
    if (cohortIds.length > 0) {
      const { data: cohorts } = await supabase
        .from("pdi_cohorts")
        .select("id, name")
        .in("id", cohortIds);
      const cohortMap = new Map((cohorts as any[] || []).map((c) => [c.id, c.name]));
      appsList.forEach((a) => {
        a.cohort_name = cohortMap.get(a.cohort_id) || "—";
      });
    }

    setApplications(appsList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (app: Application) => {
    // Get current staff
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user?.id)
      .eq("is_active", true)
      .maybeSingle();

    // Update application
    await supabase
      .from("pdi_applications")
      .update({
        status: "approved",
        reviewer_notes: reviewNotes || null,
        reviewed_by: (staffData as any)?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", app.id);

    // Create participant
    await supabase.from("pdi_participants").insert({
      cohort_id: app.cohort_id,
      application_id: app.id,
      full_name: app.full_name,
      email: app.email,
      phone: app.phone,
      role_title: app.role_title,
      company: app.company,
    });

    toast.success("Inscrição aprovada e participante adicionado!");
    setSelected(null);
    setReviewNotes("");
    fetchApplications();
  };

  const handleReject = async (app: Application) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id")
      .eq("user_id", user?.id)
      .eq("is_active", true)
      .maybeSingle();

    await supabase
      .from("pdi_applications")
      .update({
        status: "rejected",
        reviewer_notes: reviewNotes || null,
        reviewed_by: (staffData as any)?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", app.id);

    toast.success("Inscrição rejeitada");
    setSelected(null);
    setReviewNotes("");
    fetchApplications();
  };

  const filtered = applications.filter((a) => {
    const matchSearch = a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inscrições</h1>
        <p className="text-sm text-muted-foreground">Gerencie as inscrições dos participantes</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhuma inscrição encontrada.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((app) => {
            const st = STATUS_MAP[app.status] || STATUS_MAP.pending;
            return (
              <Card key={app.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm">{app.full_name}</h3>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {app.email && <span>{app.email}</span>}
                        {app.role_title && <span>• {app.role_title}</span>}
                        {app.company && <span>• {app.company}</span>}
                        <span>• Turma: {app.cohort_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enviado em {format(new Date(app.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelected(app); setReviewNotes(app.reviewer_notes || ""); }}>
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                      {app.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => { setSelected(app); setReviewNotes(""); }}>
                            <Check className="h-3 w-3 mr-1" />
                            Avaliar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Inscrição</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wide border-b pb-1">Dados Pessoais</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{selected.full_name}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selected.email || "—"}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{(selected as any).phone || "—"}</span></div>
                <div><span className="text-muted-foreground">Cargo:</span> <span className="font-medium">{selected.role_title || "—"}</span></div>
                <div><span className="text-muted-foreground">Empresa:</span> <span className="font-medium">{selected.company || "—"}</span></div>
                <div><span className="text-muted-foreground">Experiência:</span> <span className="font-medium">{selected.experience_years ? `${selected.experience_years} anos` : "—"}</span></div>
                <div><span className="text-muted-foreground">Nível de Liderança:</span> <span className="font-medium">{selected.leadership_level || "—"}</span></div>
              </div>

              <h4 className="text-xs font-semibold text-primary uppercase tracking-wide border-b pb-1 pt-2">Perfil Profissional</h4>
              <DetailField label="Objetivo Profissional" value={selected.professional_goal} />
              <DetailField label="Desafios Atuais" value={selected.current_challenges} />
              <DetailField label="Motivação" value={selected.motivation} />
              <DetailField label="Maior Ponto Fraco" value={(selected as any).biggest_weakness} />
              <DetailField label="Treinamentos Anteriores" value={(selected as any).previous_training} />
              <DetailField label="Expectativas" value={(selected as any).expectations} />

              <h4 className="text-xs font-semibold text-primary uppercase tracking-wide border-b pb-1 pt-2">Comprometimento</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <CommitField label="Participar de todas as reuniões" value={(selected as any).commitment_meetings} />
                <CommitField label="Ler os livros solicitados" value={(selected as any).commitment_books} />
                <CommitField label="Fazer todas as tarefas" value={(selected as any).commitment_tasks} />
                <CommitField label="Câmera aberta nas reuniões" value={(selected as any).commitment_camera} />
              </div>
              <DetailField label="Prontidão para Desenvolvimento" value={(selected as any).development_readiness} />
              <DetailField label="Disponibilidade de Tempo" value={(selected as any).time_availability} />

              {selected.status === "pending" && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Observações</p>
                    <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notas sobre a avaliação..." />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => handleApprove(selected)}>
                      <Check className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleReject(selected)}>
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
