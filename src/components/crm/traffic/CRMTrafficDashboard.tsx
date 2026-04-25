import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, MousePointerClick, Eye, Users, TrendingDown, TrendingUp, Layers,
  Image as ImageIcon, Target, CalendarCheck, CalendarClock, Receipt,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import type {
  CRMMetaCampaign, CRMMetaAdset, CRMMetaAd,
  CampaignPipelineLink, PipelineLeadCount, MeetingStat,
} from "./useCRMTrafficData";
import { CRMTrafficCompare } from "./CRMTrafficCompare";

interface Props {
  campaigns: CRMMetaCampaign[];
  adsets: CRMMetaAdset[];
  ads: CRMMetaAd[];
  links: CampaignPipelineLink[];
  pipelines: { id: string; name: string }[];
  leadStats: PipelineLeadCount[];
  meetingStats?: MeetingStat[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtInt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const fmtPct = (v: number) => `${(v || 0).toFixed(2)}%`;
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export const CRMTrafficDashboard = ({
  campaigns, adsets, ads, links, pipelines, leadStats, meetingStats = [],
}: Props) => {
  // Totais gerais
  const totals = useMemo(() => {
    const t = campaigns.reduce(
      (acc, c) => {
        acc.spend += Number(c.spend || 0);
        acc.impressions += Number(c.impressions || 0);
        acc.clicks += Number(c.clicks || 0);
        acc.leads += Number(c.leads || 0);
        acc.conversions += Number(c.conversions || 0);
        acc.conversion_value += Number(c.conversion_value || 0);
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, conversion_value: 0 },
    );
    return {
      ...t,
      ctr: safeDiv(t.clicks, t.impressions) * 100,
      cpc: safeDiv(t.spend, t.clicks),
      cpm: safeDiv(t.spend, t.impressions) * 1000,
      cpl: safeDiv(t.spend, t.leads),
      cac: safeDiv(t.spend, t.conversions),
      roas: safeDiv(t.conversion_value, t.spend),
    };
  }, [campaigns]);

  // Por funil: somar gasto das campanhas vinculadas (com peso); leads/reuniões via stats por utm_campaign
  const perPipeline = useMemo(() => {
    // Agrega campanhas por campaign_id (há múltiplas linhas: 1 por dia)
    const campMap = new Map<string, { spend: number; leads: number }>();
    for (const c of campaigns) {
      const cur = campMap.get(c.campaign_id) || { spend: 0, leads: 0 };
      cur.spend += Number(c.spend || 0);
      cur.leads += Number(c.leads || 0);
      campMap.set(c.campaign_id, cur);
    }
    const pipeMap = new Map(pipelines.map((p) => [p.id, p.name]));

    // Pipelines permitidos: apenas os vinculados a alguma campanha presente no filtro atual
    const allowedPipelineIds = new Set(
      links.filter((l) => campMap.has(l.campaign_id)).map((l) => l.pipeline_id),
    );

    type Row = {
      pipeline_id: string; pipeline_name: string;
      spend: number; leads_meta: number; leads_crm: number;
      won: number; won_value: number;
      meetings_scheduled: number; meetings_realized: number;
    };
    const map = new Map<string, Row>();

    const empty = (id: string): Row => ({
      pipeline_id: id,
      pipeline_name: pipeMap.get(id) || "—",
      spend: 0, leads_meta: 0, leads_crm: 0, won: 0, won_value: 0,
      meetings_scheduled: 0, meetings_realized: 0,
    });

    for (const link of links) {
      const camp = campMap.get(link.campaign_id);
      if (!camp) continue;
      const w = Number(link.weight || 1);
      const cur = map.get(link.pipeline_id) || empty(link.pipeline_id);
      cur.spend += Number(camp.spend || 0) * w;
      cur.leads_meta += Number(camp.leads || 0) * w;
      map.set(link.pipeline_id, cur);
    }

    for (const stat of leadStats) {
      if (!allowedPipelineIds.has(stat.pipeline_id)) continue;
      const cur = map.get(stat.pipeline_id) || empty(stat.pipeline_id);
      cur.leads_crm += stat.total;
      cur.won += stat.won;
      cur.won_value += stat.won_value;
      map.set(stat.pipeline_id, cur);
    }

    for (const ms of meetingStats) {
      if (!allowedPipelineIds.has(ms.pipeline_id)) continue;
      const cur = map.get(ms.pipeline_id) || empty(ms.pipeline_id);
      cur.meetings_scheduled += ms.scheduled;
      cur.meetings_realized += ms.realized;
      map.set(ms.pipeline_id, cur);
    }

    return Array.from(map.values()).map((r) => ({
      ...r,
      cpl: safeDiv(r.spend, r.leads_crm || r.leads_meta),
      cac: safeDiv(r.spend, r.won),
      roas: safeDiv(r.won_value, r.spend),
      cost_per_scheduled: safeDiv(r.spend, r.meetings_scheduled),
      cost_per_realized: safeDiv(r.spend, r.meetings_realized),
    })).sort((a, b) => b.spend - a.spend);
  }, [campaigns, links, pipelines, leadStats, meetingStats]);

  const meetingTotals = useMemo(() => {
    const sched = perPipeline.reduce((s, r) => s + r.meetings_scheduled, 0);
    const real = perPipeline.reduce((s, r) => s + r.meetings_realized, 0);
    return {
      scheduled: sched,
      realized: real,
      cost_per_scheduled: safeDiv(totals.spend, sched),
      cost_per_realized: safeDiv(totals.spend, real),
    };
  }, [perPipeline, totals.spend]);

  // CAC e ROAS gerais a partir das vendas/receita do CRM (somatório por funil)
  const crmTotals = useMemo(() => {
    const won = perPipeline.reduce((s, r) => s + r.won, 0);
    const wonValue = perPipeline.reduce((s, r) => s + r.won_value, 0);
    return {
      won,
      won_value: wonValue,
      cac: safeDiv(totals.spend, won),
      roas: safeDiv(wonValue, totals.spend),
      ticket_medio: safeDiv(wonValue, won),
    };
  }, [perPipeline, totals.spend]);

  // Top campanhas / criativos por gasto
  const topCampaigns = [...campaigns].sort((a, b) => Number(b.spend) - Number(a.spend)).slice(0, 10);
  const topAds = [...ads].sort((a, b) => Number(b.spend) - Number(a.spend)).slice(0, 12);

  return (
    <div className="space-y-6">
      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KPI icon={DollarSign} label="Investimento" value={fmtBRL(totals.spend)} gradient="from-blue-500 to-indigo-600" />
        <KPI icon={Eye} label="Impressões" value={fmtInt(totals.impressions)} gradient="from-violet-500 to-purple-600" />
        <KPI icon={MousePointerClick} label="Cliques" value={fmtInt(totals.clicks)} gradient="from-cyan-500 to-sky-600" />
        <KPI icon={Users} label="Leads (Meta)" value={fmtInt(totals.leads)} gradient="from-emerald-500 to-green-600" />
        <KPI icon={TrendingDown} label="CPL" value={fmtBRL(totals.cpl)} gradient="from-amber-500 to-orange-600" hint="Custo por Lead" />
        <KPI icon={CalendarClock} label="Custo / Reun. Agendada" value={fmtBRL(meetingTotals.cost_per_scheduled)} gradient="from-sky-500 to-blue-600" hint={`${fmtInt(meetingTotals.scheduled)} agendadas`} />
        <KPI icon={CalendarCheck} label="Custo / Reun. Realizada" value={fmtBRL(meetingTotals.cost_per_realized)} gradient="from-teal-500 to-cyan-600" hint={`${fmtInt(meetingTotals.realized)} realizadas`} />
        <KPI icon={Target} label="CAC" value={fmtBRL(crmTotals.cac)} gradient="from-rose-500 to-red-600" hint={`${fmtInt(crmTotals.won)} vendas`} />
        <KPI icon={Receipt} label="Ticket Médio" value={fmtBRL(crmTotals.ticket_medio)} gradient="from-indigo-500 to-purple-600" hint={fmtBRL(crmTotals.won_value)} />
        <KPI icon={TrendingUp} label="ROAS" value={`${(crmTotals.roas || 0).toFixed(2)}x`} gradient="from-green-500 to-emerald-600" />
        <KPI icon={MousePointerClick} label="CTR" value={fmtPct(totals.ctr)} gradient="from-fuchsia-500 to-pink-600" />
      </div>

      {/* Métricas por Funil — destaque */}
      <Card className="overflow-hidden border-border/40 shadow-lg">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />
        <CardHeader className="pb-3 bg-gradient-to-br from-muted/40 to-transparent">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-md">
              <Target className="h-4 w-4 text-white" />
            </div>
            Custo por Funil
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {perPipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Vincule campanhas a funis para visualizar o custo por funil.
            </p>
          ) : (
            <div className="overflow-auto rounded-lg border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-muted/60 to-muted/20 text-xs text-muted-foreground">
                    <th className="text-left py-2.5 px-3 font-semibold">Funil</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Investido</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Leads (CRM)</th>
                    <th className="text-right py-2.5 px-3 font-semibold">CPL</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Reun. Agend.</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Custo / Agend.</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Reun. Real.</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Custo / Real.</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Vendas</th>
                    <th className="text-right py-2.5 px-3 font-semibold">CAC</th>
                    <th className="text-right py-2.5 px-3 font-semibold">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {perPipeline.map((r, idx) => (
                    <tr
                      key={r.pipeline_id}
                      className={`border-t border-border/40 hover:bg-gradient-to-r hover:from-blue-500/5 hover:to-violet-500/5 transition-colors ${idx % 2 === 0 ? "bg-muted/10" : ""}`}
                    >
                      <td className="py-2.5 px-3 font-semibold">{r.pipeline_name}</td>
                      <td className="text-right py-2.5 px-3 tabular-nums">{fmtBRL(r.spend)}</td>
                      <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.leads_crm)}</td>
                      <td className="text-right py-2.5 px-3 font-semibold tabular-nums text-amber-600 dark:text-amber-400">{fmtBRL(r.cpl)}</td>
                      <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.meetings_scheduled)}</td>
                      <td className="text-right py-2.5 px-3 font-semibold tabular-nums text-sky-600 dark:text-sky-400">{fmtBRL(r.cost_per_scheduled)}</td>
                      <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.meetings_realized)}</td>
                      <td className="text-right py-2.5 px-3 font-semibold tabular-nums text-teal-600 dark:text-teal-400">{fmtBRL(r.cost_per_realized)}</td>
                      <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.won)}</td>
                      <td className="text-right py-2.5 px-3 font-semibold tabular-nums text-rose-600 dark:text-rose-400">{fmtBRL(r.cac)}</td>
                      <td className="text-right py-2.5 px-3">
                        <Badge
                          className={`tabular-nums border-0 ${
                            r.roas >= 1
                              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.roas.toFixed(2)}x
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparativo de Performance (Funis × Campanhas) */}
      <CRMTrafficCompare
        campaigns={campaigns}
        links={links}
        pipelines={pipelines}
        leadStats={leadStats}
        meetingStats={meetingStats}
      />

      {/* Drill-down */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="bg-muted/40 backdrop-blur-sm">
          <TabsTrigger value="campaigns" className="gap-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Layers className="h-3.5 w-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="adsets" className="gap-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <Layers className="h-3.5 w-3.5" /> Conjuntos
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-1.5 data-[state=active]:bg-gradient-to-br data-[state=active]:from-fuchsia-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-md">
            <ImageIcon className="h-3.5 w-3.5" /> Criativos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <Card className="overflow-hidden border-border/40 shadow-md">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-violet-600" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-md">
                  <Layers className="h-4 w-4 text-white" />
                </div>
                Top Campanhas por Investimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCampaigns.slice(0, 8).map(c => ({
                    name: (c.campaign_name || "").slice(0, 24),
                    spend: Number(c.spend), leads: Number(c.leads),
                  }))}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(v: any, k: string) => k === "spend" ? fmtBRL(Number(v)) : fmtInt(Number(v))}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="spend" fill="url(#spendGradient)" name="Investido" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <CampaignTable campaigns={topCampaigns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adsets" className="mt-4">
          <Card className="overflow-hidden border-border/40 shadow-md">
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md">
                  <Layers className="h-4 w-4 text-white" />
                </div>
                Conjuntos de Anúncios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdsetTable adsets={adsets.slice(0, 30)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creatives" className="mt-4">
          <Card className="overflow-hidden border-border/40 shadow-md">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 to-pink-600" />
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-md">
                  <ImageIcon className="h-4 w-4 text-white" />
                </div>
                Top Criativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {topAds.map((ad) => {
                  const cpl = safeDiv(Number(ad.spend), Number(ad.leads));
                  const cac = safeDiv(Number(ad.spend), Number(ad.conversions));
                  return (
                    <div key={ad.id} className="group rounded-xl border border-border/40 overflow-hidden bg-card hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
                      <div className="aspect-video bg-gradient-to-br from-muted to-muted/40 overflow-hidden flex items-center justify-center relative">
                        {ad.creative_thumbnail_url ? (
                          <img src={ad.creative_thumbnail_url} alt={ad.ad_name || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-sm font-semibold truncate">{ad.ad_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{ad.campaign_name}</p>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          <Mini label="Gasto" value={fmtBRL(Number(ad.spend))} />
                          <Mini label="CPL" value={fmtBRL(cpl)} />
                          <Mini label="CAC" value={fmtBRL(cac)} />
                          <Mini label="Cliques" value={fmtInt(Number(ad.clicks))} />
                          <Mini label="CTR" value={fmtPct(Number(ad.ctr))} />
                          <Mini label="Leads" value={fmtInt(Number(ad.leads))} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {topAds.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full text-center py-6">
                    Nenhum criativo sincronizado ainda.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const KPI = ({
  icon: Icon, label, value, gradient, hint,
}: { icon: any; label: string; value: string; gradient: string; hint?: string }) => (
  <Card className="overflow-hidden border-border/40 group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative">
    {/* Glow gradiente atrás */}
    <div className={`absolute inset-0 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity bg-gradient-to-br ${gradient}`} />
    {/* Barra de cor no topo */}
    <div className={`h-1 bg-gradient-to-r ${gradient}`} />
    <CardContent className="p-4 relative">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{label}</p>
          <p className="text-xl font-bold mt-1.5 tabular-nums truncate">{value}</p>
          {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} shadow-md shrink-0 group-hover:scale-110 transition-transform`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-muted/40 rounded p-1.5">
    <p className="text-muted-foreground">{label}</p>
    <p className="font-semibold truncate">{value}</p>
  </div>
);

