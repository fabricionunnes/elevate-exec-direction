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
  apikey?: string;
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
      return null;
    }
  } catch {
    return "URL inválida. Use o formato https://sm-tucano.stevo.chat ou https://evo07.stevo.chat.";
  }
  return null;
};

const resolveStevoApiUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/g, "");
  try {
    const error = getApiUrlError(trimmed);
    return error ? { apiUrl: trimmed, error } : { apiUrl: trimmed };
  } catch {
    return { apiUrl: trimmed, error: "URL inválida. Use o formato https://sm-tucano.stevo.chat ou https://evo07.stevo.chat." };
  }
};

const formatStevoApiError = (payload: any, fallback = "Erro ao carregar instâncias do STEVO") => {
  const text = JSON.stringify(payload || {}).toLowerCase();
  if (payload?.status === 401 || text.includes("unauthorized")) {
    return "A STEVO recusou essa chave para esta URL. Confira se a URL é a mesma usada no Manager V2 e se a chave está correta.";
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
  const [mode, setMode] = useState<"evolution" | "manager_v2">("evolution");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [instances, setInstances] = useState<StevoInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  // Manager V2 manual fields
  const [mgrInstanceName, setMgrInstanceName] = useState("");
  const [mgrPhone, setMgrPhone] = useState("");

  useEffect(() => {
    if (open) {
      setMode("evolution");
      setInstances([]);
      setSelectedInstance(null);
      setDisplayName("");
      setError(null);
      setShowApiKey(false);
      setApiUrl("");
      setApiKey("");
      setMgrInstanceName("");
      setMgrPhone("");
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
        toast.info("URL ajustada automaticamente.");
      }

      localStorage.setItem("stevo_api_url", cleanApiUrl);

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
        apikey: inst.token || inst.apikey,
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

  const handleImportManagerV2 = async () => {
    if (!mgrInstanceName.trim() || !apiUrl.trim() || !apiKey.trim()) {
      toast.error("Informe Nome, URL (sm-*.stevo.chat) e API Key da instância");
      return;
    }
    const cleanApiUrl = apiUrl.trim().replace(/\/+$/g, "");
    try {
      const host = new URL(cleanApiUrl).hostname.toLowerCase();
      if (!/^sm[v0-9-]/.test(host) || !host.endsWith(".stevo.chat")) {
        toast.error("URL deve ser do tipo https://sm-tucano.stevo.chat (Manager V2)");
        return;
      }
    } catch {
      toast.error("URL inválida");
      return;
    }

    setImporting(true);
    try {
      // Configure webhook directly on Manager V2 (uses POST /instance/connect)
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;
      try {
        await supabase.functions.invoke("evolution-api", {
          body: {
            action: "set-webhook-custom",
            apiUrl: cleanApiUrl,
            apiKey: apiKey.trim(),
            instanceApiKey: apiKey.trim(),
            instanceName: mgrInstanceName.trim(),
            webhookUrl,
          },
        });
      } catch (e) {
        console.warn("Webhook config falhou (segue insert):", e);
      }

      const { error: insertError } = await supabase.from("whatsapp_instances").insert({
        instance_name: mgrInstanceName.trim(),
        display_name: (displayName.trim() || mgrInstanceName.trim()),
        phone_number: mgrPhone.trim() || null,
        status: "disconnected",
        is_default: false,
        project_id: projectId || null,
        api_url: cleanApiUrl,
        api_key: apiKey.trim(),
        provider_type: "manager_v2",
      } as any);

      if (insertError) throw insertError;

      toast.success(`Instância Manager V2 "${displayName || mgrInstanceName}" cadastrada!`);
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      console.error("Manager V2 import error:", err);
      toast.error(err.message || "Erro ao cadastrar instância Manager V2");
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (mode === "manager_v2") {
      return handleImportManagerV2();
    }
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
      
      const resolved = resolveStevoApiUrl(apiUrl);
      if (resolved.error) {
        toast.error(resolved.error);
        return;
      }

      const cleanApiUrl = resolved.apiUrl;
      if (cleanApiUrl !== apiUrl.trim().replace(/\/+$/g, "")) {
        setApiUrl(cleanApiUrl);
        toast.info("URL ajustada automaticamente.");
      }

      const { data: hookData, error: hookError } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "set-webhook-custom",
          apiUrl: cleanApiUrl,
          apiKey: apiKey.trim(),
          instanceApiKey: selectedInst.apikey,
          instanceName: selectedInstance,
          webhookUrl,
        },
      });

      if (hookError) throw new Error(await getInvokeErrorMessage(hookError));
      if (hookData?.error) throw new Error(formatStevoApiError(hookData, "Erro ao configurar webhook da instância"));

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
        api_key: selectedInst.apikey || apiKey.trim(),
        provider_type: "evolution",
      } as any);

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
            Escolha o tipo de servidor e cadastre suas instâncias do STEVO.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 px-1 pt-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "evolution" ? "default" : "outline"}
            onClick={() => { setMode("evolution"); setError(null); setInstances([]); setSelectedInstance(null); }}
          >
            Evolution API
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "manager_v2" ? "default" : "outline"}
            onClick={() => { setMode("manager_v2"); setError(null); setInstances([]); setSelectedInstance(null); }}
          >
            Manager V2
          </Button>
        </div>

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
                placeholder="https://sm-tucano.stevo.chat"
              />
              <p className="text-xs text-muted-foreground">
                Pode usar a URL do Manager V2 ou a URL do servidor Evolution.
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
            {mode === "evolution" && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadInstances}
                disabled={loading || !apiUrl.trim() || !apiKey.trim()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Buscar instâncias
              </Button>
            )}
          </div>

          {mode === "manager_v2" && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Manager V2 não permite listar instâncias automaticamente. Cadastre manualmente cada instância usando o nome técnico e a chave (apikey) da instância.
              </p>
              <div className="space-y-2">
                <Label htmlFor="mgr-instance-name">Nome técnico da instância</Label>
                <Input
                  id="mgr-instance-name"
                  value={mgrInstanceName}
                  onChange={(e) => setMgrInstanceName(e.target.value)}
                  placeholder="ex: comercial-unv"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgr-display-name">Nome de exibição</Label>
                <Input
                  id="mgr-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Comercial UNV"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mgr-phone">Telefone (opcional)</Label>
                <Input
                  id="mgr-phone"
                  value={mgrPhone}
                  onChange={(e) => setMgrPhone(e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
            </div>
          )}

          {mode === "evolution" && (loading ? (
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
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || loading || (mode === "evolution" ? !selectedInstance : (!mgrInstanceName.trim() || !apiUrl.trim() || !apiKey.trim()))}
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
