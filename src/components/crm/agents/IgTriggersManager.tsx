import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Zap, Instagram, MessageCircle, AtSign, Film, KeyRound, UserPlus } from "lucide-react";

// Gatilhos do Instagram (estilo ManyChat): comentou X → responde + DM + lead + agente.
// O motor roda na edge function instagram-webhook; aqui é só o CRUD de crm_ig_triggers.

interface IgTrigger {
  id: string;
  instance_id: string;
  name: string;
  trigger_type: string;
  media_ids: string[] | null;
  keywords: string[];
  match_type: string;
  public_replies: string[];
  dm_message: string | null;
  create_lead: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  agent_id: string | null;
  cooldown_hours: number;
  priority: number;
  is_active: boolean;
}

interface Opt { id: string; label: string; }
interface StageOpt extends Opt { pipeline_id: string; }

const TYPE_META: Record<string, { label: string; icon: typeof Zap; hint: string; beta?: boolean }> = {
  comment: { label: "Comentário em post", icon: MessageCircle, hint: "Dispara quando alguém comenta a palavra-chave num post (ou em qualquer post)." },
  live_comment: { label: "Comentário em live", icon: Film, hint: "Dispara em comentários durante uma transmissão ao vivo." },
  mention: { label: "Menção", icon: AtSign, hint: "Dispara quando marcam a conta num comentário." },
  story_reply: { label: "Resposta a story", icon: Instagram, hint: "Dispara quando alguém responde um story da conta." },
  dm_keyword: { label: "Palavra-chave na DM", icon: KeyRound, hint: "Dispara quando chega uma DM contendo a palavra-chave." },
  follow: { label: "Novo seguidor", icon: UserPlus, hint: "A Meta ainda não liberou esse evento pro público (beta restrito a parceiros). O gatilho fica pronto e passa a disparar automaticamente quando a Meta abrir o webhook de novo seguidor.", beta: true },
};

const MATCH_LABELS: Record<string, string> = {
  contains: "Contém a palavra",
  exact: "Texto exato",
  starts_with: "Começa com",
  any: "Qualquer texto",
};

const emptyForm = {
  name: "",
  instance_id: "",
  trigger_type: "comment",
  keywords: "",
  match_type: "contains",
  media_ids: "",
  public_replies: "",
  dm_message: "",
  create_lead: true,
  pipeline_id: "",
  stage_id: "",
  agent_id: "",
  cooldown_hours: 24,
};

interface Props {
  canSettings: boolean;
  staffId: string | null;
  tenantId: string | null;
}

