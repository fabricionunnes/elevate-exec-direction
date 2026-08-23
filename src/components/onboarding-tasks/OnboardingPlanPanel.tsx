// Aba Onboarding do projeto: a apresentação do caminho que o cliente vai
// trilhar com a UNV. Gerada a partir do que foi vendido (briefing do negócio no
// CRM Comercial + serviço contratado), editável pelo time e apresentável pro
// cliente. No fim, vira tarefa dentro do próprio projeto.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Sparkles, Save, Pencil, X, Plus, Trash2, ChevronUp, ChevronDown,
  Rocket, Target, CheckCircle2, Flag, Presentation, ListChecks, Download, Handshake,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { generateOnboardingDeck } from "./onboardingDeckPdf";
import logoUnv from "@/assets/logo-unv-nexus.png";
import { ptBR } from "date-fns/locale";

interface Phase {
  title: string;
  period: string;
  objective: string;
  deliverables: string[];
  client_actions: string[];
  outcome: string;
}
interface Metric { label: string; target: string }
interface Plan {
  id?: string;
  title: string;
  subtitle: string | null;
  intro: string | null;
  phases: Phase[];
  expectations: { unv: string[]; cliente: string[] };
  success_metrics: Metric[];
  start_date: string | null;
  status: string;
  tasks_created_at: string | null;
  source: any;
}

const EMPTY_PHASE: Phase = {
  title: "Nova fase", period: "", objective: "",
  deliverables: [""], client_actions: [""], outcome: "",
};

/** lista de textos editável (entregas, ações do cliente...) */
function EditableList({ items, onChange, placeholder }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <Textarea
            value={it} rows={1} placeholder={placeholder}
            className="min-h-[36px] text-sm resize-y"
            onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => onChange(items.filter((_, x) => x !== i))}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground"
        onClick={() => onChange([...items, ""])}>
        <Plus className="h-3 w-3" /> adicionar
      </Button>
    </div>
  );
}

