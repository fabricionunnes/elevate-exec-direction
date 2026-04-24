import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Megaphone, Link2 } from "lucide-react";

const STABLE_REDIRECT = "https://elevate-exec-direction.lovable.app/crm-meta-ads-callback";

interface Props {
  onConnected: () => void;
}

export const CRMMetaAdsConnect = ({ onConnected }: Props) => {
  const [connecting, setConnecting] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accessToken, setAccessToken] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  // Recupera resultado do callback
  useEffect(() => {
    const stored = sessionStorage.getItem("crm_meta_ads_callback");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        sessionStorage.removeItem("crm_meta_ads_callback");
        if (data.accounts?.length === 1) {
          autoSave(data.accounts[0], data.access_token, data.expires_at, data.tenant_id);
        } else if (data.accounts?.length > 1) {
          setAccounts(data.accounts);
          setAccessToken(data.access_token);
          setExpiresAt(data.expires_at);
          setTenantId(data.tenant_id);
        }
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoSave = async (acc: any, token: string, expires: string | null, tenant: string | null) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("crm-meta-ads-sync", {
        body: {
          action: "save_connection",
          tenant_id: tenant,
          ad_account_id: acc.id,
          ad_account_name: acc.name,
          access_token: token,
          expires_at: expires,
          user_id: user?.id,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Falha ao salvar");
      toast.success("Conta Meta Ads conectada ao CRM!");
      onConnected();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      sessionStorage.setItem("crm_meta_ads_redirect_uri", STABLE_REDIRECT);
      const { data, error } = await supabase.functions.invoke("crm-meta-ads-sync", {
        body: {
          action: "auth_url",
          tenant_id: null,
          redirect_uri: STABLE_REDIRECT,
          return_origin: window.location.origin,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao gerar URL");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Erro ao conectar");
      setConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    const acc = accounts.find((a) => a.id === selected);
    await autoSave(acc, accessToken, expiresAt, tenantId);
  };

  if (accounts.length > 0) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardContent className="py-10 text-center space-y-4">
          <Megaphone className="h-12 w-12 mx-auto text-primary" />
          <h3 className="text-lg font-bold">Selecione a conta de anúncios</h3>
          <p className="text-sm text-muted-foreground">Escolha qual conta Meta Ads alimentará o CRM Comercial.</p>
          <div className="max-w-sm mx-auto">
            <Select value={selected} onValueChange={setSelected}>
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
          <Button onClick={handleSave} disabled={!selected || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Conectar conta ao CRM
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg">
      <CardContent className="py-12 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
          <Megaphone className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-bold">Conectar Meta Ads ao CRM</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Sincronize campanhas, conjuntos de anúncios e criativos. Vincule cada campanha a um ou mais funis para medir CPL, CAC e ROAS por funil, campanha e criativo.
        </p>
        <Button onClick={handleConnect} disabled={connecting} size="lg" className="gap-2">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          Conectar com Facebook
        </Button>
      </CardContent>
    </Card>
  );
};
