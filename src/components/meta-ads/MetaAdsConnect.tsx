import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Megaphone, Link2 } from "lucide-react";

interface MetaAdsConnectProps {
  projectId: string;
  onConnected: () => void;
}

export const MetaAdsConnect = ({ projectId, onConnected }: MetaAdsConnectProps) => {
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accessToken, setAccessToken] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Use origin without hash - OAuthRedirectHandler will catch the callback
      const redirectUri = window.location.origin;
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "auth_url", project_id: projectId, redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao gerar URL");

      // Open popup
      const width = 600, height = 700;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const popup = window.open(data.url, "meta-ads-auth", `width=${width},height=${height},left=${left},top=${top}`);

      // Listen for callback
      const handler = async (event: MessageEvent) => {
        if (event.data?.type === "meta-ads-callback" && event.data?.code) {
          window.removeEventListener("message", handler);
          popup?.close();

          // Exchange code
          const { data: result, error: err } = await supabase.functions.invoke("meta-ads-sync", {
            body: { action: "connect", code: event.data.code, redirect_uri: redirectUri, project_id: projectId },
          });
          if (err || result?.error) throw new Error(result?.error || "Erro na conexão");

          setAccounts(result.accounts || []);
          setAccessToken(result.access_token);
          if (result.accounts?.length === 1) {
            setSelectedAccount(result.accounts[0].id);
          }
          setConnecting(false);
        }
      };
      window.addEventListener("message", handler);

      // Check if popup was blocked
      if (!popup) {
        window.removeEventListener("message", handler);
        // Fallback: direct navigation
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao conectar");
      setConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedAccount) return;
    setSaving(true);
    try {
      const acc = accounts.find((a) => a.id === selectedAccount);
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: {
          action: "save_connection",
          project_id: projectId,
          ad_account_id: acc.id,
          ad_account_name: acc.name,
          access_token: accessToken,
          user_id: user?.id,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao salvar");
      toast.success("Meta Ads conectado com sucesso!");
      onConnected();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar conexão");
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Select account
  if (accounts.length > 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <Megaphone className="h-12 w-12 mx-auto text-blue-500" />
          <h3 className="text-lg font-semibold">Selecione a conta de anúncios</h3>
          <div className="max-w-xs mx-auto">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name || acc.account_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={!selectedAccount || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Conectar Conta
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Step 1: Connect
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <h3 className="text-lg font-semibold">Conectar Meta Ads</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Conecte sua conta do Meta Ads para visualizar campanhas, conjuntos de anúncios e criativos com métricas detalhadas de performance.
        </p>
        <Button onClick={handleConnect} disabled={connecting} className="gap-2">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          Conectar com Facebook
        </Button>
      </CardContent>
    </Card>
  );
};
