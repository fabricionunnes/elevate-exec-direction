import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, User, Phone, Mail, Edit2, History } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentClient } from "./types";
import { format } from "date-fns";

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function AppointmentClientsPanel({ projectId, canEdit }: Props) {
  const [clients, setClients] = useState<AppointmentClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<AppointmentClient | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    email: "",
    birth_date: "",
    notes: "",
  });

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from("appointment_clients")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("full_name");
    setClients((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const resetForm = () => {
    setForm({ full_name: "", cpf: "", phone: "", email: "", birth_date: "", notes: "" });
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Nome é obrigatório"); return; }
    
    if (editing) {
      const { error } = await supabase.from("appointment_clients").update(form).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Cliente atualizado");
    } else {
      const { error } = await supabase.from("appointment_clients").insert({ ...form, project_id: projectId });
      if (error) {
        if (error.message.includes("idx_appointment_clients_cpf")) {
          toast.error("CPF já cadastrado neste projeto");
        } else {
          toast.error("Erro ao criar");
        }
        return;
      }
      toast.success("Cliente cadastrado");
    }
    resetForm();
    setDialogOpen(false);
    fetchClients();
  };

  const openEdit = (client: AppointmentClient) => {
    setEditing(client);
    setForm({
      full_name: client.full_name,
      cpf: client.cpf || "",
      phone: client.phone || "",
      email: client.email || "",
      birth_date: client.birth_date || "",
      notes: client.notes || "",
    });
    setDialogOpen(true);
  };

  const openHistory = async (client: AppointmentClient) => {
    setSelectedClient(client);
    const { data } = await supabase
      .from("appointments")
      .select("*, service:appointment_services(name), professional:appointment_professionals(name)")
      .eq("client_id", client.id)
      .order("start_time", { ascending: false })
      .limit(50);
    setHistory((data as any[]) || []);
    setHistoryOpen(true);
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || (c.cpf || "").includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm(p => ({ ...p, full_name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" /></div>
                  <div><Label>Data de nascimento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm(p => ({ ...p, birth_date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone / WhatsApp</Label><Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                  <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
                <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Card key={client.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{client.full_name}</p>
                      {client.cpf && <p className="text-xs text-muted-foreground">{client.cpf}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(client)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openHistory(client)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {client.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
                  {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico - {selectedClient?.full_name}</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum atendimento registrado</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.map((apt: any) => (
                <div key={apt.id} className="p-3 rounded-lg border text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{apt.service?.name}</p>
                      <p className="text-xs text-muted-foreground">{apt.professional?.name || "Sem profissional"}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{apt.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(apt.start_time), "dd/MM/yyyy HH:mm")} • R$ {Number(apt.price).toFixed(2)}
                  </p>
                  {apt.notes && <p className="text-xs mt-1">{apt.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
