import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMetaAdsRedirectUri } from "@/lib/metaAds";

const MetaAdsCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando Meta Ads...");

  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");
    const errorReason = searchParams.get("error_reason");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      setStatus("error");
      setMessage(errorDescription || errorReason || error || "Conexão cancelada ou negada pelo usuário.");
      return;
    }

    if (!code || !stateParam) {
      setStatus("error");
      setMessage("Parâmetros de autenticação não encontrados.");
      return;
    }

    handleCallback(code, stateParam);
  }, [searchParams]);

  const handleCallback = async (code: string, stateParam: string) => {
    try {
      let projectId: string | undefined;
      let stateRedirectUri: string | undefined;
      let returnOrigin: string | undefined;
      let flow: string | undefined;
      let tenantId: string | null = null;
      try {
        const decoded = JSON.parse(atob(stateParam));
        projectId = decoded.project_id;
        stateRedirectUri = decoded.redirect_uri;
        returnOrigin = decoded.return_origin;
        flow = decoded.flow;
        tenantId = decoded.tenant_id ?? null;
      } catch {
        throw new Error("State inválido");
      }

      // ─── CRM Comercial flow ───
      if (flow === "crm_meta_ads") {
        setMessage("Trocando código por token (CRM)...");
        const redirectUri = sessionStorage.getItem("crm_meta_ads_redirect_uri") || stateRedirectUri || "";
        sessionStorage.removeItem("crm_meta_ads_redirect_uri");

        const { data: result, error: err } = await supabase.functions.invoke("crm-meta-ads-sync", {
          body: { action: "connect", code, redirect_uri: redirectUri, oauth_state: stateParam },
        });
        if (err || result?.error) throw new Error(result?.error || "Erro na conexão");

        sessionStorage.setItem("crm_meta_ads_callback", JSON.stringify({
          accounts: result.accounts,
          access_token: result.access_token,
          expires_at: result.expires_at,
          tenant_id: tenantId,
        }));

        setStatus("success");
        setMessage("Meta Ads conectado ao CRM!");
        setTimeout(() => {
          const target = `/crm?tab=traffic`;
          navigate(target, { replace: true });
        }, 1200);
        return;
      }

      // ─── Onboarding (projeto) flow ───
      if (!projectId) throw new Error("Project ID não encontrado");

      setMessage("Trocando código por token de acesso...");

      // Use the exact same redirect_uri that was used to generate the OAuth URL
      // Priority: sessionStorage > state param > stable fallback
      const storedRedirectUri = sessionStorage.getItem("meta_ads_redirect_uri");
      const redirectUri = storedRedirectUri || stateRedirectUri || getMetaAdsRedirectUri();
      sessionStorage.removeItem("meta_ads_redirect_uri");
      
      const { data: result, error: err } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "connect", code, redirect_uri: redirectUri, oauth_state: stateParam, project_id: projectId },
      });

      if (err || result?.error) throw new Error(result?.error || "Erro na conexão");

      // If only one account, auto-save
      if (result.accounts?.length === 1) {
        setMessage("Salvando conexão...");
        const acc = result.accounts[0];
        const { data: { user } } = await supabase.auth.getUser();

        const { error: saveErr } = await supabase.functions.invoke("meta-ads-sync", {
          body: {
            action: "save_connection",
            project_id: projectId,
            ad_account_id: acc.id,
            ad_account_name: acc.name,
            access_token: result.access_token,
            user_id: user?.id,
          },
        });

        if (saveErr) throw saveErr;
      }

      // Store result for the connect component to pick up
      sessionStorage.setItem("meta_ads_callback", JSON.stringify({
        accounts: result.accounts,
        access_token: result.access_token,
        project_id: projectId,
      }));

      setStatus("success");
      setMessage("Meta Ads conectado com sucesso!");

      // Navigate back to the same app origin that initiated the flow when possible
      setTimeout(() => {
        const targetPath = `/onboarding-tasks/${projectId}`;

        if (returnOrigin && returnOrigin !== window.location.origin) {
          window.location.href = `${returnOrigin}/#${targetPath}`;
          return;
        }

        navigate(targetPath, { replace: true });
      }, 1500);
    } catch (e: any) {
      console.error("Meta Ads callback error:", e);
      setStatus("error");
      setMessage(e.message || "Erro ao conectar Meta Ads");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        )}
        {status === "success" && (
          <CheckCircle className="h-10 w-10 text-primary mx-auto" />
        )}
        {status === "error" && (
          <XCircle className="h-10 w-10 text-destructive mx-auto" />
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
};

export default MetaAdsCallbackPage;