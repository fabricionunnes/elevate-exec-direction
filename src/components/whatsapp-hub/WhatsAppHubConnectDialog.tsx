import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, QrCode, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StaffInstance } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  instance: StaffInstance | null;
  onInstanceUpdate: () => void;
}

export const WhatsAppHubConnectDialog = ({ open, onOpenChange, staffId, instance, onInstanceUpdate }: Props) => {
  const [instanceName, setInstanceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!instanceName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }

    setCreating(true);
    try {
      // Create on Stevo
      const cleanName = instanceName.trim().toLowerCase().replace(/\s+/g, "_");
      const { data: funcData, error: funcError } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "create-instance",
          instanceName: cleanName,
        },
      });

      if (funcError) throw funcError;

      // Save locally
      const { error: dbError } = await supabase
        .from("staff_whatsapp_instances")
        .insert({
          staff_id: staffId,
          instance_name: instanceName.trim().toLowerCase().replace(/\s+/g, "_"),
          display_name: instanceName.trim(),
          status: "disconnected",
        });

      if (dbError) throw dbError;

      // Log
      await supabase.from("staff_whatsapp_connection_logs").insert({
        instance_id: (await supabase.from("staff_whatsapp_instances").select("id").eq("staff_id", staffId).single()).data?.id || "",
        staff_id: staffId,
        event_type: "created",
        details: `Instância ${instanceName} criada`,
      });

      toast.success("Instância criada! Agora conecte via QR Code.");
      setInstanceName("");
      onInstanceUpdate();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar instância");
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = async () => {
    if (!instance) return;
    setConnecting(true);
    setQrCode(null);

    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "qr-code",
          instanceName: instance.instance_name,
        },
      });

      if (error) throw error;

      const qr = data?.qrcode?.base64 || data?.base64;
      if (qr) {
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
        await supabase
          .from("staff_whatsapp_instances")
          .update({ status: "connecting", qr_code: qr })
          .eq("id", instance.id);
        onInstanceUpdate();
      } else {
        toast.error("QR Code não disponível");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao obter QR Code");
    } finally {
      setConnecting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!instance) return;
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "status",
          instanceName: instance.instance_name,
        },
      });

      if (error) throw error;

      const status = data?.instance?.state === "open" ? "connected" : "disconnected";
      await supabase
        .from("staff_whatsapp_instances")
        .update({ status, qr_code: null })
        .eq("id", instance.id);

      if (status === "connected") {
        toast.success("WhatsApp conectado!");
        setQrCode(null);
      } else {
        toast.info("Ainda não conectado. Escaneie o QR Code.");
      }
      onInstanceUpdate();
    } catch (err: any) {
      toast.error("Erro ao verificar status");
    }
  };

  const handleDelete = async () => {
    if (!instance) return;
    if (!confirm("Tem certeza que deseja remover esta instância?")) return;

    try {
      await supabase.functions.invoke("evolution-api", {
        body: { action: "delete-instance", instance_name: instance.instance_name },
      });
    } catch (e) {
      // Continue even if API fails
    }

    await supabase.from("staff_whatsapp_instances").delete().eq("id", instance.id);
    toast.success("Instância removida");
    setQrCode(null);
    onInstanceUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Conectar WhatsApp
          </DialogTitle>
        </DialogHeader>

        {!instance ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Crie uma instância para conectar seu WhatsApp pessoal ao sistema.
            </p>
            <div className="space-y-2">
              <Label>Nome da instância</Label>
              <Input
                placeholder="Ex: meu-whatsapp"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full bg-green-500 hover:bg-green-600">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Instância
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">{instance.display_name || instance.instance_name}</p>
                {instance.phone_number && (
                  <p className="text-xs text-muted-foreground">{instance.phone_number}</p>
                )}
              </div>
              <Badge
                variant={instance.status === "connected" ? "default" : "secondary"}
                className={instance.status === "connected" ? "bg-green-500" : ""}
              >
                {instance.status === "connected" ? (
                  <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                ) : instance.status === "connecting" ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Aguardando</>
                ) : (
                  <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                )}
              </Badge>
            </div>

            {qrCode && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Escaneie o QR Code com seu WhatsApp:</p>
                <img src={qrCode} alt="QR Code" className="mx-auto w-48 h-48 rounded-lg border" />
                <Button variant="outline" size="sm" onClick={handleCheckStatus}>
                  Verificar conexão
                </Button>
              </div>
            )}

            {!qrCode && instance.status !== "connected" && (
              <Button onClick={handleConnect} disabled={connecting} className="w-full bg-green-500 hover:bg-green-600">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Gerar QR Code
              </Button>
            )}

            {instance.status === "connected" && (
              <p className="text-sm text-center text-green-600 font-medium">
                ✓ Seu WhatsApp está conectado e pronto para uso!
              </p>
            )}

            <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Remover Instância
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
