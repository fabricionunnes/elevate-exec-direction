import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Instagram, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InstagramOAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando sua conta Instagram...");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    // Check both window.location.search and the hash part for query params
    let searchParams = window.location.search;
    
    // Sometimes OAuth redirects put params before the hash
    if (!searchParams && window.location.href.includes("?")) {
      const fullUrl = window.location.href;
      const queryStart = fullUrl.indexOf("?");
      const hashStart = fullUrl.indexOf("#");
      
      if (queryStart !== -1) {
        if (hashStart !== -1 && hashStart > queryStart) {
          searchParams = fullUrl.substring(queryStart, hashStart);
        } else {
          searchParams = fullUrl.substring(queryStart);
        }
      }
    }
    
    const urlParams = new URLSearchParams(searchParams);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    // Clean URL
    window.history.replaceState({}, document.title, window.location.origin + "/#/auth/instagram/callback");

    if (error) {
      console.error("OAuth error:", error, errorDescription);
      setStatus("error");
      setMessage(errorDescription || "Conexão cancelada ou negada pelo usuário.");
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Parâmetros de autenticação inválidos. Tente novamente.");
      return;
    }

    try {
      const decodedState = JSON.parse(atob(state));
      
      setMessage("Trocando código por token de acesso...");

      const { data, error: exchangeError } = await supabase.functions.invoke("instagram-oauth", {
        body: {
          action: "exchange",
          code,
          redirectUri: decodedState.redirectUri,
          staffId: decodedState.staffId,
        },
      });

      if (exchangeError || data?.error) {
        throw new Error(data?.error || exchangeError?.message);
      }

      setStatus("success");
      setMessage(`${data.count || 1} conta(s) Instagram conectada(s) com sucesso!`);
      
      toast.success(`${data.count || 1} conta(s) Instagram conectada(s)!`);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/crm/inbox");
      }, 2000);
    } catch (err: any) {
      console.error("OAuth callback error:", err);
      setStatus("error");
      setMessage(err.message || "Erro ao conectar conta Instagram. Tente novamente.");
    }
  };

  const handleRetry = () => {
    navigate("/crm/inbox");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-6">
          <div className={`p-4 rounded-full ${
            status === "loading" ? "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500" :
            status === "success" ? "bg-green-500" : "bg-destructive"
          }`}>
            {status === "loading" ? (
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            ) : status === "success" ? (
              <CheckCircle className="h-8 w-8 text-white" />
            ) : (
              <XCircle className="h-8 w-8 text-white" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500" />
              <h2 className="text-xl font-semibold">
                {status === "loading" ? "Conectando Instagram" :
                 status === "success" ? "Conexão realizada!" : "Erro na conexão"}
              </h2>
            </div>
            <p className="text-muted-foreground">{message}</p>
          </div>

          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              Redirecionando em alguns segundos...
            </p>
          )}

          {status === "error" && (
            <Button onClick={handleRetry} className="mt-4">
              Voltar ao CRM
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
