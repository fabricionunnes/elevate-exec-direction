import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Edit2, Clock, DollarSign, Scissors } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentService, AppointmentServiceCategory } from "./types";

interface Props { projectId: string; canEdit: boolean; }

export function AppointmentServicesPanel({ projectId, canEdit }: Props) {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [categories, setCategories] = useState<AppointmentServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentService | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category_id: "", duration_minutes: "60", price: "0", allows_packages: false, sessions_per_package: "", pre_instructions: "", post_instructions: "" });
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#6366f1" });

  const fetch = useCallback(async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("appointment_services").select("*, category:appointment_service_categories(*)").eq("project_id", projectId).eq("is_active", true).order("sort_order"),
      supabase.from("appointment_service_categories").select("*").eq("project_id", projectId).eq("is_active", true).order("name"),
    ]);
    setServices((s as any[]) || []);
    setCategories((c as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => { setForm({ name: "", description: "", category_id: "", duration_minutes: "60", price: "0", allows_packages: false, sessions_per_package: "", pre_instructions: "", post_instructions: "" }); setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload: any = {
      name: form.name, description: form.description || null,
      category_id: form.category_id || null, duration_minutes: parseInt(form.duration_minutes) || 60,
      price: parseFloat(form.price) || 0, allows_packages: form.allows_packages,
      sessions_per_package: form.sessions_per_package ? parseInt(form.sessions_per_package) : null,
      pre_instructions: form.pre_instructions || null, post_instructions: form.post_instructions || null,
    };
    if (editing) {
      const { error } = await supabase.from("appointment_services").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Serviço atualizado");
    } else {
      const { error } = await supabase.from("appointment_services").insert({ ...payload, project_id: projectId });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Serviço cadastrado");
    }
    resetForm(); setDialogOpen(false); fetch();
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const { error } = await supabase.from("appointment_service_categories").insert({ ...catForm, project_id: projectId });
    if (error) { toast.error("Erro ao criar categoria"); return; }
    toast.success("Categoria criada");
    setCatForm({ name: "", description: "", color: "#6366f1" }); setCatDialogOpen(false); fetch();
  };

  const openEdit = (svc: AppointmentService) => {
    setEditing(svc);
    setForm({
      name: svc.name, description: svc.description || "", category_id: svc.category_id || "",
      duration_minutes: String(svc.duration_minutes), price: String(svc.price),
      allows_packages: svc.allows_packages, sessions_per_package: svc.sessions_per_package ? String(svc.sessions_per_package) : "",
      pre_instructions: svc.pre_instructions || "", post_instructions: svc.post_instructions || "",
    });
    setDialogOpen(true);
  };

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Categoria</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nome *</Label><Input value={catForm.name} onChange={(e) => setCatForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>Descrição</Label><Input value={catForm.description} onChange={(e) => setCatForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <div><Label>Cor</Label><Input type="color" value={catForm.color} onChange={(e) => setCatForm(p => ({ ...p, color: e.target.value }))} className="h-10 w-20" /></div>
                  <Button onClick={handleSaveCategory} className="w-full">Criar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Serviço</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</DialogTitle></DialogHeader>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                  <div><Label>Categoria</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm(p => ({ ...p, category_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm(p => ({ ...p, duration_minutes: e.target.value }))} /></div>
                    <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} /></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.allows_packages} onCheckedChange={(v) => setForm(p => ({ ...p, allows_packages: v }))} />
                    <Label>Permite pacotes / sessões múltiplas</Label>
                  </div>
                  {form.allows_packages && (
                    <div><Label>Sessões por pacote</Label><Input type="number" value={form.sessions_per_package} onChange={(e) => setForm(p => ({ ...p, sessions_per_package: e.target.value }))} /></div>
                  )}
                  <div><Label>Instruções pré-procedimento</Label><Textarea value={form.pre_instructions} onChange={(e) => setForm(p => ({ ...p, pre_instructions: e.target.value }))} rows={2} /></div>
                  <div><Label>Instruções pós-procedimento</Label><Textarea value={form.post_instructions} onChange={(e) => setForm(p => ({ ...p, post_instructions: e.target.value }))} rows={2} /></div>
                  <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Cadastrar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum serviço cadastrado</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((svc) => (
            <Card key={svc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ backgroundColor: (svc.category as any)?.color ? `${(svc.category as any).color}20` : 'hsl(var(--primary) / 0.1)' }}>
                      <Scissors className="h-4 w-4" style={{ color: (svc.category as any)?.color || 'hsl(var(--primary))' }} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{svc.name}</p>
                      {svc.category && <p className="text-xs text-muted-foreground">{(svc.category as any).name}</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(svc)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{svc.duration_minutes}min</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />R$ {Number(svc.price).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