const CampaignTable = ({ campaigns }: { campaigns: CRMMetaCampaign[] }) => (
  <div className="overflow-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left py-2 px-2">Campanha</th>
          <th className="text-right py-2 px-2">Status</th>
          <th className="text-right py-2 px-2">Gasto</th>
          <th className="text-right py-2 px-2">Impr.</th>
          <th className="text-right py-2 px-2">Cliques</th>
          <th className="text-right py-2 px-2">CTR</th>
          <th className="text-right py-2 px-2">CPC</th>
          <th className="text-right py-2 px-2">Leads</th>
          <th className="text-right py-2 px-2">CPL</th>
        </tr>
      </thead>
      <tbody>
        {campaigns.map((c) => {
          const cpl = safeDiv(Number(c.spend), Number(c.leads));
          return (
            <tr key={c.id} className="border-b border-border/40 hover:bg-muted/30">
              <td className="py-2 px-2 max-w-xs truncate">{c.campaign_name}</td>
              <td className="text-right py-2 px-2">
                <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-[9px]">
                  {c.status}
                </Badge>
              </td>
              <td className="text-right py-2 px-2 font-semibold">{fmtBRL(Number(c.spend))}</td>
              <td className="text-right py-2 px-2">{fmtInt(Number(c.impressions))}</td>
              <td className="text-right py-2 px-2">{fmtInt(Number(c.clicks))}</td>
              <td className="text-right py-2 px-2">{fmtPct(Number(c.ctr))}</td>
              <td className="text-right py-2 px-2">{fmtBRL(Number(c.cpc))}</td>
              <td className="text-right py-2 px-2">{fmtInt(Number(c.leads))}</td>
              <td className="text-right py-2 px-2 font-semibold">{fmtBRL(cpl)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const AdsetTable = ({ adsets }: { adsets: CRMMetaAdset[] }) => (
  <div className="overflow-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left py-2 px-2">Conjunto</th>
          <th className="text-left py-2 px-2">Campanha</th>
          <th className="text-right py-2 px-2">Gasto</th>
          <th className="text-right py-2 px-2">Cliques</th>
          <th className="text-right py-2 px-2">CTR</th>
          <th className="text-right py-2 px-2">CPC</th>
          <th className="text-right py-2 px-2">Leads</th>
          <th className="text-right py-2 px-2">CPL</th>
        </tr>
      </thead>
      <tbody>
        {adsets.map((a) => {
          const cpl = safeDiv(Number(a.spend), Number(a.leads));
          return (
            <tr key={a.id} className="border-b border-border/40 hover:bg-muted/30">
              <td className="py-2 px-2 max-w-[180px] truncate">{a.adset_name}</td>
              <td className="py-2 px-2 max-w-[180px] truncate text-muted-foreground">{a.campaign_name}</td>
              <td className="text-right py-2 px-2 font-semibold">{fmtBRL(Number(a.spend))}</td>
              <td className="text-right py-2 px-2">{fmtInt(Number(a.clicks))}</td>
              <td className="text-right py-2 px-2">{fmtPct(Number(a.ctr))}</td>
              <td className="text-right py-2 px-2">{fmtBRL(Number(a.cpc))}</td>
              <td className="text-right py-2 px-2">{fmtInt(Number(a.leads))}</td>
              <td className="text-right py-2 px-2 font-semibold">{fmtBRL(cpl)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
