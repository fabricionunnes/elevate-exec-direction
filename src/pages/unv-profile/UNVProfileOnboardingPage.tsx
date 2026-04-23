import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Rocket, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function UNVProfileOnboardingPage() {
  const [tracks, setTracks] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", duration_days: 30 });

  const load = async () => {
    const [t, p] = await Promise.all([
      supabase.from("profile_onboarding_tracks").select("*").order("created_at", { ascending: false }),
      supabase.from("profile_onboarding_progress").select("*, profile_employees(full_name)"),
    ]);
    setTracks(t.data || []);
    setProgress(p.data || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("profile_onboarding_tracks").insert({
      ...form,
      checklist: [
        { day: 1, item: "Boas-vindas e tour pelo escritório/sistemas" },
        { day: 1, item: "Entrega de equipamentos e acessos" },
        { day: 7, item: "Feedback 7 dias com gestor" },
        { day: 15, item: "Feedback 15 dias com RH" },
        { day: 30, item: "Avaliação 30 dias" },
        { day: 45, item: "Feedback 45 dias" },
        { day: 90, item: "Avaliação de período de experiência" },
      ],
    });
    if (error) return toast.error(error.message);
    toast.success("Trilha criada");
    setOpen(false);
    setForm({ name: "", description: "", duration_days: 30 });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Rocket className="w-6 h-6 text-primary" /> Onboarding</h1>
          <p className="text-sm text-muted-foreground">Trilhas de admissão e feedbacks 7/15/30/45/90 dias</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova trilha</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova trilha de onboarding</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome da trilha" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <Input type="number" placeholder="Duração (dias)" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: Number(e.target.value) })} />
            </div>
            <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map(t => (
          <Card key={t.id}>
            <CardHeader><CardTitle className="text-base">{t.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{t.description}</p>
              <div className="flex justify-between text-xs">
                <span>{t.duration_days} dias</span>
                <Badge variant="outline">{(t.checklist || []).length} itens</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {tracks.length === 0 && <Card className="col-span-full"><CardContent className="p-12 text-center text-sm text-muted-foreground">Crie a primeira trilha de onboarding</CardContent></Card>}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Onboardings em andamento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {progress.length === 0 && <p className="text-sm text-muted-foreground">Nenhum colaborador em onboarding.</p>}
          {progress.map(p => (
            <div key={p.id} className="border rounded-lg p-3">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-medium">{p.profile_employees?.full_name}</p>
                <Badge>{p.progress_pct || 0}%</Badge>
              </div>
              <Progress value={p.progress_pct || 0} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
