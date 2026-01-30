import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, ExternalLink, RefreshCw, Unlink, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface InstagramInstance {
  id: string;
  instagram_user_id: string;
  username: string;
  profile_picture_url: string | null;
  status: string;
  token_expires_at: string;
  created_at: string;
}

interface InstagramSectionProps {
  onBack: () => void;
}

export const InstagramSection = ({ onBack }: InstagramSectionProps) => {
  const { currentStaff, loading: staffLoading } = useStaffPermissions();
  const staffId = currentStaff?.id;
  const [instances, setInstances] = useState<InstagramInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (staffId) {
      loadInstances();
    }
  }, [staffId]);

  const loadInstances = async () => {
    if (!staffId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-oauth", {
        body: { action: "list", staffId },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      setInstances(data.instances || []);
    } catch (err: any) {
      console.error("Error loading instances:", err);
      toast.error("Erro ao carregar contas conectadas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!staffId) {
      toast.error("Você precisa estar logado para conectar uma conta");
      return;
    }

    setIsConnecting(true);
    try {
      // Use origin as redirect URI - callback will be handled by checking URL params
      const redirectUri = window.location.origin;

      const { data, error } = await supabase.functions.invoke("instagram-oauth", {
        body: {
          action: "auth_url",
          staffId,
          redirectUri,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      // Redirect to Facebook OAuth
      window.location.href = data.authUrl;
    } catch (err: any) {
      console.error("Error getting auth URL:", err);
      toast.error(err.message || "Erro ao iniciar conexão");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    if (!staffId) return;

    try {
      const { error } = await supabase.functions.invoke("instagram-oauth", {
        body: {
          action: "disconnect",
          instanceId,
          staffId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Conta desconectada com sucesso");
      loadInstances();
    } catch (err: any) {
      console.error("Error disconnecting:", err);
      toast.error("Erro ao desconectar conta");
    }
  };

  const handleRefresh = async (instanceId: string) => {
    try {
      const { error } = await supabase.functions.invoke("instagram-oauth", {
        body: {
          action: "refresh",
          instanceId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Token atualizado com sucesso");
      loadInstances();
    } catch (err: any) {
      console.error("Error refreshing token:", err);
      toast.error("Erro ao atualizar token");
    }
  };

  const isTokenExpiringSoon = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7;
  };

  if (staffLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-pink-500" />
          <h2 className="text-lg font-semibold">Instagram</h2>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            Conectar conta Instagram
          </CardTitle>
          <CardDescription>
            Conecte sua conta Instagram Business ou Creator para gerenciar mensagens diretas, comentários e seguidores diretamente do CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">Requisitos:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Conta Instagram Business ou Creator</li>
              <li>Página do Facebook conectada à conta Instagram</li>
              <li>Acesso de administrador à página do Facebook</li>
            </ul>
          </div>

          <Button 
            onClick={handleConnect} 
            disabled={isConnecting}
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Instagram className="h-4 w-4 mr-2" />
                Conectar Instagram
                <ExternalLink className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <div className="space-y-4">
        <h3 className="font-medium">Contas conectadas</h3>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : instances.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Instagram className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma conta Instagram conectada</p>
              <p className="text-sm text-muted-foreground/70">
                Clique no botão acima para conectar sua primeira conta
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => (
              <Card key={instance.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {instance.profile_picture_url ? (
                      <img 
                        src={instance.profile_picture_url} 
                        alt={instance.username}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                        <Instagram className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">@{instance.username}</span>
                        <Badge 
                          variant={instance.status === "connected" ? "default" : "secondary"}
                          className={instance.status === "connected" ? "bg-green-500" : ""}
                        >
                          {instance.status === "connected" ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isTokenExpiringSoon(instance.token_expires_at) ? (
                          <span className="text-yellow-600">Token expira em breve</span>
                        ) : (
                          `Expira em ${new Date(instance.token_expires_at).toLocaleDateString("pt-BR")}`
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTokenExpiringSoon(instance.token_expires_at) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRefresh(instance.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Renovar
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDisconnect(instance.id)}
                    >
                      <Unlink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
