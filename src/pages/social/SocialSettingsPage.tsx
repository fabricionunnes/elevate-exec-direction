import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Instagram, MessageSquare, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PhoneInput } from "@/components/ui/phone-input";

interface ContextType {
  project: { id: string; product_name: string | null; company_name: string | null };
  boardId: string;
}

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
}

interface InstagramAccount {
  id: string;
  instagram_username: string | null;
  is_connected: boolean;
}

export const SocialSettingsPage = () => {
  const { project } = useOutletContext<ContextType>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // WhatsApp settings
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientName, setClientName] = useState("");
  
  // Instagram account
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null);
  const [connectingInstagram, setConnectingInstagram] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [project.id]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load WhatsApp instances
      const { data: instancesData } = await supabase
        .from("whatsapp_instances")
        .select("id, display_name, phone_number")
        .eq("status", "connected")
        .order("display_name");
      
      setInstances((instancesData || []).map(i => ({
        id: i.id,
        name: i.display_name || "Instância",
        phone_number: i.phone_number,
      })));

      // Load current WhatsApp settings
      const { data: whatsappSettings } = await supabase
        .from("social_whatsapp_settings")
        .select("*")
        .eq("project_id", project.id)
        .single();

      if (whatsappSettings) {
        setSelectedInstance(whatsappSettings.whatsapp_instance_id || "");
        setClientPhone(whatsappSettings.client_phone || "");
        setClientName(whatsappSettings.client_name || "");
      }

      // Load Instagram account
      const { data: igAccount } = await supabase
        .from("social_instagram_accounts")
        .select("*")
        .eq("project_id", project.id)
        .single();

      setInstagramAccount(igAccount || null);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("social_whatsapp_settings")
        .upsert({
          project_id: project.id,
          whatsapp_instance_id: selectedInstance || null,
          client_phone: clientPhone || null,
          client_name: clientName || null,
          is_active: true,
        }, { onConflict: "project_id" });

      if (error) throw error;
      toast.success("Configurações de WhatsApp salvas!");
    } catch (error) {
      console.error("Error saving WhatsApp settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectInstagram = async () => {
    setConnectingInstagram(true);
    try {
      // Get the Instagram OAuth URL
      const { data, error } = await supabase.functions.invoke("social-instagram-auth", {
        body: { projectId: project.id, action: "get_auth_url" },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Open in new window
        const popup = window.open(data.authUrl, "instagram_auth", "width=600,height=700");
        if (!popup) {
          toast.error("Popup bloqueado. Permita popups para continuar.");
        }
      }
    } catch (error) {
      console.error("Error connecting Instagram:", error);
      toast.error("Erro ao iniciar conexão com Instagram");
    } finally {
      setConnectingInstagram(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    try {
      const { error } = await supabase
        .from("social_instagram_accounts")
        .update({ is_connected: false, access_token: null })
        .eq("project_id", project.id);

      if (error) throw error;
      
      setInstagramAccount((prev) => prev ? { ...prev, is_connected: false } : null);
      toast.success("Instagram desconectado");
    } catch (error) {
      console.error("Error disconnecting Instagram:", error);
      toast.error("Erro ao desconectar Instagram");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Instagram Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Conexão com Instagram
          </CardTitle>
          <CardDescription>
            Conecte a conta do Instagram do cliente para publicação automática
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {instagramAccount?.is_connected ? (
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Instagram className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">@{instagramAccount.instagram_username}</p>
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Conectado
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDisconnectInstagram}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed rounded-lg">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="font-medium">Nenhuma conta conectada</p>
                <p className="text-sm text-muted-foreground">
                  Conecte o Instagram do cliente para publicar automaticamente
                </p>
              </div>
              <Button onClick={handleConnectInstagram} disabled={connectingInstagram} className="gap-2">
                {connectingInstagram ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Conectar Instagram
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notificações WhatsApp
          </CardTitle>
          <CardDescription>
            Configure o envio automático de links de aprovação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name} {instance.phone_number ? `(${instance.phone_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome do Cliente</Label>
            <Input
              placeholder="Nome para personalizar mensagens"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone do Cliente</Label>
            <PhoneInput
              value={clientPhone}
              onChange={setClientPhone}
              placeholder="(00) 00000-0000"
            />
            <p className="text-xs text-muted-foreground">
              Número para enviar os links de aprovação
            </p>
          </div>

          <Button onClick={handleSaveWhatsApp} disabled={saving} className="w-full gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
