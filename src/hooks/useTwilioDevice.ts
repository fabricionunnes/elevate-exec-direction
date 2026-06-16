import { useCallback, useEffect, useRef, useState } from "react";
import { Device, type Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";

export type DeviceStatus = "offline" | "connecting" | "ready" | "incoming" | "oncall";

export interface DialerCallInfo {
  from?: string;
  callSid?: string;
}

/**
 * Softphone da atendente no navegador. Registra o Twilio Device e auto-aceita as
 * ligações que o discador conecta (modelo power dialer). Expõe estado + controles.
 */
export function useTwilioDevice(staffId: string | null) {
  const [status, setStatus] = useState<DeviceStatus>("offline");
  const [error, setError] = useState<string | null>(null);
  const [callInfo, setCallInfo] = useState<DialerCallInfo | null>(null);
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
      device.on("error", (e: any) => setError(e?.message || "Erro no dispositivo de voz"));
      device.on("incoming", (call: Call) => {
        callRef.current = call;
        setCallInfo({
          from: call.parameters?.From,
          callSid: call.parameters?.CallSid,
        });
        setStatus("incoming");
        call.on("accept", () => setStatus("oncall"));
        call.on("disconnect", () => {
          setStatus("ready");
          setCallInfo(null);
          callRef.current = null;
        });
        call.on("cancel", () => {
          setStatus("ready");
          setCallInfo(null);
          callRef.current = null;
        });
        call.on("reject", () => {
          setStatus("ready");
          setCallInfo(null);
          callRef.current = null;
        });
        // Power dialer: aceita automaticamente
        call.accept();
      });

      await device.register();
      deviceRef.current = device;
    } catch (e: any) {
      setError(e?.message || String(e));
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
    setStatus("offline");
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

  return { status, error, callInfo, goReady, goOffline, hangup };
}
