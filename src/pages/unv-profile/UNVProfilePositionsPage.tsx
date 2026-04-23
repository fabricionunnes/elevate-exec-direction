import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function UNVProfilePositionsPage() {
  const [positions, setPositions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", description: "", salary_min: "", salary_max: "", competencies: "" });

  const load = async () => {
    const [p, d] = await Promise.all([
      supabase.from("profile_positions").select("*").order("title"),
      supabase.from("profile_departments").select("*").order("name"),
    ]);
    setPositions(p.data || []);
    setDepartments(d.data || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast.error("Título obrigatório");
    const { error } = await supabase.from("profile_positions").insert({
      title: form.title,
      description: form.description,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      competencies: form.competencies ? form.competencies.split(",").map((s: string) => s.trim()) : [],
    });
    if (error) return toast.error(error.message);
    toast.success("Cargo criado");
    setOpen(false);
    setForm({ title: "", description: "", salary_min: "", salary_max: "", competencies: "" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" /> Cargos & Salários</h1>
          <p className="text-sm text-muted-foreground">Cadastro de cargos, faixas salariais e competências</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo cargo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cargo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Salário mín" value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} />
                <Input type="number" placeholder="Salário máx" value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} />
              </div>
              <Input placeholder="Competências (separadas por vírgula)" value={form.competencies} onChange={e => setForm({ ...form, competencies: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map(p => (
          <Card key={p.id}>
            <CardHeader><CardTitle className="text-base">{p.title}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
              {(p.salary_min || p.salary_max) && (
                <p className="text-xs">R$ {Number(p.salary_min || 0).toLocaleString("pt-BR")} – R$ {Number(p.salary_max || 0).toLocaleString("pt-BR")}</p>
              )}
              {p.competencies?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.competencies.map((c: string, i: number) => <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {positions.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Nenhum cargo cadastrado.</p>}
      </div>
    </div>
  );
}
