import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { startRingback, stopRingback } from "@/lib/dialer/ringback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Phone, PhoneOff, PhoneCall, Loader2, X, Mic, Minus } from "lucide-react";

export interface CallTarget { id: string; name: string; phone?: string | null }

interface CallDockCtx { startCall: (lead: CallTarget) => void; busy: boolean }
const Ctx = createContext<CallDockCtx>({ startCall: () => {}, busy: false });
export const useCallDock = () => useContext(Ctx);

type Phase = "idle" | "connecting" | "ringing" | "oncall" | "ended";

export function CallDockProvider({ staffId, tenantId = null, children }: { staffId: string | null; tenantId?: string | null; children: ReactNode }) {
  const { status, error, goReady, goOffline, hangup } = useTwilioDevice(staffId);
  const [lead, setLead] = useState<CallTarget | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const statusRef = useRef(status);
  const prevStatusRef = useRef(status);
  const callIdRef = useRef<string | null>(null);
  const busy = phase === "connecting" || phase === "ringing" || phase === "oncall";

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);

  // toque de chamada enquanto não conecta
  useEffect(() => {
    if (phase === "ringing" || phase === "connecting") startRingback(); else stopRingback();
    return () => stopRingback();
  }, [phase]);

  // transições pelo estado do device
  useEffect(() => {
    const was = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === "oncall") {
      setPhase("oncall");
      setStartedAt((s) => s ?? Date.now());
    } else if (was === "oncall" && status === "ready") {
      setPhase("ended");
    }
  }, [status]);

  // timer
  useEffect(() => {
    if (phase !== "oncall") return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // poll de segurança: cobre não atendeu / ocupado / caixa postal (agente nunca conecta)
  useEffect(() => {
    if (phase !== "ringing" || !callId) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("crm_calls").select("status, answered_at").eq("id", callId).maybeSingle();
      if (!data) return;
      if (["completed", "no-answer", "busy", "failed", "canceled", "voicemail"].includes(data.status) && !data.answered_at) {
        setPhase("ended");
      }
    }, 4000);
    return () => clearInterval(t);
  }, [phase, callId]);

  const startCall = async (target: CallTarget) => {
    if (!staffId) { toast.error("Seu usuário não está vinculado para ligar."); return; }
    if (busy) { toast.warning("Já existe uma ligação em andamento."); return; }
    if (!target.phone) { toast.error("Esse lead não tem telefone cadastrado."); return; }
    setLead(target); setPhase("connecting"); setNote(""); setCallId(null); setStartedAt(null); setMinimized(false);
    try {
      if (statusRef.current === "offline") await goReady();
      const { data, error: fnErr } = await supabase.functions.invoke("dialer-call", {
        body: { leadId: target.id, agentStaffId: staffId, tenantId },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.ok) throw new Error("Não foi possível iniciar a ligação.");
      setCallId(data.callId);
      setPhase("ringing");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao ligar");
      setPhase("idle"); setLead(null);
      try { goOffline(); } catch { /* noop */ }
    }
  };

  const end = () => { try { hangup(); } catch { /* noop */ } setPhase("ended"); };

  const close = async () => {
    if (note.trim() && callId) {
      await supabase.from("crm_calls").update({ notes: note.trim() }).eq("id", callId);
    }
    try { hangup(); } catch { /* noop */ }
    try { goOffline(); } catch { /* noop */ }
    setLead(null); setPhase("idle"); setCallId(null); setNote(""); setStartedAt(null);
  };

  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  const phaseLabel = phase === "connecting" ? "Conectando…"
    : phase === "ringing" ? "Chamando…"
    : phase === "oncall" ? "Em ligação"
    : phase === "ended" ? "Ligação encerrada" : "";

  return (
    <Ctx.Provider value={{ startCall, busy }}>
      {children}
      {lead && (
        <div className="fixed bottom-4 right-4 z-[60] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${phase === "oncall" ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary"}`}>
              {phase === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : phase === "oncall" ? <PhoneCall className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{lead.name}</p>
              <p className="text-[11px] text-muted-foreground">{phaseLabel}{phase === "oncall" ? ` · ${mmss}` : ""}</p>
            </div>
            <button onClick={() => setMinimized((m) => !m)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Minimizar"><Minus className="h-4 w-4" /></button>
            <button onClick={close} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>

          {!minimized && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">{lead.phone}</p>
              {error && <p className="text-xs text-red-500">{error}</p>}

              {(phase === "oncall" || phase === "ended") && (
                <Textarea rows={3} placeholder="Anotações da ligação…" value={note} onChange={(e) => setNote(e.target.value)} className="text-sm" />
              )}

              {phase === "ended" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mic className="h-3.5 w-3.5 text-emerald-500" /> Gravação e transcrição em processamento — caem no Resumo do lead.</div>
                  <Button size="sm" className="w-full" onClick={close}>Salvar e fechar</Button>
                </div>
              ) : (
                <Button size="sm" variant="destructive" className="w-full gap-2" onClick={end} disabled={phase === "connecting"}>
                  <PhoneOff className="h-4 w-4" /> Encerrar ligação
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}