export function IgTriggersManager({ canSettings, staffId, tenantId }: Props) {
  const [triggers, setTriggers] = useState<IgTrigger[]>([]);
  const [instances, setInstances] = useState<Opt[]>([]);
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [agents, setAgents] = useState<Opt[]>([]);
  const [runCounts, setRunCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [trg, inst, pipes, stgs, ags, runs] = await Promise.all([
      supabase.from("crm_ig_triggers").select("*").order("created_at", { ascending: false }),
      supabase.from("instagram_instances").select("id, instance_name, instagram_username, status").eq("status", "active"),
      supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("crm_stages").select("id, name, pipeline_id").order("sort_order"),
      supabase.from("crm_ai_agents").select("id, name").eq("is_active", true),
      supabase.from("crm_ig_trigger_runs").select("trigger_id").is("error", null).order("created_at", { ascending: false }).limit(1000),
    ]);
    if (trg.error) {
      toast.error("Erro ao carregar gatilhos");
      setLoading(false);
      return;
    }
    setTriggers((trg.data || []) as IgTrigger[]);
    setInstances((inst.data || []).map((i: any) => ({ id: i.id, label: i.instagram_username ? `@${i.instagram_username}` : i.instance_name })));
    setPipelines((pipes.data || []).map((p: any) => ({ id: p.id, label: p.name })));
    setStages((stgs.data || []).map((s: any) => ({ id: s.id, label: s.name, pipeline_id: s.pipeline_id })));
    setAgents((ags.data || []).map((a: any) => ({ id: a.id, label: a.name })));
    const counts: Record<string, number> = {};
    (runs.data || []).forEach((r: any) => { counts[r.trigger_id] = (counts[r.trigger_id] || 0) + 1; });
    setRunCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, instance_id: instances[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (t: IgTrigger) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      instance_id: t.instance_id,
      trigger_type: t.trigger_type,
      keywords: (t.keywords || []).join(", "),
      match_type: t.match_type,
      media_ids: (t.media_ids || []).join(", "),
      public_replies: (t.public_replies || []).join("\n"),
      dm_message: t.dm_message || "",
      create_lead: t.create_lead,
      pipeline_id: t.pipeline_id || "",
      stage_id: t.stage_id || "",
      agent_id: t.agent_id || "",
      cooldown_hours: t.cooldown_hours,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Dá um nome pro gatilho"); return; }
    if (!form.instance_id) { toast.error("Escolha a conta do Instagram"); return; }
    const keywords = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    if (form.match_type !== "any" && keywords.length === 0 && form.trigger_type !== "follow" && form.trigger_type !== "mention") {
      toast.error("Informe ao menos uma palavra-chave (ou mude pra “Qualquer texto”)");
      return;
    }
    if (!form.dm_message.trim() && !form.public_replies.trim()) {
      toast.error("Configure ao menos a DM ou uma resposta pública");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      instance_id: form.instance_id,
      trigger_type: form.trigger_type,
      keywords,
      match_type: keywords.length === 0 ? "any" : form.match_type,
      media_ids: form.media_ids.split(",").map((m) => m.trim()).filter(Boolean),
      public_replies: form.public_replies.split("\n").map((r) => r.trim()).filter(Boolean),
      dm_message: form.dm_message.trim() || null,
      create_lead: form.create_lead,
      pipeline_id: form.pipeline_id || null,
      stage_id: form.stage_id || null,
      agent_id: form.agent_id || null,
      cooldown_hours: Number(form.cooldown_hours) || 24,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    };
    const res = editingId
      ? await supabase.from("crm_ig_triggers").update(payload).eq("id", editingId)
      : await supabase.from("crm_ig_triggers").insert({ ...payload, created_by: staffId });
    setSaving(false);
    if (res.error) {
      toast.error("Erro ao salvar gatilho");
      console.error(res.error);
      return;
    }
    toast.success(editingId ? "Gatilho atualizado" : "Gatilho criado — ative no interruptor quando quiser rodar");
    setDialogOpen(false);
    fetchAll();
  };

  const handleToggle = async (t: IgTrigger, value: boolean) => {
    setTriggers((prev) => prev.map((x) => x.id === t.id ? { ...x, is_active: value } : x));
    const { error } = await supabase
      .from("crm_ig_triggers")
      .update({ is_active: value, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      toast.error("Erro ao alterar status");
      setTriggers((prev) => prev.map((x) => x.id === t.id ? { ...x, is_active: !value } : x));
    } else {
      toast.success(value ? "Gatilho ligado" : "Gatilho desligado");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("crm_ig_triggers").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Gatilho excluído"); fetchAll(); }
    setDeleteId(null);
  };

  const typeMeta = TYPE_META[form.trigger_type] ?? TYPE_META.comment;
  const showPublicReply = form.trigger_type === "comment" || form.trigger_type === "live_comment" || form.trigger_type === "mention";
  const showMedia = form.trigger_type === "comment" || form.trigger_type === "live_comment";
  const showKeywords = form.trigger_type !== "follow";
  const stagesOfPipeline = stages.filter((s) => s.pipeline_id === form.pipeline_id);

  if (!canSettings) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Você não tem permissão para gerenciar gatilhos do Instagram.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Automação estilo ManyChat: quem comenta a palavra-chave, responde story ou menciona a conta
          recebe resposta + DM na hora, vira lead no funil e o agente de IA assume a conversa.
        </p>
        <Button onClick={openNew} className="gap-2 shrink-0" disabled={instances.length === 0}>
          <Plus className="h-4 w-4" /> Novo gatilho
        </Button>
      </div>

      {instances.length === 0 && !loading && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          Nenhuma conta do Instagram conectada. Conecte em Configurações → Instagram antes de criar gatilhos.
        </CardContent></Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : triggers.length === 0 ? (
        instances.length > 0 && (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum gatilho ainda. Ex.: “comentou EU QUERO no post → manda o link por DM e cria o lead”.
          </CardContent></Card>
        )
      ) : (
        <div className="grid gap-3">
          {triggers.map((t) => {
            const meta = TYPE_META[t.trigger_type] ?? TYPE_META.comment;
            const Icon = meta.icon;
            const inst = instances.find((i) => i.id === t.instance_id);
            return (
              <Card key={t.id} className="overflow-hidden">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${t.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                      {meta.beta && <Badge variant="secondary" className="text-[10px]">Aguardando Meta</Badge>}
                      {inst && <Badge variant="secondary" className="text-[10px]">{inst.label}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {t.keywords?.length ? `Palavras: ${t.keywords.join(", ")}` : "Qualquer texto"}
                      {t.media_ids?.length ? ` · ${t.media_ids.length} post(s)` : ""}
                      {` · ${runCounts[t.id] || 0} disparo(s)`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={t.is_active} onCheckedChange={(v) => handleToggle(t, v)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar gatilho" : "Novo gatilho"}</DialogTitle>
            <DialogDescription>{typeMeta.hint}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Isca do post de lançamento" />
              </div>
              <div className="space-y-1.5">
                <Label>Conta do Instagram</Label>
                <Select value={form.instance_id} onValueChange={(v) => setForm({ ...form, instance_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolha a conta" /></SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de gatilho</Label>
                <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}{m.beta ? " (aguardando Meta)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showKeywords && (
                <div className="space-y-1.5">
                  <Label>Combinação</Label>
                  <Select value={form.match_type} onValueChange={(v) => setForm({ ...form, match_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MATCH_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {form.trigger_type === "follow" && (
              <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                O webhook de novo seguidor ainda é um beta fechado da Meta (nem o ManyChat dispara de forma
                confiável). Deixe o gatilho configurado: no dia em que a Meta liberar o evento, ele passa a
                rodar sem precisar mexer em nada.
              </div>
            )}

            {showKeywords && form.match_type !== "any" && (
              <div className="space-y-1.5">
                <Label>Palavras-chave (separe por vírgula)</Label>
                <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="EU QUERO, QUERO, LINK" />
              </div>
            )}

            {showMedia && (
              <div className="space-y-1.5">
                <Label>IDs dos posts (opcional — vazio = todos os posts)</Label>
                <Input value={form.media_ids} onChange={(e) => setForm({ ...form, media_ids: e.target.value })} placeholder="17890000000000000, 17890000000000001" />
              </div>
            )}

            {showPublicReply && (
              <div className="space-y-1.5">
                <Label>Respostas públicas ao comentário (uma por linha — sorteia uma)</Label>
                <Textarea rows={3} value={form.public_replies} onChange={(e) => setForm({ ...form, public_replies: e.target.value })} placeholder={"Te chamei na DM! 📩\nAcabei de te mandar no privado\nOlha a DM, {{nome}}!"} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Mensagem privada (DM)</Label>
              <Textarea rows={4} value={form.dm_message} onChange={(e) => setForm({ ...form, dm_message: e.target.value })} placeholder={"Oi {{nome}}! Vi seu comentário — aqui está o material: https://..."} />
              <p className="text-[11px] text-muted-foreground">Aceita {"{{nome}}"} e {"{{username}}"}.</p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Criar/rotear lead no CRM</p>
                <p className="text-xs text-muted-foreground">Quem dispara o gatilho vira lead no funil escolhido.</p>
              </div>
              <Switch checked={form.create_lead} onCheckedChange={(v) => setForm({ ...form, create_lead: v })} />
            </div>

            {form.create_lead && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Funil</Label>
                  <Select value={form.pipeline_id} onValueChange={(v) => setForm({ ...form, pipeline_id: v, stage_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Padrão (FUNIL SS)" /></SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Etapa</Label>
                  <Select value={form.stage_id} onValueChange={(v) => setForm({ ...form, stage_id: v })} disabled={!form.pipeline_id}>
                    <SelectTrigger><SelectValue placeholder="Primeira etapa" /></SelectTrigger>
                    <SelectContent>
                      {stagesOfPipeline.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Agente de IA assume a conversa (opcional)</Label>
                <Select value={form.agent_id || "none"} onValueChange={(v) => setForm({ ...form, agent_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Não repetir pro mesmo usuário por (horas)</Label>
                <Input type="number" min={0} value={form.cooldown_hours} onChange={(e) => setForm({ ...form, cooldown_hours: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar gatilho"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir gatilho?</AlertDialogTitle>
            <AlertDialogDescription>
              O gatilho para de disparar na hora e o histórico de disparos é removido. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
