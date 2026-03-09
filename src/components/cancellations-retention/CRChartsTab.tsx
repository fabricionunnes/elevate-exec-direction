import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, RadialBarChart, RadialBar, Legend,
} from "recharts";
import { differenceInMonths, parseISO } from "date-fns";

interface Props {
  projects: any[];
  companies: any[];
  retentionAttempts: any[];
}

const GRADIENT_COLORS = [
  { start: "#f43f5e", end: "#fb7185" },
  { start: "#f97316", end: "#fdba74" },
  { start: "#8b5cf6", end: "#a78bfa" },
  { start: "#06b6d4", end: "#67e8f9" },
  { start: "#10b981", end: "#6ee7b7" },
  { start: "#ec4899", end: "#f9a8d4" },
  { start: "#eab308", end: "#fde047" },
  { start: "#6366f1", end: "#a5b4fc" },
];

const GradientDefs = () => (
  <defs>
    {GRADIENT_COLORS.map((c, i) => (
      <linearGradient key={i} id={`chartGrad${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={c.start} stopOpacity={0.95} />
        <stop offset="100%" stopColor={c.end} stopOpacity={0.7} />
      </linearGradient>
    ))}
    {GRADIENT_COLORS.map((c, i) => (
      <linearGradient key={`h${i}`} id={`chartGradH${i}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={c.start} stopOpacity={0.95} />
        <stop offset="100%" stopColor={c.end} stopOpacity={0.7} />
      </linearGradient>
    ))}
  </defs>
);

const tooltipStyle = { borderRadius: 12, border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.12)", fontSize: 13 };

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
        segment: seg.length > 18 ? seg.substring(0, 18) + "..." : seg,
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
        name: name.length > 14 ? name.substring(0, 14) + "..." : name,
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
      .map(([name, d], i) => ({
        name: name.length > 14 ? name.substring(0, 14) + "..." : name,
        rate: d.total > 0 ? parseFloat(((d.retained / d.total) * 100).toFixed(1)) : 0,
        total: d.total,
        fill: `url(#chartGradH${i % GRADIENT_COLORS.length})`,
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

  const getBarColor = (val: number, idx: number) => {
    if (val >= 60) return "#f43f5e";
    if (val >= 30) return "#f97316";
    return "#10b981";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Churn por Segmento - 3D perspective */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-400" />
              Churn por Segmento (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ perspective: "800px" }}>
              <div style={{ transform: "rotateY(3deg)", transformOrigin: "left center" }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={churnBySegment} layout="vertical" barGap={4}>
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="segment" type="category" width={130} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                    <Bar dataKey="churn" radius={[0, 8, 8, 0]} maxBarSize={28}>
                      {churnBySegment.map((e, i) => (
                        <Cell key={i} fill={getBarColor(e.churn, i)} style={{ filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.15))" }} />
                      ))}
                      <LabelList dataKey="churn" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Churn por Consultor */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-violet-500 to-pink-400" />
              Churn por Consultor (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ perspective: "800px" }}>
              <div style={{ transform: "rotateY(-3deg)", transformOrigin: "right center" }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={churnByConsultant} layout="vertical" barGap={4}>
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                    <Bar dataKey="churn" radius={[0, 8, 8, 0]} maxBarSize={28}>
                      {churnByConsultant.map((e, i) => (
                        <Cell key={i} fill={getBarColor(e.churn, i)} style={{ filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.15))" }} />
                      ))}
                      <LabelList dataKey="churn" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Retenção por Consultor */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-indigo-500 to-blue-400" />
              Retenção por Consultor (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={retentionByConsultant} layout="vertical">
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={tooltipStyle} />
                <Bar dataKey="rate" radius={[0, 8, 8, 0]} maxBarSize={22}>
                  {retentionByConsultant.map((_, i) => (
                    <Cell key={i} fill={`url(#chartGradH${i % GRADIENT_COLORS.length})`} style={{ filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.1))" }} />
                  ))}
                  <LabelList dataKey="rate" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cancelamentos por Tempo de Cliente - 3D bars */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-400" />
              Por Tempo de Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ perspective: "800px" }}>
              <div style={{ transform: "rotateX(5deg)", transformOrigin: "center bottom" }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={churnByClientTime} barGap={6}>
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Cancelamentos" radius={[8, 8, 4, 4]} maxBarSize={40}>
                      {churnByClientTime.map((_, i) => (
                        <Cell key={i} fill={`url(#chartGrad${i % GRADIENT_COLORS.length})`} style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" }} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Churn por Faixa de Ticket - 3D bars */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" />
              Por Faixa de Ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ perspective: "800px" }}>
              <div style={{ transform: "rotateX(5deg)", transformOrigin: "center bottom" }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={churnByTicket} barGap={6}>
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="faixa" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Cancelamentos" radius={[8, 8, 4, 4]} maxBarSize={40}>
                      {churnByTicket.map((_, i) => (
                        <Cell key={i} fill={`url(#chartGrad${(i + 3) % GRADIENT_COLORS.length})`} style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" }} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 12, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
