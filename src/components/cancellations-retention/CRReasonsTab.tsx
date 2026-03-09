import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projects: any[];
  companies: any[];
}

const REASON_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  falta_resultado: "Falta de resultado",
  mudanca_estrategia: "Mudança de estratégia",
  encerramento_empresa: "Encerramento",
  insatisfacao_servico: "Insatisfação",
  outro: "Outro",
};

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#6b7280"];

const percentTooltipFormatter = (value: number) => `${value.toFixed(1)}%`;

export function CRReasonsTab({ projects, companies }: Props) {
  const cancelled = projects.filter(p => p.status === "closed" && p.churn_reason);
  const totalCancelled = cancelled.length;

  // Pie chart: show percentage
  const reasonFrequency = useMemo(() => {
    const map: Record<string, number> = {};
    cancelled.forEach(p => {
      const r = p.churn_reason || "outro";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map)
      .map(([reason, count]) => ({
        reason: REASON_LABELS[reason] || reason,
        count,
        percent: totalCancelled > 0 ? (count / totalCancelled) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cancelled, totalCancelled]);

  // By consultant: convert to percentage within each consultant
  const reasonByConsultant = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    cancelled.forEach(p => {
      const name = p.consultant_name || p.cs_name || "Sem consultor";
      const reason = REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro";
      if (!map[name]) map[name] = {};
      map[name][reason] = (map[name][reason] || 0) + 1;
    });
    return Object.entries(map).map(([name, reasons]) => {
      const total = Object.values(reasons).reduce((s, v) => s + v, 0);
      const entry: any = {
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        total,
      };
      Object.entries(reasons).forEach(([r, count]) => {
        entry[r] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      });
      return entry;
    }).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [cancelled]);

  // By segment: convert to percentage within each segment
  const reasonBySegment = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    cancelled.forEach(p => {
      const company = companies.find(c => c.id === p.onboarding_company_id);
      const segment = company?.segment || "Sem segmento";
      const reason = REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro";
      if (!map[segment]) map[segment] = {};
      map[segment][reason] = (map[segment][reason] || 0) + 1;
    });
    return Object.entries(map).map(([segment, reasons]) => {
      const total = Object.values(reasons).reduce((s, v) => s + v, 0);
      const entry: any = {
        segment: segment.length > 20 ? segment.substring(0, 20) + "..." : segment,
        total,
      };
      Object.entries(reasons).forEach(([r, count]) => {
        entry[r] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      });
      return entry;
    }).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [cancelled, companies]);

  // By month: convert to percentage within each month
  const reasonByMonth = useMemo(() => {
    const months: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM/yy", { locale: ptBR });

      const monthCancelled = cancelled.filter(p => p.churn_date?.startsWith(key));
      const total = monthCancelled.length;
      const entry: any = { label };
      const countMap: Record<string, number> = {};
      monthCancelled.forEach(p => {
        const r = REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro";
        countMap[r] = (countMap[r] || 0) + 1;
      });
      Object.entries(countMap).forEach(([r, count]) => {
        entry[r] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
      });
      months.push(entry);
    }
    return months;
  }, [cancelled]);

  const allReasons = [...new Set(cancelled.map(p => REASON_LABELS[p.churn_reason] || p.churn_reason || "Outro"))];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Motivos Mais Frequentes</CardTitle></CardHeader>
          <CardContent>
            {reasonFrequency.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reasonFrequency}
                    dataKey="percent"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ reason, percent }) => `${reason}: ${percent.toFixed(1)}%`}
                  >
                    {reasonFrequency.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Motivos por Consultor (%)</CardTitle></CardHeader>
          <CardContent>
            {reasonByConsultant.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reasonByConsultant} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                  <Tooltip formatter={percentTooltipFormatter} />
                  <Legend />
                  {allReasons.map((r, i) => (
                    <Bar key={r} dataKey={r} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Motivos por Segmento (%)</CardTitle></CardHeader>
          <CardContent>
            {reasonBySegment.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reasonBySegment} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="segment" type="category" width={120} className="text-xs" />
                  <Tooltip formatter={percentTooltipFormatter} />
                  <Legend />
                  {allReasons.map((r, i) => (
                    <Bar key={r} dataKey={r} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução dos Motivos ao Longo do Tempo (%)</CardTitle></CardHeader>
          <CardContent>
            {reasonByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reasonByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} className="text-xs" />
                  <Tooltip formatter={percentTooltipFormatter} />
                  <Legend />
                  {allReasons.map((r, i) => (
                    <Bar key={r} dataKey={r} stackId="a" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
