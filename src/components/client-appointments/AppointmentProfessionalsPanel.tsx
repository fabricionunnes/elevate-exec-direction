import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit2, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentProfessional } from "./types";

interface Props { projectId: string; canEdit: boolean; }

export function AppointmentProfessionalsPanel({ projectId, canEdit }: Props) {
  const [professionals, setProfessionals] = useState<AppointmentProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentProfessional | null>(null);
  const [form, setForm] = useState({ name: "", specialty: "", commission_percent: "" });

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("appointment_professionals").select("*").eq("project_id", projectId).eq("is_active", true).order("name");
    setProfessionals((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => { setForm({ name: "", specialty: "", commission_percent: "" }); setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload: any = { name: form.name, specialty: form.specialty || null, commission_percent: form.commission_percent ? parseFloat(form.commission_percent) : null };
    if (editing) {
      const { error } = await supabase.from("appointment_professionals").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Profissional atualizado");
    } else {
      const { error } = await supabase.from("appointment_professionals").insert({ ...payload, project_id: projectId });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Profissional cadastrado");
    }
    resetForm(); setDialogOpen(false); fetch();
  };

  const openEdit = (p: AppointmentProfessional) => {
    setEditing(p);
    setForm({ name: p.name, specialty: p.specialty || "", commission_percent: p.commission_percent ? String(p.commission_percent) : "" });
    setDialogOpen(true);
  };

  const filtered = professionals.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar profissional..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Profissional</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar Profissional" : "Novo Profissional"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Especialidade</Label><Input value={form.specialty} onChange={(e) => setForm(p => ({ ...p, specialty: e.target.value }))} /></div>
                <div><Label>Comissão (%)</Label><Input type="number" step="0.01" value={form.commission_percent} onChange={(e) => setForm(p => ({ ...p, commission_percent: e.target.value }))} /></div>
                <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum profissional cadastrado</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((prof) => (
            <Card key={prof.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCog className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{prof.name}</p>
                      {prof.specialty && <p className="text-xs text-muted-foreground">{prof.specialty}</p>}
                      {prof.commission_percent != null && <p className="text-xs text-muted-foreground">Comissão: {prof.commission_percent}%</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(prof)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
