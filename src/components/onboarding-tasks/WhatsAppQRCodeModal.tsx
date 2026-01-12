import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, QrCode, LogOut, RotateCcw, AlertTriangle, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  phone_number: string | null;
  qr_code: string | null;
}

interface WhatsAppQRCodeModalProps {
  instance: WhatsAppInstance;
  onClose: () => void;
  onConnected: () => void;
}

interface DiagnosticInfo {
  source: string | null;
  connectionState: string | null;
  count: number | null;
  attempts: number;
}

// Polling intervals with backoff (in ms)
const POLLING_INTERVALS = [2000, 3000, 4000, 5000, 6000, 7000, 8000];
const MAX_POLLING_ATTEMPTS = 15;
const STATUS_CHECK_INTERVAL = 5000;
const STUCK_THRESHOLD = 6; // After this many attempts with count=0, show recovery options

export const WhatsAppQRCodeModal = ({ 
  instance, 
  onClose, 
  onConnected 
}: WhatsAppQRCodeModalProps) => {
  const [qrCode, setQrCode] = useState<string | null>(instance.qr_code);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo>({
    source: null,
    connectionState: null,
    count: null,
    attempts: 0,
  });
  
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  // Start status checking on mount
  useEffect(() => {
    statusIntervalRef.current = setInterval(() => {
      if (!connected) checkStatus();
    }, STATUS_CHECK_INTERVAL);

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [instance.instance_name, connected]);

  // Auto-start QR refresh on mount if no QR code
  useEffect(() => {
    if (!qrCode && !loading && !isPolling) {
      startQrPolling();
    }
  }, []);

  const callEvolutionAPI = async (
    action: string,
    body?: any,
    queryParams?: Record<string, string>
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const params = new URLSearchParams({ action, ...queryParams });
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?${params.toString()}`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body || {}),
    });

    const data = await response.json().catch(() => ({ error: 'Resposta inválida' }));

    if (!response.ok) {
      // Extract detailed error message
      const errorMsg = 
        data?.error || 
        data?.response?.message?.join(', ') || 
        data?.details?.error ||
        `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  };

  const extractQrBase64 = (result: any): string | null => {
    const raw =
      result?.base64 ??
      result?.qrcode?.base64 ??
      result?.qrCode?.base64 ??
      result?.qr?.base64 ??
      result?.qrcode?.qr ??
      result?.qrcode?.image ??
      result?.qr?.image ??
      result?.qrCode ??
      result?.qr ??
      result?.qrcode ??
      result?.qr_code ??
      null;

    if (!raw || typeof raw !== "string") return null;
    return raw.replace(/^data:image\/(png|jpeg);base64,/, "");
  };

  const extractQrText = (result: any): string | null => {
    const raw =
      result?.code ??
      result?.qrcode?.code ??
      result?.qrCode?.code ??
      result?.qr?.code ??
      null;
    return typeof raw === "string" && raw.trim() ? raw : null;
  };

  const extractPairingCode = (result: any): string | null => {
    const raw = result?.pairingCode ?? result?.pairing_code ?? null;
    return typeof raw === "string" && raw.trim() ? raw : null;
  };

  const extractInstance = (result: any) => result?.instance ?? result;

  const buildQrDataUrl = async (result: any): Promise<string | null> => {
    const base64 = extractQrBase64(result);
    if (base64) return `data:image/png;base64,${base64}`;

    const code = extractQrText(result);
    if (code) {
      return await QRCode.toDataURL(code, { margin: 1, width: 256 });
    }

    return null;
  };

  const fetchQrCode = useCallback(async (): Promise<{ success: boolean; qrReady: boolean; staleInstance?: boolean }> => {
    try {
      const phone = (instance.phone_number || "").trim().replace(/\D/g, "");

      // Require full country code digits (ex: 5511999999999)
      if (!phone || phone.length < 12) {
        toast.error("Número inválido para gerar QR. Salve com DDI (ex: 5511999999999) e recrie a instância.");
        return { success: false, qrReady: false };
      }

      const result = await callEvolutionAPI(
        "connect",
        { instanceName: instance.instance_name },
        { number: phone }
      );

      console.log("[QR Modal] Connect result:", result);

      // Check for errors - specifically if instance doesn't exist in Evolution API
      if (result?.error) {
        // Check if this is a "not found" error
        const errorMsg = result.error?.toLowerCase() || '';
        if (errorMsg.includes('não encontrada') || errorMsg.includes('not found')) {
          // Instance exists in DB but not in Evolution API - clean up
          console.log("[QR Modal] Instance not found in Evolution API, cleaning up DB record");
          toast.error("Instância não existe na Evolution API. Removendo registro...");
          
          // Delete from database
          await supabase
            .from("whatsapp_instances")
            .delete()
            .eq("id", instance.id);
          
          return { success: false, qrReady: false, staleInstance: true };
        }
        
        toast.error(result.error);
        return { success: false, qrReady: false };
      }

      // Extract diagnostic info
      const qrCount = result?.qrcode?.count ?? result?.count ?? null;
      const source = result?._source ?? null;
      const connState = result?._connectionState?.state ?? null;

      setDiagnostic(prev => ({
        source,
        connectionState: connState,
        count: qrCount,
        attempts: prev.attempts + 1,
      }));
      
      const pairing = extractPairingCode(result);
      const dataUrl = await buildQrDataUrl(result);

      if (dataUrl) {
        setQrCode(dataUrl);
        setPairingCode(pairing);

        // Update in database
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code: dataUrl, status: "connecting" })
          .eq("id", instance.id);

        return { success: true, qrReady: true };
      }

      if (pairing) {
        setPairingCode(pairing);
        toast.info(`Código de pareamento: ${pairing}`);
        return { success: true, qrReady: true };
      }

      // QR not ready yet
      if (qrCount === 0) {
        console.log("[QR Modal] QR not ready yet (count: 0)");

        // Keep DB in a "connecting" state so the admin can use Logout/Restart on the list
        await supabase
          .from("whatsapp_instances")
          .update({ status: "connecting", qr_code: null })
          .eq("id", instance.id);
      }

      return { success: true, qrReady: false };
    } catch (error: any) {
      console.error("[QR Modal] Error fetching QR:", error);
      
      // Check if this is a stale instance error
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('não encontrada') || errorMsg.includes('not found')) {
        console.log("[QR Modal] Instance not found, cleaning up...");
        toast.error("Instância não existe. Removendo registro obsoleto...");
        
        await supabase
          .from("whatsapp_instances")
          .delete()
          .eq("id", instance.id);
        
        return { success: false, qrReady: false, staleInstance: true };
      }
      
      toast.error(error.message || "Erro ao buscar QR Code");
      return { success: false, qrReady: false };
    }
  }, [instance]);

  const startQrPolling = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setIsPolling(true);
    setPollingAttempt(0);
    setLoading(true);
    setDiagnostic(prev => ({ ...prev, attempts: 0 }));

    const poll = async (attempt: number) => {
      if (!mountedRef.current || connected) {
        setIsPolling(false);
        setLoading(false);
        return;
      }

      if (attempt >= MAX_POLLING_ATTEMPTS) {
        setIsPolling(false);
        setLoading(false);
        toast.error("QR Code não foi gerado. Tente Logout/Restart ou recrie a instância.");
        return;
      }

      setPollingAttempt(attempt);
      const { qrReady, staleInstance } = await fetchQrCode();

      // If instance was stale, close modal and trigger refresh
      if (staleInstance) {
        setIsPolling(false);
        setLoading(false);
        toast.info("Registro removido. Crie uma nova instância.");
        onClose();
        return;
      }

      if (qrReady) {
        setIsPolling(false);
        setLoading(false);
        return;
      }

      // Schedule next attempt with backoff
      const interval = POLLING_INTERVALS[Math.min(attempt, POLLING_INTERVALS.length - 1)];
      pollingTimeoutRef.current = setTimeout(() => poll(attempt + 1), interval);
    };

    await poll(0);
  }, [fetchQrCode, connected, onClose]);

  const refreshQRCode = async () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    startQrPolling();
  };

  const handleLogout = async () => {
    setActionLoading("logout");
    try {
      await callEvolutionAPI("logout", { instanceName: instance.instance_name });
      
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);
      
      toast.success("Logout realizado. Tentando gerar novo QR...");
      setQrCode(null);
      setPairingCode(null);
      setDiagnostic({ source: null, connectionState: null, count: null, attempts: 0 });
      
      // Wait a bit then start polling again
      setTimeout(() => refreshQRCode(), 2000);
    } catch (error: any) {
      console.error("Error logging out:", error);
      toast.error(error.message || "Erro ao fazer logout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading("restart");
    try {
      await callEvolutionAPI("restart", { instanceName: instance.instance_name });
      
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);
      
      toast.success("Instância reiniciada. Aguarde e tentando gerar novo QR...");
      setQrCode(null);
      setPairingCode(null);
      setDiagnostic({ source: null, connectionState: null, count: null, attempts: 0 });
      
      // Wait longer for restart then start polling
      setTimeout(() => refreshQRCode(), 5000);
    } catch (error: any) {
      console.error("Error restarting:", error);
      toast.error(error.message || "Erro ao reiniciar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecreate = async () => {
    setActionLoading("recreate");

    try {
      const phone = (instance.phone_number || "").trim().replace(/\D/g, "");
      if (!phone || phone.length < 12) {
        toast.error("Número inválido. Salve com DDI (ex: 5511999999999) e recrie a instância.");
        return;
      }

      // Try deleting in Evolution (ignore 'not found')
      try {
        await callEvolutionAPI("delete-instance", { instanceName: instance.instance_name });
      } catch (e) {
        console.log("[QR Modal] delete-instance ignored:", e);
      }

      // Recreate in Evolution with a fresh token
      await callEvolutionAPI("create-instance", {
        instanceName: instance.instance_name,
        token: `token_${instance.instance_name}_${Date.now()}`,
        number: phone,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      });

      // Reset DB state
      await supabase
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);

      toast.success("Instância recriada. Gerando novo QR...");
      setQrCode(null);
      setPairingCode(null);
      setDiagnostic({ source: null, connectionState: null, count: null, attempts: 0 });

      // Give Evolution a moment to boot then poll
      setTimeout(() => refreshQRCode(), 3000);
    } catch (error: any) {
      console.error("[QR Modal] Error recreating:", error);
      toast.error(error.message || "Erro ao recriar instância");
    } finally {
      setActionLoading(null);
    }
  };

  const checkStatus = async () => {
    if (connected || !mountedRef.current) return;

    setChecking(true);
    try {
      const result = await callEvolutionAPI("status", {}, {
        instanceName: instance.instance_name,
      });

      const inst = extractInstance(result);
      const state = inst?.state;

      // Update diagnostic
      setDiagnostic(prev => ({ ...prev, connectionState: state }));

      if (state === "open") {
        setConnected(true);

        // Stop polling
        if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
        setIsPolling(false);

        // Update database
        await supabase
          .from("whatsapp_instances")
          .update({
            status: "connected",
            phone_number: inst?.phoneNumber || null,
            qr_code: null,
          })
          .eq("id", instance.id);

        toast.success("WhatsApp conectado com sucesso!");

        setTimeout(() => {
          onConnected();
        }, 1500);
      }
    } catch (error) {
      // Silent fail for status checks
      console.log("[QR Modal] Status check error:", error);
    } finally {
      setChecking(false);
    }
  };

  const getPollingStatus = () => {
    if (!isPolling) return null;
    return `Tentativa ${pollingAttempt + 1}/${MAX_POLLING_ATTEMPTS}...`;
  };

  const isStuck = diagnostic.attempts >= STUCK_THRESHOLD && diagnostic.count === 0 && !qrCode;

  const getDiagnosticMessage = () => {
    if (!diagnostic.source && !diagnostic.connectionState) return null;
    
    const parts: string[] = [];
    if (diagnostic.source) parts.push(`Fonte: ${diagnostic.source}`);
    if (diagnostic.connectionState) parts.push(`Estado: ${diagnostic.connectionState}`);
    if (diagnostic.count !== null) parts.push(`Count: ${diagnostic.count}`);
    
    return parts.join(' | ');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-green-500" />
            Conectar {instance.display_name}
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com seu WhatsApp para conectar
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {connected ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="text-lg font-medium text-green-600">Conectado!</p>
            </div>
          ) : qrCode ? (
            <>
              <div className="border-4 border-green-500 rounded-lg p-2 bg-white">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>

              {pairingCode && (
                <div className="bg-muted p-3 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">Código de Pareamento:</p>
                  <p className="text-lg font-mono font-bold">{pairingCode}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando conexão...
                  </>
                ) : (
                  <>
                    Aguardando leitura do QR Code...
                  </>
                )}
              </div>
              
              <Button 
                variant="outline" 
                onClick={refreshQRCode} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar QR Code
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 w-full">
              {isStuck ? (
                <>
                  <AlertTriangle className="h-12 w-12 text-amber-500" />
                  <p className="text-amber-600 font-medium text-center">
                    QR Code não gerado após {diagnostic.attempts} tentativas
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    A sessão pode estar travada. Tente as ações abaixo:
                  </p>
                  
                  {getDiagnosticMessage() && (
                    <Alert className="mt-2">
                      <AlertDescription className="text-xs font-mono">
                        {getDiagnosticMessage()}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <Button
                      variant="outline"
                      onClick={handleLogout}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === "logout" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      Logout e Reconectar
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={handleRestart}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === "restart" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Reiniciar Instância
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={handleRecreate}
                      disabled={!!actionLoading}
                      className="gap-2"
                    >
                      {actionLoading === "recreate" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Excluir e Recriar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {isPolling ? "Gerando QR Code..." : "Aguardando..."}
                  </p>
                  {getPollingStatus() && (
                    <p className="text-xs text-muted-foreground">{getPollingStatus()}</p>
                  )}
                  
                  {getDiagnosticMessage() && diagnostic.attempts > 2 && (
                    <Alert className="mt-2">
                      <AlertDescription className="text-xs font-mono">
                        {getDiagnosticMessage()}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {!isPolling && (
                    <Button onClick={refreshQRCode} disabled={loading}>
                      Tentar novamente
                    </Button>
                  )}
                  
                  {isPolling && diagnostic.attempts > 3 && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        disabled={!!actionLoading}
                        className="gap-1 text-xs"
                      >
                        {actionLoading === "logout" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <LogOut className="h-3 w-3" />
                        )}
                        Logout
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRestart}
                        disabled={!!actionLoading}
                        className="gap-1 text-xs"
                      >
                        {actionLoading === "restart" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Restart
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>1. Abra o WhatsApp no seu celular</p>
          <p>2. Toque em Menu (⋮) ou Configurações</p>
          <p>3. Toque em "Aparelhos conectados"</p>
          <p>4. Escaneie este QR Code</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
