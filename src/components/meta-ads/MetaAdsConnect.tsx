import { useState, useEffect } from "react";
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

  // Check for callback result from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("meta_ads_callback");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.project_id === projectId) {
          sessionStorage.removeItem("meta_ads_callback");
          if (data.accounts?.length === 1) {
            // Auto-connected, just refresh
            onConnected();
          } else if (data.accounts?.length > 1) {
            setAccounts(data.accounts);
            setAccessToken(data.access_token);
          }
        }
      } catch {
        sessionStorage.removeItem("meta_ads_callback");
      }
    }
  }, [projectId]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/meta-ads-callback`;
      // Store the exact redirect_uri so the callback page uses the same one
      sessionStorage.setItem("meta_ads_redirect_uri", redirectUri);
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "auth_url", project_id: projectId, redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao gerar URL");

      // Navigate directly (no popup - avoids blockers)
      window.location.href = data.url;
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
          <Megaphone className="h-12 w-12 mx-auto text-primary" />
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