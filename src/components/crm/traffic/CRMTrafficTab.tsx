import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RefreshCw, Megaphone, Settings2, Plug2, CheckCircle2, Filter, X } from "lucide-react";
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
import { SearchableSelect } from "./SearchableSelect";
import { MultiSearchableSelect } from "./MultiSearchableSelect";

interface Props {
  isAdmin: boolean;
}

export const CRMTrafficTab = ({ isAdmin }: Props) => {
  const { account, campaigns, adsets, ads, links, pipelines, leadStats, meetingStats, loading, reload } = useCRMTrafficData();
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState("30");
  const [openSettings, setOpenSettings] = useState(false);

  // Filtros do dashboard
  const [pipelineFilter, setPipelineFilter] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
  const [adsetFilter, setAdsetFilter] = useState<string[]>([]);
  const [adFilter, setAdFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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

  // Aplicar filtros (campanhas/adsets/ads por data + campanha + funil via vínculos)
  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

    const inDate = (ds?: string | null, de?: string | null) => {
      if (!fromTs && !toTs) return true;
      const start = ds ? new Date(ds).getTime() : null;
      const end = de ? new Date(de).getTime() : start;
      if (fromTs && end && end < fromTs) return false;
      if (toTs && start && start > toTs) return false;
      return true;
    };

    // Conjunto de campaign_ids permitidos pelo filtro de funil (via vínculos)
    const pipeSet = pipelineFilter.length > 0 ? new Set(pipelineFilter) : null;
    let allowedCampaignIds: Set<string> | null = null;
    if (pipeSet) {
      allowedCampaignIds = new Set(
        links.filter((l) => pipeSet.has(l.pipeline_id)).map((l) => l.campaign_id),
      );
    }

    const matchStatus = (status?: string | null) => {
      if (statusFilter === "all") return true;
      const isActive = (status || "").toUpperCase() === "ACTIVE";
      return statusFilter === "active" ? isActive : !isActive;
    };

    const campSet = campaignFilter.length > 0 ? new Set(campaignFilter) : null;
    const adsetSet = adsetFilter.length > 0 ? new Set(adsetFilter) : null;
    const adSet = adFilter.length > 0 ? new Set(adFilter) : null;

    const fCampaigns = campaigns.filter((c) => {
      if (campSet && !campSet.has(c.campaign_id)) return false;
      if (allowedCampaignIds && !allowedCampaignIds.has(c.campaign_id)) return false;
      if (!matchStatus(c.status)) return false;
      if (!inDate(c.date_start, c.date_stop)) return false;
      return true;
    });

    const validCampIds = new Set(fCampaigns.map((c) => c.campaign_id));
    const fAdsets = adsets.filter((a) => {
      if (!a.campaign_id || !validCampIds.has(a.campaign_id)) return false;
      if (adsetSet && !adsetSet.has(a.adset_id)) return false;
      if (!matchStatus(a.status)) return false;
      return true;
    });
    const validAdsetIds = new Set(fAdsets.map((a) => a.adset_id));
    const fAds = ads.filter((a) => {
      if (!a.campaign_id || !validCampIds.has(a.campaign_id)) return false;
      if (adsetSet && (!a.adset_id || !validAdsetIds.has(a.adset_id))) return false;
      if (adSet && !adSet.has(a.ad_id)) return false;
      if (!matchStatus(a.status)) return false;
      return true;
    });

    // Se filtros de adset/ad estão ativos, recalcula métricas das campanhas
    // a partir dos adsets/ads filtrados (para refletir nos cards e Custo por Funil)
    let effectiveCampaigns = fCampaigns;
    if (adsetSet || adSet) {
      const source: any[] = adSet ? fAds : fAdsets;
      const agg = new Map<string, { spend: number; impressions: number; clicks: number; leads: number; conversions: number; conversion_value: number }>();
      for (const item of source) {
        if (!item.campaign_id) continue;
        const cur = agg.get(item.campaign_id) || { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, conversion_value: 0 };
        cur.spend += Number(item.spend || 0);
        cur.impressions += Number(item.impressions || 0);
        cur.clicks += Number(item.clicks || 0);
        cur.leads += Number(item.leads || 0);
        cur.conversions += Number(item.conversions || 0);
        cur.conversion_value += Number(item.conversion_value || 0);
        agg.set(item.campaign_id, cur);
      }
      const campMeta = new Map(fCampaigns.map((c) => [c.campaign_id, c]));
      effectiveCampaigns = Array.from(agg.entries()).map(([campaign_id, m]) => {
        const base: any = campMeta.get(campaign_id) || {};
        return {
          ...base,
          campaign_id,
          campaign_name: base.campaign_name || campaign_id,
          spend: m.spend,
          impressions: m.impressions,
          clicks: m.clicks,
          ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
          cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
          cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
          leads: m.leads,
          conversions: m.conversions,
          conversion_value: m.conversion_value,
        };
      });
    }

    // Filtro por funil + data (created_at do lead / event_date da reunião)
    const inDateStr = (d?: string | null) => {
      if (!dateFrom && !dateTo) return true;
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    const fLeadStats = leadStats.filter(
      (s) => (!pipeSet || pipeSet.has(s.pipeline_id)) && inDateStr(s.date),
    );
    const fMeetingStats = meetingStats.filter(
      (s) => (!pipeSet || pipeSet.has(s.pipeline_id)) && inDateStr(s.date),
    );

    return { campaigns: effectiveCampaigns, adsets: fAdsets, ads: fAds, leadStats: fLeadStats, meetingStats: fMeetingStats };
  }, [campaigns, adsets, ads, links, leadStats, meetingStats, pipelineFilter, campaignFilter, adsetFilter, adFilter, statusFilter, dateFrom, dateTo]);

  // Opções dos selects respeitando o filtro de Status (e cascata Campanha → Conjunto → Anúncio)
  const availableOptions = useMemo(() => {
    const matchStatus = (status?: string | null) => {
      if (statusFilter === "all") return true;
      const isActive = (status || "").toUpperCase() === "ACTIVE";
      return statusFilter === "active" ? isActive : !isActive;
    };

    const statusOkCampaigns = campaigns.filter((c) => matchStatus(c.status));
    const statusOkCampaignIds = new Set(statusOkCampaigns.map((c) => c.campaign_id));

    // Funis: somente os com pelo menos uma campanha que bate com o status
    const linkedPipelineIds = new Set(
      links.filter((l) => statusOkCampaignIds.has(l.campaign_id)).map((l) => l.pipeline_id),
    );
    const pipelineOptions = pipelines
      .filter((p) => linkedPipelineIds.has(p.id))
      .map((p) => ({ value: p.id, label: p.name }));

    // Campanhas: status + funil selecionado
    const pipeSet = pipelineFilter.length > 0 ? new Set(pipelineFilter) : null;
    const campaignIdsAllowedByPipe = pipeSet
      ? new Set(links.filter((l) => pipeSet.has(l.pipeline_id)).map((l) => l.campaign_id))
      : null;
    const campaignOptions = Array.from(
      new Map(
        statusOkCampaigns
          .filter((c) => !campaignIdsAllowedByPipe || campaignIdsAllowedByPipe.has(c.campaign_id))
          .map((c) => [c.campaign_id, { value: c.campaign_id, label: c.campaign_name || c.campaign_id }]),
      ).values(),
    );

    const allowedCampaignIdsForChildren = new Set(campaignOptions.map((o) => o.value));
    const campSelectedSet = campaignFilter.length > 0 ? new Set(campaignFilter) : null;

    const adsetOptions = Array.from(
      new Map(
        adsets
          .filter((a) => matchStatus(a.status))
          .filter((a) => a.campaign_id && allowedCampaignIdsForChildren.has(a.campaign_id))
          .filter((a) => !campSelectedSet || (a.campaign_id && campSelectedSet.has(a.campaign_id)))
          .map((a) => [a.adset_id, { value: a.adset_id, label: a.adset_name || a.adset_id }]),
      ).values(),
    );

    const adsetSelectedSet = adsetFilter.length > 0 ? new Set(adsetFilter) : null;
    const adOptions = Array.from(
      new Map(
        ads
          .filter((a) => matchStatus(a.status))
          .filter((a) => a.campaign_id && allowedCampaignIdsForChildren.has(a.campaign_id))
          .filter((a) => !campSelectedSet || (a.campaign_id && campSelectedSet.has(a.campaign_id)))
          .filter((a) => !adsetSelectedSet || (a.adset_id && adsetSelectedSet.has(a.adset_id)))
          .map((a) => [a.ad_id, { value: a.ad_id, label: a.ad_name || a.ad_id }]),
      ).values(),
    );

    return { pipelineOptions, campaignOptions, adsetOptions, adOptions };
  }, [campaigns, adsets, ads, links, pipelines, statusFilter, pipelineFilter, campaignFilter, adsetFilter]);

  const availablePipelineOptions = availableOptions.pipelineOptions;
  const availableCampaignOptions = availableOptions.campaignOptions;
  const availableAdsetOptions = availableOptions.adsetOptions;
  const availableAdOptions = availableOptions.adOptions;

  const hasFilters = pipelineFilter.length > 0 || campaignFilter.length > 0 || adsetFilter.length > 0 || adFilter.length > 0 || statusFilter !== "active" || dateFrom || dateTo;
  const clearFilters = () => {
    setPipelineFilter([]);
    setCampaignFilter([]);
    setAdsetFilter([]);
    setAdFilter([]);
    setStatusFilter("active");
    setDateFrom("");
    setDateTo("");
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
      {/* Hero/status header com gradiente */}
      <Card className="relative overflow-hidden border-border/40 shadow-xl">
        {/* Background gradiente sutil */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-violet-500/5 to-pink-500/10" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-pink-500/20 to-fuchsia-500/20 rounded-full blur-3xl" />

        <CardContent className="relative p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 via-violet-500 to-pink-500 shadow-lg ring-1 ring-white/10">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-bold truncate bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  {account.ad_account_name || account.ad_account_id}
                </p>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Conectado</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {account.last_synced_at
                  ? `Última sincronização: ${format(new Date(account.last_synced_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                  : "Ainda não sincronizado"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-[140px] text-xs bg-background/60 backdrop-blur"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button
                onClick={handleSync}
                disabled={syncing}
                size="sm"
                className="gap-1.5 bg-gradient-to-br from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white border-0 shadow-md hover:shadow-lg transition-all"
              >
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sincronizar
              </Button>
            )}
            {isAdmin && (
              <Sheet open={openSettings} onOpenChange={setOpenSettings}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 bg-background/60 backdrop-blur">
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
              <Button onClick={handleDisconnect} variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Plug2 className="h-3.5 w-3.5" /> Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="border-border/40 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1 rounded-md bg-gradient-to-br from-blue-500/20 to-violet-500/20">
              <Filter className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold">Filtros</p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs gap-1 hover:text-destructive">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
          {/* Linha 1: Status, Funil, Datas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <SearchableSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as any)}
                options={[
                  { value: "active", label: "Apenas ativos" },
                  { value: "inactive", label: "Apenas inativos" },
                  { value: "all", label: "Todos" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Funil</Label>
              <MultiSearchableSelect
                values={pipelineFilter}
                onChange={setPipelineFilter}
                allLabel="Todos os funis"
                options={availablePipelineOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Data inicial</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Data final</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>

          {/* Linha 2: Campanha, Conjunto de Anúncios, Anúncios (mais largos) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Campanha</Label>
              <MultiSearchableSelect
                values={campaignFilter}
                onChange={setCampaignFilter}
                allLabel="Todas as campanhas"
                options={availableCampaignOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Conjunto de Anúncios</Label>
              <MultiSearchableSelect
                values={adsetFilter}
                onChange={setAdsetFilter}
                allLabel="Todos os conjuntos"
                options={availableAdsetOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Anúncios</Label>
              <MultiSearchableSelect
                values={adFilter}
                onChange={setAdFilter}
                allLabel="Todos os anúncios"
                options={availableAdOptions}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <CRMTrafficDashboard
        campaigns={filtered.campaigns}
        adsets={filtered.adsets}
        ads={filtered.ads}
        links={links}
        pipelines={pipelines}
        leadStats={filtered.leadStats}
        meetingStats={filtered.meetingStats}
      />
    </div>
  );
};
