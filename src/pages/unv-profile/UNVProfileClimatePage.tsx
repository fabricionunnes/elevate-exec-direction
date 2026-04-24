import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Heart, Plus, Copy, ExternalLink, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import { useProfileViewerScope } from "@/hooks/useProfileViewerScope";

const STATUS_LABELS: Record<string, string> = { draft: "Rascunho", active: "Ativa", closed: "Encerrada" };
const TYPE_LABELS: Record<string, string> = { pulse: "Pulse", climate: "Clima geral", enps: "eNPS" };

export default function UNVProfileClimatePage() {
  const { isAdmin, employeeId, loading: scopeLoading } = useProfileViewerScope();
  const [list, setList] = useState<any[]>([]);
  const [myResponses, setMyResponses] = useState<any[]>([]);
  const [enps, setEnps] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", type: "pulse", status: "active" });

  const load = async () => {
    if (isAdmin) {
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
      } else {
        setEnps(null);
      }
      setMyResponses([]);
      return;
    }
    if (!employeeId) { setList([]); setMyResponses([]); setEnps(null); return; }
    // Não-admin: apenas as pesquisas que ele respondeu (não-anônimas vinculadas ao employee_id).
    const { data: resp } = await supabase
      .from("profile_climate_responses")
      .select("*, survey:profile_climate_surveys(id, title, type, status)")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    setMyResponses(resp || []);
    setList([]);
    setEnps(null);
  };

  useEffect(() => { if (!scopeLoading) load(); }, [scopeLoading, isAdmin, employeeId]);

  const create = async () => {
    if (!form.title) return toast.error("Título obrigatório");

    const baseQuestions: any[] = [];
    if (form.type === "enps" || form.type === "climate") {
      baseQuestions.push({ id: 1, type: "enps", text: "De 0 a 10, o quanto você recomendaria nossa empresa como um bom lugar para trabalhar?" });
    }
    if (form.type === "pulse" || form.type === "climate") {
      baseQuestions.push({ id: baseQuestions.length + 1, type: "scale", text: "Como você se sente em relação ao seu trabalho hoje? (1 a 5)" });
    }
    baseQuestions.push({ id: baseQuestions.length + 1, type: "text", text: "O que poderíamos melhorar?" });

    const { error } = await supabase.from("profile_climate_surveys").insert({
      ...form,
      questions: baseQuestions,
    });
    if (error) return toast.error(error.message);
    toast.success("Pesquisa criada");
    setOpen(false);
    setForm({ title: "", type: "pulse", status: "active" });
    load();
  };

  const buildLink = (id: string) => `${getPublicBaseUrl()}/#/pesquisa-clima/${id}`;

  const copyLink = async (id: string) => {
    const link = buildLink(id);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast.success("Link copiado!"); } catch { toast.error("Falha ao copiar"); }
      document.body.removeChild(ta);
    }
  };

  const toggleStatus = async (s: any) => {
    const next = s.status === "closed" ? "active" : "closed";
    const { error } = await supabase.from("profile_climate_surveys").update({ status: next }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "Pesquisa reaberta" : "Pesquisa encerrada");
    load();
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Heart className="w-6 h-6 text-primary" /> Clima & Engajamento</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Pulse surveys e eNPS interno" : "Suas respostas em pesquisas"}</p>
        </div>
        {isAdmin && (
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
        )}
      </div>

      {isAdmin && enps !== null && (
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

      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(s => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>{STATUS_LABELS[s.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{TYPE_LABELS[s.type] || s.type} • {(s.questions || []).length} perguntas</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
                  {buildLink(s.id)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(s.id)}>
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(buildLink(s.id), "_blank")}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleStatus(s)}>
                    {s.status === "closed" ? <><Unlock className="w-3.5 h-3.5 mr-1.5" />Reabrir</> : <><Lock className="w-3.5 h-3.5 mr-1.5" />Encerrar</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {list.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-12">Nenhuma pesquisa criada.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {myResponses.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">{r.survey?.title || "Pesquisa"}</p>
                  <Badge variant="outline">{TYPE_LABELS[r.survey?.type] || r.survey?.type}</Badge>
                </div>
                {r.enps_score != null && (
                  <p className="text-sm">Sua nota eNPS: <strong>{r.enps_score}</strong></p>
                )}
                {r.answers && Object.keys(r.answers).length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    {Object.entries(r.answers).map(([k, v]) => (
                      <p key={k}><strong>{k}:</strong> {String(v)}</p>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          ))}
          {myResponses.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              Você ainda não respondeu nenhuma pesquisa de clima identificada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
