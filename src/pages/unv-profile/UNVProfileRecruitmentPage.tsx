import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, MapPin, Users as UsersIcon, ExternalLink, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUS_LABELS: Record<string, string> = { open: "Aberta", paused: "Pausada", closed: "Encerrada", filled: "Preenchida" };
const STATUS_COLORS: Record<string, string> = { open: "bg-emerald-500", paused: "bg-amber-500", closed: "bg-rose-500", filled: "bg-blue-500" };

export default function UNVProfileRecruitmentPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const emptyForm = {
    title: "", area: "", seniority: "", contract_model: "CLT",
    salary_min: "", salary_max: "", description: "", requirements: "",
    city: "", state: "", is_remote: false, status: "open",
    target_d: "", target_i: "", target_s: "", target_c: "",
  };
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    const { data } = await supabase.from("profile_jobs").select("*").order("created_at", { ascending: false });
    setJobs(data || []);
    const { data: cands } = await supabase.from("profile_candidates").select("job_id");
    const c: Record<string, number> = {};
    (cands || []).forEach((x: any) => { if (x.job_id) c[x.job_id] = (c[x.job_id] || 0) + 1; });
    setCounts(c);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (job: any) => {
    setEditingId(job.id);
    setForm({
      title: job.title || "", area: job.area || "", seniority: job.seniority || "",
      contract_model: job.contract_model || "CLT",
      salary_min: job.salary_min ?? "", salary_max: job.salary_max ?? "",
      description: job.description || "", requirements: job.requirements || "",
      city: job.city || "", state: job.state || "", is_remote: !!job.is_remote,
      status: job.status || "open",
      target_d: job.target_disc?.D ?? "", target_i: job.target_disc?.I ?? "",
      target_s: job.target_disc?.S ?? "", target_c: job.target_disc?.C ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title) return toast.error("Informe o título da vaga");
    const { target_d, target_i, target_s, target_c, ...rest } = form;
    const hasTarget = [target_d, target_i, target_s, target_c].some((v) => v !== "" && v != null);
    const clamp = (v: any) => Math.max(0, Math.min(100, Number(v) || 0));
    const payload: any = {
      ...rest,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      target_disc: hasTarget ? { D: clamp(target_d), I: clamp(target_i), S: clamp(target_s), C: clamp(target_c) } : null,
    };
    if (editingId) {
      const { error } = await supabase.from("profile_jobs").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Vaga atualizada");
    } else {
      const { error } = await supabase.from("profile_jobs").insert({ ...payload, public_token: crypto.randomUUID() });
      if (error) return toast.error(error.message);
      toast.success("Vaga criada");
    }
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  const remove = async (job: any) => {
    if (!confirm(`Excluir a vaga "${job.title}"? Os candidatos vinculados também serão removidos. Essa ação não pode ser desfeita.`)) return;
    await supabase.from("profile_candidates").delete().eq("job_id", job.id);
    const { error } = await supabase.from("profile_jobs").delete().eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success("Vaga excluída");
    load();
  };

  const filtered = jobs.filter(j =>
    (status === "all" || j.status === status) &&
    (!q || j.title?.toLowerCase().includes(q.toLowerCase()) || j.area?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="w-6 h-6 text-primary" /> Recrutamento & Seleção</h1>
          <p className="text-sm text-muted-foreground">Gestão completa de vagas e candidatos com IA</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nova vaga</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingId ? "Editar vaga" : "Nova vaga"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Título da vaga *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="col-span-2" />
              <Input placeholder="Área" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
              <Select value={form.seniority} onValueChange={v => setForm({ ...form, seniority: v })}>
                <SelectTrigger><SelectValue placeholder="Senioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estagio">Estágio</SelectItem>
                  <SelectItem value="junior">Júnior</SelectItem>
                  <SelectItem value="pleno">Pleno</SelectItem>
                  <SelectItem value="senior">Sênior</SelectItem>
                  <SelectItem value="especialista">Especialista</SelectItem>
                  <SelectItem value="lideranca">Liderança</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.contract_model} onValueChange={v => setForm({ ...form, contract_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                  <SelectItem value="Estagio">Estágio</SelectItem>
                  <SelectItem value="Freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Cidade" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <Input placeholder="Estado" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
              <Input placeholder="Salário mín" type="number" value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} />
              <Input placeholder="Salário máx" type="number" value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} />
              <Textarea placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="col-span-2" />
              <Textarea placeholder="Requisitos" value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} className="col-span-2" />
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="closed">Encerrada</SelectItem>
                  <SelectItem value="filled">Preenchida</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_remote} onChange={e => setForm({ ...form, is_remote: e.target.checked })} />
                Vaga remota
              </label>
              <div className="col-span-2 border-t pt-3 mt-1">
                <p className="text-sm font-medium">Perfil DISC ideal da vaga <span className="text-xs font-normal text-muted-foreground">(0–100, opcional — usado pra comparar com o DISC dos candidatos)</span></p>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <Input type="number" min={0} max={100} placeholder="D (Dominância)" value={form.target_d} onChange={e => setForm({ ...form, target_d: e.target.value })} />
                  <Input type="number" min={0} max={100} placeholder="I (Influência)" value={form.target_i} onChange={e => setForm({ ...form, target_i: e.target.value })} />
                  <Input type="number" min={0} max={100} placeholder="S (Estabilidade)" value={form.target_s} onChange={e => setForm({ ...form, target_s: e.target.value })} />
                  <Input type="number" min={0} max={100} placeholder="C (Conformidade)" value={form.target_c} onChange={e => setForm({ ...form, target_c: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>{editingId ? "Salvar alterações" : "Criar vaga"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar vaga..." className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="closed">Encerrada</SelectItem>
            <SelectItem value="filled">Preenchida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(job => (
          <Card key={job.id} className="hover:shadow-md transition">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{job.title}</CardTitle>
                <Badge className={`${STATUS_COLORS[job.status]} text-white`}>{STATUS_LABELS[job.status]}</Badge>
              </div>
              {job.area && <p className="text-xs text-muted-foreground">{job.area} • {job.seniority || "—"}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {(job.city || job.is_remote) && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.is_remote ? "Remoto" : `${job.city}/${job.state}`}</span>
                )}
                <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" />{counts[job.id] || 0} candidatos</span>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link to={`/unv-profile/recruitment/${job.id}`}>Pipeline</Link>
                </Button>
                {job.public_token && (
                  <Button asChild size="sm" variant="ghost" title="Abrir página pública de candidatura">
                    <a href={`#/vagas/${job.public_token}`} target="_blank" rel="noopener"><ExternalLink className="w-3 h-3" /></a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" title="Editar vaga" onClick={() => openEdit(job)}><Pencil className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" title="Excluir vaga" onClick={() => remove(job)}><Trash2 className="w-3 h-3 text-rose-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full"><CardContent className="p-12 text-center text-sm text-muted-foreground">Nenhuma vaga encontrada. Crie a primeira!</CardContent></Card>
        )}
      </div>
    </div>
  );
}
