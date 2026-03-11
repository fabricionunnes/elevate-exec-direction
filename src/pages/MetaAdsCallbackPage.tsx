import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const MetaAdsCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando Meta Ads...");

  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage("Conexão cancelada ou negada pelo usuário.");
      return;
    }

    if (!code || !stateParam) {
      setStatus("error");
      setMessage("Parâmetros de autenticação não encontrados.");
      return;
    }

    handleCallback(code, stateParam);
  }, []);

  const handleCallback = async (code: string, stateParam: string) => {
    try {
      let projectId: string;
      let stateRedirectUri: string | undefined;
      try {
        const decoded = JSON.parse(atob(stateParam));
        projectId = decoded.project_id;
        stateRedirectUri = decoded.redirect_uri;
      } catch {
        throw new Error("State inválido");
      }

      if (!projectId) throw new Error("Project ID não encontrado");

      setMessage("Trocando código por token de acesso...");

      // Use the exact same redirect_uri that was used to generate the OAuth URL
      const storedRedirectUri = sessionStorage.getItem("meta_ads_redirect_uri");
      const redirectUri = storedRedirectUri || window.location.origin;
      sessionStorage.removeItem("meta_ads_redirect_uri");
      
      const { data: result, error: err } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "connect", code, redirect_uri: redirectUri, project_id: projectId },
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

      // Navigate back to project
      setTimeout(() => {
        navigate(`/onboarding-tasks/${projectId}`, { replace: true });
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
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
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