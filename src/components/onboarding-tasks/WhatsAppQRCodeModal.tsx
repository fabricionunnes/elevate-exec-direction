import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, QrCode } from "lucide-react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  display_name: string;
  qr_code: string | null;
}

interface WhatsAppQRCodeModalProps {
  instance: WhatsAppInstance;
  onClose: () => void;
  onConnected: () => void;
}

export const WhatsAppQRCodeModal = ({ 
  instance, 
  onClose, 
  onConnected 
}: WhatsAppQRCodeModalProps) => {
  const [qrCode, setQrCode] = useState<string | null>(instance.qr_code);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Check status every 5 seconds
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [instance.instance_name]);

  const callEvolutionAPI = async (
    action: string,
    body?: any,
    queryParams?: Record<string, string>
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    // Build URL with action and additional query parameters
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const extractQrBase64 = (result: any): string | null => {
    const raw =
      result?.base64 ??
      result?.qrcode?.base64 ??
      result?.qrCode?.base64 ??
      result?.qr?.base64 ??
      result?.qrcode ??
      result?.qr_code ??
      null;

    if (!raw || typeof raw !== "string") return null;
    return raw.replace(/^data:image\/(png|jpeg);base64,/, "");
  };

  const extractQrText = (result: any): string | null => {
    const raw = result?.code ?? result?.qrcode?.code ?? result?.qrCode ?? null;
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
      // Evolution v2 normalmente devolve um "code" (texto) que deve ser convertido em QR.
      return await QRCode.toDataURL(code, { margin: 1, width: 256 });
    }

    return null;
  };
  const refreshQRCode = async () => {
    setLoading(true);
    try {
      const result = await callEvolutionAPI("connect", {
        instanceName: instance.instance_name,
      });

      const pairingCode = extractPairingCode(result);
      const dataUrl = await buildQrDataUrl(result);

      if (dataUrl) {
        setQrCode(dataUrl);

        // Update in database (salva o dataURL, mais robusto que base64 puro)
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code: dataUrl, status: "connecting" })
          .eq("id", instance.id);

        return;
      }

      if (pairingCode) {
        toast.error(`Código de pareamento: ${pairingCode}`);
      } else {
        toast.error("QR Code ainda não disponível. Tente novamente em alguns segundos.");
      }
    } catch (error: any) {
      console.error("Error refreshing QR:", error);
      toast.error(error.message || "Erro ao atualizar QR Code");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (connected) return;

    setChecking(true);
    try {
      const result = await callEvolutionAPI("status", {}, {
        instanceName: instance.instance_name,
      });

      const inst = extractInstance(result);
      const state = inst?.state;

      if (state === "open") {
        setConnected(true);

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
      console.log("Status check:", error);
    } finally {
      setChecking(false);
    }
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
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Gerando QR Code...</p>
              <Button onClick={refreshQRCode} disabled={loading}>
                Gerar QR Code
              </Button>
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
