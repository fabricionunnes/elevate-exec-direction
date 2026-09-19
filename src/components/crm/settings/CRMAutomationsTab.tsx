// Configurações do CRM → Automações (pedido do Fabrício, 18/09/2026).
// Regras "quando chegar lead pela instância X → funil Y, rodízio entre A/B/C, etiqueta Z, avisar no WhatsApp".
// O motor roda no banco (crm_run_wa_automations), na primeira mensagem recebida da conversa.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ArrowDown, ArrowUp, Copy, History, Loader2, Pencil, Plus, Rewind, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Conditions { instance_ids: string[]; official_instance_ids: string[]; lead_state: "sem_lead" | "com_lead" | "qualquer"; keywords: string[]; only_new_conversations: boolean }
interface Actions {
  create_lead: { enabled: boolean; pipeline_id: string; stage_id: string; origin_id: string };
  move_stage: { enabled: boolean; stage_id: string };
  assign: { mode: "none" | "fixed" | "round_robin"; staff_ids: string[]; only_if_unowned: boolean; assign_conversation: boolean };
  tag_ids: string[]; sector_id: string; notify: { enabled: boolean };
}
interface Automation { id: string; name: string; description: string | null; is_active: boolean; conditions: Conditions; actions: Actions; position: number; stop_after: boolean; run_count: number; last_run_at: string | null }

const emptyConditions = (): Conditions => ({ instance_ids: [], official_instance_ids: [], lead_state: "sem_lead", keywords: [], only_new_conversations: true });
const emptyActions = (): Actions => ({
  create_lead: { enabled: true, pipeline_id: "", stage_id: "", origin_id: "" }, move_stage: { enabled: false, stage_id: "" },
  assign: { mode: "none", staff_ids: [], only_if_unowned: true, assign_conversation: true }, tag_ids: [], sector_id: "", notify: { enabled: false },
});
// regra salva por versão antiga pode vir sem algum campo: completa com o padrão
const norm = (a: any): Automation => ({
  ...a,
  conditions: { ...emptyConditions(), ...(a.conditions || {}) },
  actions: { ...emptyActions(), ...(a.actions || {}), create_lead: { ...emptyActions().create_lead, ...(a.actions?.create_lead || {}) }, move_stage: { ...emptyActions().move_stage, ...(a.actions?.move_stage || {}) }, assign: { ...emptyActions().assign, ...(a.actions?.assign || {}) }, notify: { ...emptyActions().notify, ...(a.actions?.notify || {}) } },
});

