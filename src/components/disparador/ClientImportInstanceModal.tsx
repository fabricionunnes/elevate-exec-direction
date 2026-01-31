import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageCircle, Eye, EyeOff, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
  const [importing, setImporting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Manual entry fields
  const [instanceName, setInstanceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setInstanceName("");
      setDisplayName("");
      setApiKey("");
      setApiUrl("");
      setPhoneNumber("");
      setShowApiKey(false);
    }
  }, [open]);

  // Auto-generate display name from instance name
  useEffect(() => {
    if (instanceName && !displayName) {
      setDisplayName(instanceName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    }
  }, [instanceName]);

  const handleImport = async () => {
    if (!instanceName.trim()) {
      toast.error("Preencha o nome da instância");
      return;
    }

    if (!apiKey.trim()) {
      toast.error("Preencha a API Key");
      return;
    }

    if (!apiUrl.trim()) {
      toast.error("Preencha a URL da API");
      return;
    }

    // Check if instance already exists
    if (existingInstanceNames.includes(instanceName.trim())) {
      toast.error("Esta instância já foi importada");
      return;
    }

    setImporting(true);
    try {
      // Save the Evolution API config for this project
      const cleanApiUrl = apiUrl.trim().replace(/\/$/, "");
      
      const { error: configError } = await supabase
        .from("client_evolution_config")
        .upsert({
          project_id: projectId,
          api_url: cleanApiUrl,
          api_key: apiKey.trim(),
        }, {
          onConflict: "project_id",
        });

      if (configError) {
        console.error("Error saving config:", configError);
        // Continue anyway, the instance data is more important
      }

      // Configure webhook for this instance
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;

      try {
        await fetch(`${cleanApiUrl}/webhook/set/${instanceName.trim()}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey.trim(),
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
      } catch (webhookErr) {
        console.warn("Could not configure webhook:", webhookErr);
        // Continue anyway - webhook config is optional
      }

      // Insert into local database
      const { error: insertError } = await supabase.from("whatsapp_instances").insert({
        instance_name: instanceName.trim(),
        display_name: displayName.trim() || instanceName.trim(),
        phone_number: phoneNumber.trim() || null,
        status: "connected", // Assume connected since STEVO shows it
        is_default: false,
        project_id: projectId,
      });

      if (insertError) throw insertError;

      toast.success(`Instância "${displayName || instanceName}" importada com sucesso!`);
      onOpenChange(false);
      onImported();
    } catch (err: any) {
      console.error("Error importing instance:", err);
      toast.error(err.message || "Erro ao importar instância");
    } finally {
      setImporting(false);
    }
  };

  const isFormValid = instanceName.trim() && apiKey.trim() && apiUrl.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            Adicionar Instância WhatsApp
          </DialogTitle>
          <DialogDescription>
            Preencha os dados fornecidos pelo STEVO para conectar sua instância.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instance Name */}
          <div className="space-y-2">
            <Label htmlFor="instanceName">
              Nome da Instância <span className="text-destructive">*</span>
            </Label>
            <Input
              id="instanceName"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="Ex: fabricio-nunnes"
            />
            <p className="text-xs text-muted-foreground">
              Copie o "Nome da Instância" exatamente como aparece no STEVO
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">
              API Key <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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
            <p className="text-xs text-muted-foreground">
              Copie a "API Key" do painel do STEVO
            </p>
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="apiUrl">
              URL SM v2 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="apiUrl"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://sm-exemplo.stevo.chat"
            />
            <p className="text-xs text-muted-foreground">
              Copie a "URL SM v2" do painel do STEVO
            </p>
          </div>

          {/* Phone Number (optional) */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número do WhatsApp</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: 5531994622556"
            />
            <p className="text-xs text-muted-foreground">
              Opcional - O número conectado à instância
            </p>
          </div>

          {/* Display Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome de Exibição</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Comercial, Suporte..."
            />
            <p className="text-xs text-muted-foreground">
              Opcional - Nome amigável para identificar a instância
            </p>
          </div>

          {/* Validation indicator */}
          {isFormValid && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">
                Dados preenchidos corretamente
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!isFormValid || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Instância
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};