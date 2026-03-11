import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Instagram, ExternalLink, RefreshCw, Unlink, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { InstagramAccount } from "../types";

interface InstagramConnectProps {
  projectId: string;
  isStaff?: boolean;
  onConnected: () => void;
  existingAccount?: InstagramAccount | null;
}

export const InstagramConnect = ({ projectId, isStaff = false, onConnected, existingAccount }: InstagramConnectProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [manualAuthUrl, setManualAuthUrl] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setManualAuthUrl(null);
    try {
      const redirectUri = `https://elevate-exec-direction.lovable.app/#/social/instagram-callback`;
      
      const { data, error } = await supabase.functions.invoke("instagram-project-oauth", {
        body: {
          action: "auth_url",
          projectId,
          redirectUri,
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      if (data?.authUrl) {
        // Always show the link for the user to click directly.
        // Using window.open or window.location.href gets blocked by Safari's
        // Cross-Origin-Opener-Policy on Facebook OAuth pages.
        setManualAuthUrl(data.authUrl);
      }
    } catch (err: any) {
      console.error("Error connecting Instagram:", err);
      toast.error(err.message || "Erro ao conectar Instagram");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!existingAccount) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("instagram-project-oauth", {
        body: { action: "sync", accountId: existingAccount.id },
      });
      if (error) throw error;
      toast.success("Sincronização iniciada!");
      onConnected();
    } catch (err: any) {
      toast.error("Erro ao sincronizar dados");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!existingAccount) return;
    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from("instagram_accounts")
        .update({ status: "disconnected" })
        .eq("id", existingAccount.id);
      if (error) throw error;
      toast.success("Instagram desconectado");
      onConnected();
    } catch (err: any) {
      toast.error("Erro ao desconectar");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (existingAccount) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500" />
              Conta Conectada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg border">
              {existingAccount.profile_picture_url ? (
                <img src={existingAccount.profile_picture_url} alt="" className="h-14 w-14 rounded-full" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                  <Instagram className="h-7 w-7 text-white" />
                </div>
              )}
              <div>
                <p className="font-semibold text-lg">@{existingAccount.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="bg-green-500 text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                  {existingAccount.last_synced_at && (
                    <span className="text-xs text-muted-foreground">
                      Última sinc.: {new Date(existingAccount.last_synced_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={isSyncing} variant="outline" className="gap-2">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar Dados
              </Button>
              <Button onClick={handleDisconnect} disabled={isDisconnecting} variant="destructive" className="gap-2">
                {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Desconectar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center mb-4">
            <Instagram className="h-8 w-8 text-white" />
          </div>
          <CardTitle>Conectar Instagram</CardTitle>
          <CardDescription>
            Conecte a conta Instagram profissional para acompanhar todas as métricas de desempenho.
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

          {!manualAuthUrl ? (
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white"
              size="lg"
            >
              {isConnecting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando link...</>
              ) : (
                <><Instagram className="h-4 w-4 mr-2" /> Conectar Instagram <ExternalLink className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <a 
                href={manualAuthUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 transition-colors"
              >
                <Instagram className="h-4 w-4" />
                Abrir autenticação do Instagram
                <ExternalLink className="h-4 w-4" />
              </a>
              <p className="text-xs text-center text-muted-foreground">
                Clique acima para abrir a página de autenticação do Facebook/Instagram.
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => setManualAuthUrl(null)}
              >
                Gerar novo link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
