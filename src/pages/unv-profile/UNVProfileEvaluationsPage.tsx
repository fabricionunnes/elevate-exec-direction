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

export default function UNVProfileEvaluationsPage() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", type: "self", starts_at: "", ends_at: "" });

  const load = async () => {
    const { data } = await supabase.from("profile_evaluation_cycles").select("*").order("created_at", { ascending: false });
    setCycles(data || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast.error("Título obrigatório");
    const { error } = await supabase.from("profile_evaluation_cycles").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Ciclo criado");
    setOpen(false);
    setForm({ title: "", type: "self", starts_at: "", ends_at: "" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" /> Avaliações de Desempenho</h1>
          <p className="text-sm text-muted-foreground">Auto / Gestor / 90 / 180 / 360</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo ciclo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo ciclo de avaliação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título (ex: Avaliação 2026.1)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
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
              <Input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
              <Input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cycles.map(c => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{c.title}</CardTitle>
                <Badge variant="outline">{c.type}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {c.starts_at && new Date(c.starts_at).toLocaleDateString("pt-BR")} - {c.ends_at && new Date(c.ends_at).toLocaleDateString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        ))}
        {cycles.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Nenhum ciclo de avaliação criado.</p>}
      </div>
    </div>
  );
}
