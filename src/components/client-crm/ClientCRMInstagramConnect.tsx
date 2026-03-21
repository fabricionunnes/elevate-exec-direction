import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Instagram, Wifi, WifiOff, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InstagramInstance {
  id: string;
  instance_name: string;
  instagram_account_id: string;
  instagram_username: string | null;
  page_id: string;
  page_name: string | null;
  profile_picture_url: string | null;
  status: string;
  token_expires_at: string | null;
  project_id: string | null;
}

interface Props {
  projectId: string;
}

export const ClientCRMInstagramConnect = ({ projectId }: Props) => {
  const [instances, setInstances] = useState<InstagramInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchInstances();
  }, [projectId]);

  const fetchInstances = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("instagram_instances")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setInstances((data || []) as InstagramInstance[]);
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Get current user's onboarding_user id as staffId equivalent
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      // Try to get onboarding_user or staff id
      const { data: onbUser } = await supabase
        .from("onboarding_users")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("project_id", projectId)
        .maybeSingle();

      // Also check if user is staff
      const { data: staffUser } = await supabase
        .from("onboarding_staff")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      const staffId = staffUser?.id || onbUser?.id;
      if (!staffId) throw new Error("Usuário não encontrado");

      const redirectUri = `${window.location.origin}/`;

      const { data, error } = await supabase.functions.invoke("instagram-oauth", {
        body: {
          action: "auth_url",
          staffId,
          redirectUri,
          projectId,
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      // Open OAuth URL
      window.location.href = data.authUrl;
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar conexão");
      setConnecting(false);
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    try {
      await supabase
        .from("instagram_instances")
        .update({ status: "disconnected", project_id: null })
        .eq("id", instanceId);
      toast.success("Instagram desconectado");
      await fetchInstances();
    } catch (err: any) {
      toast.error("Erro ao desconectar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connectedInstances = instances.filter(i => i.status === "connected");

  return (
    <div className="space-y-4">
      {connectedInstances.length === 0 ? (
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500" />
              Conectar Instagram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Instagram Business para receber e responder mensagens diretamente pelo CRM.
            </p>
            <p className="text-xs text-muted-foreground">
              Requisitos: conta Instagram Business ou Creator vinculada a uma Página do Facebook.
            </p>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Instagram className="h-4 w-4 mr-2" />
              )}
              Conectar com Instagram
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connectedInstances.map((instance) => (
            <Card key={instance.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={instance.profile_picture_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                        {instance.instagram_username?.slice(0, 2).toUpperCase() || "IG"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          @{instance.instagram_username || "instagram"}
                        </span>
                        <Badge variant="default" className="bg-green-600 text-xs">
                          Conectado
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {instance.page_name || "Página vinculada"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchInstances()}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(instance.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full"
          >
            <Instagram className="h-4 w-4 mr-2" />
            Conectar outra conta
          </Button>
        </div>
      )}
    </div>
  );
};
