import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, Unlink, BarChart3, Layers, Megaphone, Image, FileDown, ArrowRightLeft } from "lucide-react";
import { MetaAdsConnect } from "./MetaAdsConnect";
import { MetaAdsOverview } from "./MetaAdsOverview";
import { MetaAdsCampaigns } from "./MetaAdsCampaigns";
import { MetaAdsAdsets } from "./MetaAdsAdsets";
import { MetaAdsCreatives } from "./MetaAdsCreatives";
import { MetaAdsComparison } from "./MetaAdsComparison";
import { MetaAdsDateFilter } from "./MetaAdsDateFilter";
import { generateMetaAdsPdf } from "./MetaAdsPdfReport";

interface MetaAdsModuleProps {
  projectId: string;
  isStaff?: boolean;
}

export const MetaAdsModule = ({ projectId, isStaff = false }: MetaAdsModuleProps) => {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateStop, setDateStop] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchAccount = useCallback(async () => {
    const { data } = await supabase
      .from("meta_ads_accounts")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_connected", true)
      .maybeSingle();
    setAccount(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-ads-sync", {
        body: { action: "sync", project_id: projectId, date_start: dateStart, date_stop: dateStop },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizado! ${data.synced.campaigns} campanhas, ${data.synced.adsets} conjuntos, ${data.synced.ads} anúncios`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    const { error } = await supabase.functions.invoke("meta-ads-sync", {
      body: { action: "disconnect", project_id: projectId },
    });
    if (!error) {
      setAccount(null);
      toast.success("Meta Ads desconectado");
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await generateMetaAdsPdf(projectId, dateStart, dateStop, account?.ad_account_name || account?.ad_account_id || "");
      toast.success("PDF gerado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + (e.message || ""));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return <MetaAdsConnect projectId={projectId} onConnected={fetchAccount} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            Meta Ads
          </h2>
          <p className="text-xs text-muted-foreground">
            Conta: {account.ad_account_name || account.ad_account_id}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MetaAdsDateFilter
            dateStart={dateStart}
            dateStop={dateStop}
            onDateStartChange={setDateStart}
            onDateStopChange={setDateStop}
          />
          <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloading} className="gap-1.5">
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Baixar PDF
          </Button>
          {isStaff && (
            <Button size="sm" variant="ghost" onClick={handleDisconnect} className="gap-1.5 text-destructive">
              <Unlink className="h-3.5 w-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="adsets" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Conjuntos
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-1.5">
            <Image className="h-3.5 w-3.5" />
            Criativos
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Comparativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <MetaAdsOverview projectId={projectId} dateStart={dateStart} dateStop={dateStop} syncing={syncing} />
        </TabsContent>
        <TabsContent value="campaigns">
          <MetaAdsCampaigns projectId={projectId} dateStart={dateStart} dateStop={dateStop} />
        </TabsContent>
        <TabsContent value="adsets">
          <MetaAdsAdsets projectId={projectId} dateStart={dateStart} dateStop={dateStop} />
        </TabsContent>
        <TabsContent value="creatives">
          <MetaAdsCreatives projectId={projectId} dateStart={dateStart} dateStop={dateStop} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
