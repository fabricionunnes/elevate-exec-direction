import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Wifi, WifiOff, QrCode, Settings, RefreshCw, Trash2 } from "lucide-react";

interface WhatsAppConfig {
  id: string;
  project_id: string;
  instance_name: string | null;
  instance_id: string | null;
  server_url: string | null;
  api_key: string | null;
  status: string;
  qr_code: string | null;
  connected_at: string | null;
}

interface Props {
  projectId: string;
}

export const ClientCRMWhatsApp = ({ projectId }: Props) => {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ instance_name: "", server_url: "", api_key: "" });
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [projectId]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_crm_whatsapp_config")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    setConfig(data as WhatsAppConfig | null);
    if (data) {
      setForm({
        instance_name: data.instance_name || "",
        server_url: data.server_url || "",
        api_key: data.api_key || "",
      });
    }
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    if (!form.instance_name.trim() || !form.server_url.trim() || !form.api_key.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      if (config) {
        await supabase
          .from("client_crm_whatsapp_config")
          .update({
            instance_name: form.instance_name,
            server_url: form.server_url,
            api_key: form.api_key,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
      } else {
        await supabase.from("client_crm_whatsapp_config").insert({
          project_id: projectId,
          instance_name: form.instance_name,
          server_url: form.server_url,
          api_key: form.api_key,
        });
      }
      toast.success("Configuração salva!");
      setShowSetup(false);
      await fetchConfig();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!config?.server_url || !config?.api_key || !config?.instance_name) {
      toast.error("Configure a instância primeiro");
      return;
    }
    setSaving(true);
    try {
      // Try to connect via Evolution API
      const baseUrl = config.server_url.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/instance/connect/${config.instance_name}`, {
        method: "GET",
        headers: {
          apikey: config.api_key,
        },
      });

      if (!response.ok) {
        throw new Error("Erro ao conectar. Verifique as credenciais.");
      }

      const data = await response.json();
      
      // Check for QR code
      const qrCode = data?.base64 || data?.qrcode?.base64 || null;
      const instanceId = data?.instance?.instanceId || config.instance_id;

      await supabase
        .from("client_crm_whatsapp_config")
        .update({
          status: qrCode ? "connecting" : "connected",
          qr_code: qrCode,
          instance_id: instanceId,
          connected_at: qrCode ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      if (qrCode) {
        toast.info("Escaneie o QR Code com seu WhatsApp");
      } else {
        toast.success("Instância conectada!");
      }
      await fetchConfig();
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!config?.server_url || !config?.api_key || !config?.instance_name) return;
    setSaving(true);
    try {
      const baseUrl = config.server_url.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/instance/connectionState/${config.instance_name}`, {
        headers: { apikey: config.api_key },
      });
      const data = await response.json();
      const state = data?.instance?.state || data?.state || "disconnected";
      const isConnected = state === "open" || state === "connected";

      await supabase
        .from("client_crm_whatsapp_config")
        .update({
          status: isConnected ? "connected" : "disconnected",
          qr_code: isConnected ? null : config.qr_code,
          connected_at: isConnected ? new Date().toISOString() : config.connected_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      toast.success(isConnected ? "Instância conectada!" : "Instância desconectada");
      await fetchConfig();
    } catch (error: any) {
      toast.error("Erro ao verificar status");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!config) return;
    await supabase
      .from("client_crm_whatsapp_config")
      .update({ status: "disconnected", qr_code: null, updated_at: new Date().toISOString() })
      .eq("id", config.id);
    toast.success("Desconectado");
    await fetchConfig();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No config yet - show setup
  if (!config || showSetup) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Instância WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Conecte sua própria instância do WhatsApp (Evolution API) para gerenciar atendimentos diretamente pelo CRM.
          </p>
          <Input
            placeholder="Nome da instância"
            value={form.instance_name}
            onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
          />
          <Input
            placeholder="URL do servidor (ex: https://api.seuservidor.com)"
            value={form.server_url}
            onChange={(e) => setForm({ ...form, server_url: e.target.value })}
          />
          <Input
            placeholder="API Key"
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={handleSaveConfig} disabled={saving} className="flex-1">
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            {config && (
              <Button variant="outline" onClick={() => setShowSetup(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {config.status === "connected" ? (
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  <Wifi className="h-6 w-6" />
                </div>
              ) : (
                <div className="p-3 rounded-full bg-red-100 text-red-600">
                  <WifiOff className="h-6 w-6" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{config.instance_name}</h3>
                <Badge variant={config.status === "connected" ? "default" : "secondary"} className={config.status === "connected" ? "bg-green-600" : ""}>
                  {config.status === "connected" ? "Conectado" : config.status === "connecting" ? "Conectando..." : "Desconectado"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={saving}>
                <RefreshCw className="h-4 w-4 mr-1" /> Status
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSetup(true)}>
                <Settings className="h-4 w-4 mr-1" /> Configurar
              </Button>
              {config.status !== "connected" ? (
                <Button size="sm" onClick={handleConnect} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                  Conectar
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              )}
            </div>
          </div>

          {/* QR Code display */}
          {config.status === "connecting" && config.qr_code && (
            <div className="mt-4 flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Escaneie o QR Code abaixo com seu WhatsApp:</p>
              <img src={`data:image/png;base64,${config.qr_code}`} alt="QR Code" className="w-64 h-64 rounded-lg" />
              <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={saving}>
                <RefreshCw className="h-4 w-4 mr-1" /> Verificar Conexão
              </Button>
            </div>
          )}

          {config.status === "connected" && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-700">
                ✅ Sua instância está conectada e pronta para uso. Os atendimentos aparecerão aqui em breve.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