export function OnboardingPlanPanel({ projectId, userRole }: { projectId: string; userRole?: string }) {
  const canEdit = userRole !== "client";
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [draft, setDraft] = useState<Plan | null>(null);
  const [present, setPresent] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [taskSel, setTaskSel] = useState<Record<string, boolean>>({});
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [slide, setSlide] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("project_onboarding_plans")
      .select("*").eq("project_id", projectId).maybeSingle();
    setPlan(data ? {
      ...data,
      phases: Array.isArray(data.phases) ? data.phases : [],
      expectations: data.expectations || { unv: [], cliente: [] },
      success_metrics: Array.isArray(data.success_metrics) ? data.success_metrics : [],
    } : null);
    setLoading(false);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // nome da empresa: aparece no rodapé dos slides e no nome do arquivo
  useEffect(() => {
    (async () => {
      const { data: proj } = await (supabase as any).from("onboarding_projects")
        .select("onboarding_company_id").eq("id", projectId).maybeSingle();
      if (!proj?.onboarding_company_id) return;
      const { data: c } = await (supabase as any).from("onboarding_companies")
        .select("name").eq("id", proj.onboarding_company_id).maybeSingle();
      if (c?.name) setCompanyName(c.name);
    })();
  }, [projectId]);

  const generate = async (force = false) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-plan-generate", {
        body: { project_id: projectId, force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      toast.success(d.ia
        ? `Plano gerado com base ${d.briefing_encontrado ? "no briefing da venda" : "no briefing da empresa"}`
        : d.aviso || "Plano criado a partir do modelo padrão UNV");
      await load();
      setEditing(true);
    } catch (e: any) {
      toast.error(e?.message || "Não consegui gerar o plano");
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(plan))); setEditing(true); };
  const cancelEdit = () => { setDraft(null); setEditing(false); };

  const save = async () => {
    if (!draft) { setEditing(false); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("project_onboarding_plans").upsert({
        project_id: projectId,
        title: draft.title, subtitle: draft.subtitle, intro: draft.intro,
        phases: draft.phases, expectations: draft.expectations,
        success_metrics: draft.success_metrics, start_date: draft.start_date,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id" });
      if (error) throw error;
      toast.success("Plano salvo");
      setEditing(false); setDraft(null); load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const view = editing && draft ? draft : plan;
  const setD = (patch: Partial<Plan>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setPhase = (i: number, patch: Partial<Phase>) =>
    setDraft((d) => d ? { ...d, phases: d.phases.map((p, x) => x === i ? { ...p, ...patch } : p) } : d);
  const movePhase = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.phases.length) return d;
      const ph = [...d.phases]; [ph[i], ph[j]] = [ph[j], ph[i]];
      return { ...d, phases: ph };
    });

  // ── tarefas: 1 tarefa por entrega, prazo escalonado a partir do início
  const taskCandidates = useMemo(() => {
    if (!plan) return [] as { key: string; phase: string; title: string; description: string; due: Date }[];
    // contrato antigo (cliente já rodando): prazo conta de hoje, senão nasceria vencido
    const hoje = new Date();
    const inicio = plan.start_date ? new Date(`${plan.start_date}T12:00:00`) : hoje;
    const start = inicio.getTime() < hoje.getTime() ? hoje : inicio;
    const out: { key: string; phase: string; title: string; description: string; due: Date }[] = [];
    plan.phases.forEach((ph, pi) => {
      const base = addDays(start, pi * 14); // cada fase ~2 semanas depois da anterior
      (ph.deliverables || []).filter(Boolean).forEach((d, di) => {
        out.push({
          key: `${pi}-${di}`,
          phase: ph.title,
          title: d,
          description: [ph.objective, ph.outcome ? `Resultado esperado: ${ph.outcome}` : ""].filter(Boolean).join("\n\n"),
          due: addDays(base, Math.min(di * 3, 12)),
        });
      });
    });
    return out;
  }, [plan]);

  const openTasks = () => {
    const sel: Record<string, boolean> = {};
    taskCandidates.forEach((t) => { sel[t.key] = true; });
    setTaskSel(sel); setTasksOpen(true);
  };

  const createTasks = async () => {
    const chosen = taskCandidates.filter((t) => taskSel[t.key]);
    if (!chosen.length) { toast.error("Selecione ao menos uma tarefa"); return; }
    setCreatingTasks(true);
    try {
      const { data: maxRow } = await (supabase as any).from("onboarding_tasks")
        .select("sort_order").eq("project_id", projectId)
        .order("sort_order", { ascending: false }).limit(1).maybeSingle();
      let order = Number(maxRow?.sort_order || 0);
      const rows = chosen.map((t) => ({
        project_id: projectId,
        title: `${t.phase} · ${t.title}`.slice(0, 250),
        description: t.description || null,
        due_date: format(t.due, "yyyy-MM-dd"),
        status: "pending",
        sort_order: ++order,
        tags: ["Onboarding"],
      }));
      const { error } = await (supabase as any).from("onboarding_tasks").insert(rows);
      if (error) throw error;
      await (supabase as any).from("project_onboarding_plans")
        .update({ tasks_created_at: new Date().toISOString() }).eq("project_id", projectId);
      toast.success(`${rows.length} tarefa${rows.length > 1 ? "s" : ""} criada${rows.length > 1 ? "s" : ""} na Jornada do projeto`);
      setTasksOpen(false); load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar tarefas");
    } finally { setCreatingTasks(false); }
  };

  const [pdfLoading, setPdfLoading] = useState(false);
  const exportPdf = async () => {
    if (!view) return;
    setPdfLoading(true);
    try {
      await generateOnboardingDeck({
        title: view.title,
        subtitle: view.subtitle,
        intro: view.intro,
        phases: view.phases,
        expectations: view.expectations,
        success_metrics: view.success_metrics,
        clientName: companyName || view.title,
      });
      toast.success("Apresentação baixada");
    } catch (e: any) {
      console.error("[onboarding pdf]", e);
      toast.error(`Não consegui gerar o PDF: ${e?.message || "erro desconhecido"}`);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!view) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Rocket className="h-12 w-12 mx-auto mb-4 text-primary/30" />
          <p className="text-lg font-semibold mb-1">Nenhum plano de onboarding ainda</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
            A UNV monta o caminho do cliente a partir do que foi vendido: o briefing do negócio
            no CRM Comercial, o serviço contratado e o briefing da empresa. Depois é só editar
            e apresentar.
          </p>
          {canEdit && (
            <Button onClick={() => generate(false)} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar apresentação de onboarding
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const Presentation_ = (
    <div ref={printRef} className="bg-background">
      <div className="text-center py-8 px-6 border-b">
        {view.subtitle && <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary mb-2">{view.subtitle}</p>}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{view.title}</h1>
        {view.intro && <p className="mt-4 text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">{view.intro}</p>}
      </div>

      <div className="p-6 space-y-4">
        {view.phases.map((ph, i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 bg-primary/5 border-b">
              <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black shrink-0">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-lg leading-tight">{ph.title}</p>
                {ph.period && <p className="text-xs text-muted-foreground">{ph.period}</p>}
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              {ph.objective && <p className="text-sm">{ph.objective}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                {!!(ph.deliverables || []).filter(Boolean).length && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> A UNV entrega
                    </p>
                    <ul className="space-y-1">
                      {ph.deliverables.filter(Boolean).map((d, x) => (
                        <li key={x} className="text-sm flex gap-2"><span className="text-emerald-600">•</span><span>{d}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!(ph.client_actions || []).filter(Boolean).length && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5 text-sky-600" /> O que precisamos de você
                    </p>
                    <ul className="space-y-1">
                      {ph.client_actions.filter(Boolean).map((d, x) => (
                        <li key={x} className="text-sm flex gap-2"><span className="text-sky-600">•</span><span>{d}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {ph.outcome && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm flex gap-2">
                  <Flag className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><span className="font-semibold">No fim desta fase: </span>{ph.outcome}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {(!!view.success_metrics.length || !!view.expectations?.unv?.length || !!view.expectations?.cliente?.length) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {!!view.success_metrics.length && (
              <div className="rounded-xl border bg-card p-5">
                <p className="font-bold mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Como medimos sucesso</p>
                <ul className="space-y-2">
                  {view.success_metrics.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm border-b last:border-0 pb-1.5 last:pb-0">
                      <span>{m.label}</span>
                      <span className="font-semibold text-primary whitespace-nowrap">{m.target || "a definir no kick-off"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(!!view.expectations?.unv?.length || !!view.expectations?.cliente?.length) && (
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <p className="font-bold flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" /> Combinado</p>
                {!!view.expectations?.unv?.filter(Boolean).length && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Da UNV</p>
                    <ul className="space-y-1">{view.expectations.unv.filter(Boolean).map((e, i) => <li key={i} className="text-sm flex gap-2"><span>•</span><span>{e}</span></li>)}</ul>
                  </div>
                )}
                {!!view.expectations?.cliente?.filter(Boolean).length && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">De você</p>
                    <ul className="space-y-1">{view.expectations.cliente.filter(Boolean).map((e, i) => <li key={i} className="text-sm flex gap-2"><span>•</span><span>{e}</span></li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* barra de ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Onboarding do cliente</h2>
          {plan?.tasks_created_at && (
            <Badge variant="outline" className="text-[10px]">
              tarefas criadas em {format(new Date(plan.tasks_created_at), "dd/MM", { locale: ptBR })}
            </Badge>
          )}
          {plan?.source?.ia === false && <Badge variant="outline" className="text-[10px]">modelo padrão</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSlide(0); setPresent(true); }}>
            <Presentation className="h-3.5 w-3.5" /> Apresentar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPdf} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
          </Button>
          {canEdit && !editing && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openTasks} disabled={!taskCandidates.length}>
                <ListChecks className="h-3.5 w-3.5" /> Criar tarefas
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generate(true)} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Regerar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={startEdit}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
            </>
          )}
          {canEdit && editing && (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancelar</Button>
              <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {!editing ? (
        <Card className="overflow-hidden"><CardContent className="p-0">{Presentation_}</CardContent></Card>
      ) : (
        /* ── modo edição ── */
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Capa</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Título</label>
                  <Input value={draft?.title || ""} onChange={(e) => setD({ title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subtítulo (serviço contratado)</label>
                  <Input value={draft?.subtitle || ""} onChange={(e) => setD({ subtitle: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Abertura — o que foi contratado e onde queremos chegar</label>
                <Textarea rows={3} value={draft?.intro || ""} onChange={(e) => setD({ intro: e.target.value })} />
              </div>
              <div className="w-48">
                <label className="text-xs text-muted-foreground">Início (base dos prazos)</label>
                <Input type="date" value={draft?.start_date || ""} onChange={(e) => setD({ start_date: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          {draft?.phases.map((ph, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
                  <Input className="font-semibold" value={ph.title} onChange={(e) => setPhase(i, { title: e.target.value })} />
                  <Input className="w-40 shrink-0" placeholder="prazo (ex: Semanas 1 e 2)" value={ph.period} onChange={(e) => setPhase(i, { period: e.target.value })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhase(i, -1)}><ChevronUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhase(i, 1)}><ChevronDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => setD({ phases: draft.phases.filter((_, x) => x !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Objetivo da fase</label>
                  <Textarea rows={2} value={ph.objective} onChange={(e) => setPhase(i, { objective: e.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-emerald-700">A UNV entrega</label>
                    <EditableList items={ph.deliverables || []} placeholder="entrega desta fase"
                      onChange={(v) => setPhase(i, { deliverables: v })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-sky-700">O que precisamos do cliente</label>
                    <EditableList items={ph.client_actions || []} placeholder="o que o cliente precisa fazer"
                      onChange={(v) => setPhase(i, { client_actions: v })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Resultado esperado no fim da fase</label>
                  <Textarea rows={2} value={ph.outcome} onChange={(e) => setPhase(i, { outcome: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" className="w-full gap-2"
            onClick={() => setD({ phases: [...(draft?.phases || []), { ...EMPTY_PHASE }] })}>
            <Plus className="h-4 w-4" /> Adicionar fase
          </Button>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Como medimos sucesso</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(draft?.success_metrics || []).map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="indicador" value={m.label}
                      onChange={(e) => setD({ success_metrics: draft!.success_metrics.map((x, y) => y === i ? { ...x, label: e.target.value } : x) })} />
                    <Input className="w-40" placeholder="meta" value={m.target}
                      onChange={(e) => setD({ success_metrics: draft!.success_metrics.map((x, y) => y === i ? { ...x, target: e.target.value } : x) })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                      onClick={() => setD({ success_metrics: draft!.success_metrics.filter((_, y) => y !== i) })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground"
                  onClick={() => setD({ success_metrics: [...(draft?.success_metrics || []), { label: "", target: "" }] })}>
                  <Plus className="h-3 w-3" /> adicionar indicador
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Combinado</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-semibold">Da UNV</label>
                  <EditableList items={draft?.expectations?.unv || []} placeholder="compromisso da UNV"
                    onChange={(v) => setD({ expectations: { ...(draft!.expectations || { unv: [], cliente: [] }), unv: v } })} />
                </div>
                <div>
                  <label className="text-xs font-semibold">Do cliente</label>
                  <EditableList items={draft?.expectations?.cliente || []} placeholder="compromisso do cliente"
                    onChange={(v) => setD({ expectations: { ...(draft!.expectations || { unv: [], cliente: [] }), cliente: v } })} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* modo apresentação: slides com o branding UNV (navy + vermelho + logo),
          setas/espaço navegam, Esc sai */}
      {present && (() => {
        const slides: React.ReactNode[] = [
          // capa
          <div key="capa" className="h-full w-full flex flex-col justify-center px-16" style={{ background: "#0D2B5E" }}>
            <img src={logoUnv} alt="UNV" className="h-16 w-auto object-contain self-start mb-12 brightness-0 invert" />
            {view.subtitle && <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-300 mb-4">{view.subtitle}</p>}
            <h1 className="text-5xl font-black text-white leading-tight max-w-4xl">{view.title}</h1>
            <p className="mt-6 text-lg text-slate-300">Plano de trabalho e caminho para o resultado</p>
          </div>,
          // abertura
          <div key="intro" className="h-full w-full px-16 py-14 flex flex-col bg-white">
            <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#CC1B1B" }}>O que vamos construir juntos</p>
            <h2 className="text-4xl font-black mt-3" style={{ color: "#0D2B5E" }}>O caminho</h2>
            <p className="mt-8 text-xl leading-relaxed text-slate-800 max-w-5xl">{view.intro}</p>
            <div className="mt-auto flex items-start gap-2">
              {view.phases.map((ph, i) => (
                <div key={i} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                      style={{ background: i === 0 ? "#CC1B1B" : "#0D2B5E" }}>{i + 1}</div>
                    {i < view.phases.length - 1 && <div className="h-[2px] flex-1 bg-slate-200" />}
                  </div>
                  <p className="text-xs font-semibold mt-2 pr-3" style={{ color: "#0D2B5E" }}>{ph.title}</p>
                </div>
              ))}
            </div>
          </div>,
          // uma fase por slide
          ...view.phases.map((ph, i) => (
            <div key={`f${i}`} className="h-full w-full px-16 py-12 flex flex-col bg-white">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0" style={{ background: "#CC1B1B" }}>{i + 1}</div>
                <div>
                  <h2 className="text-3xl font-black leading-tight" style={{ color: "#0D2B5E" }}>{ph.title}</h2>
                  {ph.period && <p className="text-sm text-slate-500">{ph.period}</p>}
                </div>
              </div>
              {ph.objective && <p className="mt-6 text-lg text-slate-800 max-w-5xl">{ph.objective}</p>}
              <div className="mt-6 grid gap-6 sm:grid-cols-2 flex-1 min-h-0">
                {!!(ph.deliverables || []).filter(Boolean).length && (
                  <div className="rounded-xl bg-slate-50 p-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "#0D2B5E" }}>A UNV entrega</p>
                    <ul className="space-y-2.5">
                      {ph.deliverables.filter(Boolean).map((d, x) => (
                        <li key={x} className="flex gap-2.5 text-base text-slate-800">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#0D2B5E" }} />{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!(ph.client_actions || []).filter(Boolean).length && (
                  <div className="rounded-xl bg-red-50/60 p-6">
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: "#CC1B1B" }}>O que precisamos de você</p>
                    <ul className="space-y-2.5">
                      {ph.client_actions.filter(Boolean).map((d, x) => (
                        <li key={x} className="flex gap-2.5 text-base text-slate-800">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#CC1B1B" }} />{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {ph.outcome && (
                <div className="mt-6 rounded-lg px-6 py-4 text-white" style={{ background: "#0D2B5E" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-200 mr-2">No fim desta fase</span>
                  <span className="text-base">{ph.outcome}</span>
                </div>
              )}
            </div>
          )),
          // métricas + combinado
          ...((view.success_metrics.length || view.expectations?.unv?.length || view.expectations?.cliente?.length) ? [
            <div key="metricas" className="h-full w-full px-16 py-12 bg-white flex flex-col">
              <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#CC1B1B" }}>Como vamos medir</p>
              <h2 className="text-4xl font-black mt-3 mb-8" style={{ color: "#0D2B5E" }}>Sucesso e combinado</h2>
              <div className="grid gap-10 sm:grid-cols-2 flex-1 min-h-0">
                {!!view.success_metrics.length && (
                  <div>
                    {view.success_metrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 border-b py-3">
                        <span className="text-lg text-slate-800">{m.label}</span>
                        <span className="text-lg font-bold" style={{ color: "#CC1B1B" }}>{m.target || "a definir no kick-off"}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-6">
                  {!!view.expectations?.unv?.filter(Boolean).length && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#0D2B5E" }}>Da UNV</p>
                      <ul className="space-y-2">{view.expectations.unv.filter(Boolean).map((e, i) => (
                        <li key={i} className="flex gap-2.5 text-base text-slate-800"><span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#0D2B5E" }} />{e}</li>))}
                      </ul>
                    </div>
                  )}
                  {!!view.expectations?.cliente?.filter(Boolean).length && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#CC1B1B" }}>De você</p>
                      <ul className="space-y-2">{view.expectations.cliente.filter(Boolean).map((e, i) => (
                        <li key={i} className="flex gap-2.5 text-base text-slate-800"><span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#CC1B1B" }} />{e}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>,
          ] : []),
          // fechamento
          <div key="fim" className="h-full w-full flex flex-col items-center justify-center" style={{ background: "#0D2B5E" }}>
            <img src={logoUnv} alt="UNV" className="h-20 w-auto object-contain mb-10 brightness-0 invert" />
            <p className="text-4xl font-black text-white">Bora pra cima.</p>
            <p className="mt-3 text-slate-300">Universidade Nacional de Vendas</p>
          </div>,
        ];
        const go = (d: number) => setSlide((x) => Math.min(Math.max(x + d, 0), slides.length - 1));
        return (
          <div className="fixed inset-0 z-[95] bg-black flex flex-col"
            tabIndex={0} autoFocus
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
              if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
              if (e.key === "Escape") setPresent(false);
            }}>
            <div className="flex-1 min-h-0 flex items-center justify-center p-4">
              <div className="w-full max-w-[1280px] aspect-video shadow-2xl overflow-hidden relative bg-white">
                {slides[slide]}
                {/* rodapé da marca nos slides claros */}
                {slide !== 0 && slide !== slides.length - 1 && (
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-16 py-3 border-t bg-white">
                    <span className="text-xs text-slate-400">{companyName}</span>
                    <span className="text-xs text-slate-400">{slide}/{slides.length - 1}</span>
                    <img src={logoUnv} alt="UNV" className="h-5 w-auto object-contain opacity-70" />
                  </div>
                )}
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: slide === 0 || slide === slides.length - 1 ? "transparent" : "#0D2B5E" }} />
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pb-5 text-white/80">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => go(-1)} disabled={slide === 0}><ChevronLeft className="h-5 w-5" /></Button>
              <span className="text-sm tabular-nums">{slide + 1} / {slides.length}</span>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => go(1)} disabled={slide === slides.length - 1}><ChevronRight className="h-5 w-5" /></Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 ml-4" onClick={() => setPresent(false)}>Sair (Esc)</Button>
            </div>
          </div>
        );
      })()}

      {/* criar tarefas */}
      <Dialog open={tasksOpen} onOpenChange={setTasksOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar tarefas na Jornada do projeto</DialogTitle>
            <DialogDescription>
              Cada entrega do plano vira uma tarefa, com prazo escalonado a partir de{" "}
              {taskCandidates[0] ? format(taskCandidates[0].due, "dd/MM/yyyy", { locale: ptBR }) : "hoje"}.
              Desmarque o que não quiser criar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {taskCandidates.map((t) => (
              <label key={t.key} className="flex items-start gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <Checkbox checked={!!taskSel[t.key]} onCheckedChange={(c) => setTaskSel((s) => ({ ...s, [t.key]: !!c }))} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.phase} · vence {format(t.due, "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTasksOpen(false)}>Cancelar</Button>
            <Button onClick={createTasks} disabled={creatingTasks} className="gap-1.5">
              {creatingTasks && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Criar {Object.values(taskSel).filter(Boolean).length} tarefas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
