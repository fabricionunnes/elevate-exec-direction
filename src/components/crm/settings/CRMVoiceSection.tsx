// Configurações do CRM → Automações → "Assistente de voz (liga pro lead)" (pedido do Fabrício, 22/09/2026).
// Liga/desliga geral, funis liberados, gatilho "lead sem resposta", horário e limite diário.
// O motor é a edge voice-agent (cron 5/5 min); por lead, o controle fica no painel do Atendimento.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

type Cfg = {
  voice_agent_enabled: boolean; voice_pipeline_ids: string[]; voice_no_reply_minutes: number; voice_hours: string;
  voice_max_calls_per_day: number; voice_trigger_no_reply: boolean; retell_agent_id?: string; retell_from_number?: string;
};
const DEF: Cfg = { voice_agent_enabled: false, voice_pipeline_ids: [], voice_no_reply_minutes: 10, voice_hours: "09:00-19:00", voice_max_calls_per_day: 30, voice_trigger_no_reply: true };

export function CRMVoiceSection() {
  const [cfg, setCfg] = useState<Cfg>(DEF);
  const [pronto, setPronto] = useState<{ retell_key: boolean; agente: boolean; numero: boolean; twilio: boolean } | null>(null);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: pp }] = await Promise.all([
      supabase.functions.invoke("voice-agent?action=status", { body: {} }),
      (supabase as any).from("crm_pipelines").select("id, name").order("name"),
    ]);
    const c = (data as any)?.cfg || {};
    setCfg({ ...DEF, ...c, voice_pipeline_ids: Array.isArray(c.voice_pipeline_ids) ? c.voice_pipeline_ids : [] });
    setPronto((data as any)?.pronto || null);
    setPipelines(pp || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key: keyof Cfg, value: unknown) => {
    setSaving(key);
    const prev = cfg[key];
    setCfg((c) => ({ ...c, [key]: value }));
    const { error } = await (supabase as any).from("crm_settings").upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
    setSaving(null);
    if (error) { setCfg((c) => ({ ...c, [key]: prev })); toast.error("Não consegui salvar: " + error.message); }
  };
  const [hIni, hFim] = String(cfg.voice_hours || "09:00-19:00").split("-");
  const configurada = !!(pronto?.retell_key && pronto?.agente && pronto?.numero);

  const verPreview = async () => {
    setPreview(null);
    const { data, error } = await supabase.functions.invoke("voice-agent?action=preview", { body: {} });
    if (error) { toast.error(error.message); return; }
    setPreview((data as any)?.saida || []);
    if ((data as any)?.skipped) toast.info((data as any).skipped);
  };

  return (
    <div className="space-y-4 pt-6 border-t">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><PhoneCall className="h-5 w-5 text-primary" />Assistente de voz (liga pro lead)</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Ligação com voz humana, pelo número da UNV, usando o mesmo cérebro dos agentes de WhatsApp. Só liga pra lead dos funis marcados abaixo; em cada conversa dá pra ligar ou desligar por lead.
          </p>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="flex items-center gap-2">
            <Badge variant={configurada ? "default" : "secondary"}>{configurada ? "Retell conectada" : "Aguardando configuração da Retell"}</Badge>
            <Switch checked={cfg.voice_agent_enabled} disabled={saving === "voice_agent_enabled" || !configurada} onCheckedChange={(v) => save("voice_agent_enabled", v)} />
          </div>
        )}
      </div>

      {!loading && (
        <Card><CardContent className="pt-4 space-y-5">
          <div>
            <Label>Funis liberados</Label>
            <p className="text-xs text-muted-foreground mb-2">A assistente só liga pra lead destes funis. Nenhum marcado = não liga pra ninguém (a não ser lead com "sempre ligar").</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-44 overflow-y-auto border rounded-md p-2">
              {pipelines.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={cfg.voice_pipeline_ids.includes(p.id)}
                    onCheckedChange={() => save("voice_pipeline_ids", cfg.voice_pipeline_ids.includes(p.id) ? cfg.voice_pipeline_ids.filter((x) => x !== p.id) : [...cfg.voice_pipeline_ids, p.id])} />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span><span className="font-medium">Lead novo que não respondeu no WhatsApp</span><br /><span className="text-xs text-muted-foreground">Chegou hoje, recebeu nossa mensagem e ficou em silêncio: a assistente liga.</span></span>
              <Switch checked={cfg.voice_trigger_no_reply} onCheckedChange={(v) => save("voice_trigger_no_reply", v)} />
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Liga depois de</span>
              <Input type="number" min={3} className="w-20 h-8" value={cfg.voice_no_reply_minutes} onChange={(e) => setCfg((c) => ({ ...c, voice_no_reply_minutes: Number(e.target.value) }))} onBlur={() => save("voice_no_reply_minutes", Number(cfg.voice_no_reply_minutes) || 10)} />
              <span className="text-muted-foreground">minutos sem resposta</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Liga a partir de</Label><Input type="time" value={hIni} onChange={(e) => save("voice_hours", `${e.target.value}-${hFim}`)} /></div>
            <div><Label>até</Label><Input type="time" value={hFim} onChange={(e) => save("voice_hours", `${hIni}-${e.target.value}`)} /></div>
            <div><Label>Máximo de ligações por dia</Label><Input type="number" min={1} value={cfg.voice_max_calls_per_day} onChange={(e) => setCfg((c) => ({ ...c, voice_max_calls_per_day: Number(e.target.value) }))} onBlur={() => save("voice_max_calls_per_day", Number(cfg.voice_max_calls_per_day) || 30)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Só de segunda a sexta. Nunca liga duas vezes pro mesmo lead em 3 horas. Cada ligação fica registrada no lead com resumo e gravação.</p>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={verPreview}><Play className="h-4 w-4 mr-2" />Quem receberia ligação agora</Button>
            {pronto && !configurada && <span className="text-xs text-muted-foreground">Falta: {[!pronto.retell_key && "chave da Retell", !pronto.agente && "agente", !pronto.numero && "número"].filter(Boolean).join(", ")}.</span>}
          </div>
          {preview && (
            <div className="text-sm border rounded-md p-2">
              {preview.length === 0 ? <span className="text-muted-foreground">Ninguém no momento.</span> : preview.map((p, i) => <div key={i}>{p.lead} · {p.phone}</div>)}
            </div>
          )}
        </CardContent></Card>
      )}
    </div>
  );
}