export function CRMAutomationsTab() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Automation[]>([]);
  const [instances, setInstances] = useState<{ id: string; label: string }[]>([]);
  const [officials, setOfficials] = useState<{ id: string; label: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; pipeline_id: string; sort_order: number | null }[]>([]);
  const [origins, setOrigins] = useState<{ id: string; name: string; pipeline_id: string | null }[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string; role: string | null }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOf, setHistoryOf] = useState<Automation | null>(null);
  // Aplicar nas conversas que chegaram ANTES da regra existir (pedido do Fabrício, 19/09/2026)
  const [backOf, setBackOf] = useState<Automation | null>(null);
  const [backDays, setBackDays] = useState("7");
  const [backItems, setBackItems] = useState<any[] | null>(null);
  const [backSel, setBackSel] = useState<string[]>([]);
  const [backAgent, setBackAgent] = useState(true);
  const [backBusy, setBackBusy] = useState(false);
  const abrirBackfill = (a: Automation) => { setBackOf(a); setBackItems(null); setBackSel([]); setBackDays("7"); setBackAgent(true); };
  const buscarBackfill = async () => {
    if (!backOf) return;
    setBackBusy(true);
    const { data, error } = await supabase.rpc("crm_automation_backfill" as any, { p_automation: backOf.id, p_days: Number(backDays) || 7, p_dry: true, p_trigger_agent: false, p_conversations: null });
    setBackBusy(false);
    if (error) { toast.error(error.message || "Não consegui buscar as conversas."); return; }
    const itens = ((data as any)?.itens || []) as any[];
    setBackItems(itens); setBackSel(itens.map((i) => i.conversation_id));
  };
  const aplicarBackfill = async () => {
    if (!backOf || backSel.length === 0) return;
    if (!window.confirm(`Aplicar a regra "${backOf.name}" em ${backSel.length} conversa${backSel.length > 1 ? "s" : ""}?${backAgent ? " O agente de IA vai responder as que estão esperando resposta." : ""}`)) return;
    setBackBusy(true);
    const { data, error } = await supabase.rpc("crm_automation_backfill" as any, { p_automation: backOf.id, p_days: Number(backDays) || 7, p_dry: false, p_trigger_agent: backAgent, p_conversations: backSel });
    setBackBusy(false);
    if (error) { toast.error(error.message || "Não consegui aplicar."); return; }
    toast.success(`Regra aplicada em ${(data as any)?.total ?? 0} conversa(s).`);
    setBackOf(null); load();
  };
  const [runs, setRuns] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState("");

  const load = useCallback(async () => {
    const sb = supabase as any;
    const [r, i, o, p, s, og, st, t, sc] = await Promise.all([
      sb.from("crm_automations").select("*").order("position").order("created_at"),
      sb.from("whatsapp_instances").select("id, instance_name, display_name").order("instance_name"),
      sb.from("whatsapp_official_instances").select("id, display_name, phone_number").order("display_name"),
      sb.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
      sb.from("crm_stages").select("id, name, pipeline_id, sort_order").order("sort_order"),
      sb.from("crm_origins").select("id, name, pipeline_id").order("name"),
      sb.from("onboarding_staff").select("id, name, role").eq("is_active", true).in("role", ["master", "admin", "head_comercial", "closer", "sdr"]).order("name"),
      sb.from("crm_tags").select("id, name, color").order("name"),
      sb.from("company_sectors").select("id, name").order("name"),
    ]);
    setRules((r.data || []).map(norm));
    setInstances((i.data || []).map((x: any) => ({ id: x.id, label: x.display_name || x.instance_name })));
    setOfficials((o.data || []).map((x: any) => ({ id: x.id, label: `${x.display_name || x.phone_number} (API oficial)` })));
    setPipelines(p.data || []); setStages(s.data || []); setOrigins(og.data || []); setStaff(st.data || []); setTags(t.data || []); setSectors(sc.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const nameOf = (list: { id: string; label?: string; name?: string }[], id: string) => { const x = list.find((y) => y.id === id); return x ? (x.label || x.name || "") : "removido"; };

  const resumo = (a: Automation) => {
    const c = a.conditions, x = a.actions, partes: string[] = [];
    const inst = [...c.instance_ids.map((id) => nameOf(instances, id)), ...c.official_instance_ids.map((id) => nameOf(officials, id))];
    partes.push(`Quando chegar mensagem ${inst.length ? `em ${inst.join(", ")}` : "em qualquer número"}`);
    partes.push(c.lead_state === "sem_lead" ? "de contato sem lead" : c.lead_state === "com_lead" ? "de contato que já tem lead" : "de qualquer contato");
    if (c.keywords.length) partes.push(`contendo "${c.keywords.join('", "')}"`);
    const ac: string[] = [];
    if (x.create_lead.enabled && x.create_lead.pipeline_id) ac.push(`cria lead em ${nameOf(pipelines, x.create_lead.pipeline_id)}${x.create_lead.stage_id ? ` › ${nameOf(stages, x.create_lead.stage_id)}` : ""}`);
    if (x.move_stage.enabled && x.move_stage.stage_id) ac.push(`move lead existente pra ${nameOf(stages, x.move_stage.stage_id)}`);
    if (x.assign.mode === "fixed" && x.assign.staff_ids[0]) ac.push(`entrega pra ${nameOf(staff, x.assign.staff_ids[0])}`);
    if (x.assign.mode === "round_robin" && x.assign.staff_ids.length) ac.push(`rodízio entre ${x.assign.staff_ids.map((id) => nameOf(staff, id).split(" ")[0]).join(", ")}`);
    if (x.tag_ids.length) ac.push(`${x.tag_ids.length} etiqueta${x.tag_ids.length > 1 ? "s" : ""}`);
    if (x.notify.enabled) ac.push("avisa no WhatsApp");
    return `${partes.join(" ")} → ${ac.join(", ") || "nenhuma ação configurada"}`;
  };

  const toggle = async (a: Automation, v: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === a.id ? { ...r, is_active: v } : r)));
    const { error } = await (supabase as any).from("crm_automations").update({ is_active: v }).eq("id", a.id);
    if (error) { toast.error("Não consegui salvar: " + error.message); load(); return; }
    toast.success(v ? "Automação ligada. Vale pras conversas que chegarem a partir de agora." : "Automação desligada.");
  };

  const mover = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir; if (j < 0 || j >= rules.length) return;
    const nova = [...rules]; [nova[idx], nova[j]] = [nova[j], nova[idx]];
    setRules(nova);
    await Promise.all(nova.map((r, k) => (supabase as any).from("crm_automations").update({ position: k }).eq("id", r.id)));
  };

  const excluir = async (a: Automation) => {
    if (!confirm(`Excluir a automação "${a.name}"? O histórico dela também é apagado. Os leads já criados não são afetados.`)) return;
    const { error } = await (supabase as any).from("crm_automations").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Automação excluída"); load();
  };

  const duplicar = async (a: Automation) => {
    const { error } = await (supabase as any).from("crm_automations").insert({ name: `${a.name} (cópia)`, description: a.description, is_active: false, conditions: a.conditions, actions: a.actions, position: rules.length, stop_after: a.stop_after });
    if (error) { toast.error(error.message); return; }
    toast.success("Cópia criada desligada"); load();
  };

  const abrirHistorico = async (a: Automation) => {
    setHistoryOf(a); setRuns([]);
    const { data } = await (supabase as any).from("crm_automation_runs")
      .select("id, created_at, result, lead_id, lead:crm_leads(name), staff:onboarding_staff!crm_automation_runs_assigned_staff_id_fkey(name)")
      .eq("automation_id", a.id).order("created_at", { ascending: false }).limit(50);
    if (data) { setRuns(data); return; }
    // sem FK nomeada: busca simples
    const { data: plain } = await (supabase as any).from("crm_automation_runs").select("id, created_at, result, lead_id").eq("automation_id", a.id).order("created_at", { ascending: false }).limit(50);
    setRuns(plain || []);
  };

  const salvar = async () => {
    if (!editing) return;
    const e = editing;
    if (!e.name.trim()) { toast.error("Dê um nome pra automação"); return; }
    if (e.actions.create_lead.enabled && !e.actions.create_lead.pipeline_id) { toast.error("Escolha o funil onde o lead vai ser criado"); return; }
    if (e.actions.move_stage.enabled && !e.actions.move_stage.stage_id) { toast.error("Escolha a etapa pra onde mover o lead existente"); return; }
    if (e.actions.assign.mode !== "none" && e.actions.assign.staff_ids.length === 0) { toast.error("Escolha quem recebe os leads"); return; }
    const temAcao = (e.actions.create_lead.enabled) || e.actions.move_stage.enabled || e.actions.assign.mode !== "none" || e.actions.tag_ids.length > 0 || !!e.actions.sector_id;
    if (!temAcao) { toast.error("Configure pelo menos uma ação"); return; }
    setSaving(true);
    const payload = { name: e.name.trim(), description: e.description?.trim() || null, conditions: e.conditions, actions: e.actions, stop_after: e.stop_after };
    const sb = supabase as any;
    const { error } = e.id
      ? await sb.from("crm_automations").update(payload).eq("id", e.id)
      : await sb.from("crm_automations").insert({ ...payload, is_active: false, position: rules.length });
    setSaving(false);
    if (error) { toast.error("Não consegui salvar: " + error.message); return; }
    toast.success(e.id ? "Automação salva" : "Automação criada desligada. Revise e ligue quando quiser.");
    setEditing(null); load();
  };

  const upd = (fn: (d: Automation) => void) => setEditing((prev) => { if (!prev) return prev; const d: Automation = JSON.parse(JSON.stringify(prev)); fn(d); return d; });
  const toggleIn = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const stagesOf = (pid: string) => stages.filter((s) => s.pipeline_id === pid);
  const staffFiltrado = useMemo(() => { const q = staffSearch.trim().toLowerCase(); return q ? staff.filter((s) => s.name.toLowerCase().includes(q)) : staff; }, [staff, staffSearch]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando automações...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Automações</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Regras que rodam sozinhas quando chega a primeira mensagem de uma conversa no WhatsApp. As regras são avaliadas de cima pra baixo; use as setas pra mudar a ordem.
          </p>
        </div>
        <Button onClick={() => { setStaffSearch(""); setEditing(norm({ id: "", name: "", description: "", is_active: false, conditions: emptyConditions(), actions: emptyActions(), position: rules.length, stop_after: true, run_count: 0, last_run_at: null })); }}>
          <Plus className="h-4 w-4 mr-2" />Nova automação
        </Button>
      </div>

      {rules.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma automação ainda. Exemplo: "todo contato novo que chamar no número da Natalia vira lead no Funil SE, com rodízio entre Ricardo e Natalia".
        </CardContent></Card>
      )}

      {rules.map((a, idx) => (
        <Card key={a.id} className={a.is_active ? "border-primary/40" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  {a.name}
                  <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">{a.is_active ? "Ligada" : "Desligada"}</Badge>
                  {!a.stop_after && <Badge variant="outline" className="text-[10px]">continua nas próximas regras</Badge>}
                </CardTitle>
                <CardDescription className="mt-1">{resumo(a)}</CardDescription>
              </div>
              <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a, v)} />
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {a.run_count > 0 ? `Rodou ${a.run_count} vez${a.run_count > 1 ? "es" : ""}${a.last_run_at ? `, última em ${format(new Date(a.last_run_at), "dd/MM HH:mm")}` : ""}` : "Ainda não rodou"}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Subir" disabled={idx === 0} onClick={() => mover(idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Descer" disabled={idx === rules.length - 1} onClick={() => mover(idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Aplicar nas conversas anteriores" disabled={!a.is_active} onClick={() => abrirBackfill(a)}><Rewind className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico" onClick={() => abrirHistorico(a)}><History className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => duplicar(a)}><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setStaffSearch(""); setEditing(norm(a)); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => excluir(a)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar automação" : "Nova automação"}</DialogTitle>
            <DialogDescription>Defina quando a regra dispara e o que ela faz. Ela roda na primeira mensagem recebida de cada conversa, uma única vez por conversa.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-6">
              <div className="grid gap-3">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={editing.name} onChange={(e) => upd((d) => { d.name = e.target.value; })} placeholder="Ex: Leads do número da Natalia → Funil SE" /></div>
                <div className="space-y-1.5"><Label>Observação (opcional)</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => upd((d) => { d.description = e.target.value; })} /></div>
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold border-b pb-1">1. Quando</h3>
                <div className="space-y-1.5">
                  <Label>Números (instâncias)</Label>
                  <p className="text-xs text-muted-foreground">Nenhum marcado = vale pra todos os números.</p>
                  <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                    {instances.map((i) => (
                      <label key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox checked={editing.conditions.instance_ids.includes(i.id)} onCheckedChange={() => upd((d) => { d.conditions.instance_ids = toggleIn(d.conditions.instance_ids, i.id); })} />{i.label}
                      </label>
                    ))}
                    {officials.map((i) => (
                      <label key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox checked={editing.conditions.official_instance_ids.includes(i.id)} onCheckedChange={() => upd((d) => { d.conditions.official_instance_ids = toggleIn(d.conditions.official_instance_ids, i.id); })} />{i.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Contato</Label>
                    <Select value={editing.conditions.lead_state} onValueChange={(v) => upd((d) => { d.conditions.lead_state = v as any; })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_lead">Só quem ainda não é lead</SelectItem>
                        <SelectItem value="com_lead">Só quem já é lead</SelectItem>
                        <SelectItem value="qualquer">Qualquer contato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mensagem contém (opcional)</Label>
                    <Input value={editing.conditions.keywords.join(", ")} onChange={(e) => upd((d) => { d.conditions.keywords = e.target.value.split(",").map((k) => k.trimStart()).filter((k, i, arr) => k !== "" || i === arr.length - 1); })} placeholder="Ex: orçamento, preço" />
                    <p className="text-xs text-muted-foreground">Separe por vírgula. Vazio = qualquer mensagem.</p>
                  </div>
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox className="mt-0.5" checked={editing.conditions.only_new_conversations} onCheckedChange={(v) => upd((d) => { d.conditions.only_new_conversations = v === true; })} />
                  <span>Só conversas novas (criadas depois que a regra for ligada). <span className="text-muted-foreground">Desmarque pra valer também na próxima mensagem de conversas antigas.</span></span>
                </label>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-1">2. Faça</h3>

                <div className="rounded-lg border p-3 space-y-3">
                  <label className="flex items-center justify-between gap-2 text-sm font-medium cursor-pointer">Criar lead (quando o contato ainda não é lead)
                    <Switch checked={editing.actions.create_lead.enabled} onCheckedChange={(v) => upd((d) => { d.actions.create_lead.enabled = v; })} /></label>
                  {editing.actions.create_lead.enabled && (
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Funil</Label>
                        <SearchableSelect value={editing.actions.create_lead.pipeline_id} onValueChange={(v) => upd((d) => { d.actions.create_lead.pipeline_id = v; d.actions.create_lead.stage_id = ""; d.actions.create_lead.origin_id = ""; })}
                          options={pipelines.map((p) => ({ value: p.id, label: p.name }))} placeholder="Escolha o funil" emptyMessage="Nenhum funil." /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Etapa</Label>
                        <SearchableSelect value={editing.actions.create_lead.stage_id || "first"} onValueChange={(v) => upd((d) => { d.actions.create_lead.stage_id = v === "first" ? "" : v; })}
                          options={[{ value: "first", label: "Primeira etapa do funil" }, ...stagesOf(editing.actions.create_lead.pipeline_id).map((s) => ({ value: s.id, label: s.name }))]} placeholder="Etapa" emptyMessage="Escolha o funil antes." /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Origem (opcional)</Label>
                        <SearchableSelect value={editing.actions.create_lead.origin_id || "none"} onValueChange={(v) => upd((d) => { d.actions.create_lead.origin_id = v === "none" ? "" : v; })}
                          options={[{ value: "none", label: "Sem origem" }, ...origins.filter((o) => !o.pipeline_id || o.pipeline_id === editing.actions.create_lead.pipeline_id).map((o) => ({ value: o.id, label: o.name }))]} placeholder="Origem" emptyMessage="Nenhuma origem." /></div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <label className="flex items-center justify-between gap-2 text-sm font-medium cursor-pointer">Mover lead que já existe pra uma etapa
                    <Switch checked={editing.actions.move_stage.enabled} onCheckedChange={(v) => upd((d) => { d.actions.move_stage.enabled = v; })} /></label>
                  {editing.actions.move_stage.enabled && (
                    <SearchableSelect value={editing.actions.move_stage.stage_id} onValueChange={(v) => upd((d) => { d.actions.move_stage.stage_id = v; })}
                      options={stages.map((s) => ({ value: s.id, label: `${nameOf(pipelines, s.pipeline_id)} › ${s.name}` })).filter((o) => !o.label.startsWith("removido"))} placeholder="Escolha funil › etapa" emptyMessage="Nenhuma etapa." />
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Responsável</span>
                    <Select value={editing.actions.assign.mode} onValueChange={(v) => upd((d) => { d.actions.assign.mode = v as any; if (v === "fixed") d.actions.assign.staff_ids = d.actions.assign.staff_ids.slice(0, 1); })}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não mexer</SelectItem>
                        <SelectItem value="fixed">Sempre a mesma pessoa</SelectItem>
                        <SelectItem value="round_robin">Rodízio entre pessoas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editing.actions.assign.mode !== "none" && (
                    <>
                      <Input className="h-9" placeholder="Buscar pessoa pelo nome..." value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
                      <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                        {staffFiltrado.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                            <Checkbox checked={editing.actions.assign.staff_ids.includes(s.id)}
                              onCheckedChange={() => upd((d) => { d.actions.assign.staff_ids = d.actions.assign.mode === "fixed" ? [s.id] : toggleIn(d.actions.assign.staff_ids, s.id); })} />
                            <span className="flex-1 truncate">{s.name}</span><span className="text-[11px] text-muted-foreground">{s.role}</span>
                          </label>
                        ))}
                      </div>
                      {editing.actions.assign.mode === "round_robin" && <p className="text-xs text-muted-foreground">Cada lead novo vai pra quem recebeu há mais tempo. Pessoa desativada no sistema sai do rodízio sozinha.</p>}
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={editing.actions.assign.only_if_unowned} onCheckedChange={(v) => upd((d) => { d.actions.assign.only_if_unowned = v === true; })} />Não trocar o responsável de lead que já tem dono</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={editing.actions.assign.assign_conversation} onCheckedChange={(v) => upd((d) => { d.actions.assign.assign_conversation = v === true; })} />Atribuir também a conversa no Atendimento</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={editing.actions.notify.enabled} onCheckedChange={(v) => upd((d) => { d.actions.notify.enabled = v === true; })} />Avisar o responsável no WhatsApp ("Lead novo pra você", com o link)</label>
                    </>
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-2">
                  <span className="text-sm font-medium">Etiquetas no lead</span>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => { const on = editing.actions.tag_ids.includes(t.id); return (
                      <button type="button" key={t.id} onClick={() => upd((d) => { d.actions.tag_ids = toggleIn(d.actions.tag_ids, t.id); })}
                        className={`text-xs rounded-full border px-2 py-0.5 transition-colors ${on ? "text-white border-transparent" : "text-muted-foreground hover:bg-muted"}`} style={on ? { backgroundColor: t.color || "#64748b" } : undefined}>{t.name}</button>
                    ); })}
                    {tags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada (aba Tags).</span>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Setor da conversa (opcional)</Label>
                    <SearchableSelect value={editing.actions.sector_id || "none"} onValueChange={(v) => upd((d) => { d.actions.sector_id = v === "none" ? "" : v; })}
                      options={[{ value: "none", label: "Não mexer" }, ...sectors.map((s) => ({ value: s.id, label: s.name }))]} placeholder="Setor" emptyMessage="Nenhum setor." /></div>
                  <label className="flex items-start gap-2 text-sm cursor-pointer sm:pt-6"><Checkbox className="mt-0.5" checked={editing.stop_after} onCheckedChange={(v) => upd((d) => { d.stop_after = v === true; })} />Se esta regra rodar, não avaliar as regras abaixo dela</label>
                </div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aplicar nas conversas anteriores */}
      <Dialog open={!!backOf} onOpenChange={(o) => !o && setBackOf(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicar nas conversas anteriores: {backOf?.name}</DialogTitle>
            <DialogDescription>A regra só pega conversa nova. Aqui você aplica nas que chegaram antes de ela existir. Primeiro veja a lista, depois confirme.</DialogDescription>
          </DialogHeader>
          <div className="flex items-end gap-2">
            <div className="w-40">
              <Label className="text-xs">Conversas dos últimos</Label>
              <Select value={backDays} onValueChange={(v) => { setBackDays(v); setBackItems(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1", "3", "7", "15", "30", "60"].map((d) => <SelectItem key={d} value={d}>{d} dia{d === "1" ? "" : "s"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={buscarBackfill} disabled={backBusy}>{backBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Ver conversas</Button>
          </div>
          {backItems && (backItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conversa desse período se encaixa na regra.</p>
          ) : (
            <>
              <div className="divide-y border rounded-md">
                {backItems.map((i) => (
                  <label key={i.conversation_id} className="flex items-start gap-3 p-2 text-sm cursor-pointer">
                    <Checkbox className="mt-1" checked={backSel.includes(i.conversation_id)}
                      onCheckedChange={(c) => setBackSel((prev) => c ? [...prev, i.conversation_id] : prev.filter((x) => x !== i.conversation_id))} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{i.nome && /[a-zA-ZÀ-ú]/.test(i.nome) ? i.nome : i.telefone} <span className="text-xs text-muted-foreground font-normal">{i.telefone}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{i.ultima || "sem texto"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[i.resultado?.lead_criado ? "cria lead" : null, i.resultado?.movido_para ? "move lead" : null, i.resultado?.responsavel ? `responsável: ${i.resultado.responsavel}` : null, i.aguardando_resposta ? "esperando resposta" : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(i.chegou_em), "dd/MM HH:mm")}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={backAgent} onCheckedChange={setBackAgent} />
                Acionar o agente de IA nas conversas que estão esperando resposta
              </label>
            </>
          ))}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackOf(null)} disabled={backBusy}>Fechar</Button>
            <Button onClick={aplicarBackfill} disabled={backBusy || !backItems || backSel.length === 0}>{backBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Aplicar em {backSel.length}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico: {historyOf?.name}</DialogTitle><DialogDescription>Últimas 50 vezes que a regra rodou.</DialogDescription></DialogHeader>
          {runs.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Ainda não rodou.</p> : (
            <div className="divide-y">
              {runs.map((r) => (
                <div key={r.id} className="py-2 text-sm flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.lead?.name || "Conversa sem lead"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.result?.lead_criado ? "lead criado" : null, r.result?.movido_para ? "lead movido" : null, r.result?.responsavel ? `responsável: ${r.result.responsavel}` : null, r.result?.etiquetas ? `${r.result.etiquetas} etiqueta(s)` : null].filter(Boolean).join(" · ") || "sem alteração"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM HH:mm")}</p>
                    {r.lead_id && <a className="text-xs text-primary hover:underline" href={`#/crm/leads/${r.lead_id}`}>abrir lead</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
