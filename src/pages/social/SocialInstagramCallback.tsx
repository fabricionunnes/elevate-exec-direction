import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InstagramAccountOption {
  instagram_user_id: string;
  username: string;
  profile_picture_url: string | null;
  followers_count: number;
  facebook_page_name: string;
  facebook_page_id?: string;
}

export default function SocialInstagramCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "selecting" | "success" | "error">("loading");
  const [message, setMessage] = useState("Conectando ao Instagram...");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InstagramAccountOption[]>([]);
  const [selectingId, setSelectingId] = useState<string | null>(null);

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
      const state = JSON.parse(atob(stateParam));
      const { projectId: pId, redirectUri, flow } = state;
      setProjectId(pId);

      setMessage("Trocando código por token de acesso...");

      const callbackRedirectUri = redirectUri || window.location.origin + "/";
      const edgeFunction = flow === "social" ? "social-instagram-auth" : "instagram-project-oauth";
      const bodyPayload = flow === "social"
        ? { action: "exchange", code, projectId: pId, redirectUri: callbackRedirectUri }
        : { action: "callback", code, projectId: pId, redirectUri: callbackRedirectUri };

      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: bodyPayload,
      });

      if (error) throw error;

      if (data?.success && data?.multiple) {
        // Multiple accounts found — show selection UI
        setAccounts(data.accounts);
        setProjectId(data.projectId || pId);
        setStatus("selecting");
        return;
      }

      if (data?.success) {
        setAccountName(data.account?.username || data.username || null);
        setMessage("Instagram conectado!");

        const accountId = data.accountId;
        if (accountId) {
          try {
            await supabase.functions.invoke("instagram-project-oauth", {
              body: { action: "sync", accountId },
            });
          } catch (syncErr) {
            console.warn("Auto-sync failed:", syncErr);
          }
        }

        setStatus("success");
        notifyParentAndClose(pId);
      } else {
        throw new Error(data?.error || "Erro ao conectar");
      }
    } catch (error: any) {
      console.error("Instagram OAuth error:", error);
      setStatus("error");
      setMessage(error.message || "Erro ao conectar com Instagram");
    }
  };

  const handleSelectAccount = async (account: InstagramAccountOption) => {
    if (!projectId) return;
    setSelectingId(account.instagram_user_id);

    try {
      const { data, error } = await supabase.functions.invoke("social-instagram-auth", {
        body: {
          action: "select_account",
          projectId,
          instagramUserId: account.instagram_user_id,
          username: account.username,
          profilePictureUrl: account.profile_picture_url,
          followersCount: account.followers_count,
          facebookPageId: account.facebook_page_id,
          facebookPageName: account.facebook_page_name,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao selecionar conta");

      setAccountName(account.username);
      setStatus("success");
      setMessage("Instagram conectado!");
      notifyParentAndClose(projectId);
    } catch (err: any) {
      console.error("Error selecting account:", err);
      setStatus("error");
      setMessage(err.message || "Erro ao selecionar conta");
    } finally {
      setSelectingId(null);
    }
  };

  const notifyParentAndClose = (pId: string) => {
    if (window.opener) {
      setTimeout(() => {
        window.opener.postMessage({ type: "instagram-connected", projectId: pId }, "*");
        window.close();
      }, 2000);
    }
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else if (projectId) {
      navigate(`/social/${projectId}/settings`);
    } else {
      navigate("/onboarding-tasks/login");
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

        {status === "selecting" && (
          <>
            <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
              <Instagram className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Escolha a conta Instagram</h2>
              <p className="text-muted-foreground mt-2">
                {accounts.length > 1 
                  ? `Encontramos ${accounts.length} contas Instagram Business conectadas ao seu Facebook. Selecione qual deseja usar:`
                  : "Selecione a conta Instagram Business para conectar:"
                }
              </p>
            </div>
            <div className="space-y-3 text-left">
              {accounts.map((account) => (
                <Card
                  key={account.instagram_user_id}
                  className="p-4 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                  onClick={() => !selectingId && handleSelectAccount(account)}
                >
                  <div className="flex items-center gap-3">
                    {account.profile_picture_url ? (
                      <img
                        src={account.profile_picture_url}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                        <Instagram className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">@{account.username}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Página: {account.facebook_page_name}
                      </p>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {account.followers_count?.toLocaleString("pt-BR")} seguidores
                      </Badge>
                    </div>
                    {selectingId === account.instagram_user_id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Button size="sm" variant="outline">Conectar</Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            {accounts.length <= 1 && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 text-left">
                💡 Não encontrou todas as contas? Apenas contas <strong>Instagram Business ou Creator</strong> vinculadas a uma <strong>Página do Facebook</strong> aparecem aqui. Verifique se as outras contas estão configuradas como Business/Creator e conectadas a uma página.
              </p>
            )}
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
              {window.opener ? (
                <p className="text-muted-foreground mt-2">
                  Esta janela será fechada automaticamente...
                </p>
              ) : (
                <p className="text-muted-foreground mt-2">
                  Instagram conectado! Volte ao painel para continuar.
                </p>
              )}
            </div>
            <Button onClick={handleClose}>Voltar ao CRM</Button>
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
              Voltar ao CRM
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
