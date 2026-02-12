import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit2, Building, Wrench } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentResource } from "./types";

interface Props { projectId: string; canEdit: boolean; }

export function AppointmentResourcesPanel({ projectId, canEdit }: Props) {
  const [resources, setResources] = useState<AppointmentResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentResource | null>(null);
  const [form, setForm] = useState({ name: "", resource_type: "room" as string });

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("appointment_resources").select("*").eq("project_id", projectId).eq("is_active", true).order("name");
    setResources((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => { setForm({ name: "", resource_type: "room" }); setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editing) {
      const { error } = await supabase.from("appointment_resources").update(form).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Recurso atualizado");
    } else {
      const { error } = await supabase.from("appointment_resources").insert({ ...form, project_id: projectId });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Recurso cadastrado");
    }
    resetForm(); setDialogOpen(false); fetch();
  };

  const openEdit = (r: AppointmentResource) => {
    setEditing(r); setForm({ name: r.name, resource_type: r.resource_type }); setDialogOpen(true);
  };

  const filtered = resources.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar recurso..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Recurso</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar Recurso" : "Novo Recurso"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.resource_type} onValueChange={(v) => setForm(p => ({ ...p, resource_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Sala</SelectItem>
                      <SelectItem value="equipment">Equipamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum recurso cadastrado</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((res) => (
            <Card key={res.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    {res.resource_type === "room" ? <Building className="h-4 w-4 text-primary" /> : <Wrench className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{res.name}</p>
                    <p className="text-xs text-muted-foreground">{res.resource_type === "room" ? "Sala" : "Equipamento"}</p>
                  </div>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(res)}><Edit2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
