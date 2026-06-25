import { useCallback, useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";

export type MonitorMode = "listen" | "whisper" | "barge";
export type MonitorStatus = "off" | "connecting" | "active" | "error";

/**
 * Softphone do GESTOR pra monitoria ao vivo do discador.
 * - escutar: ouve a ligação sem ninguém saber
 * - sussurrar: fala só pra SDR (cliente não ouve)
 * - entrar: entra na conversa (cliente ouve também)
 * O Device fica registrado como manager-{staffId}; quando o gestor escolhe um modo,
 * a edge dialer-monitor liga no browser dele e ele entra na conferência da SDR.
 */
export function useDialerMonitor(managerStaffId: string | null) {
  const [status, setStatus] = useState<MonitorStatus>("off");
  const [mode, setMode] = useState<MonitorMode | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const managerCallSidRef = useRef<string | null>(null);
  const readyRef = useRef(false);

  const ensureDevice = useCallback(async () => {
    if (readyRef.current && deviceRef.current) return;
    // microfone (necessário pra sussurrar/entrar)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    const { data, error: fnErr } = await supabase.functions.invoke("dialer-token", {
      body: { identity: `manager-${managerStaffId}` },
    });
    if (fnErr || !data?.token) throw new Error(data?.error || fnErr?.message || "Falha ao obter token");
    const device = new Device(data.token, { logLevel: 1, codecPreferences: ["opus", "pcmu"] as any });
    device.on("incoming", (call: Call) => {
      callRef.current = call;
      call.on("disconnect", () => {
        callRef.current = null;
        setStatus("off");
        setMode(null);
        setAgentId(null);
      });
      call.accept();
      setStatus("active");
    });
    device.on("error", (e: any) => setError(e?.message || "Erro no dispositivo de voz"));
    await device.register();
    deviceRef.current = device;
    readyRef.current = true;
  }, [managerStaffId]);

  // Começa a monitorar uma SDR no modo escolhido
  const start = useCallback(async (agentStaffId: string, m: MonitorMode) => {
    if (!managerStaffId) { setError("Sem gestor vinculado"); return; }
    setError(null);
    setStatus("connecting");
    try {
      await ensureDevice();
      const { data, error: fnErr } = await supabase.functions.invoke("dialer-monitor", {
        body: { action: "join", agentStaffId, managerStaffId, mode: m },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Falha ao entrar na ligação");
      managerCallSidRef.current = data?.managerCallSid || null;
      setAgentId(agentStaffId);
      setMode(m);
      // status vira "active" no evento accept; deixa connecting até lá
    } catch (e: any) {
      setError(e?.message || String(e));
      setStatus("error");
    }
  }, [managerStaffId, ensureDevice]);

  // Troca o modo sem sair da ligação
  const changeMode = useCallback(async (m: MonitorMode) => {
    if (!managerStaffId || !agentId || !managerCallSidRef.current) return;
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("dialer-monitor", {
        body: { action: "update", agentStaffId: agentId, managerStaffId, mode: m, managerCallSid: managerCallSidRef.current },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message || "Falha ao trocar o modo");
      setMode(m);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [managerStaffId, agentId]);

  const stop = useCallback(() => {
    try { callRef.current?.disconnect(); } catch { /* noop */ }
    callRef.current = null;
    managerCallSidRef.current = null;
    setStatus("off");
    setMode(null);
    setAgentId(null);
  }, []);

  useEffect(() => () => {
    try { callRef.current?.disconnect(); deviceRef.current?.destroy(); } catch { /* noop */ }
  }, []);

  return { status, mode, agentId, error, start, changeMode, stop };
}
