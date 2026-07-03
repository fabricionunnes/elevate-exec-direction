import { useCallback, useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";

export type DeviceStatus = "offline" | "connecting" | "ready" | "incoming" | "oncall";

export interface DialerCallInfo {
  from?: string;
  callSid?: string;
}

// Avisos de qualidade do Twilio traduzidos em ação pra atendente.
// "constant-audio-input-level" = o mic NÃO está captando → o cliente não ouve.
const WARNING_MESSAGES: Record<string, string> = {
  "constant-audio-input-level":
    "Seu microfone não está captando áudio — o cliente NÃO está te ouvindo. Verifique o headset e feche outras abas que usam o microfone (ex.: UNV Office).",
  "constant-audio-output-level": "Sem áudio do cliente — verifique seu fone/alto-falante.",
  "high-packet-loss": "Rede instável — o cliente pode estar te ouvindo picotado.",
  "high-packets-lost-fraction": "Rede instável — o cliente pode estar te ouvindo picotado.",
  "high-jitter": "Rede instável — o áudio pode chegar distorcido pro cliente.",
  "high-rtt": "Conexão lenta — o áudio está com atraso.",
  "low-mos": "Qualidade da chamada degradada — se possível, use internet cabeada.",
};

// Coordenação de microfone entre abas do mesmo navegador (UNV Office solta
// o mic enquanto a atendente está em ligação do discador).
const micChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("unv-mic-priority") : null;
function announceDialerCall(active: boolean) {
  try {
    micChannel?.postMessage({ type: active ? "dialer-call-start" : "dialer-call-end", ts: Date.now() });
  } catch { /* sem suporte */ }
}

/**
 * Softphone da atendente no navegador. Registra o Twilio Device e auto-aceita as
 * ligações que o discador conecta (modelo power dialer). Expõe estado + controles.
 */
export function useTwilioDevice(staffId: string | null) {
  const [status, setStatus] = useState<DeviceStatus>("offline");
  const [error, setError] = useState<string | null>(null);
  const [callInfo, setCallInfo] = useState<DialerCallInfo | null>(null);
  /** aviso de qualidade da ligação atual (mic mudo, rede ruim) — mostrar na UI */
  const [callWarning, setCallWarning] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  const goReady = useCallback(async () => {
    if (!staffId) {
      setError("Sem staff vinculado");
      return;
    }
    setError(null);
    setStatus("connecting");
    try {
      // 1) Permissão de microfone primeiro (sem isso o Device falha em silêncio)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (micErr: any) {
        throw new Error("Permita o acesso ao microfone para usar o discador.");
      }

      // 2) Token
      const { data, error: fnErr } = await supabase.functions.invoke("dialer-token", {
        body: { staffId },
      });
      if (fnErr || !data?.token) {
        throw new Error(data?.error || fnErr?.message || "Falha ao obter token do Twilio");
      }

      const device = new Device(data.token, {
        logLevel: 1,
        codecPreferences: ["opus", "pcmu"] as any,
      });

      device.on("registered", () => setStatus("ready"));
      device.on("unregistered", () => setStatus("offline"));
      device.on("error", (e: any) => {
        console.error("[dialer] device error:", e);
        const code = e?.code ? ` (código ${e.code})` : "";
        setError((e?.message || e?.description || "Erro no dispositivo de voz") + code);
      });
      device.on("incoming", (call: Call) => {
        callRef.current = call;
        setCallInfo({
          from: call.parameters?.From,
          callSid: call.parameters?.CallSid,
        });
        setStatus("incoming");
        const endCall = () => {
          setStatus("ready");
          setCallInfo(null);
          setCallWarning(null);
          callRef.current = null;
          announceDialerCall(false); // Office pode retomar o microfone
        };
        call.on("accept", () => {
          setStatus("oncall");
          announceDialerCall(true); // Office solta o microfone durante a ligação
        });
        call.on("disconnect", endCall);
        call.on("cancel", endCall);
        call.on("reject", endCall);
        // Qualidade em tempo real: mic sem captação = cliente não ouve a atendente
        call.on("warning", (name: string) => {
          console.warn("[dialer] quality warning:", name);
          setCallWarning(WARNING_MESSAGES[name] || `Qualidade da chamada degradada (${name}).`);
        });
        call.on("warning-cleared", () => setCallWarning(null));
        // Power dialer: aceita automaticamente
        call.accept();
      });

      await device.register();
      deviceRef.current = device;
    } catch (e: any) {
      console.error("[dialer] goReady error:", e, JSON.stringify(e, Object.getOwnPropertyNames(e || {})));
      let detail = e?.message || e?.description || (e?.code != null ? `código ${e.code}` : "");
      if (!detail) {
        try { detail = JSON.stringify(e, Object.getOwnPropertyNames(e || {})); } catch { detail = String(e); }
      }
      if (!detail || detail === "{}") detail = e?.name || e?.constructor?.name || "erro desconhecido";
      setError(`Falha ao conectar: ${detail}`);
      setStatus("offline");
    }
  }, [staffId]);

  const goOffline = useCallback(() => {
    try {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    } catch { /* noop */ }
    deviceRef.current = null;
    callRef.current = null;
    setCallInfo(null);
    setCallWarning(null);
    setStatus("offline");
    announceDialerCall(false);
  }, []);

  const hangup = useCallback(() => {
    try {
      callRef.current?.disconnect();
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    return () => {
      try {
        deviceRef.current?.destroy();
      } catch { /* noop */ }
    };
  }, []);

  return { status, error, callInfo, callWarning, goReady, goOffline, hangup };
}
