import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, RefreshCw, Megaphone, Settings2, Plug2, CheckCircle2 } from "lucide-react";
import { useCRMTrafficData } from "./useCRMTrafficData";
import { CRMMetaAdsConnect } from "./CRMMetaAdsConnect";
import { CRMTrafficDashboard } from "./CRMTrafficDashboard";
import { CRMCampaignPipelineLinks } from "./CRMCampaignPipelineLinks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  isAdmin: boolean;
}

export const CRMTrafficTab = ({ isAdmin }: Props) => {
  const { account, campaigns, adsets, ads, links, pipelines, leadStats, loading, reload } = useCRMTrafficData();
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState("30");
  const [openSettings, setOpenSettings] = useState(false);

  const handleSync = async () => {
    if (!account) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-meta-ads-sync", {
        body: { action: "sync", account_id: account.id, days: Number(days) },
      });
      if (error || data?.error) throw new Error(data?.error || "Falha na sincronização");
      toast.success(`Sincronizado! ${data.campaigns} campanhas, ${data.adsets} conjuntos, ${data.ads} criativos.`);
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!account || !confirm("Desconectar a conta Meta Ads do CRM?")) return;
    const { error } = await supabase.functions.invoke("crm-meta-ads-sync", {
      body: { action: "disconnect", account_id: account.id },
    });
    if (error) return toast.error(error.message);
    toast.success("Conta desconectada");
    reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <CRMMetaAdsConnect onConnected={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de status/ações */}
      <Card className="border-border/40">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold truncate">{account.ad_account_name || account.ad_account_id}</p>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {account.last_synced_at
                  ? `Última sync: ${format(new Date(account.last_synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                  : "Ainda não sincronizado"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button onClick={handleSync} disabled={syncing} size="sm" className="gap-1.5">
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sincronizar
              </Button>
            )}
            {isAdmin && (
              <Sheet open={openSettings} onOpenChange={setOpenSettings}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Vínculos
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-2xl overflow-auto">
                  <SheetHeader>
                    <SheetTitle>Vincular campanhas a funis</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <CRMCampaignPipelineLinks
                      account={account}
                      campaigns={campaigns}
                      links={links}
                      pipelines={pipelines}
                      onChanged={reload}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
            {isAdmin && (
              <Button onClick={handleDisconnect} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <Plug2 className="h-3.5 w-3.5" /> Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <CRMTrafficDashboard
        campaigns={campaigns}
        adsets={adsets}
        ads={ads}
        links={links}
        pipelines={pipelines}
        leadStats={leadStats}
      />
    </div>
  );
};
