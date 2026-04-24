import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Target,
  Lightbulb,
  CheckCircle2,
  ScanLine,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";

interface LeadScannerTabProps {
  leadId: string;
}

interface ScannerSubmission {
  id: string;
  full_name: string;
  whatsapp: string;
  email: string;
  company_name: string | null;
  segment: string | null;
  revenue_range: string | null;
  sellers_count: number | null;
  has_sales_manager: boolean | null;
  lead_channels: string[] | null;
  leads_per_month: number | null;
  has_process: string | null;
  avg_ticket: number | null;
  conversion_rate: number | null;
  sales_cycle_days: number | null;
  sales_per_month: number | null;
  has_crm: boolean | null;
  tracks_goals_daily: boolean | null;
  invests_paid_traffic: boolean | null;
  paid_traffic_monthly: number | null;
  cost_per_lead: number | null;
  has_marketing_team: boolean | null;
  maturity_organization: number | null;
  maturity_goals: number | null;
  maturity_predictability: number | null;
  maturity_lead_quality: number | null;
  maturity_performance: number | null;
  diagnosis_text: string | null;
  performance_level: string | null;
  bottlenecks: string[] | null;
  current_revenue: number | null;
  potential_revenue: number | null;
  monthly_loss: number | null;
  annual_loss: number | null;
  action_plan: any;
  funnel_status: string;
  created_at: string;
  completed_at: string | null;
  meeting_requested_at: string | null;
}

const fmtCurrency = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

const fmtBool = (v: boolean | null | undefined) =>
  v == null ? "—" : v ? "Sim" : "Não";

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-2 border-b border-border/40 last:border-0">
    <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
      {label}
    </span>
    <span className="text-sm text-foreground">{value ?? "—"}</span>
  </div>
);

export const LeadScannerTab = ({ leadId }: LeadScannerTabProps) => {
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<ScannerSubmission | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales_scanner_submissions")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubmission(data as any);
      setLoading(false);
    };
    load();
  }, [leadId]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <ScanLine className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Este lead ainda não preencheu o Scanner de Vendas UNV.
        </p>
      </div>
    );
  }

  const s = submission;

  const performanceColor =
    s.performance_level === "alto"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      : s.performance_level === "médio" || s.performance_level === "medio"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
      : "bg-destructive/10 text-destructive border-destructive/30";

  const revenueChartData = [
    {
      name: "Atual",
      valor: Number(s.current_revenue || 0),
    },
    {
      name: "Potencial",
      valor: Number(s.potential_revenue || 0),
    },
  ];

  const maturityData = [
    { area: "Organização", valor: s.maturity_organization || 0 },
    { area: "Metas", valor: s.maturity_goals || 0 },
    { area: "Previsibilidade", valor: s.maturity_predictability || 0 },
    { area: "Qualidade Leads", valor: s.maturity_lead_quality || 0 },
    { area: "Performance", valor: s.maturity_performance || 0 },
  ];

  const actionItems: string[] = Array.isArray(s.action_plan)
    ? s.action_plan
    : s.action_plan?.items || s.action_plan?.actions || [];

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Scanner de Vendas UNV</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Status: {s.funnel_status}
          </Badge>
          {s.performance_level && (
            <Badge variant="outline" className={`text-xs ${performanceColor}`}>
              Desempenho: {s.performance_level}
            </Badge>
          )}
        </div>
      </div>

      {/* Financial impact */}
      {(s.current_revenue != null || s.monthly_loss != null) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Impacto Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground uppercase">Faturamento Atual</p>
                <p className="text-lg font-bold tabular-nums">{fmtCurrency(s.current_revenue)}</p>
              </div>
              <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3">
                <p className="text-[11px] text-emerald-600 uppercase">Potencial</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600">
                  {fmtCurrency(s.potential_revenue)}
                </p>
              </div>
              <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-3">
                <p className="text-[11px] text-destructive uppercase">Perda Mensal</p>
                <p className="text-lg font-bold tabular-nums text-destructive">
                  {fmtCurrency(s.monthly_loss)}
                </p>
              </div>
              <div className="rounded-lg border bg-destructive/5 border-destructive/20 p-3">
                <p className="text-[11px] text-destructive uppercase">Perda Anual</p>
                <p className="text-lg font-bold tabular-nums text-destructive">
                  {fmtCurrency(s.annual_loss)}
                </p>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => fmtCurrency(v)}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maturity radar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            Maturidade Comercial (1 a 5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={maturityData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Maturidade"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis */}
      {s.diagnosis_text && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Diagnóstico Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.diagnosis_text}</p>
          </CardContent>
        </Card>
      )}

      {/* Bottlenecks */}
      {s.bottlenecks && s.bottlenecks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Principais Gargalos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {s.bottlenecks.map((b, i) => (
                <Badge key={i} variant="outline" className="bg-destructive/5 border-destructive/30 text-destructive">
                  {b}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action plan */}
      {actionItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-emerald-500" />
              Plano de Ação Sugerido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {actionItems.map((item: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{typeof item === "string" ? item : item.title || item.action || JSON.stringify(item)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* All form answers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Dados Iniciais & Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Field label="Nome completo" value={s.full_name} />
            <Field label="WhatsApp" value={s.whatsapp} />
            <Field label="E-mail" value={s.email} />
            <Field label="Empresa" value={s.company_name} />
            <Field label="Nicho/Segmento" value={s.segment} />
            <Field label="Faturamento mensal" value={s.revenue_range} />
            <Field label="Nº de vendedores" value={s.sellers_count} />
            <Field label="Possui gerente comercial" value={fmtBool(s.has_sales_manager)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Estrutura de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Field
              label="Canais de aquisição"
              value={s.lead_channels?.length ? s.lead_channels.join(", ") : "—"}
            />
            <Field label="Leads por mês" value={s.leads_per_month} />
            <Field label="Processo comercial definido" value={s.has_process} />
            <Field label="Possui CRM" value={fmtBool(s.has_crm)} />
            <Field label="Acompanha metas diariamente" value={fmtBool(s.tracks_goals_daily)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-500" />
              Indicadores Comerciais
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Field label="Ticket médio" value={fmtCurrency(s.avg_ticket)} />
            <Field
              label="Taxa de conversão"
              value={s.conversion_rate != null ? `${s.conversion_rate}%` : "—"}
            />
            <Field
              label="Ciclo médio de vendas"
              value={s.sales_cycle_days != null ? `${s.sales_cycle_days} dias` : "—"}
            />
            <Field label="Vendas por mês" value={s.sales_per_month} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-pink-500" />
              Marketing & Investimento
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Field label="Investe em tráfego pago" value={fmtBool(s.invests_paid_traffic)} />
            <Field label="Investimento mensal" value={fmtCurrency(s.paid_traffic_monthly)} />
            <Field label="Custo por lead" value={fmtCurrency(s.cost_per_lead)} />
            <Field label="Possui equipe de marketing" value={fmtBool(s.has_marketing_team)} />
          </CardContent>
        </Card>
      </div>

      <div className="text-[11px] text-muted-foreground text-right pt-2">
        Preenchido em {new Date(s.created_at).toLocaleString("pt-BR")}
        {s.meeting_requested_at &&
          ` • Reunião solicitada em ${new Date(s.meeting_requested_at).toLocaleString("pt-BR")}`}
      </div>
    </div>
  );
};
