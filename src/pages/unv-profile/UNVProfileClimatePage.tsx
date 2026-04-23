import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = { draft: "Rascunho", active: "Ativa", closed: "Encerrada" };

export default function UNVProfileClimatePage() {
  const [list, setList] = useState<any[]>([]);
  const [enps, setEnps] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", type: "pulse", status: "active" });

  const load = async () => {
    const [s, r] = await Promise.all([
      supabase.from("profile_climate_surveys").select("*").order("created_at", { ascending: false }),
      supabase.from("profile_climate_responses").select("enps_score"),
    ]);
    setList(s.data || []);
    const scores = (r.data || []).map((x: any) => x.enps_score).filter((x: any) => typeof x === "number");
    if (scores.length) {
      const promoters = scores.filter((x: number) => x >= 9).length;
      const detractors = scores.filter((x: number) => x <= 6).length;
      setEnps(Math.round(((promoters - detractors) / scores.length) * 100));
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title) return toast.error("Título obrigatório");
    const { error } = await supabase.from("profile_climate_surveys").insert({
      ...form,
      questions: [
        { id: 1, type: "enps", text: "De 0 a 10, o quanto você recomendaria nossa empresa como um bom lugar para trabalhar?" },
        { id: 2, type: "scale", text: "Como você se sente em relação ao seu trabalho hoje?" },
        { id: 3, type: "text", text: "O que poderíamos melhorar?" },
      ],
    });
    if (error) return toast.error(error.message);
    toast.success("Pesquisa criada");
    setOpen(false);
    setForm({ title: "", type: "pulse", status: "active" });
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Heart className="w-6 h-6 text-primary" /> Clima & Engajamento</h1>
          <p className="text-sm text-muted-foreground">Pulse surveys e eNPS interno</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova pesquisa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova pesquisa de clima</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pulse">Pulse (rápida)</SelectItem>
                  <SelectItem value="climate">Clima geral</SelectItem>
                  <SelectItem value="enps">eNPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {enps !== null && (
        <Card className={enps >= 50 ? "border-emerald-500/50 bg-emerald-500/5" : enps >= 0 ? "border-amber-500/50 bg-amber-500/5" : "border-rose-500/50 bg-rose-500/5"}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">eNPS atual</p>
              <p className="text-4xl font-bold">{enps}</p>
            </div>
            <Heart className="w-12 h-12 text-primary opacity-50" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map(s => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex justify-between">
                <CardTitle className="text-base">{s.title}</CardTitle>
                <Badge>{STATUS_LABELS[s.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{s.type}</p>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{(s.questions || []).length} perguntas</p>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Nenhuma pesquisa criada.</p>}
      </div>
    </div>
  );
}
