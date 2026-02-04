import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, MessageSquare, Briefcase, Loader2, Check, X, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, [projectId]);

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from("social_integrations")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (platformId: string) => {
    const integration = integrations.find(i => i.platform === platformId);
    return integration?.status || "disconnected";
  };

  const getIntegrationAccount = (platformId: string) => {
    const integration = integrations.find(i => i.platform === platformId);
    return integration?.account_name;
  };

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    try {
      // Create or update integration record
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
                    <Button variant="outline" size="sm">
                      Gerenciar
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

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            💡 As integrações permitem publicar automaticamente no Instagram, 
            enviar links de aprovação via WhatsApp e gerenciar tudo pelo Meta Business Suite.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
