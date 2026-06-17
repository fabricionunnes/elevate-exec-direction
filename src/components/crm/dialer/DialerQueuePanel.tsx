import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Play, Pause, RefreshCw, Loader2, Phone, Users, Trash2 } from "lucide-react";

// Vazio por padrão: o cliente atende e fala direto com a atendente, sem mensagem automática.
const DEFAULT_CONSENT = "";

interface Campaign {
  id: string;
  name: string;
  status: string;
  agent_staff_id: string | null;
  pipeline_id: string | null;
  trigger_stage_id: string | null;
  consent_message: string;
  agent?: { name: string } | null;
  pipeline?: { name: string } | null;
  counts?: { queued: number; total: number };
}

export function DialerQueuePanel({ onChanged, tenantId = null }: { onChanged?: () => void; tenantId?: string | null }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    agent_staff_id: "",
    pipeline_id: "",
    consent_message: DEFAULT_CONSENT,
    use_amd: true,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_dialer_campaigns")
      .select("*, agent:onboarding_staff!crm_dialer_campaigns_agent_staff_id_fkey(name), pipeline:crm_pipelines(name)")
      .order("created_at", { ascending: false });
    const list = (data || []) as any as Campaign[];
    // counts por campanha
    for (const c of list) {
      const [{ count: queued }, { count: total }] = await Promise.all([
        supabase.from("crm_dialer_queue").select("*", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "queued"),
        supabase.from("crm_dialer_queue").select("*", { count: "exact", head: true }).eq("campaign_id", c.id),
      ]);
      c.counts = { queued: queued || 0, total: total || 0 };
    }
    setCampaigns(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("onboarding_staff").select("id, name").eq("is_active", true)
      .in("role", ["master", "admin", "head_comercial", "closer", "sdr", "bdr", "social_setter"])
      .then(({ data }) => setStaff(data || []));
    supabase.from("crm_pipelines").select("id, name").eq("is_active", true)
      .then(({ data }) => {
        setPipelines(data || []);
        const discador = (data || []).find((p: any) => p.name === "Discador");
        if (discador) setForm((f) => ({ ...f, pipeline_id: discador.id }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCampaign = async () => {
    if (!form.name.trim()) return toast.error("Dê um nome para a campanha");
    if (!form.agent_staff_id) return toast.error("Selecione a atendente");
    if (!form.pipeline_id) return toast.error("Selecione o funil");
    // 1ª etapa do funil = etapa-gatilho
    const { data: stage } = await supabase
      .from("crm_stages").select("id").eq("pipeline_id", form.pipeline_id)
      .order("sort_order", { ascending: true }).limit(1).maybeSingle();
    const { error } = await supabase.from("crm_dialer_campaigns").insert({
      name: form.name.trim(),
      agent_staff_id: form.agent_staff_id,
      pipeline_id: form.pipeline_id,
      trigger_stage_id: stage?.id || null,
      consent_message: form.consent_message,
      use_amd: form.use_amd,
      tenant_id: tenantId,
      status: "paused",
    });
    if (error) return toast.error(error.message);
    toast.success("Campanha criada");
    setCreating(false);
    setForm((f) => ({ ...f, name: "" }));
    load();
    onChanged?.();
  };

  const syncQueue = async (c: Campaign) => {
    if (!c.trigger_stage_id) return toast.error("Campanha sem etapa-gatilho");
    setBusyId(c.id);
    try {
      const { data: leads } = await supabase
        .from("crm_leads").select("id").eq("stage_id", c.trigger_stage_id).limit(5000);
      const rows = (leads || []).map((l: any) => ({ campaign_id: c.id, lead_id: l.id, status: "queued", tenant_id: tenantId }));
      if (!rows.length) { toast.info("Nenhum lead na etapa 'Para ligar'"); return; }
      let added = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("crm_dialer_queue")
          .upsert(chunk, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
        if (!error) added += chunk.length;
      }
      toast.success(`${rows.length} leads sincronizados na fila`);
      load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (c: Campaign) => {
    const next = c.status === "active" ? "paused" : "active";
    await supabase.from("crm_dialer_campaigns").update({ status: next }).eq("id", c.id);
    load();
    onChanged?.();
  };

  const deleteCampaign = async (c: Campaign) => {
    if (!window.confirm(`Excluir a campanha "${c.name}"? A fila dela é removida. As ligações já feitas ficam guardadas no histórico dos leads.`)) return;
    setBusyId(c.id);
    const { error } = await supabase.from("crm_dialer_campaigns").delete().eq("id", c.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Campanha excluída");
    load();
    onChanged?.();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando campanhas…</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Campanhas de discagem</h2>
        <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma campanha ainda. Crie uma ligada ao funil "Discador".</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge variant={c.status === "active" ? "default" : "secondary"}>
                  {c.status === "active" ? "Ativa" : c.status === "completed" ? "Concluída" : "Pausada"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>Atendente: <span className="text-foreground">{c.agent?.name || "—"}</span></p>
                <p>Funil: <span className="text-foreground">{c.pipeline?.name || "—"}</span></p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" /> {c.counts?.queued ?? 0} na fila</span>
                <span className="text-muted-foreground">{c.counts?.total ?? 0} no total</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1" disabled={busyId === c.id} onClick={() => syncQueue(c)}>
                  {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sincronizar fila
                </Button>
                <Button size="sm" variant={c.status === "active" ? "secondary" : "default"} className="gap-1" onClick={() => toggleStatus(c)}>
                  {c.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pausar</> : <><Play className="h-3.5 w-3.5" /> Iniciar</>}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-red-500 hover:text-red-600 ml-auto" disabled={busyId === c.id} onClick={() => deleteCampaign(c)}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova campanha de discagem</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Base fria junho" />
            </div>
            <div>
              <Label>Atendente (recebe as ligações)</Label>
              <Select value={form.agent_staff_id} onValueChange={(v) => setForm((f) => ({ ...f, agent_staff_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funil (leads da 1ª etapa entram na fila)</Label>
              <Select value={form.pipeline_id} onValueChange={(v) => setForm((f) => ({ ...f, pipeline_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensagem automática antes de conectar (opcional)</Label>
              <Textarea rows={2} placeholder="Deixe vazio para o cliente cair direto na atendente." value={form.consent_message} onChange={(e) => setForm((f) => ({ ...f, consent_message: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Vazio = a atendente fala assim que o cliente atende. Preencha só se quiser tocar um aviso de gravação antes.</p>
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1" checked={form.use_amd} onChange={(e) => setForm((f) => ({ ...f, use_amd: e.target.checked }))} />
              <span>
                Detectar secretária eletrônica (pula caixa postal automaticamente)
                <span className="block text-xs text-muted-foreground">Recomendado. Custa ~US$0,0075/ligação. Desligue para economizar — aí a atendente desliga as caixas postais na mão.</span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button onClick={createCampaign}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
