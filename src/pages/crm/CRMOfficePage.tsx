import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCRMContext } from "./CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { startGoogleCalendarConnection } from "@/lib/googleCalendarOAuth";

export const CRMOfficePage = () => {
  const { staffName, staffRole } = useCRMContext();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkConnection = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        console.warn("No active session — skipping Google Calendar check");
        setIsConnected(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("google-calendar?action=check-connection");
      if (error) throw error;
      setIsConnected(data?.connected ?? false);
    } catch (err) {
      console.error("Error checking Google Calendar connection:", err);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await startGoogleCalendarConnection(window.location.hash.replace(/^#/, "") || "/crm/office");
    } catch (err: any) {
      console.error("Error connecting Google Calendar:", err);
      toast.error("Erro ao conectar Google Agenda");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar?action=disconnect");
      if (error) throw error;
      setIsConnected(false);
      toast.success("Google Agenda desconectada");
    } catch (err) {
      console.error("Error disconnecting:", err);
      toast.error("Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Escritório</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas integrações e ferramentas de trabalho
        </p>
      </div>

      {/* Google Calendar Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg">Google Agenda</CardTitle>
              <CardDescription className="mt-1">
                Conecte sua conta Google para sincronizar eventos, criar reuniões com Meet e gerenciar sua agenda diretamente pelo CRM.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Verificando conexão...</span>
            </div>
          ) : isConnected ? (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Conectado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sua Google Agenda está sincronizada com o CRM
                  </p>
                </div>
                <Badge variant="outline" className="border-green-500/30 text-green-600 text-xs shrink-0">
                  Ativo
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setLoading(true); checkConnection(); }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Verificar status
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="h-3.5 w-3.5" />
                  )}
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Não conectado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Conecte sua conta Google para utilizar a agenda integrada
                  </p>
                </div>
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="gap-2"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Conectar Google Agenda
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Como funciona:</strong> Ao conectar sua Google Agenda, seus eventos serão
            sincronizados automaticamente com o CRM. Atividades com data e hora serão criadas
            como eventos no seu calendário, e reuniões poderão incluir links do Google Meet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
