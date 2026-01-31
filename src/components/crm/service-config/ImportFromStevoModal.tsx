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
import { Loader2, RefreshCw, MessageCircle, AlertCircle, Eye, EyeOff, Search } from "lucide-react";
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
  
  // Custom credentials for searching different Evolution APIs
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [useDefaultApi, setUseDefaultApi] = useState(true);

  useEffect(() => {
    if (open) {
      // Load default instances on open
      loadDefaultInstances();
    } else {
      setInstances([]);
      setSelectedInstance(null);
      setDisplayName("");
      setError(null);
      setCustomApiUrl("");
      setCustomApiKey("");
      setHasSearched(false);
      setUseDefaultApi(true);
    }
  }, [open]);

  const loadDefaultInstances = async () => {
    setLoading(true);
    setError(null);
    setUseDefaultApi(true);
    setHasSearched(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke("evolution-api", {
        body: { action: "list-instances" },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // The API returns instances directly in data.instances or as the array itself
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
        setError("Nenhuma instância encontrada no STEVO padrão.");
      }
    } catch (err: any) {
      console.error("Error loading instances:", err);
      setError(err.message || "Erro ao carregar instâncias do STEVO");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCustomApi = async () => {
    if (!customApiUrl.trim() || !customApiKey.trim()) {
      toast.error("Preencha a URL e API Key para buscar");
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);
    setUseDefaultApi(false);

    try {
      const apiUrl = customApiUrl.trim().replace(/\/$/, "");
      const fetchUrl = `${apiUrl}/instance/fetchInstances`;
      
      console.log("Tentando buscar instâncias de:", fetchUrl);
      
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          "apikey": customApiKey.trim(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error("Erro na resposta:", response.status, errorText);
        
        if (response.status === 404) {
          throw new Error(`Endpoint não encontrado (404). Verifique se a URL está correta: ${apiUrl}`);
        } else if (response.status === 401 || response.status === 403) {
          throw new Error(`Credenciais inválidas (${response.status}). Verifique sua API Key.`);
        } else {
          throw new Error(`Erro ${response.status}: ${errorText || "Verifique suas credenciais"}`);
        }
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
        setError("Nenhuma instância encontrada nesta API.");
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
      // Pre-fill display name with a friendly version
      setDisplayName(instanceName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    }
  };

  const handleImport = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma instância para importar");
      return;
    }

    const selectedInst = instances.find((i) => i.instanceName === selectedInstance);
    if (!selectedInst) return;

    setImporting(true);
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;
      
      // If using custom API, set webhook directly
      if (!useDefaultApi && customApiUrl && customApiKey) {
        await fetch(`${customApiUrl.trim().replace(/\/$/, "")}/webhook/set/${selectedInstance}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": customApiKey.trim(),
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
      } else {
        // Use default API via edge function
        await supabase.functions.invoke("evolution-api", {
          body: {
            action: "set-webhook",
            instanceName: selectedInstance,
            webhookUrl,
          },
        });
      }

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
        project_id: projectId || null,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Importar do STEVO
          </DialogTitle>
          <DialogDescription>
            Busque instâncias da API padrão ou insira credenciais de outra Evolution API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Custom API credentials section */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <p className="text-sm font-medium">Buscar em outra Evolution API</p>
            <div className="space-y-2">
              <Label htmlFor="customApiUrl" className="text-sm">URL da API</Label>
              <Input
                id="customApiUrl"
                type="url"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="https://sua-evolution-api.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customApiKey" className="text-sm">API Key</Label>
              <div className="relative">
                <Input
                  id="customApiKey"
                  type={showApiKey ? "text" : "password"}
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Sua chave de API"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleSearchCustomApi} 
                disabled={loading || !customApiUrl || !customApiKey}
                variant="secondary"
                size="sm"
              >
                {loading && !useDefaultApi ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar nesta API
                  </>
                )}
              </Button>
              <Button 
                onClick={loadDefaultInstances} 
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading && useDefaultApi ? 'animate-spin' : ''}`} />
                API Padrão
              </Button>
            </div>
          </div>

          {/* Results section */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando instâncias...</span>
            </div>
          ) : error && hasSearched ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <AlertCircle className="h-6 w-6 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : instances.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Instâncias disponíveis ({instances.length})
                  {!useDefaultApi && <span className="text-muted-foreground ml-1">(API customizada)</span>}
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
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
          ) : hasSearched ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma instância disponível encontrada.
              </p>
            </div>
          ) : null}
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
