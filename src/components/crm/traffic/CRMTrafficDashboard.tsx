import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, MousePointerClick, Eye, Users, TrendingDown, TrendingUp, Layers,
  Image as ImageIcon, Target, CalendarCheck, CalendarClock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import type {
  CRMMetaCampaign, CRMMetaAdset, CRMMetaAd,
  CampaignPipelineLink, PipelineLeadCount, MeetingStat,
} from "./useCRMTrafficData";

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
    const campMap = new Map(campaigns.map((c) => [c.campaign_id, c]));
    const pipeMap = new Map(pipelines.map((p) => [p.id, p.name]));

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
      const cur = map.get(stat.pipeline_id) || empty(stat.pipeline_id);
      cur.leads_crm += stat.total;
      cur.won += stat.won;
      cur.won_value += stat.won_value;
      map.set(stat.pipeline_id, cur);
    }

    for (const ms of meetingStats) {
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

  // Top campanhas / criativos por gasto
  const topCampaigns = [...campaigns].sort((a, b) => Number(b.spend) - Number(a.spend)).slice(0, 10);
  const topAds = [...ads].sort((a, b) => Number(b.spend) - Number(a.spend)).slice(0, 12);

  return (
    <div className="space-y-6">
      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={DollarSign} label="Investimento" value={fmtBRL(totals.spend)} color="#3b82f6" />
        <KPI icon={Eye} label="Impressões" value={fmtInt(totals.impressions)} color="#8b5cf6" />
        <KPI icon={MousePointerClick} label="Cliques" value={fmtInt(totals.clicks)} color="#06b6d4" />
        <KPI icon={Users} label="Leads (Meta)" value={fmtInt(totals.leads)} color="#10b981" />
        <KPI icon={TrendingDown} label="CPL" value={fmtBRL(totals.cpl)} color="#f59e0b" hint="Custo por Lead" />
        <KPI icon={CalendarClock} label="Custo / Reunião Agendada" value={fmtBRL(meetingTotals.cost_per_scheduled)} color="#0ea5e9" hint={`${fmtInt(meetingTotals.scheduled)} agendadas`} />
        <KPI icon={CalendarCheck} label="Custo / Reunião Realizada" value={fmtBRL(meetingTotals.cost_per_realized)} color="#14b8a6" hint={`${fmtInt(meetingTotals.realized)} realizadas`} />
        <KPI icon={Target} label="CAC" value={fmtBRL(totals.cac)} color="#ef4444" hint="Custo por Venda" />
        <KPI icon={TrendingUp} label="ROAS" value={`${(totals.roas || 0).toFixed(2)}x`} color="#22c55e" />
        <KPI icon={MousePointerClick} label="CTR" value={fmtPct(totals.ctr)} color="#a855f7" />
      </div>

      {/* Métricas por Funil — destaque */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> Custo por Funil
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perPipeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Vincule campanhas a funis para visualizar o custo por funil.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2">Funil</th>
                    <th className="text-right py-2 px-2">Investido</th>
                    <th className="text-right py-2 px-2">Leads (CRM)</th>
                    <th className="text-right py-2 px-2">CPL</th>
                    <th className="text-right py-2 px-2">Reun. Agend.</th>
                    <th className="text-right py-2 px-2">Custo / Agend.</th>
                    <th className="text-right py-2 px-2">Reun. Real.</th>
                    <th className="text-right py-2 px-2">Custo / Real.</th>
                    <th className="text-right py-2 px-2">Vendas</th>
                    <th className="text-right py-2 px-2">CAC</th>
                    <th className="text-right py-2 px-2">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {perPipeline.map((r) => (
                    <tr key={r.pipeline_id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{r.pipeline_name}</td>
                      <td className="text-right py-2 px-2">{fmtBRL(r.spend)}</td>
                      <td className="text-right py-2 px-2">{fmtInt(r.leads_crm)}</td>
                      <td className="text-right py-2 px-2 font-semibold">{fmtBRL(r.cpl)}</td>
                      <td className="text-right py-2 px-2">{fmtInt(r.meetings_scheduled)}</td>
                      <td className="text-right py-2 px-2 font-semibold">{fmtBRL(r.cost_per_scheduled)}</td>
                      <td className="text-right py-2 px-2">{fmtInt(r.meetings_realized)}</td>
                      <td className="text-right py-2 px-2 font-semibold">{fmtBRL(r.cost_per_realized)}</td>
                      <td className="text-right py-2 px-2">{fmtInt(r.won)}</td>
                      <td className="text-right py-2 px-2 font-semibold">{fmtBRL(r.cac)}</td>
                      <td className="text-right py-2 px-2">
                        <Badge variant={r.roas >= 1 ? "default" : "secondary"}>
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

      {/* Drill-down */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-1">
            <Layers className="h-3.5 w-3.5" /> Campanhas
          </TabsTrigger>
          <TabsTrigger value="adsets" className="gap-1">
            <Layers className="h-3.5 w-3.5" /> Conjuntos
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-1">
            <ImageIcon className="h-3.5 w-3.5" /> Criativos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Campanhas por Investimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCampaigns.slice(0, 8).map(c => ({
                    name: (c.campaign_name || "").slice(0, 24),
                    spend: Number(c.spend), leads: Number(c.leads),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any, k: string) => k === "spend" ? fmtBRL(Number(v)) : fmtInt(Number(v))} />
                    <Bar dataKey="spend" fill="#3b82f6" name="Investido" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <CampaignTable campaigns={topCampaigns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adsets" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conjuntos de Anúncios</CardTitle>
            </CardHeader>
            <CardContent>
              <AdsetTable adsets={adsets.slice(0, 30)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creatives" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Criativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {topAds.map((ad) => {
                  const cpl = safeDiv(Number(ad.spend), Number(ad.leads));
                  const cac = safeDiv(Number(ad.spend), Number(ad.conversions));
                  return (
                    <div key={ad.id} className="rounded-xl border border-border/40 overflow-hidden bg-card hover:shadow-md transition">
                      <div className="aspect-video bg-muted overflow-hidden flex items-center justify-center">
                        {ad.creative_thumbnail_url ? (
                          <img src={ad.creative_thumbnail_url} alt={ad.ad_name || ""} className="w-full h-full object-cover" />
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
  icon: Icon, label, value, color, hint,
}: { icon: any; label: string; value: string; color: string; hint?: string }) => (
  <Card className="overflow-hidden border-border/40">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold mt-1">{value}</p>
          {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${color}20` }}>
          <Icon className="h-4 w-4" style={{ color }} />
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
