import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { TrendingUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const DEFAULT_LEVELS = [
  { name: "Júnior", criteria: "Iniciante, supervisão constante", min_months: 0 },
  { name: "Pleno", criteria: "Autonomia em tarefas padrão", min_months: 18 },
  { name: "Sênior", criteria: "Autonomia total + mentoria", min_months: 36 },
  { name: "Especialista", criteria: "Referência técnica da área", min_months: 60 },
];

export default function UNVProfileCareerPage() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", area: "" });

  const load = async () => {
    const { data } = await supabase.from("profile_career_tracks").select("*").order("created_at", { ascending: false });
    setTracks(data || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("profile_career_tracks").insert({ ...form, levels: DEFAULT_LEVELS });
    if (error) return toast.error(error.message);
    toast.success("Trilha de carreira criada");
    setOpen(false);
    setForm({ name: "", area: "" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-primary" /> Plano de Carreira</h1>
          <p className="text-sm text-muted-foreground">Trilhas de evolução por cargo e área</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova trilha</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova trilha de carreira</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome (ex: Vendas)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Área" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
              <p className="text-xs text-muted-foreground">Níveis padrão (Júnior → Especialista) serão criados automaticamente.</p>
            </div>
            <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {tracks.map(t => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{t.area}</p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {(t.levels || []).map((lvl: any, i: number) => (
                  <div key={i} className="min-w-[200px] border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Badge>Nível {i + 1}</Badge>
                      <span className="text-xs text-muted-foreground">{lvl.min_months}m+</span>
                    </div>
                    <p className="font-semibold text-sm">{lvl.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{lvl.criteria}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {tracks.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Crie sua primeira trilha de carreira.</p>}
      </div>
    </div>
  );
}
