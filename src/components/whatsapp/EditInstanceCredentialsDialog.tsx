import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, EyeOff, Settings } from "lucide-react";
import { toast } from "sonner";

interface EditInstanceCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceDisplayName: string;
  onSaved: () => void;
}

export const EditInstanceCredentialsDialog = ({
  open,
  onOpenChange,
  instanceId,
  instanceDisplayName,
  onSaved,
}: EditInstanceCredentialsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [providerType, setProviderType] = useState<"evolution" | "manager_v2">("manager_v2");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (open && instanceId) {
      loadCredentials();
    }
  }, [open, instanceId]);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("api_url, api_key, provider_type")
        .eq("id", instanceId)
        .single();

      if (error) throw error;

      setApiUrl((data as any)?.api_url || "");
      setApiKey((data as any)?.api_key || "");
      const pt = (data as any)?.provider_type;
      setProviderType(pt === "evolution" ? "evolution" : "manager_v2");
    } catch (err: any) {
      console.error("Error loading credentials:", err);
      toast.error("Erro ao carregar credenciais da instância");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const cleanUrl = apiUrl.trim().replace(/\/+$/, "");
    const cleanKey = apiKey.trim();

    if (!cleanUrl || !cleanKey) {
      toast.error("Informe a URL da API e a API Key");
      return;
    }

    try {
      new URL(cleanUrl);
    } catch {
      toast.error("URL inválida. Use o formato https://sm-tucano.stevo.chat");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          api_url: cleanUrl,
          api_key: cleanKey,
          provider_type: providerType,
        } as any)
        .eq("id", instanceId);

      if (error) throw error;

      toast.success("Credenciais salvas com sucesso!");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error("Error saving credentials:", err);
      toast.error(err.message || "Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          api_url: null,
          api_key: null,
          provider_type: null,
        } as any)
        .eq("id", instanceId);

      if (error) throw error;

      setApiUrl("");
      setApiKey("");
      setProviderType("manager_v2");
      toast.success("Credenciais removidas — usará configuração global");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover credenciais");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Credenciais da Instância
          </DialogTitle>
          <DialogDescription>
            Configure a URL e chave de API para <strong>{instanceDisplayName}</strong>.
            Instâncias Stevo/Manager V2 precisam de credenciais próprias por instância.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-provider-type">Tipo de servidor</Label>
              <Select
                value={providerType}
                onValueChange={(v) => setProviderType(v as "evolution" | "manager_v2")}
              >
                <SelectTrigger id="edit-provider-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager_v2">Manager V2 (Stevo — sm-*.stevo.chat / evo*.stevo.chat)</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-api-url">URL da API</Label>
              <Input
                id="edit-api-url"
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={
                  providerType === "manager_v2"
                    ? "https://sm-tucano.stevo.chat"
                    : "https://api.evolution.example.com"
                }
              />
              {providerType === "manager_v2" && (
                <p className="text-xs text-muted-foreground">
                  Use a URL específica da instância — ex: https://evo07.stevo.chat
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-api-key">API Key</Label>
              <div className="relative">
                <Input
                  id="edit-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole a chave da instância"
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
              {providerType === "manager_v2" && (
                <p className="text-xs text-muted-foreground">
                  No Stevo Manager V2 cada instância tem sua própria apikey (não a chave global).
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {apiUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving || loading}
              className="text-muted-foreground mr-auto"
            >
              Remover credenciais
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !apiUrl.trim() || !apiKey.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
