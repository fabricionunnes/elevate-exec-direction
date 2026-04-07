import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings2, Send, Wifi, WifiOff } from "lucide-react";
import type { StaffInstance } from "@/pages/onboarding-tasks/WhatsAppHubPage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  instances: StaffInstance[];
  onInstanceUpdate: () => void;
}

export const WhatsAppHubConnectDialog = ({ open, onOpenChange, instances, onInstanceUpdate }: Props) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Instâncias STEVO liberadas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O Hub agora reutiliza as conexões STEVO já cadastradas no sistema e respeita as permissões por usuário.
          </p>

          {instances.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Nenhuma instância foi liberada para este usuário ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {instances.map((instance) => (
                <div key={instance.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{instance.display_name || instance.instance_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{instance.phone_number || instance.instance_name}</p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Badge variant={instance.status === "connected" ? "default" : "secondary"}>
                        {instance.status === "connected" ? (
                          <><Wifi className="h-3 w-3 mr-1" /> Conectada</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" /> {instance.status || "Desconectada"}</>
                        )}
                      </Badge>
                      <Badge variant="outline">Pode ver</Badge>
                      {instance.can_send && <Badge variant="outline"><Send className="h-3 w-3 mr-1" /> Pode enviar</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onInstanceUpdate}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate("/onboarding-tasks/whatsapp");
              }}
            >
              <Settings2 className="h-4 w-4 mr-2" /> Gerenciar instâncias
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
