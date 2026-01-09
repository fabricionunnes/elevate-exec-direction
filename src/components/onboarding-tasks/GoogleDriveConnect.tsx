import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FolderOpen, Link2, Unlink, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GoogleDriveConnectProps {
  projectId: string;
  documentsLink: string | null;
  onConnectionChange?: () => void;
}

export function GoogleDriveConnect({ projectId, documentsLink, onConnectionChange }: GoogleDriveConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, [projectId]);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");

      if (code && state) {
        try {
          const stateData = JSON.parse(atob(state));
          if (stateData.projectId === projectId) {
            setIsConnecting(true);
            
            const { data, error } = await supabase.functions.invoke("google-drive-oauth", {
              body: {
                action: "exchange",
                code,
                redirectUri: stateData.redirectUri,
                projectId,
              },
            });

            if (error) throw error;

            if (data.success) {
              toast.success("Google Drive conectado com sucesso!");
              setIsConnected(true);
              setIsExpired(false);
              onConnectionChange?.();
            }

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          }
        } catch (err) {
          console.error("OAuth callback error:", err);
          toast.error("Erro ao conectar Google Drive");
        } finally {
          setIsConnecting(false);
        }
      }
    };

    handleCallback();
  }, [projectId]);

  const checkConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-oauth", {
        body: {
          action: "status",
          projectId,
        },
      });

      if (error) throw error;

      setIsConnected(data.connected || false);
      setIsExpired(data.expired || false);
    } catch (err) {
      console.error("Error checking Drive status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!documentsLink) {
      toast.error("Configure primeiro o link dos Documentos (pasta do Google Drive)");
      return;
    }

    setIsConnecting(true);
    try {
      // Build redirect URI (current page without query params)
      const redirectUri = `${window.location.origin}${window.location.pathname}`;

      const { data, error } = await supabase.functions.invoke("google-drive-oauth", {
        body: {
          action: "auth_url",
          projectId,
          redirectUri,
        },
      });

      if (error) throw error;

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      console.error("Error getting auth URL:", err);
      toast.error("Erro ao iniciar conexão com Google Drive");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-drive-oauth", {
        body: {
          action: "disconnect",
          projectId,
        },
      });

      if (error) throw error;

      toast.success("Google Drive desconectado");
      setIsConnected(false);
      setShowDialog(false);
      onConnectionChange?.();
    } catch (err) {
      console.error("Error disconnecting Drive:", err);
      toast.error("Erro ao desconectar Google Drive");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-oauth", {
        body: {
          action: "refresh",
          projectId,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Conexão renovada com sucesso!");
        setIsExpired(false);
      }
    } catch (err) {
      console.error("Error refreshing token:", err);
      toast.error("Erro ao renovar conexão. Reconecte o Google Drive.");
      // If refresh fails, need to reconnect
      handleConnect();
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Drive
      </Button>
    );
  }

  if (!documentsLink) {
    return null; // Don't show if no documents link configured
  }

  return (
    <>
      <Button
        variant={isConnected ? "outline" : "ghost"}
        size="sm"
        className={`h-7 px-2 text-xs ${isConnected ? (isExpired ? 'border-orange-400' : 'border-green-500') : 'text-muted-foreground'}`}
        onClick={() => setShowDialog(true)}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : isConnected ? (
          isExpired ? (
            <AlertCircle className="h-3 w-3 mr-1 text-orange-500" />
          ) : (
            <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
          )
        ) : (
          <FolderOpen className="h-3 w-3 mr-1" />
        )}
        <span className="hidden sm:inline">
          {isConnected ? (isExpired ? "Drive Expirado" : "Drive OK") : "Conectar Drive"}
        </span>
        <span className="sm:hidden">Drive</span>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Integração Google Drive
            </DialogTitle>
            <DialogDescription>
              Conecte o Google Drive para que a IA Coach possa analisar os documentos da pasta vinculada ao projeto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current status */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Status da conexão:</span>
              {isConnected ? (
                isExpired ? (
                  <Badge variant="outline" className="border-orange-400 text-orange-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Expirado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                )
              ) : (
                <Badge variant="secondary">
                  <Unlink className="h-3 w-3 mr-1" />
                  Não conectado
                </Badge>
              )}
            </div>

            {/* Documents link info */}
            {documentsLink && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <span className="text-xs text-muted-foreground">Pasta vinculada:</span>
                <p className="text-sm truncate">{documentsLink}</p>
              </div>
            )}

            {/* Info about what it does */}
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Ao conectar, a IA Coach terá acesso para <strong>ler</strong> os documentos da pasta do Google Drive vinculada:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Google Docs, Sheets e Slides</li>
                <li>Arquivos de texto (.txt, .csv, .md)</li>
                <li>PDFs (metadados apenas)</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isConnected ? (
                <>
                  {isExpired && (
                    <Button onClick={handleRefreshToken} disabled={isConnecting}>
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Renovar Conexão
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-2" />
                    )}
                    Desconectar Google Drive
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Conectar com Google
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
