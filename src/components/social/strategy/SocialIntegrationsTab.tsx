import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, MessageSquare, Briefcase, Loader2, Check, X, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppGroupSettings } from "./WhatsAppGroupSettings";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SocialIntegrationsTabProps {
  projectId: string;
}

interface Integration {
  id: string;
  platform: string;
  status: string;
  account_name: string | null;
  last_sync_at: string | null;
  error_message: string | null;
}

interface InstagramAccount {
  id: string;
  instagram_username: string | null;
  is_connected: boolean;
}

const PLATFORMS = [
  { 
    id: "instagram", 
    name: "Instagram", 
    icon: Instagram, 
    description: "Publicação automática de conteúdo",
    gradient: "from-pink-500 to-purple-600"
  },
  { 
    id: "facebook", 
    name: "Facebook", 
    icon: Facebook, 
    description: "Gerenciamento de página",
    gradient: "from-blue-500 to-blue-700"
  },
  { 
    id: "whatsapp", 
    name: "WhatsApp", 
    icon: MessageSquare, 
    description: "Notificações de aprovação",
    gradient: "from-green-500 to-green-700"
  },
  { 
    id: "meta_business", 
    name: "Meta Business Suite", 
    icon: Briefcase, 
    description: "Gerenciamento unificado",
    gradient: "from-blue-600 to-indigo-700"
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "connected":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><Check className="h-3 w-3 mr-1" /> Conectado</Badge>;
    case "error":
      return <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Erro</Badge>;
    case "requires_action":
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertCircle className="h-3 w-3 mr-1" /> Requer Ação</Badge>;
    default:
      return <Badge variant="secondary">Desconectado</Badge>;
  }
};

export const SocialIntegrationsTab = ({ projectId }: SocialIntegrationsTabProps) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();

    // Listen for Instagram connection from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "instagram-connected" && event.data?.projectId === projectId) {
        loadIntegrations();
        toast.success("Instagram conectado com sucesso!");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [projectId]);

  const loadIntegrations = async () => {
    try {
      const [integrationsRes, instagramRes] = await Promise.all([
        supabase
          .from("social_integrations")
          .select("*")
          .eq("project_id", projectId),
        supabase
          .from("social_instagram_accounts")
          .select("id, instagram_username, is_connected")
          .eq("project_id", projectId)
          .maybeSingle()
      ]);

      if (integrationsRes.error) throw integrationsRes.error;
      setIntegrations(integrationsRes.data || []);

      if (!instagramRes.error) {
        setInstagramAccount(instagramRes.data);
      }
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (platformId: string) => {
    if (platformId === "instagram" && instagramAccount?.is_connected) {
      return "connected";
    }
    const integration = integrations.find(i => i.platform === platformId);
    return integration?.status || "disconnected";
  };

  const getIntegrationAccount = (platformId: string) => {
    if (platformId === "instagram" && instagramAccount?.instagram_username) {
      return `@${instagramAccount.instagram_username}`;
    }
    const integration = integrations.find(i => i.platform === platformId);
    return integration?.account_name;
  };

  const handleConnectInstagram = async () => {
    setConnecting("instagram");
    try {
      const { data, error } = await supabase.functions.invoke("social-instagram-auth", {
        body: { projectId, action: "get_auth_url" },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Try to open in new window
        const popup = window.open(data.authUrl, "instagram_auth", "width=600,height=700");
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          // Popup was blocked - show fallback dialog
          setPopupBlockedUrl(data.authUrl);
        }
      }
    } catch (error) {
      console.error("Error connecting Instagram:", error);
      toast.error("Erro ao iniciar conexão com Instagram");
    } finally {
      setConnecting(null);
    }
  };

  const handleCopyAuthUrl = async () => {
    if (popupBlockedUrl) {
      await navigator.clipboard.writeText(popupBlockedUrl);
      toast.success("Link copiado! Cole em uma nova aba para continuar.");
    }
  };

  const handleDisconnectInstagram = async () => {
    try {
      const { error } = await supabase.functions.invoke("social-instagram-auth", {
        body: { projectId, action: "disconnect" },
      });

      if (error) throw error;
      
      setInstagramAccount(null);
      toast.success("Instagram desconectado");
      loadIntegrations();
    } catch (error) {
      console.error("Error disconnecting Instagram:", error);
      toast.error("Erro ao desconectar Instagram");
    }
  };

  const handleConnect = async (platformId: string) => {
    if (platformId === "instagram") {
      await handleConnectInstagram();
      return;
    }

    setConnecting(platformId);
    try {
      const { error } = await supabase
        .from("social_integrations")
        .upsert({
          project_id: projectId,
          platform: platformId,
          status: "requires_action",
        }, { onConflict: "project_id,platform" });

      if (error) throw error;

      toast.info("Funcionalidade de conexão em desenvolvimento");
      loadIntegrations();
    } catch (error) {
      console.error("Error connecting:", error);
      toast.error("Erro ao iniciar conexão");
    } finally {
      setConnecting(null);
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-lg font-medium">Conecte suas plataformas</h3>
        <p className="text-sm text-muted-foreground">
          Integre as redes sociais do cliente para automatizar publicações e aprovações
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const status = getIntegrationStatus(platform.id);
          const accountName = getIntegrationAccount(platform.id);
          const Icon = platform.icon;
          const isInstagram = platform.id === "instagram";

          return (
            <Card key={platform.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${platform.gradient}`} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${platform.gradient} flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{platform.name}</CardTitle>
                      <CardDescription className="text-xs">{platform.description}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(status)}
                </div>
              </CardHeader>
              <CardContent>
                {status === "connected" && accountName ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{accountName}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={isInstagram ? handleDisconnectInstagram : undefined}
                    >
                      {isInstagram ? "Desconectar" : "Gerenciar"}
                    </Button>
                  </div>
                ) : status === "error" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-destructive">Erro na conexão. Reconecte a conta.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleConnect(platform.id)}
                      disabled={connecting === platform.id}
                    >
                      {connecting === platform.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Reconectar
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handleConnect(platform.id)}
                    disabled={connecting === platform.id}
                  >
                    {connecting === platform.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Conectar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* WhatsApp Group Settings */}
      <WhatsAppGroupSettings projectId={projectId} />

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            💡 As integrações permitem publicar automaticamente no Instagram, 
            enviar links de aprovação via WhatsApp e gerenciar tudo pelo Meta Business Suite.
          </p>
        </CardContent>
      </Card>

      {/* Popup Blocked Fallback Dialog */}
      <Dialog open={!!popupBlockedUrl} onOpenChange={(open) => !open && setPopupBlockedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Popup bloqueado</DialogTitle>
            <DialogDescription>
              Seu navegador bloqueou a janela de autorização. Copie o link abaixo e cole em uma nova aba para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input 
              value={popupBlockedUrl || ""} 
              readOnly 
              className="text-xs"
            />
            <Button onClick={handleCopyAuthUrl} size="icon" variant="outline">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button 
            variant="default" 
            className="w-full"
            onClick={() => {
              window.open(popupBlockedUrl!, "_blank");
              setPopupBlockedUrl(null);
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir em nova aba
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
