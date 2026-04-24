import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { useProfileViewerScope } from "@/hooks/useProfileViewerScope";

export default function UNVProfileEvaluationsPage() {
  const { isAdmin, employeeId, loading: scopeLoading } = useProfileViewerScope();
  const [cycles, setCycles] = useState<any[]>([]);
  const [myEvals, setMyEvals] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", type: "self", start_date: "", end_date: "" });

  const load = async () => {
    if (isAdmin) {
      const { data } = await supabase.from("profile_evaluation_cycles").select("*").order("created_at", { ascending: false });
      setCycles(data || []);
      setMyEvals([]);
      return;
    }
    if (!employeeId) {
      setCycles([]);
      setMyEvals([]);
      return;
    }
    // Não-admin: mostra apenas avaliações em que ele é avaliado OU avaliador.
    const { data: evals } = await supabase
      .from("profile_evaluations")
      .select("*, cycle:profile_evaluation_cycles(name, type, start_date, end_date, status)")
      .or(`evaluated_id.eq.${employeeId},evaluator_id.eq.${employeeId}`)
      .order("created_at", { ascending: false });
    setMyEvals(evals || []);
    // Lista os ciclos relacionados a essas avaliações.
    const cycleIds = Array.from(new Set((evals || []).map((e: any) => e.cycle_id).filter(Boolean)));
    if (cycleIds.length) {
      const { data: cs } = await supabase.from("profile_evaluation_cycles").select("*").in("id", cycleIds);
      setCycles(cs || []);
    } else {
      setCycles([]);
    }
  };

  useEffect(() => { if (!scopeLoading) load(); }, [scopeLoading, isAdmin, employeeId]);

  const create = async () => {
    if (!form.name) return toast.error("Título obrigatório");
    const payload: any = { name: form.name, type: form.type };
    if (form.start_date) payload.start_date = form.start_date;
    if (form.end_date) payload.end_date = form.end_date;
    const { error } = await supabase.from("profile_evaluation_cycles").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Ciclo criado");
    setOpen(false);
    setForm({ name: "", type: "self", start_date: "", end_date: "" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Avaliações de Desempenho</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Auto / Gestor / 90 / 180 / 360" : "Suas avaliações"}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo ciclo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo ciclo de avaliação</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Título (ex: Avaliação 2026.1)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Autoavaliação</SelectItem>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="90">90 graus</SelectItem>
                    <SelectItem value="180">180 graus</SelectItem>
                    <SelectItem value="360">360 graus</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cycles.map(c => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <Badge variant="outline">{c.type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {c.start_date && new Date(c.start_date).toLocaleDateString("pt-BR")} - {c.end_date && new Date(c.end_date).toLocaleDateString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          ))}
          {cycles.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Nenhum ciclo de avaliação criado.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myEvals.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base">{e.cycle?.name || "Avaliação"}</CardTitle>
                  <Badge variant="outline">{e.evaluator_role || e.cycle?.type}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {e.evaluated_id === employeeId ? "Você é avaliado" : "Você é avaliador"}
                  {e.completed_at ? " • Concluída" : " • Pendente"}
                </p>
              </CardHeader>
              <CardContent>
                {e.overall_score != null && <p className="text-sm">Nota geral: <strong>{Number(e.overall_score).toFixed(1)}</strong></p>}
                {e.comments && <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{e.comments}</p>}
              </CardContent>
            </Card>
          ))}
          {myEvals.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Você ainda não tem avaliações.</p>}
        </div>
      )}
    </div>
  );
}
