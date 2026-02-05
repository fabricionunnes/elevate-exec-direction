import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SocialInstagramCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando ao Instagram...");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setStatus("error");
      setMessage("Autorização negada pelo usuário");
      return;
    }

    if (!code || !stateParam) {
      setStatus("error");
      setMessage("Parâmetros inválidos");
      return;
    }

    processOAuth(code, stateParam);
  }, [searchParams]);

  const processOAuth = async (code: string, stateParam: string) => {
    try {
      // Decode state
      const state = JSON.parse(atob(stateParam));
      const { projectId: pId } = state;
      setProjectId(pId);

      setMessage("Trocando código por token de acesso...");

      const { data, error } = await supabase.functions.invoke("social-instagram-auth", {
        body: {
          action: "exchange",
          code,
          projectId: pId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setStatus("success");
        setAccountName(data.account?.username || null);
        setMessage("Instagram conectado com sucesso!");

        // Close popup after delay
        setTimeout(() => {
          if (window.opener) {
            window.opener.postMessage({ type: "instagram-connected", projectId: pId }, "*");
            window.close();
          }
        }, 2000);
      } else {
        throw new Error(data?.error || "Erro ao conectar");
      }
    } catch (error: any) {
      console.error("Instagram OAuth error:", error);
      setStatus("error");
      setMessage(error.message || "Erro ao conectar com Instagram");
    }
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else if (projectId) {
      navigate(`/social/${projectId}/settings`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-primary-foreground animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Conectando Instagram</h2>
              <p className="text-muted-foreground mt-2">{message}</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-20 w-20 mx-auto rounded-full bg-primary flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-primary">Conectado!</h2>
              {accountName && (
                <p className="text-lg font-medium mt-2">@{accountName}</p>
              )}
              <p className="text-muted-foreground mt-2">
                Esta janela será fechada automaticamente...
              </p>
            </div>
            <Button onClick={handleClose}>Fechar</Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-20 w-20 mx-auto rounded-full bg-destructive flex items-center justify-center">
              <XCircle className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-destructive">Erro na Conexão</h2>
              <p className="text-muted-foreground mt-2">{message}</p>
            </div>
            <Button onClick={handleClose} variant="outline">
              Fechar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
