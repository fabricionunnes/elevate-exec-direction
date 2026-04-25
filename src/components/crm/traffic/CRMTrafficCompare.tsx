import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GitCompare, ArrowUpDown } from "lucide-react";
import type {
  CRMMetaCampaign, CampaignPipelineLink, PipelineLeadCount, MeetingStat,
} from "./useCRMTrafficData";

interface Props {
  campaigns: CRMMetaCampaign[];
  links: CampaignPipelineLink[];
  pipelines: { id: string; name: string }[];
  leadStats: PipelineLeadCount[];
  meetingStats?: MeetingStat[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtInt = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

type Row = {
  id: string;
  name: string;
  spend: number;
  leads: number;
  meetings_scheduled: number;
  meetings_realized: number;
  won: number;
  won_value: number;
  cpl: number;
  cost_per_scheduled: number;
  cost_per_realized: number;
  cac: number;
};

type SortKey = keyof Omit<Row, "id" | "name">;

const heatCell = (
  value: number,
  allValues: number[],
  inverted = false, // true para custos (menor = melhor)
) => {
  const valid = allValues.filter((v) => v > 0);
  if (valid.length === 0 || value === 0) return "";
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (min === max) return "";
  const norm = (value - min) / (max - min);
  const score = inverted ? 1 - norm : norm;
  if (score >= 0.75) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold";
  if (score >= 0.5) return "bg-emerald-500/5";
  if (score <= 0.25) return "bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold";
  if (score <= 0.5) return "bg-rose-500/5";
  return "";
};

export const CRMTrafficCompare = ({
  campaigns, links, pipelines, leadStats, meetingStats = [],
}: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Agregação de campanhas por campaign_id (campaigns vem com 1 linha por dia)
  const campAgg = useMemo(() => {
    const m = new Map<string, { campaign_id: string; campaign_name: string; spend: number; leads: number }>();
    for (const c of campaigns) {
      const cur = m.get(c.campaign_id) || {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name || c.campaign_id,
        spend: 0,
        leads: 0,
      };
      cur.spend += Number(c.spend || 0);
      cur.leads += Number(c.leads || 0);
      if (!cur.campaign_name && c.campaign_name) cur.campaign_name = c.campaign_name;
      m.set(c.campaign_id, cur);
    }
    return Array.from(m.values());
  }, [campaigns]);

  // Linhas por funil
  const pipelineRows = useMemo<Row[]>(() => {
    const pipeMap = new Map(pipelines.map((p) => [p.id, p.name]));
    const campMap = new Map(campAgg.map((c) => [c.campaign_id, c]));
    const allowed = new Set(links.filter((l) => campMap.has(l.campaign_id)).map((l) => l.pipeline_id));

    type Acc = { spend: number; leads_meta: number; leads_crm: number; sched: number; real: number; won: number; won_value: number };
    const acc = new Map<string, Acc>();
    const empty = (): Acc => ({ spend: 0, leads_meta: 0, leads_crm: 0, sched: 0, real: 0, won: 0, won_value: 0 });

    for (const link of links) {
      const c = campMap.get(link.campaign_id);
      if (!c) continue;
      const w = Number(link.weight || 1);
      const cur = acc.get(link.pipeline_id) || empty();
      cur.spend += c.spend * w;
      cur.leads_meta += c.leads * w;
      acc.set(link.pipeline_id, cur);
    }
    for (const s of leadStats) {
      if (!allowed.has(s.pipeline_id)) continue;
      const cur = acc.get(s.pipeline_id) || empty();
      cur.leads_crm += s.total;
      cur.won += s.won;
      cur.won_value += s.won_value;
      acc.set(s.pipeline_id, cur);
    }
    for (const m of meetingStats) {
      if (!allowed.has(m.pipeline_id)) continue;
      const cur = acc.get(m.pipeline_id) || empty();
      cur.sched += m.scheduled;
      cur.real += m.realized;
      acc.set(m.pipeline_id, cur);
    }

    return Array.from(acc.entries()).map(([id, a]) => ({
      id,
      name: pipeMap.get(id) || "—",
      spend: a.spend,
      leads: a.leads_crm || a.leads_meta,
      meetings_scheduled: a.sched,
      meetings_realized: a.real,
      won: a.won,
      won_value: a.won_value,
      cpl: safeDiv(a.spend, a.leads_crm || a.leads_meta),
      cost_per_scheduled: safeDiv(a.spend, a.sched),
      cost_per_realized: safeDiv(a.spend, a.real),
      cac: safeDiv(a.spend, a.won),
    }));
  }, [campAgg, links, pipelines, leadStats, meetingStats]);

  // Linhas por campanha (vendas/reuniões rateadas pelo peso da campanha no pipeline)
  const campaignRows = useMemo<Row[]>(() => {
    // Para cada pipeline: total spend vinculado e share de cada campanha
    const pipeTotals = new Map<string, number>();
    for (const link of links) {
      const c = campAgg.find((x) => x.campaign_id === link.campaign_id);
      if (!c) continue;
      pipeTotals.set(link.pipeline_id, (pipeTotals.get(link.pipeline_id) || 0) + c.spend * Number(link.weight || 1));
    }

    // Agrega leadStats e meetingStats por pipeline_id
    const leadByPipe = new Map<string, { total: number; won: number; won_value: number }>();
    for (const s of leadStats) {
      const cur = leadByPipe.get(s.pipeline_id) || { total: 0, won: 0, won_value: 0 };
      cur.total += s.total;
      cur.won += s.won;
      cur.won_value += s.won_value;
      leadByPipe.set(s.pipeline_id, cur);
    }
    const meetByPipe = new Map<string, { sched: number; real: number }>();
    for (const m of meetingStats) {
      const cur = meetByPipe.get(m.pipeline_id) || { sched: 0, real: 0 };
      cur.sched += m.scheduled;
      cur.real += m.realized;
      meetByPipe.set(m.pipeline_id, cur);
    }

    // Para cada campanha, soma a parcela proporcional dos pipelines aos quais está vinculada
    const rows: Row[] = campAgg.map((c) => {
      const myLinks = links.filter((l) => l.campaign_id === c.campaign_id);
      let leads_crm = 0, sched = 0, real = 0, won = 0, won_value = 0;
      for (const link of myLinks) {
        const totalSpendInPipe = pipeTotals.get(link.pipeline_id) || 0;
        const myShare = totalSpendInPipe > 0 ? (c.spend * Number(link.weight || 1)) / totalSpendInPipe : 0;
        const lp = leadByPipe.get(link.pipeline_id);
        const mp = meetByPipe.get(link.pipeline_id);
        if (lp) {
          leads_crm += lp.total * myShare;
          won += lp.won * myShare;
          won_value += lp.won_value * myShare;
        }
        if (mp) {
          sched += mp.sched * myShare;
          real += mp.real * myShare;
        }
      }
      const leads = leads_crm > 0 ? leads_crm : c.leads;
      return {
        id: c.campaign_id,
        name: c.campaign_name,
        spend: c.spend,
        leads,
        meetings_scheduled: sched,
        meetings_realized: real,
        won,
        won_value,
        cpl: safeDiv(c.spend, leads),
        cost_per_scheduled: safeDiv(c.spend, sched),
        cost_per_realized: safeDiv(c.spend, real),
        cac: safeDiv(c.spend, won),
      };
    }).filter((r) => r.spend > 0 || r.leads > 0);

    return rows;
  }, [campAgg, links, leadStats, meetingStats]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sort = (rows: Row[]) => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  };

  const Header = ({ label, k, align = "right" }: { label: string; k: SortKey; align?: "left" | "right" }) => (
    <th
      className={`py-2.5 px-3 font-semibold text-xs cursor-pointer select-none hover:text-foreground transition-colors ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && <ArrowUpDown className="h-3 w-3 opacity-70" />}
      </span>
    </th>
  );

  const Table = ({ rows, label }: { rows: Row[]; label: string }) => {
    const sorted = sort(rows);
    const cpls = sorted.map((r) => r.cpl);
    const cps = sorted.map((r) => r.cost_per_scheduled);
    const cpr = sorted.map((r) => r.cost_per_realized);
    const cacs = sorted.map((r) => r.cac);
    const wons = sorted.map((r) => r.won);
    const revs = sorted.map((r) => r.won_value);

    if (sorted.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">Sem dados para comparar.</p>;
    }
    return (
      <div className="overflow-auto rounded-lg border border-border/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-muted/60 to-muted/20 text-muted-foreground border-b border-border/40">
              <Header label={label} k="spend" align="left" />
              <Header label="Investido" k="spend" />
              <Header label="Leads" k="leads" />
              <Header label="CPL" k="cpl" />
              <Header label="Reun. Agend." k="meetings_scheduled" />
              <Header label="Custo/Agend." k="cost_per_scheduled" />
              <Header label="Reun. Real." k="meetings_realized" />
              <Header label="Custo/Real." k="cost_per_realized" />
              <Header label="Vendas" k="won" />
              <Header label="Receita" k="won_value" />
              <Header label="CAC" k="cac" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => (
              <tr
                key={r.id}
                className={`border-t border-border/40 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "bg-muted/10" : ""}`}
              >
                <td className="py-2.5 px-3 font-semibold max-w-[260px] truncate" title={r.name}>{r.name}</td>
                <td className="text-right py-2.5 px-3 tabular-nums">{fmtBRL(r.spend)}</td>
                <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.leads)}</td>
                <td className={`text-right py-2.5 px-3 tabular-nums ${heatCell(r.cpl, cpls, true)}`}>{fmtBRL(r.cpl)}</td>
                <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.meetings_scheduled)}</td>
                <td className={`text-right py-2.5 px-3 tabular-nums ${heatCell(r.cost_per_scheduled, cps, true)}`}>{fmtBRL(r.cost_per_scheduled)}</td>
                <td className="text-right py-2.5 px-3 tabular-nums">{fmtInt(r.meetings_realized)}</td>
                <td className={`text-right py-2.5 px-3 tabular-nums ${heatCell(r.cost_per_realized, cpr, true)}`}>{fmtBRL(r.cost_per_realized)}</td>
                <td className={`text-right py-2.5 px-3 tabular-nums ${heatCell(r.won, wons)}`}>{fmtInt(r.won)}</td>
                <td className={`text-right py-2.5 px-3 tabular-nums ${heatCell(r.won_value, revs)}`}>{fmtBRL(r.won_value)}</td>
                <td className="text-right py-2.5 px-3">
                  <Badge className={`tabular-nums border-0 ${heatCell(r.cac, cacs, true) || "bg-muted text-muted-foreground"}`}>
                    {r.cac > 0 ? fmtBRL(r.cac) : "—"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden border-border/40 shadow-lg">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
      <CardHeader className="pb-3 bg-gradient-to-br from-muted/40 to-transparent">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 shadow-md">
            <GitCompare className="h-4 w-4 text-white" />
          </div>
          Comparativo de Performance
          <span className="text-xs font-normal text-muted-foreground ml-1">
            (clique nos cabeçalhos para ordenar — verde = melhor, vermelho = pior)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="pipelines" className="w-full">
          <TabsList className="bg-muted/40">
            <TabsTrigger
              value="pipelines"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-violet-600 data-[state=active]:text-white"
            >
              Funis
            </TabsTrigger>
            <TabsTrigger
              value="campaigns"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-rose-600 data-[state=active]:text-white"
            >
              Campanhas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pipelines" className="mt-4">
            <Table rows={pipelineRows} label="Funil" />
          </TabsContent>
          <TabsContent value="campaigns" className="mt-4">
            <Table rows={campaignRows} label="Campanha" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
