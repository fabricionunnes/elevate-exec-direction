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
import { Loader2, RefreshCw, MessageCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
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

interface ImportFromStevoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingInstanceNames?: string[];
  onImported: () => void;
  projectId?: string; // Optional: for client mode, instances will be linked to this project
}

const getApiUrlError = (value: string) => {
  try {
    const hostname = new URL(value.trim().replace(/\/+$/g, "")).hostname.toLowerCase();
    if (hostname.startsWith("sm-") && hostname.endsWith(".stevo.chat")) {
      return "Você informou a URL do Manager V2. Use a URL da API/Servidor da Evolution, normalmente no formato https://evo07.stevo.chat.";
    }
  } catch {
    return "URL inválida. Use o formato https://evo07.stevo.chat.";
  }
  return null;
};

const KNOWN_STEVO_MANAGER_SERVERS: Record<string, string> = {
  "sm-tucano.stevo.chat": "https://evo07.stevo.chat",
};

const resolveStevoApiUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/g, "");
  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    const knownServer = KNOWN_STEVO_MANAGER_SERVERS[hostname];
    if (knownServer) {
      return {
        apiUrl: knownServer,
        warning: `A URL do Manager V2 foi ajustada automaticamente para ${knownServer}.`,
      };
    }
    const error = getApiUrlError(trimmed);
    return error ? { apiUrl: trimmed, error } : { apiUrl: trimmed };
  } catch {
    return { apiUrl: trimmed, error: "URL inválida. Use o formato https://evo07.stevo.chat." };
  }
};

const formatStevoApiError = (payload: any, fallback = "Erro ao carregar instâncias do STEVO") => {
  const text = JSON.stringify(payload || {}).toLowerCase();
  if (payload?.status === 401 || text.includes("unauthorized")) {
    return "A API da STEVO recusou essa API Key. Use a chave da instância/servidor Evolution (normalmente UUID), não a chave do Manager V2.";
  }
  if (payload?.error?.includes?.("Manager V2") || text.includes("manager v2")) {
    return "Você informou a URL do Manager V2. Para sm-tucano, use https://evo07.stevo.chat como URL da API.";
  }
  return payload?.details?.response?.message || payload?.details?.message || payload?.message || payload?.error || fallback;
};

const getInvokeErrorMessage = async (fnError: any) => {
  try {
    if (fnError?.context && typeof fnError.context.json === "function") {
      return formatStevoApiError(await fnError.context.json(), fnError.message);
    }
  } catch {
    // Fall back to the SDK message below.
  }
  return fnError?.message || "Erro ao chamar a integração do STEVO";
};

export const ImportFromStevoModal = ({
  open,
  onOpenChange,
  existingInstanceNames = [],
  onImported,
  projectId,
}: ImportFromStevoModalProps) => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [instances, setInstances] = useState<StevoInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset everything when opening — user must input credentials and click "Buscar"
      setInstances([]);
      setSelectedInstance(null);
      setDisplayName("");
      setError(null);
      setShowApiKey(false);
      setApiUrl("");
      setApiKey("");
    }
  }, [open]);

  const loadInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!apiUrl.trim() || !apiKey.trim()) {
        setError("Informe a URL da API e a API Key para buscar suas instâncias.");
        setInstances([]);
        return;
      }

      const resolved = resolveStevoApiUrl(apiUrl);
      if (resolved.error) {
        setError(resolved.error);
        setInstances([]);
        return;
      }

      const cleanApiUrl = resolved.apiUrl;
      if (cleanApiUrl !== apiUrl.trim().replace(/\/+$/g, "")) {
        setApiUrl(cleanApiUrl);
        toast.info(resolved.warning || "URL da API ajustada automaticamente.");
      }

      localStorage.setItem("stevo_api_url", cleanApiUrl);
      localStorage.setItem("stevo_api_key", apiKey.trim());

      const { data, error: fnError } = await supabase.functions.invoke("evolution-api", {
        body: { action: "list-instances-custom", apiUrl: cleanApiUrl, apiKey: apiKey.trim() },
      });

      if (fnError) throw new Error(await getInvokeErrorMessage(fnError));
      if (data?.error) throw new Error(formatStevoApiError(data));

      // The API returns { instances: [...] } for custom listing
      let rawInstances = data?.instances || data || [];
      if (!Array.isArray(rawInstances)) rawInstances = [];

      // Map Evolution API response to our interface
      const allInstances: StevoInstance[] = rawInstances.map((inst: any) => ({
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
        setError("Todas as instâncias do STEVO já foram importadas.");
      } else if (allInstances.length === 0) {
        setError("Nenhuma instância encontrada no STEVO. Crie uma instância primeiro no Evolution Manager.");
      }
    } catch (err: any) {
      console.error("Error loading instances:", err);
      
      setError(err.message || "Erro ao carregar instâncias do STEVO");
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
      // Pre-fill display name with a friendly version
      setDisplayName(instanceName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    }
  };

  const handleImport = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância para importar");
      return;
    }

    if (!apiUrl.trim() || !apiKey.trim()) {
      toast.error("Informe a URL da API e a API Key");
      return;
    }

    const selectedInst = instances.find((i) => i.instanceName === selectedInstance);
    if (!selectedInst) return;

    setImporting(true);
    try {
      // First, configure webhook for this instance
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;
      
      const cleanApiUrl = apiUrl.trim().replace(/\/+$/g, "");
      const urlError = getApiUrlError(cleanApiUrl);
      if (urlError) {
        toast.error(urlError);
        return;
      }

      const { data: hookData, error: hookError } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "set-webhook-custom",
          apiUrl: cleanApiUrl,
          apiKey: apiKey.trim(),
          instanceName: selectedInstance,
          webhookUrl,
        },
      });

      if (hookError) throw hookError;
      if (hookData?.error) throw new Error(hookData.error);

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
        project_id: projectId || null, // Link to project if provided (client mode)
        api_url: cleanApiUrl,
        api_key: apiKey.trim(),
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
            Importar do STEVO
          </DialogTitle>
          <DialogDescription>
            Selecione uma instância existente no Evolution Manager para importar ao sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* API config */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="stevo-api-url">URL da API</Label>
              <Input
                id="stevo-api-url"
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://evo07.stevo.chat"
              />
              <p className="text-xs text-muted-foreground">
                Use a URL da API/Servidor Evolution. Não use o link do Manager V2 que começa com sm-.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stevo-api-key">API Key</Label>
              <div className="relative">
                <Input
                  id="stevo-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole sua API Key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey((v) => !v)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInstances}
              disabled={loading || !apiUrl.trim() || !apiKey.trim()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Buscar instâncias
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando instâncias...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={loadInstances} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
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
                  <p className="text-xs text-muted-foreground">
                    Este nome será exibido no sistema. O nome técnico "{selectedInstance}" será mantido internamente.
                  </p>
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
