import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Building2, CreditCard, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

interface ContaAzulStatus {
  connected: boolean;
  lastSync: string | null;
  status: string | null;
}

export function IntegrationsPanel() {
  const [searchParams] = useSearchParams();
  const [contaAzulStatus, setContaAzulStatus] = useState<ContaAzulStatus>({
    connected: false,
    lastSync: null,
    status: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadStatus();
    
    // Check for OAuth callback params
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    
    if (success === "true") {
      toast.success("Conta Azul conectado com sucesso!");
      loadStatus();
    } else if (error) {
      const errorMessages: Record<string, string> = {
        auth_denied: "Autorização negada pelo usuário",
        no_code: "Código de autorização não recebido",
        invalid_state: "Erro de validação de segurança",
        token_failed: "Falha ao obter token de acesso",
        unknown: "Erro desconhecido na conexão"
      };
      toast.error(errorMessages[error] || "Erro na conexão");
    }
  }, [searchParams]);

  const loadStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("conta-azul-oauth?action=status");
      
      if (error) throw error;
      
      setContaAzulStatus({
        connected: data?.connected || false,
        lastSync: data?.lastSync,
        status: data?.status
      });
    } catch (error) {
      console.error("Error loading Conta Azul status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Capture current URL to return after OAuth
      const returnUrl = window.location.origin;
      
      const { data, error } = await supabase.functions.invoke("conta-azul-oauth", {
        body: { action: "get-auth-url", returnUrl }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        // Try to navigate in the top window (works in iframes)
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.authUrl;
          } else {
            window.location.href = data.authUrl;
          }
        } catch {
          // If blocked by sandbox, open in new tab
          const newWindow = window.open(data.authUrl, "_blank", "noopener,noreferrer");
          if (!newWindow) {
            toast.error("Permita pop-ups para continuar com a conexão");
            setIsConnecting(false);
          }
        }
      }
    } catch (error: any) {
      console.error("Error getting auth URL:", error);
      toast.error("Erro ao iniciar conexão: " + error.message);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase.functions.invoke("conta-azul-oauth?action=disconnect");
      
      if (error) throw error;
      
      toast.success("Conta Azul desconectado");
      setContaAzulStatus({ connected: false, lastSync: null, status: null });
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast.error("Erro ao desconectar: " + error.message);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("conta-azul-oauth?action=sync");

      if (error) throw error;

      const salesSynced = data?.sales?.synced ?? data?.receivables?.synced ?? 0;
      const purchasesSynced = data?.purchases?.synced ?? data?.payables?.synced ?? 0;

      toast.success(`Sincronização concluída! ${salesSynced} vendas, ${purchasesSynced} compras`);
      loadStatus();
    } catch (error: any) {
      console.error("Error syncing:", error);
      toast.error("Erro na sincronização: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return "Nunca sincronizado";
    return new Date(date).toLocaleString("pt-BR");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrações</h2>
        <p className="text-muted-foreground">Conecte sistemas externos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                </div>
                Conta Azul
              </CardTitle>
              {isLoading ? (
                <Badge variant="outline">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Carregando
                </Badge>
              ) : contaAzulStatus.connected ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline">Não configurado</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sincronize clientes, contratos, contas a pagar/receber e pagamentos automaticamente.
            </p>
            
            {contaAzulStatus.connected && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Última sincronização: {formatLastSync(contaAzulStatus.lastSync)}
              </div>
            )}
            
            <div className="flex gap-2">
              {contaAzulStatus.connected ? (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sincronizar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleDisconnect}
                    title="Desconectar"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleConnect}
                  disabled={isConnecting || isLoading}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Conectar Conta Azul
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-emerald-500" />
                </div>
                Open Banking
              </CardTitle>
              <Badge variant="outline">Em breve</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte suas contas bancárias para importar extratos e conciliar automaticamente.
            </p>
            <Button variant="outline" className="w-full" disabled>
              <Link2 className="h-4 w-4 mr-2" />
              Em Desenvolvimento
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status das Integrações</CardTitle>
        </CardHeader>
        <CardContent>
          {contaAzulStatus.connected ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Conta Azul</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {contaAzulStatus.status || "Conectado"}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500">Ativo</Badge>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma integração ativa. Configure acima para começar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
