import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { startRingback, stopRingback } from "@/lib/dialer/ringback";
import { callingHoursStatus } from "@/lib/dialer/callingHours";
import { LeadBriefingPanel } from "./LeadBriefingPanel";
import { ScheduleLeadMeetingDialog } from "@/components/crm/lead-detail/ScheduleLeadMeetingDialog";
import { Phone, PhoneOff, PhoneForwarded, Power, Loader2, SkipForward, AlertTriangle, CalendarPlus } from "lucide-react";

interface CampaignOpt { id: string; name: string; status: string }
interface CurrentCall { callId: string; queueId: string | null; lead: { id: string; name: string; phone: string } }

const DISPOSITIONS = [
  { key: "qualificado", label: "Qualificado", variant: "default" as const },
  { key: "agendou_reuniao", label: "Agendou reunião", variant: "default" as const },
  { key: "retornar_depois", label: "Retornar depois", variant: "secondary" as const },
  { key: "sem_interesse", label: "Sem interesse", variant: "secondary" as const },
  { key: "nao_qualificado", label: "Não qualificado", variant: "outline" as const },
];

const statusLabel: Record<string, string> = {
  offline: "Offline", connecting: "Conectando…", ready: "Pronta", incoming: "Recebendo…", oncall: "Em ligação",
};
const statusColor: Record<string, string> = {
  offline: "bg-muted text-muted-foreground", connecting: "bg-amber-500/15 text-amber-500",
  ready: "bg-emerald-500/15 text-emerald-500", incoming: "bg-blue-500/15 text-blue-500", oncall: "bg-primary/15 text-primary",
};

