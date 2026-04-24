import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { useProfileViewerScope } from "@/hooks/useProfileViewerScope";

const TYPE_LABELS: Record<string, string> = { positive: "Reconhecimento", constructive: "Construtivo", "1on1": "1:1", neutral: "Geral" };
const TYPE_COLORS: Record<string, string> = { positive: "bg-emerald-500", constructive: "bg-amber-500", "1on1": "bg-blue-500", neutral: "bg-slate-500" };

export default function UNVProfileFeedbacksPage() {
  const { isAdmin, employeeId, loading: scopeLoading } = useProfileViewerScope();
  const [list, setList] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ to_id: "", type: "positive", content: "" });

  const load = async () => {
    let q = supabase
      .from("profile_feedbacks")
      .select("*, profile_employees!profile_feedbacks_to_id_fkey(full_name), from_emp:profile_employees!profile_feedbacks_from_id_fkey(full_name)")
      .order("created_at", { ascending: false });
    if (!isAdmin) {
      if (!employeeId) { setList([]); setEmployees([]); return; }
      q = q.or(`to_id.eq.${employeeId},from_id.eq.${employeeId}`);
    }
    const f = await q;
    setList(f.data || []);
    if (isAdmin) {
      const e = await supabase.from("profile_employees").select("id, full_name").order("full_name");
      setEmployees(e.data || []);
    } else {
      setEmployees([]);
    }
  };

  useEffect(() => { if (!scopeLoading) load(); }, [scopeLoading, isAdmin, employeeId]);

  const create = async () => {
    if (!form.to_id || !form.content) return toast.error("Preencha colaborador e mensagem");
    const { error } = await supabase.from("profile_feedbacks").insert({
      to_id: form.to_id,
      type: form.type,
      content: form.content,
    });
    if (error) return toast.error(error.message);
    toast.success("Feedback registrado");
    setOpen(false);
    setForm({ to_id: "", type: "positive", content: "" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-primary" /> Feedbacks & 1:1</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Cultura de feedback contínuo" : "Seus feedbacks recebidos e enviados"}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo feedback</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo feedback</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={form.to_id} onValueChange={v => setForm({ ...form, to_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Para quem? *" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Reconhecimento</SelectItem>
                    <SelectItem value="constructive">Construtivo</SelectItem>
                    <SelectItem value="1on1">1:1</SelectItem>
                    <SelectItem value="neutral">Geral</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Mensagem" rows={5} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <DialogFooter><Button onClick={create}>Enviar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {list.map(f => {
          const direction = !isAdmin && f.from_id === employeeId ? "Enviado" : !isAdmin && f.to_id === employeeId ? "Recebido" : null;
          return (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {direction ? `${direction} ${direction === "Enviado" ? "para" : "de"} ${direction === "Enviado" ? f.profile_employees?.full_name : f.from_emp?.full_name || "—"}` : f.profile_employees?.full_name}
                  </p>
                  <Badge className={`${TYPE_COLORS[f.type]} text-white`}>{TYPE_LABELS[f.type]}</Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{f.content}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          );
        })}
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Nenhum feedback registrado.</p>}
      </div>
    </div>
  );
}
