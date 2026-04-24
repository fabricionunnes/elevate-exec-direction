import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useProfileViewerScope } from "@/hooks/useProfileViewerScope";

const STATUS_COLORS: Record<string, string> = { open: "bg-blue-500", in_progress: "bg-amber-500", completed: "bg-emerald-500", canceled: "bg-rose-500" };
const STATUS_LABELS: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", completed: "Concluído", canceled: "Cancelado" };

export default function UNVProfilePDIPage() {
  const { isAdmin, employeeId, loading: scopeLoading } = useProfileViewerScope();
  const [list, setList] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: "", title: "", description: "", due_date: "", status: "open" });

  const load = async () => {
    let q = supabase.from("profile_pdi").select("*, profile_employees(full_name, avatar_url)").order("created_at", { ascending: false });
    if (!isAdmin) {
      if (!employeeId) { setList([]); setEmployees([]); return; }
      q = q.or(`employee_id.eq.${employeeId},responsible_id.eq.${employeeId}`);
    }
    const pdis = await q;
    setList(pdis.data || []);
    if (isAdmin) {
      const emps = await supabase.from("profile_employees").select("id, full_name").order("full_name");
      setEmployees(emps.data || []);
    }
  };

  useEffect(() => { if (!scopeLoading) load(); }, [scopeLoading, isAdmin, employeeId]);

  const create = async () => {
    if (!form.employee_id || !form.title) return toast.error("Colaborador e título são obrigatórios");
    const payload: any = {
      employee_id: form.employee_id,
      title: form.title,
      description: form.description || null,
      status: form.status || "open",
    };
    if (form.due_date) payload.due_date = form.due_date;
    const { error } = await supabase.from("profile_pdi").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("PDI criado");
    setOpen(false);
    setForm({ employee_id: "", title: "", description: "", due_date: "", status: "open" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-primary" /> PDI</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Planos de Desenvolvimento Individual" : "Seu plano de desenvolvimento"}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo PDI</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo PDI</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Colaborador *" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="Descrição / Ações" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <DialogFooter><Button onClick={create}>Criar PDI</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAdmin && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex gap-3 items-center">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">UNV IA pode sugerir PDIs personalizados</p>
              <p className="text-xs text-muted-foreground">Baseado em perfil DISC, desempenho e cargo do colaborador</p>
            </div>
            <Button size="sm" variant="outline">Sugerir com IA</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map(p => (
          <Card key={p.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{p.title}</CardTitle>
                <Badge className={`${STATUS_COLORS[p.status]} text-white`}>{STATUS_LABELS[p.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.profile_employees?.full_name} {p.due_date && `• Até ${new Date(p.due_date).toLocaleDateString("pt-BR")}`}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{p.description}</p>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-12">
            {isAdmin ? "Nenhum PDI criado." : "Você ainda não tem um PDI ativo."}
          </p>
        )}
      </div>
    </div>
  );
}
