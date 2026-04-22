import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Clock } from "lucide-react";
import { CadenceMediaUpload } from "./CadenceMediaUpload";
import { CadenceBranchesEditor, type Branch } from "./CadenceBranchesEditor";

interface Cadence {
  id: string;
  name: string;
  description: string | null;
  scope: "pipeline" | "stage";
  pipeline_id: string | null;
  stage_id: string | null;
  is_active: boolean;
  stop_on_reply: boolean;
  stop_on_stage_change: boolean;
  window_start: string | null;
  window_end: string | null;
  window_weekdays: number[] | null;
}

interface Step {
  id?: string;
  sort_order: number;
  delay_value: number;
  delay_unit: "minutes" | "hours" | "days";
  message_template: string;
  instance_mode: "fixed" | "from_owner";
  whatsapp_instance_id: string | null;
  send_condition: "always" | "no_reply";
  is_active: boolean;
  media_type: "text" | "image" | "audio" | "video" | "document";
  media_url: string | null;
  media_caption: string | null;
  media_filename: string | null;
  branches: Branch[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Cadence | null;
  onSaved: () => void;
}

const emptyStep = (order: number): Step => ({
  sort_order: order,
  delay_value: order === 0 ? 0 : 1,
  delay_unit: "days",
  message_template: "",
  instance_mode: "from_owner",
  whatsapp_instance_id: null,
  send_condition: "always",
  is_active: true,
  media_type: "text",
  media_url: null,
  media_caption: null,
  media_filename: null,
  branches: [],
});

export function CadenceEditorDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"pipeline" | "stage">("stage");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnStageChange, setStopOnStageChange] = useState(true);
  const [useCustomWindow, setUseCustomWindow] = useState(false);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [steps, setSteps] = useState<Step[]>([emptyStep(0)]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [pip, ins] = await Promise.all([
        supabase.from("crm_pipelines").select("id, name").eq("is_active", true).order("name"),
        supabase.from("whatsapp_instances").select("id, instance_name").order("instance_name"),
      ]);
      setPipelines(pip.data || []);
      setInstances(ins.data || []);
    })();
  }, [open]);

  useEffect(() => {
    if (!pipelineId) { setStages([]); return; }
    supabase.from("crm_stages").select("id, name, pipeline_id").eq("pipeline_id", pipelineId).order("sort_order").then(({ data }) => setStages(data || []));
  }, [pipelineId]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description || "");
      setScope(editing.scope);
      setPipelineId(editing.pipeline_id);
      setStageId(editing.stage_id);
      setStopOnReply(editing.stop_on_reply);
      setStopOnStageChange(editing.stop_on_stage_change);
      const hasWin = !!(editing.window_start && editing.window_end);
      setUseCustomWindow(hasWin);
      setWindowStart(editing.window_start || "09:00");
      setWindowEnd(editing.window_end || "18:00");
      supabase.from("crm_cadence_steps").select("*").eq("cadence_id", editing.id).order("sort_order")
        .then(({ data }) => {
          const mapped = (data || []).map((s: any) => ({
            ...s,
            media_type: s.media_type || "text",
            branches: Array.isArray(s.branches) ? s.branches : [],
          }));
          setSteps(mapped.length ? mapped : [emptyStep(0)]);
        });
      if (editing.pipeline_id) {
        supabase.from("crm_stages").select("id, name, pipeline_id").eq("pipeline_id", editing.pipeline_id).order("sort_order").then(({ data }) => setStages(data || []));
      } else if (editing.stage_id) {
        supabase.from("crm_stages").select("id, name, pipeline_id").eq("id", editing.stage_id).maybeSingle().then(({ data }) => {
          if (data) setPipelineId(data.pipeline_id);
        });
      }
    } else {
      setName(""); setDescription(""); setScope("stage");
      setPipelineId(null); setStageId(null);
      setStopOnReply(true); setStopOnStageChange(true);
      setUseCustomWindow(false); setWindowStart("09:00"); setWindowEnd("18:00");
      setSteps([emptyStep(0)]);
    }
  }, [open, editing]);

  const addStep = () => setSteps((p) => [...p, emptyStep(p.length)]);
  const removeStep = (idx: number) => setSteps((p) => p.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i })));
  const updateStep = (idx: number, patch: Partial<Step>) => setSteps((p) => p.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    if (scope === "pipeline" && !pipelineId) { toast.error("Selecione um funil"); return; }
    if (scope === "stage" && !stageId) { toast.error("Selecione uma etapa"); return; }
    if (steps.length === 0) { toast.error("Adicione ao menos uma mensagem"); return; }
    for (const s of steps) {
      if (s.media_type === "text" && !s.message_template.trim()) {
        toast.error("Mensagens de texto não podem estar vazias"); return;
      }
      if (s.media_type !== "text" && !s.media_url) {
        toast.error(`Faça upload do arquivo de mídia em todos os passos com tipo "${s.media_type}"`); return;
      }
      if (s.instance_mode === "fixed" && !s.whatsapp_instance_id) {
        toast.error("Selecione a instância para passos com modo fixo"); return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        scope,
        pipeline_id: scope === "pipeline" ? pipelineId : null,
        stage_id: scope === "stage" ? stageId : null,
        stop_on_reply: stopOnReply,
        stop_on_stage_change: stopOnStageChange,
        window_start: useCustomWindow ? windowStart : null,
        window_end: useCustomWindow ? windowEnd : null,
      };

      let cadenceId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("crm_cadences").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("crm_cadences").insert(payload).select("id").single();
        if (error) throw error;
        cadenceId = data.id;
      }

      await supabase.from("crm_cadence_steps").delete().eq("cadence_id", cadenceId!);
      const stepRows = steps.map((s, i) => ({
        cadence_id: cadenceId,
        sort_order: i,
        delay_value: s.delay_value,
        delay_unit: s.delay_unit,
        message_template: s.message_template,
        instance_mode: s.instance_mode,
        whatsapp_instance_id: s.instance_mode === "fixed" ? s.whatsapp_instance_id : null,
        send_condition: s.send_condition,
        is_active: s.is_active,
        media_type: s.media_type,
        media_url: s.media_type === "text" ? null : s.media_url,
        media_caption: s.media_type === "text" ? null : s.media_caption,
        media_filename: s.media_type === "text" ? null : s.media_filename,
        branches: (s.branches || []) as any,
      }));
      const { error: stepErr } = await supabase.from("crm_cadence_steps").insert(stepRows);
      if (stepErr) throw stepErr;

      toast.success(editing ? "Cadência atualizada" : "Cadência criada");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cadência" : "Nova cadência"}</DialogTitle>
          <DialogDescription>Configure a sequência de mensagens automáticas.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Follow-up pós-qualificação" />
          </div>
          <div className="grid gap-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Aplicar em</Label>
              <Select value={scope} onValueChange={(v: any) => { setScope(v); setStageId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage">Etapa específica</SelectItem>
                  <SelectItem value="pipeline">Funil inteiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Funil</Label>
              <Select value={pipelineId || ""} onValueChange={(v) => { setPipelineId(v); setStageId(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {scope === "stage" && (
              <div className="grid gap-2">
                <Label>Etapa</Label>
                <Select value={stageId || ""} onValueChange={setStageId} disabled={!pipelineId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Parar se o lead responder</Label>
              <Switch checked={stopOnReply} onCheckedChange={setStopOnReply} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Parar se mudar de etapa</Label>
              <Switch checked={stopOnStageChange} onCheckedChange={setStopOnStageChange} />
            </div>
          </div>

          <div className="p-3 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Janela de horário personalizada</Label>
              </div>
              <Switch checked={useCustomWindow} onCheckedChange={setUseCustomWindow} />
            </div>
            {useCustomWindow && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                </div>
              </div>
            )}
            {!useCustomWindow && (
              <p className="text-xs text-muted-foreground">Usa a janela global configurada no botão "Janela global".</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Mensagens da cadência</Label>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />Adicionar mensagem
              </Button>
            </div>

            {steps.map((step, idx) => (
              <Card key={idx} className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Mensagem #{idx + 1}</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeStep(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">{idx === 0 ? "Atraso após entrar na etapa" : "Atraso após mensagem anterior"}</Label>
                    <Input type="number" min={0} value={step.delay_value} onChange={(e) => updateStep(idx, { delay_value: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Unidade</Label>
                    <Select value={step.delay_unit} onValueChange={(v: any) => updateStep(idx, { delay_unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutos</SelectItem>
                        <SelectItem value="hours">Horas</SelectItem>
                        <SelectItem value="days">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Condição</Label>
                    <Select value={step.send_condition} onValueChange={(v: any) => updateStep(idx, { send_condition: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Sempre enviar</SelectItem>
                        <SelectItem value="no_reply">Só se não respondeu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">Instância de envio</Label>
                    <Select value={step.instance_mode} onValueChange={(v: any) => updateStep(idx, { instance_mode: v, whatsapp_instance_id: null })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="from_owner">Instância do dono do lead</SelectItem>
                        <SelectItem value="fixed">Instância fixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {step.instance_mode === "fixed" && (
                    <div className="grid gap-1">
                      <Label className="text-xs">Selecionar instância</Label>
                      <Select value={step.whatsapp_instance_id || ""} onValueChange={(v) => updateStep(idx, { whatsapp_instance_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                        <SelectContent>
                          {instances.map((i) => <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Tipo de conteúdo */}
                <div className="grid gap-1">
                  <Label className="text-xs">Tipo de conteúdo</Label>
                  <Select value={step.media_type} onValueChange={(v: any) => updateStep(idx, { media_type: v, media_url: null, media_filename: null })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">📝 Texto</SelectItem>
                      <SelectItem value="image">🖼️ Imagem</SelectItem>
                      <SelectItem value="audio">🎙️ Áudio</SelectItem>
                      <SelectItem value="video">🎥 Vídeo</SelectItem>
                      <SelectItem value="document">📎 Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {step.media_type !== "text" && (
                  <CadenceMediaUpload
                    mediaType={step.media_type as any}
                    value={step.media_url}
                    filename={step.media_filename}
                    onChange={(url, filename) => updateStep(idx, { media_url: url, media_filename: filename || null })}
                  />
                )}

                <div className="grid gap-1">
                  <Label className="text-xs">
                    {step.media_type === "text"
                      ? `Mensagem (variáveis: {{nome}}, {{nome_completo}}, {{empresa}})`
                      : step.media_type === "audio"
                      ? "Áudio não tem legenda"
                      : `Legenda (opcional, variáveis: {{nome}}, {{empresa}})`}
                  </Label>
                  {step.media_type === "audio" ? null : step.media_type === "text" ? (
                    <Textarea
                      rows={3}
                      value={step.message_template}
                      onChange={(e) => updateStep(idx, { message_template: e.target.value })}
                      placeholder="Olá {{nome}}, tudo bem?"
                    />
                  ) : (
                    <Textarea
                      rows={2}
                      value={step.media_caption || ""}
                      onChange={(e) => updateStep(idx, { media_caption: e.target.value })}
                      placeholder="Legenda opcional..."
                    />
                  )}
                </div>

                <CadenceBranchesEditor
                  branches={step.branches}
                  onChange={(b) => updateStep(idx, { branches: b })}
                  totalSteps={steps.length}
                  currentSortOrder={idx}
                />
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar cadência"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
