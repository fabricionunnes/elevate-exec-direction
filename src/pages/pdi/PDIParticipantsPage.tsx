import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Plus, Copy, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Participant {
  id: string;
  cohort_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  company: string | null;
  access_token: string;
  status: string;
  enrolled_at: string;
  cohort_name?: string;
}

interface Cohort {
  id: string;
  name: string;
}

export default function PDIParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role_title: "",
    company: "",
    cohort_id: "",
  });

  const fetchData = useCallback(async () => {
    const [participantsRes, cohortsRes] = await Promise.all([
      supabase.from("pdi_participants").select("*").order("enrolled_at", { ascending: false }),
      supabase.from("pdi_cohorts").select("id, name").order("name"),
    ]);

    const cohortsList = (cohortsRes.data as any[]) || [];
    setCohorts(cohortsList);
    const cohortMap = new Map(cohortsList.map((c) => [c.id, c.name]));

    const partsList = ((participantsRes.data as any[]) || []).map((p) => ({
      ...p,
      cohort_name: cohortMap.get(p.cohort_id) || "—",
    }));
    setParticipants(partsList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.cohort_id) {
      toast.error("Nome e turma são obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("pdi_participants").insert({
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      role_title: form.role_title || null,
      company: form.company || null,
      cohort_id: form.cohort_id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao adicionar participante");
      return;
    }
    toast.success("Participante adicionado!");
    setDialogOpen(false);
    setForm({ full_name: "", email: "", phone: "", role_title: "", company: "", cohort_id: "" });
    fetchData();
  };

  const copyAccessLink = (token: string) => {
    const url = `${window.location.origin}/#/pdi/participant/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de acesso copiado!");
  };

  const filtered = participants.filter((p) => {
    const matchSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email || "").toLowerCase().includes(search.toLowerCase());
    const matchCohort = filterCohort === "all" || p.cohort_id === filterCohort;
    return matchSearch && matchCohort;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Participantes</h1>
          <p className="text-sm text-muted-foreground">Gerencie os participantes do PDI</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Participante
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar participante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCohort} onValueChange={setFilterCohort}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as turmas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as turmas</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Nenhum participante encontrado.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-foreground">{p.full_name}</h3>
                        <Badge variant={p.status === "active" ? "default" : "secondary"}>
                          {p.status === "active" ? "Ativo" : p.status === "completed" ? "Concluído" : p.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {p.email && <span>{p.email}</span>}
                        {p.role_title && <span>• {p.role_title}</span>}
                        {p.company && <span>• {p.company}</span>}
                        <span>• {p.cohort_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyAccessLink(p.access_token)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Link
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedParticipant(p)}>
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add participant dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Participante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome Completo *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Turma *</Label>
              <Select value={form.cohort_id} onValueChange={(v) => setForm({ ...form, cohort_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo</Label>
                <Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? "Adicionando..." : "Adicionar Participante"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedParticipant} onOpenChange={() => setSelectedParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Participante</DialogTitle>
          </DialogHeader>
          {selectedParticipant && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{selectedParticipant.full_name}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selectedParticipant.email || "—"}</span></div>
                <div><span className="text-muted-foreground">Cargo:</span> <span className="font-medium">{selectedParticipant.role_title || "—"}</span></div>
                <div><span className="text-muted-foreground">Empresa:</span> <span className="font-medium">{selectedParticipant.company || "—"}</span></div>
                <div><span className="text-muted-foreground">Turma:</span> <span className="font-medium">{selectedParticipant.cohort_name}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{selectedParticipant.status}</span></div>
                <div><span className="text-muted-foreground">Inscrito em:</span> <span className="font-medium">{format(new Date(selectedParticipant.enrolled_at), "dd/MM/yyyy", { locale: ptBR })}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
