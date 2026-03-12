import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Users, Calendar, Copy, ExternalLink, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  min_participants: number;
  max_participants: number;
  total_hours: number;
  status: string;
  enrollment_token: string;
  is_enrollment_open: boolean;
  responsible_staff_id: string | null;
  project_id: string | null;
  created_at: string;
}

interface Staff {
  id: string;
  name: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativa", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export default function PDICohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { currentStaff, isMaster } = useStaffPermissions();
  const isAdminOrMaster = isMaster || currentStaff?.role === "admin";

  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "",
    start_date: "",
    end_date: "",
    min_participants: "1",
    max_participants: "50",
    total_hours: "0",
    responsible_staff_id: "",
  });

  const fetchCohorts = useCallback(async () => {
    const { data } = await supabase
      .from("pdi_cohorts")
      .select("*")
      .order("created_at", { ascending: false });
    setCohorts((data as any[]) || []);
    setLoading(false);
  }, []);

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setStaff((data as any[]) || []);
  }, []);

  useEffect(() => {
    fetchCohorts();
    fetchStaff();
  }, [fetchCohorts, fetchStaff]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Nome da turma é obrigatório");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("pdi_cohorts").insert({
      name: form.name,
      description: form.description || null,
      objective: form.objective || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      min_participants: parseInt(form.min_participants) || 1,
      max_participants: parseInt(form.max_participants) || 50,
      total_hours: parseInt(form.total_hours) || 0,
      responsible_staff_id: form.responsible_staff_id || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar turma");
      return;
    }
    toast.success("Turma criada com sucesso!");
    setDialogOpen(false);
    setForm({ name: "", description: "", objective: "", start_date: "", end_date: "", min_participants: "1", max_participants: "50", total_hours: "0", responsible_staff_id: "" });
    fetchCohorts();
  };

  const toggleEnrollment = async (cohort: Cohort) => {
    await supabase
      .from("pdi_cohorts")
      .update({ is_enrollment_open: !cohort.is_enrollment_open })
      .eq("id", cohort.id);
    fetchCohorts();
    toast.success(cohort.is_enrollment_open ? "Inscrições fechadas" : "Inscrições abertas");
  };

  const updateStatus = async (cohortId: string, status: string) => {
    await supabase.from("pdi_cohorts").update({ status }).eq("id", cohortId);
    fetchCohorts();
    toast.success("Status atualizado");
  };

  const deleteCohort = async (cohortId: string) => {
    const { error } = await supabase.from("pdi_cohorts").delete().eq("id", cohortId);
    if (error) {
      toast.error("Erro ao excluir turma");
      return;
    }
    toast.success("Turma excluída com sucesso!");
    fetchCohorts();
  };

  const copyEnrollmentLink = (token: string) => {
    const url = `${getPublicBaseUrl()}/?public=pdi-enroll&token=${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const filtered = cohorts.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Turmas</h1>
          <p className="text-sm text-muted-foreground">Gerencie turmas de desenvolvimento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Turma
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Turma</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Nome da Turma *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Turma Liderança 2026" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva a turma..." />
              </div>
              <div>
                <Label>Objetivo do Programa</Label>
                <Textarea value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Qual o objetivo..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de Início</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Data de Término</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Mín. Participantes</Label>
                  <Input type="number" value={form.min_participants} onChange={(e) => setForm({ ...form, min_participants: e.target.value })} />
                </div>
                <div>
                  <Label>Máx. Participantes</Label>
                  <Input type="number" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} />
                </div>
                <div>
                  <Label>Carga Horária</Label>
                  <Input type="number" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: e.target.value })} placeholder="horas" />
                </div>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={form.responsible_staff_id} onValueChange={(v) => setForm({ ...form, responsible_staff_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full">
                {saving ? "Criando..." : "Criar Turma"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar turma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          Nenhuma turma encontrada. Crie sua primeira turma!
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((cohort) => {
            const st = STATUS_MAP[cohort.status] || STATUS_MAP.draft;
            return (
              <Card key={cohort.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{cohort.name}</h3>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {cohort.is_enrollment_open && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600">Inscrições Abertas</Badge>
                        )}
                      </div>
                      {cohort.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{cohort.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        {cohort.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(cohort.start_date), "dd/MM/yyyy", { locale: ptBR })}
                            {cohort.end_date && ` — ${format(new Date(cohort.end_date), "dd/MM/yyyy", { locale: ptBR })}`}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {cohort.min_participants}–{cohort.max_participants} participantes
                        </span>
                        {cohort.total_hours > 0 && (
                          <span>{cohort.total_hours}h</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyEnrollmentLink(cohort.enrollment_token)}
                        title="Copiar link de inscrição"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Link
                      </Button>
                      <Button
                        variant={cohort.is_enrollment_open ? "secondary" : "default"}
                        size="sm"
                        onClick={() => toggleEnrollment(cohort)}
                      >
                        {cohort.is_enrollment_open ? "Fechar Inscrições" : "Abrir Inscrições"}
                      </Button>
                      {cohort.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(cohort.id, "active")}>
                          Ativar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
