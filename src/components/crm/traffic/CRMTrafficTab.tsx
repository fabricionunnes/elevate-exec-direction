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

interface Props {
  isAdmin: boolean;
}

export const CRMTrafficTab = ({ isAdmin }: Props) => {
  const { account, campaigns, adsets, ads, links, pipelines, leadStats, meetingStats, loading, reload } = useCRMTrafficData();
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState("30");
  const [openSettings, setOpenSettings] = useState(false);

  // Filtros do dashboard
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
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
    let allowedCampaignIds: Set<string> | null = null;
    if (pipelineFilter !== "all") {
      allowedCampaignIds = new Set(
        links.filter((l) => l.pipeline_id === pipelineFilter).map((l) => l.campaign_id),
      );
    }

    const fCampaigns = campaigns.filter((c) => {
      if (campaignFilter !== "all" && c.campaign_id !== campaignFilter) return false;
      if (allowedCampaignIds && !allowedCampaignIds.has(c.campaign_id)) return false;
      if (!inDate(c.date_start, c.date_stop)) return false;
      return true;
    });

    const validCampIds = new Set(fCampaigns.map((c) => c.campaign_id));
    const fAdsets = adsets.filter((a) => a.campaign_id && validCampIds.has(a.campaign_id));
    const fAds = ads.filter((a) => a.campaign_id && validCampIds.has(a.campaign_id));

    // Para leads/reuniões: filtramos apenas por funil (o vínculo campanha→funil já garante atribuição correta).
    // Filtro por campanha afeta apenas gasto/impressões/cliques/criativos.
    const fLeadStats = leadStats.filter(
      (s) => pipelineFilter === "all" || s.pipeline_id === pipelineFilter,
    );
    const fMeetingStats = meetingStats.filter(
      (s) => pipelineFilter === "all" || s.pipeline_id === pipelineFilter,
    );

    return { campaigns: fCampaigns, adsets: fAdsets, ads: fAds, leadStats: fLeadStats, meetingStats: fMeetingStats };
  }, [campaigns, adsets, ads, links, leadStats, meetingStats, pipelineFilter, campaignFilter, dateFrom, dateTo]);

  const hasFilters = pipelineFilter !== "all" || campaignFilter !== "all" || dateFrom || dateTo;
  const clearFilters = () => {
    setPipelineFilter("all");
    setCampaignFilter("all");
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

      {/* Filtros */}
      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Filtros</p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Funil</Label>
              <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funis</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Campanha</Label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.campaign_id} value={c.campaign_id}>
                      {c.campaign_name || c.campaign_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