export function DialerLivePanel({ campaigns, staffId, tenantId = null }: { campaigns: CampaignOpt[]; staffId: string | null; tenantId?: string | null }) {
  const active = campaigns.filter((c) => c.status === "active");
  const [campaignId, setCampaignId] = useState<string>("");
  const { status, error, goReady, goOffline, hangup } = useTwilioDevice(staffId);
  const [current, setCurrent] = useState<CurrentCall | null>(null);
  const [dialing, setDialing] = useState(false);
  const [note, setNote] = useState("");
  const [autoDial, setAutoDial] = useState(false);
  const [balance, setBalance] = useState<{ balance: number; currency: string; low: boolean; critical: boolean } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [hours, setHours] = useState(() => callingHoursStatus());
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setHours(callingHoursStatus()), 60000);
    return () => clearInterval(t);
  }, []);
  const currentRef = useRef<CurrentCall | null>(null);
  const autoDialRef = useRef(autoDial);
  const handledRef = useRef<string | null>(null);
  const prevStatusRef = useRef(status);

  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { autoDialRef.current = autoDial; }, [autoDial]);

  const refreshBalance = async () => {
    const { data } = await supabase.functions.invoke("dialer-balance");
    if (data && typeof data.balance === "number") setBalance(data);
  };
  useEffect(() => { void refreshBalance(); }, []);

  // Heartbeat: intervalo fixo (NÃO depende de status — senão cada mudança de status reinicia o
  // timer de 30s e durante a discagem ele nunca chega a disparar, deixando o agente "offline").
  // Atualiza last_seen_at enquanto houver sessão aberta; para sozinho quando a sessão fecha (ref null).
  useEffect(() => {
    const t = setInterval(() => {
      if (sessionIdRef.current) {
        void supabase.from("crm_dialer_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionIdRef.current);
      }
    }, 25000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!campaignId && active.length) setCampaignId(active[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  // encerra sessão ao desmontar
  useEffect(() => {
    return () => { void closeSession(); stopRingback(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tom de chamada no navegador enquanto o cliente ainda não atendeu.
  // Toca quando há ligação em curso e o agente ainda não foi conectado; para ao atender.
  useEffect(() => {
    if (current && (status === "ready" || status === "connecting")) {
      startRingback();
    } else {
      stopRingback();
    }
    return () => stopRingback();
  }, [current, status]);

  const openSession = async () => {
    if (!staffId) return;
    const nowIso = new Date().toISOString();
    // fecha qualquer sessão minha que tenha ficado aberta (evita sobreposição e inflar o tempo)
    await supabase.from("crm_dialer_sessions").update({ ended_at: nowIso }).eq("agent_staff_id", staffId).is("ended_at", null);
    const { data } = await supabase.from("crm_dialer_sessions")
      .insert({ agent_staff_id: staffId, campaign_id: campaignId || null, tenant_id: tenantId, last_seen_at: nowIso }).select("id").maybeSingle();
    sessionIdRef.current = data?.id || null;
  };
  const closeSession = async () => {
    if (sessionIdRef.current) {
      await supabase.from("crm_dialer_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionIdRef.current);
      sessionIdRef.current = null;
    }
  };

  const toggleReady = async () => {
    if (status === "offline") {
      await goReady();
      await openSession();
    } else {
      goOffline();
      await closeSession();
    }
  };

  const dialNext = async () => {
    if (!campaignId) return toast.error("Selecione uma campanha ativa");
    if (status !== "ready") return toast.error("Fique 'Pronta' antes de discar");
    setDialing(true);
    setNote("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("dialer-call", { body: { campaignId, agentStaffId: staffId } });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (data?.done) {
        if (data.error) toast.warning(data.error);
        else toast.info(data.reason === "queue_empty" ? "Fila vazia — sincronize mais leads" : "Campanha não está ativa");
        setCurrent(null);
        return;
      }
      if (data?.ok) {
        setCurrent({ callId: data.callId, queueId: data.queueId, lead: data.lead });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao discar");
    } finally {
      setDialing(false);
    }
  };

  const disposition = async (key: string, label: string) => {
    if (!current) return;
    handledRef.current = current.callId; // evita que o detector de fim de ligação trate de novo
    hangup();
    // disposição manual vai pra fila; a IA preenche ai_disposition depois via dialer-qualify
    await supabase.from("crm_calls").update({ notes: note || null }).eq("id", current.callId);
    if (current.queueId) {
      await supabase.from("crm_dialer_queue").update({ disposition: key, status: "completed" }).eq("id", current.queueId);
    }
    toast.success(`Marcado: ${label}`);
    setCurrent(null);
    setNote("");
    stopRingback();
    void refreshBalance();
    if (autoDial && status !== "offline") {
      setTimeout(() => { void dialNext(); }, 800);
    }
  };

  // Encerramento automático (cliente desligou, não atendeu, caixa postal): registra e vai pro próximo.
  const onCallEnded = async (reason: string) => {
    const c = currentRef.current;
    if (!c || handledRef.current === c.callId) return;
    handledRef.current = c.callId;
    stopRingback();
    if (c.queueId) {
      await supabase.from("crm_dialer_queue").update({ status: "completed", disposition: reason }).eq("id", c.queueId);
    }
    setCurrent(null);
    setNote("");
    void refreshBalance();
    if (autoDialRef.current && status !== "offline") {
      setTimeout(() => { void dialNext(); }, 1000);
    }
  };

  // Detecção imediata: agente estava em ligação e voltou pra "pronta" => o outro lado desligou.
  useEffect(() => {
    const was = prevStatusRef.current;
    prevStatusRef.current = status;
    if ((was === "oncall" || was === "incoming") && status === "ready" && currentRef.current) {
      void onCallEnded("atendida");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Poll de segurança: cobre não-atendeu/ocupado/caixa postal (onde o agente nunca foi conectado).
  useEffect(() => {
    if (!current) return;
    const id = current.callId;
    const t = setInterval(async () => {
      const { data } = await supabase.from("crm_calls").select("status, answered_at, answered_by").eq("id", id).maybeSingle();
      if (!data) return;
      if (["completed", "no-answer", "busy", "failed", "canceled", "voicemail"].includes(data.status)) {
        void onCallEnded(data.answered_by === "human" ? "atendida" : data.status === "voicemail" ? "voicemail" : "nao_atendeu");
      }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.callId]);

  return (
    <div className="grid lg:grid-cols-[360px_1fr] h-full">
      {/* Coluna de controle */}
      <div className="border-r border-border p-4 space-y-4 overflow-auto">
        <div className="flex items-center justify-between">
          <Badge className={statusColor[status]}>{statusLabel[status]}</Badge>
          <Button size="sm" variant={status === "offline" ? "default" : "secondary"} className="gap-1" onClick={toggleReady}>
            <Power className="h-4 w-4" /> {status === "offline" ? "Ficar pronta" : "Pausar"}
          </Button>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {!hours.allowed && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 p-2 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{hours.message}</span>
          </div>
        )}

        {balance && (balance.low || balance.critical) && (
          <div className={`rounded-md border p-2 text-xs flex items-start gap-2 ${balance.critical ? "border-red-500/40 bg-red-500/10 text-red-500" : "border-amber-500/40 bg-amber-500/10 text-amber-600"}`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {balance.critical ? "Saldo Twilio crítico" : "Saldo Twilio acabando"}: {balance.currency} {balance.balance.toFixed(2)}. Recarregue para não parar as ligações.
            </span>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground">Campanha ativa</label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger><SelectValue placeholder={active.length ? "Selecione" : "Nenhuma campanha ativa"} /></SelectTrigger>
            <SelectContent>
              {active.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!current ? (
          <Button className="w-full gap-2" disabled={dialing || status !== "ready" || !campaignId || !hours.allowed} onClick={dialNext}>
            {dialing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneForwarded className="h-4 w-4" />}
            Discar próximo
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4 text-primary" /> {current.lead.name}
              </div>
              <p className="text-xs text-muted-foreground">{current.lead.phone}</p>
            </div>
            <Textarea rows={3} placeholder="Anotações da ligação…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((d) => (
                <Button key={d.key} size="sm" variant={d.variant} onClick={() => disposition(d.key, d.label)}>
                  {d.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowSchedule(true)}>
              <CalendarPlus className="h-4 w-4" /> Agendar reunião
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => disposition("nao_atendeu", "Não atendeu")}>
              <PhoneOff className="h-4 w-4" /> Encerrar / Não atendeu
            </Button>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={autoDial} onChange={(e) => setAutoDial(e.target.checked)} />
          <SkipForward className="h-3.5 w-3.5" /> Discar o próximo automaticamente
        </label>
      </div>

      {/* Briefing */}
      <div className="min-h-[400px]">
        <LeadBriefingPanel leadId={current?.lead.id || null} />
      </div>

      {current && (
        <ScheduleLeadMeetingDialog
          open={showSchedule}
          onOpenChange={setShowSchedule}
          leadId={current.lead.id}
          leadName={current.lead.name}
          onSuccess={async () => {
            setShowSchedule(false);
            if (current?.queueId) {
              await supabase.from("crm_dialer_queue").update({ disposition: "agendou_reuniao" }).eq("id", current.queueId);
            }
            toast.success("Reunião agendada");
          }}
        />
      )}
    </div>
  );
}
