import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Plus, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export default function UNVProfileTrainingsPage() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", description: "", category: "", duration_minutes: 0, video_url: "" });

  const load = async () => {
    const { data } = await supabase.from("profile_trainings").select("*").order("created_at", { ascending: false });
    setList(data || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast.error("Título obrigatório");
    const { error } = await supabase.from("profile_trainings").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Treinamento criado");
    setOpen(false);
    setForm({ title: "", description: "", category: "", duration_minutes: 0, video_url: "" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="w-6 h-6 text-primary" /> Treinamentos</h1>
          <p className="text-sm text-muted-foreground">Trilhas, conteúdos, vídeos, testes e certificados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Novo treinamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo treinamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Categoria (ex: Vendas)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <Input type="number" placeholder="Duração (min)" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
              <Input placeholder="URL do vídeo (YouTube/Vimeo)" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(t => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-base">{t.title}</CardTitle>
                {t.video_url && <PlayCircle className="w-4 h-4 text-primary" />}
              </div>
              {t.category && <Badge variant="outline" className="text-[10px] w-fit">{t.category}</Badge>}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>
              {t.duration_minutes > 0 && <p className="text-xs mt-2">{t.duration_minutes} min</p>}
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Crie seu primeiro treinamento.</p>}
      </div>
    </div>
  );
}
