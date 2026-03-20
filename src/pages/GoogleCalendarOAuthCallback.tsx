import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const fallbackPath = "/crm/office";

const decodeState = (state: string | null) => {
  if (!state) return null;

  try {
    return JSON.parse(atob(state));
  } catch {
    return null;
  }
};

const GoogleCalendarOAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const finishOAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");
      const decodedState = decodeState(params.get("state"));
      const returnPath = decodedState?.returnPath || fallbackPath;

      if (error) {
        toast.error("A conexão com Google Agenda foi cancelada ou falhou");
        navigate(returnPath, { replace: true });
        return;
      }

      if (!code || decodedState?.flow !== "google_calendar") {
        toast.error("Retorno do Google Agenda inválido");
        navigate(returnPath, { replace: true });
        return;
      }

      try {
        const { error: exchangeError } = await supabase.functions.invoke("google-calendar?action=exchange-code", {
          body: {
            code,
            redirectUri: window.location.origin,
          },
        });

        if (exchangeError) throw exchangeError;

        toast.success("Google Agenda conectada com sucesso");
      } catch (exchangeError) {
        console.error("Google Calendar OAuth callback error:", exchangeError);
        toast.error("Não foi possível concluir a conexão com Google Agenda");
      } finally {
        navigate(returnPath, { replace: true });
      }
    };

    void finishOAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm">Conectando sua Google Agenda...</span>
      </div>
    </div>
  );
};

export default GoogleCalendarOAuthCallback;