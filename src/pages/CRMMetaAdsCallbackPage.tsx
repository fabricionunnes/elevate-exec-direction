import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STABLE_REDIRECT = "https://elevate-exec-direction.lovable.app/crm-meta-ads-callback";

const CRMMetaAdsCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando Meta Ads ao CRM...");

  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error_description") || searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(error);
      return;
    }
    if (!code || !stateParam) {
      setStatus("error");
      setMessage("Parâmetros de autenticação ausentes.");
      return;
    }

    (async () => {
      try {
        let tenantId: string | null = null;
        let returnOrigin: string | undefined;
        try {
          const decoded = JSON.parse(atob(stateParam));
          tenantId = decoded.tenant_id ?? null;
          returnOrigin = decoded.return_origin;
        } catch {
          // continue
        }

        const redirectUri =
          sessionStorage.getItem("crm_meta_ads_redirect_uri") || STABLE_REDIRECT;
        sessionStorage.removeItem("crm_meta_ads_redirect_uri");

        setMessage("Trocando código por token...");
        const { data, error: err } = await supabase.functions.invoke("crm-meta-ads-sync", {
          body: { action: "connect", code, redirect_uri: redirectUri },
        });
        if (err || data?.error) throw new Error(data?.error || "Falha no OAuth");

        const accounts = data.accounts || [];

        // Persistimos em sessionStorage para a tela do CRM finalizar a escolha da conta
        sessionStorage.setItem(
          "crm_meta_ads_callback",
          JSON.stringify({
            accounts,
            access_token: data.access_token,
            expires_at: data.expires_at,
            tenant_id: tenantId,
          }),
        );

        setStatus("success");
        setMessage("Conectado! Selecione a conta de anúncios no CRM.");
        setTimeout(() => {
          if (returnOrigin && returnOrigin !== window.location.origin) {
            window.location.href = `${returnOrigin}/#/crm/dashboard?tab=traffic`;
          } else {
            navigate("/crm/dashboard?tab=traffic", { replace: true });
          }
        }, 1200);
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Erro ao conectar Meta Ads");
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />}
        {status === "success" && <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />}
        {status === "error" && <XCircle className="h-10 w-10 text-destructive mx-auto" />}
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <Button variant="outline" onClick={() => navigate("/crm/dashboard")}>
            Voltar ao CRM
          </Button>
        )}
      </div>
    </div>
  );
};

export default CRMMetaAdsCallbackPage;
