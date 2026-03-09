import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { differenceInMonths, parseISO } from "date-fns";

interface Props {
  projects: any[];
  companies: any[];
  retentionAttempts: any[];
}

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#6b7280", "#ec4899", "#14b8a6"];

export function CRChartsTab({ projects, companies, retentionAttempts }: Props) {
  const cancelled = projects.filter(p => p.status === "closed" && p.churn_date);

  const churnBySegment = useMemo(() => {
    const map: Record<string, { churned: number; active: number }> = {};
    companies.forEach(c => {
      const seg = c.segment || "Sem segmento";
      if (!map[seg]) map[seg] = { churned: 0, active: 0 };
      if (c.status === "active") map[seg].active++;
      else if (c.status === "inactive" || c.status === "churned") map[seg].churned++;
    });
    return Object.entries(map)
      .map(([seg, d]) => ({
        segment: seg.length > 15 ? seg.substring(0, 15) + "..." : seg,
        churn: d.active + d.churned > 0 ? parseFloat(((d.churned / (d.active + d.churned)) * 100).toFixed(1)) : 0,
        total: d.active + d.churned,
      }))
      .filter(d => d.total >= 2)
      .sort((a, b) => b.churn - a.churn)
      .slice(0, 10);
  }, [companies]);

  const churnByConsultant = useMemo(() => {
    const map: Record<string, { churned: number; total: number }> = {};
    cancelled.forEach(p => {
      const name = p.consultant_name || p.cs_name || "Sem consultor";
      if (!map[name]) map[name] = { churned: 0, total: 0 };
      map[name].churned++;
    });
    companies.filter(c => c.status === "active").forEach(c => {
      const name = c.consultant?.name || c.cs?.name || "Sem consultor";
      if (!map[name]) map[name] = { churned: 0, total: 0 };
      map[name].total++;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        churn: (d.churned + d.total) > 0 ? parseFloat(((d.churned / (d.churned + d.total)) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.churn - a.churn)
      .slice(0, 10);
  }, [cancelled, companies]);

  const retentionByConsultant = useMemo(() => {
    const map: Record<string, { retained: number; total: number }> = {};
    retentionAttempts.forEach(r => {
      const name = r.staff_name || "Desconhecido";
      if (!map[name]) map[name] = { retained: 0, total: 0 };
      map[name].total++;
      if (r.result === "retained") map[name].retained++;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        rate: d.total > 0 ? parseFloat(((d.retained / d.total) * 100).toFixed(1)) : 0,
        total: d.total,
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);
  }, [retentionAttempts]);

  const churnByClientTime = useMemo(() => {
    const buckets: Record<string, number> = {
      "0-3m": 0, "3-6m": 0, "6-12m": 0, "12-24m": 0, "24m+": 0,
    };
    cancelled.forEach(p => {
      const company = companies.find(c => c.id === p.onboarding_company_id);
      if (!company?.contract_start_date || !p.churn_date) return;
      const months = differenceInMonths(parseISO(p.churn_date), parseISO(company.contract_start_date));
      if (months < 3) buckets["0-3m"]++;
      else if (months < 6) buckets["3-6m"]++;
      else if (months < 12) buckets["6-12m"]++;
      else if (months < 24) buckets["12-24m"]++;
      else buckets["24m+"]++;
    });
    return Object.entries(buckets).map(([period, count]) => ({ period, count }));
  }, [cancelled, companies]);

  const churnByTicket = useMemo(() => {
    const buckets: Record<string, number> = {
      "< R$1k": 0, "R$1-3k": 0, "R$3-5k": 0, "R$5-10k": 0, "> R$10k": 0,
    };
    cancelled.forEach(p => {
      const company = companies.find(c => c.id === p.onboarding_company_id);
      const v = company?.contract_value || 0;
      if (v < 1000) buckets["< R$1k"]++;
      else if (v < 3000) buckets["R$1-3k"]++;
      else if (v < 5000) buckets["R$3-5k"]++;
      else if (v < 10000) buckets["R$5-10k"]++;
      else buckets["> R$10k"]++;
    });
    return Object.entries(buckets).map(([faixa, count]) => ({ faixa, count }));
  }, [cancelled, companies]);

  const getBarColor = (val: number) => {
    if (val >= 60) return "#ef4444";
    if (val >= 30) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Churn por Segmento (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnBySegment} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="segment" type="category" width={120} className="text-xs" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="churn" radius={[0, 4, 4, 0]} maxBarSize={25}>
                  {churnBySegment.map((e, i) => <Cell key={i} fill={getBarColor(e.churn)} />)}
                  <LabelList dataKey="churn" position="right" formatter={(v: number) => `${v}%`} className="text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Churn por Consultor (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnByConsultant} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="churn" radius={[0, 4, 4, 0]} maxBarSize={25}>
                  {churnByConsultant.map((e, i) => <Cell key={i} fill={getBarColor(e.churn)} />)}
                  <LabelList dataKey="churn" position="right" formatter={(v: number) => `${v}%`} className="text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Retenção por Consultor (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={retentionByConsultant} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  <LabelList dataKey="rate" position="right" formatter={(v: number) => `${v}%`} className="text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cancelamentos por Tempo de Cliente</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={churnByClientTime}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" name="Cancelamentos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]}>
                  {churnByClientTime.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Churn por Faixa de Ticket</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={churnByTicket}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="faixa" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" name="Cancelamentos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]}>
                  {churnByTicket.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
