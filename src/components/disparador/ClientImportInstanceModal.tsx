import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, MessageCircle, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";

interface StevoInstance {
  instanceName: string;
  instanceId?: string;
  status?: string;
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string;
  number?: string;
}

interface ClientImportInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingInstanceNames?: string[];
  onImported: () => void;
}

export const ClientImportInstanceModal = ({
  open,
  onOpenChange,
  projectId,
  existingInstanceNames = [],
  onImported,
}: ClientImportInstanceModalProps) => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [instances, setInstances] = useState<StevoInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<{ api_url: string; api_key: string } | null>(null);

  useEffect(() => {
    if (open) {
      loadConfig();
    } else {
      setInstances([]);
      setSelectedInstance(null);
      setDisplayName("");
      setError(null);
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, get the client's Evolution API config
      const { data: configData, error: configError } = await supabase
        .from("client_evolution_config")
        .select("api_url, api_key")
        .eq("project_id", projectId)
        .maybeSingle();

      if (configError) throw configError;

      if (!configData) {
        setError("Configure sua Evolution API primeiro antes de importar instâncias.");
        setLoading(false);
        return;
      }

      setConfig(configData);
      await loadInstancesFromConfig(configData);
    } catch (err: any) {
      console.error("Error loading config:", err);
      setError(err.message || "Erro ao carregar configuração");
      setLoading(false);
    }
  };

  const loadInstancesFromConfig = async (cfg: { api_url: string; api_key: string }) => {
    try {
      const response = await fetch(`${cfg.api_url}/instance/fetchInstances`, {
        method: "GET",
        headers: {
          "apikey": cfg.api_key,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: Verifique suas credenciais`);
      }

      const rawInstances = await response.json();

      // Map Evolution API response to our interface
      const allInstances: StevoInstance[] = (Array.isArray(rawInstances) ? rawInstances : []).map((inst: any) => ({
        instanceName: inst.name || inst.instanceName,
        instanceId: inst.id,
        status: inst.connectionStatus || inst.status,
        owner: inst.ownerJid,
        profileName: inst.profileName,
        profilePictureUrl: inst.profilePicUrl,
        number: inst.number || (inst.ownerJid ? inst.ownerJid.split("@")[0] : null),
      }));

      // Filter out instances that are already imported
      const availableInstances = allInstances.filter(
        (inst) => !existingInstanceNames.includes(inst.instanceName)
      );

      setInstances(availableInstances);

      if (availableInstances.length === 0 && allInstances.length > 0) {
        setError("Todas as instâncias já foram importadas.");
      } else if (allInstances.length === 0) {
        setError("Nenhuma instância encontrada. Crie uma instância primeiro no Evolution Manager.");
      }
    } catch (err: any) {
      console.error("Error loading instances:", err);
      setError(err.message || "Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInstance = (instanceName: string) => {
    if (selectedInstance === instanceName) {
      setSelectedInstance(null);
      setDisplayName("");
    } else {
      setSelectedInstance(instanceName);
      setDisplayName(instanceName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    }
  };

  const handleImport = async () => {
    if (!selectedInstance || !config) {
      toast.error("Selecione uma instância para importar");
      return;
    }

    const selectedInst = instances.find((i) => i.instanceName === selectedInstance);
    if (!selectedInst) return;

    setImporting(true);
    try {
      // Configure webhook for this instance using client's own API
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;

      await fetch(`${config.api_url}/webhook/set/${selectedInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.api_key,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
          ],
        }),
      });

      // Determine status based on STEVO data
      let status = "disconnected";
      if (selectedInst.status === "open" || selectedInst.status === "connected") {
        status = "connected";
      }

      // Insert into local database
      const { error: insertError } = await supabase.from("whatsapp_instances").insert({
        instance_name: selectedInstance,
        display_name: displayName.trim() || selectedInstance,
        phone_number: selectedInst.number || null,
        status,
        is_default: false,
        project_id: projectId,
      });

      if (insertError) throw insertError;

      toast.success(`Instância "${displayName || selectedInstance}" importada com sucesso!`);
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      console.error("Error importing instance:", err);
      toast.error(err.message || "Erro ao importar instância");
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === "open" || status === "connected") {
      return <Badge className="bg-green-500 text-white">Conectado</Badge>;
    }
    return <Badge variant="destructive">Desconectado</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Importar Instância
          </DialogTitle>
          <DialogDescription>
            Selecione uma instância da sua Evolution API para importar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando instâncias...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
              {error.includes("Configure") ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Vá até a aba "Configuração" e insira suas credenciais da Evolution API.
                </p>
              ) : (
                <Button variant="outline" size="sm" onClick={loadConfig} className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Instâncias disponíveis</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {instances.map((instance) => (
                    <div
                      key={instance.instanceName}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedInstance === instance.instanceName
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => handleSelectInstance(instance.instanceName)}
                    >
                      <Checkbox
                        checked={selectedInstance === instance.instanceName}
                        onCheckedChange={() => handleSelectInstance(instance.instanceName)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{instance.instanceName}</p>
                        {instance.number && (
                          <p className="text-sm text-muted-foreground">{instance.number}</p>
                        )}
                        {instance.profileName && (
                          <p className="text-sm text-muted-foreground">{instance.profileName}</p>
                        )}
                      </div>
                      {getStatusBadge(instance.status)}
                    </div>
                  ))}
                </div>
              </div>

              {selectedInstance && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="displayName">Nome de exibição</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Comercial, Suporte..."
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedInstance || importing || loading}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              "Importar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
