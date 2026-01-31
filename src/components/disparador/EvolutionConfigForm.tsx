import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Settings, CheckCircle2, Eye, EyeOff, ExternalLink } from "lucide-react";

interface EvolutionConfigFormProps {
  projectId: string;
  onConfigured?: () => void;
}

interface EvolutionConfig {
  id: string;
  api_url: string;
  api_key: string;
}

export const EvolutionConfigForm = ({ projectId, onConfigured }: EvolutionConfigFormProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [projectId]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("client_evolution_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setApiUrl(data.api_url);
        setApiKey(data.api_key);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    // Validate URL format
    try {
      new URL(apiUrl);
    } catch {
      toast.error("URL inválida. Use o formato https://sua-api.com");
      return;
    }

    setSaving(true);
    try {
      if (config) {
        // Update existing
        const { error } = await supabase
          .from("client_evolution_config")
          .update({
            api_url: apiUrl.trim().replace(/\/$/, ""), // Remove trailing slash
            api_key: apiKey.trim(),
          })
          .eq("id", config.id);

        if (error) throw error;
        toast.success("Configuração atualizada!");
      } else {
        // Insert new
        const { error } = await supabase
          .from("client_evolution_config")
          .insert({
            project_id: projectId,
            api_url: apiUrl.trim().replace(/\/$/, ""),
            api_key: apiKey.trim(),
          });

        if (error) throw error;
        toast.success("Configuração salva!");
      }

      await fetchConfig();
      onConfigured?.();
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(error.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      toast.error("Configure a URL e API Key primeiro");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl.trim().replace(/\/$/, "")}/instance/fetchInstances`, {
        method: "GET",
        headers: {
          "apikey": apiKey.trim(),
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      toast.success(`Conexão OK! ${Array.isArray(data) ? data.length : 0} instância(s) encontrada(s)`);
    } catch (error: any) {
      console.error("Connection test error:", error);
      toast.error(`Erro ao conectar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Configurar Evolution API
          {config && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
        </CardTitle>
        <CardDescription>
          Configure as credenciais da sua instância Evolution API (STEVO) para conectar seu WhatsApp.
          <a 
            href="https://doc.evolution-api.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-1 text-primary hover:underline"
          >
            Documentação <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiUrl">URL da API</Label>
          <Input
            id="apiUrl"
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://sua-evolution-api.com"
          />
          <p className="text-xs text-muted-foreground">
            Ex: https://api.stevo.com.br ou sua URL personalizada
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
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
            Encontre a API Key nas configurações da sua Evolution API
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={saving || !apiUrl || !apiKey}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Testar Conexão
          </Button>
          <Button onClick={handleSave} disabled={saving || !apiUrl || !apiKey}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {config ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
