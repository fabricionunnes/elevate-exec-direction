import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, QrCode } from "lucide-react";
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

  const callEvolutionAPI = async (action: string, body?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    // Build URL with action query parameter
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=${action}`;
    
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

  const refreshQRCode = async () => {
    setLoading(true);
    try {
      const result = await callEvolutionAPI("connect", { 
        instanceName: instance.instance_name 
      });
      
      if (result?.base64) {
        setQrCode(result.base64);
        
        // Update in database
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code: result.base64, status: "connecting" })
          .eq("id", instance.id);
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
      const result = await callEvolutionAPI("status", { 
        instanceName: instance.instance_name 
      });
      
      if (result?.state === "open") {
        setConnected(true);
        
        // Update database
        await supabase
          .from("whatsapp_instances")
          .update({ 
            status: "connected", 
            phone_number: result?.phoneNumber || null,
            qr_code: null 
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
                  src={`data:image/png;base64,${qrCode}`} 
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
