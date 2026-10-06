// Painel recorrente do UNV Start: o cliente lança os números do comercial
// (leads, conversas, propostas, vendas, faturamento), acompanha meta, funil e
// projeção do mês, e recebe a leitura do Diretor Comercial IA (1 por dia).
// Tudo via unv-start-engine com o token do portal; sem login de staff.

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, BrainCircuit, Loader2, Minus, Pencil, Target, Trash2 } from "lucide-react";

interface MetricRow {
  metric_date: string;
  leads: number;
  conversas: number;
  propostas: number;
  vendas: number;
  faturamento_cents: number;
}

interface Props {
  token: string;
  invokeEngine: (body: Record<string, unknown>) => Promise<any>;
  Markdown: ComponentType<{ content: string }>;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const brlFull = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "–");

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maskMoney(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return brlFull(Number(digits));
}

function moneyToCents(masked: string) {
  return Number(masked.replace(/\D/g, "") || 0);
}

function sum(rows: MetricRow[]) {
  return rows.reduce(
    (a, r) => ({
      leads: a.leads + r.leads,
      conversas: a.conversas + r.conversas,
      propostas: a.propostas + r.propostas,
      vendas: a.vendas + r.vendas,
      faturamento_cents: a.faturamento_cents + Number(r.faturamento_cents),
    }),
    { leads: 0, conversas: 0, propostas: 0, vendas: 0, faturamento_cents: 0 },
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev <= 0 && cur <= 0) return null;
  if (prev <= 0)
    return <span className="text-xs text-muted-foreground">sem base no mês anterior</span>;
  const d = Math.round(((cur - prev) / prev) * 100);
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  const tone = d > 0 ? "text-green-700 dark:text-green-400" : d < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {d > 0 ? "+" : ""}
      {d}% vs mês anterior
    </span>
  );
}

const EMPTY_FORM = { leads: "", conversas: "", propostas: "", vendas: "", faturamento: "" };

export default function UNVStartDashboard({ token, invokeEngine, Markdown }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [goalCents, setGoalCents] = useState<number | null>(null);
  const [insight, setInsight] = useState<{ content_md: string; at: string } | null>(null);

  const [date, setDate] = useState(localISO(new Date()));
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [goalInput, setGoalInput] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const [insightLoading, setInsightLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await invokeEngine({ action: "get_dashboard", token });
      setRows(data.rows || []);
      setGoalCents(data.monthly_goal_cents ? Number(data.monthly_goal_cents) : null);
      setInsight(data.insight || null);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [invokeEngine, token]);

  useEffect(() => {
    load();
  }, [load]);

  // ao trocar a data, se já existe lançamento, carrega pra edição
  useEffect(() => {
    const r = rows.find((x) => x.metric_date === date);
    setForm(
      r
        ? {
            leads: String(r.leads),
            conversas: String(r.conversas),
            propostas: String(r.propostas),
            vendas: String(r.vendas),
            faturamento: Number(r.faturamento_cents) > 0 ? brlFull(Number(r.faturamento_cents)) : "",
          }
        : EMPTY_FORM,
    );
  }, [date, rows]);

  const today = new Date();
  const monthKey = localISO(today).slice(0, 7);
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevKey = localISO(prevMonthDate).slice(0, 7);
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const mtd = useMemo(() => sum(rows.filter((r) => r.metric_date.startsWith(monthKey))), [rows, monthKey]);
  const prevSamePeriod = useMemo(
    () =>
      sum(
        rows.filter(
          (r) => r.metric_date.startsWith(prevKey) && Number(r.metric_date.slice(8, 10)) <= dayOfMonth,
        ),
      ),
    [rows, prevKey, dayOfMonth],
  );

  const projection = dayOfMonth > 0 ? Math.round((mtd.faturamento_cents / dayOfMonth) * daysInMonth) : 0;
  const goalPct = goalCents ? Math.min(100, Math.round((mtd.faturamento_cents / goalCents) * 100)) : 0;
  const ticket = mtd.vendas > 0 ? Math.round(mtd.faturamento_cents / mtd.vendas) : 0;

  // últimos 30 dias, dia sem lançamento fica vazio (não é zero)
  const chartData = useMemo(() => {
    const byDate = new Map(rows.map((r) => [r.metric_date, r]));
    const out: { dia: string; data: string; valor: number | null }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const iso = localISO(d);
      const r = byDate.get(iso);
      out.push({
        dia: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        data: iso,
        valor: r ? Number(r.faturamento_cents) / 100 : null,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, monthKey]);

  const funnel = [
    { label: "Leads", value: mtd.leads, conv: null as string | null },
    { label: "Conversas", value: mtd.conversas, conv: pct(mtd.conversas, mtd.leads) },
    { label: "Propostas", value: mtd.propostas, conv: pct(mtd.propostas, mtd.conversas) },
    { label: "Vendas", value: mtd.vendas, conv: pct(mtd.vendas, mtd.propostas) },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const saveMetrics = async () => {
    setSaving(true);
    try {
      await invokeEngine({
        action: "save_metrics",
        token,
        metric_date: date,
        leads: Number(form.leads || 0),
        conversas: Number(form.conversas || 0),
        propostas: Number(form.propostas || 0),
        vendas: Number(form.vendas || 0),
        faturamento_cents: moneyToCents(form.faturamento),
      });
      toast.success("Números salvos.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (d: string) => {
    try {
      await invokeEngine({ action: "delete_metrics", token, metric_date: d });
      toast.success("Lançamento removido.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível remover.");
    }
  };

  const saveGoal = async () => {
    setSavingGoal(true);
    try {
      const data = await invokeEngine({ action: "set_goal", token, monthly_goal_cents: moneyToCents(goalInput) });
      setGoalCents(data.monthly_goal_cents ? Number(data.monthly_goal_cents) : null);
      setEditingGoal(false);
      toast.success("Meta salva.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível salvar a meta.");
    } finally {
      setSavingGoal(false);
    }
  };

  const askInsight = async () => {
    setInsightLoading(true);
    try {
      const data = await invokeEngine({ action: "get_insight", token });
      setInsight({ content_md: data.content_md, at: data.at });
      if (data.cached) toast.message("Essa é a análise de hoje. Uma nova sai a cada dia.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível gerar a análise.");
    } finally {
      setInsightLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const monthName = today.toLocaleDateString("pt-BR", { month: "long" });
  const recent = [...rows].sort((a, b) => b.metric_date.localeCompare(a.metric_date)).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* META DO MÊS */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Faturamento de {monthName}</p>
              <p className="text-3xl font-bold text-[#0D2B5E] dark:text-blue-300">{brl(mtd.faturamento_cents)}</p>
              <Delta cur={mtd.faturamento_cents} prev={prevSamePeriod.faturamento_cents} />
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Projeção do mês</p>
              <p className="text-lg font-semibold">{mtd.faturamento_cents > 0 ? brl(projection) : "–"}</p>
              <p className="text-xs text-muted-foreground">no ritmo atual</p>
            </div>
          </div>

          {goalCents && !editingGoal ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> Meta {brl(goalCents)}
                </span>
                <span className="font-medium">
                  {goalPct}% atingido
                  <button
                    className="ml-2 text-muted-foreground underline underline-offset-2"
                    onClick={() => {
                      setGoalInput(brlFull(goalCents));
                      setEditingGoal(true);
                    }}
                  >
                    editar
                  </button>
                </span>
              </div>
              <Progress value={goalPct} className="h-2" />
              {mtd.faturamento_cents > 0 && (
                <p className="text-xs text-muted-foreground">
                  {projection >= goalCents
                    ? "No ritmo atual você bate a meta."
                    : `Faltam ${brl(goalCents - mtd.faturamento_cents)}, ${brl(
                        Math.max(0, Math.round((goalCents - mtd.faturamento_cents) / Math.max(1, daysInMonth - dayOfMonth + 1))),
                      )} por dia até o fim do mês.`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                inputMode="numeric"
                placeholder="Sua meta de faturamento do mês"
                value={goalInput}
                onChange={(e) => setGoalInput(maskMoney(e.target.value))}
                className="bg-background"
              />
              <Button
                onClick={saveGoal}
                disabled={savingGoal || !goalInput}
                className="bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white shrink-0"
              >
                {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Definir meta"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NÚMEROS DO MÊS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Leads", value: String(mtd.leads), cur: mtd.leads, prev: prevSamePeriod.leads },
          { label: "Vendas", value: String(mtd.vendas), cur: mtd.vendas, prev: prevSamePeriod.vendas },
          { label: "Conversão geral", value: pct(mtd.vendas, mtd.leads), cur: 0, prev: 0 },
          { label: "Ticket médio", value: ticket ? brl(ticket) : "–", cur: 0, prev: 0 },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="py-4 space-y-0.5">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold">{k.value}</p>
              {k.prev > 0 || k.cur > 0 ? <Delta cur={k.cur} prev={k.prev} /> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FUNIL */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Funil do mês</CardTitle>
          <CardDescription>Onde a venda está morrendo: veja a taxa de passagem entre cada etapa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 text-[#0D2B5E] dark:text-blue-400">
          {funnel.map((f) => (
            <div key={f.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-foreground">
                <span>
                  {f.label}
                  {f.conv && <span className="text-xs text-muted-foreground ml-2">passagem {f.conv}</span>}
                </span>
                <span className="font-semibold tabular-nums">{f.value}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-current"
                  style={{ width: `${Math.max(f.value > 0 ? 3 : 0, (f.value / funnelMax) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* FATURAMENTO POR DIA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Faturamento por dia</CardTitle>
          <CardDescription>Últimos 30 dias. Dia sem barra é dia sem lançamento.</CardDescription>
        </CardHeader>
        <CardContent className="text-[#0D2B5E] dark:text-blue-400">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  dataKey="dia"
                  tickLine={false}
                  axisLine={false}
                  interval={6}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v)
                  }
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { dia: string; valor: number | null };
                    return (
                      <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
                        <p className="text-muted-foreground">{p.dia}</p>
                        <p className="font-semibold text-foreground">
                          {p.valor == null ? "Sem lançamento" : brlFull(Math.round(p.valor * 100))}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="valor" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* DIRETOR COMERCIAL IA */}
      <Card className="border-[#0D2B5E]/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-[#0D2B5E] dark:text-blue-300" />
            Diretor Comercial IA
          </CardTitle>
          <CardDescription>
            Lê os seus números e a estrutura que você montou, e diz onde está o vazamento e o que fazer esta semana.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insight ? (
            <>
              <p className="text-xs text-muted-foreground">
                Análise de {new Date(insight.at).toLocaleDateString("pt-BR")}
              </p>
              <Markdown content={insight.content_md} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {rows.length < 2
                ? "Lance pelo menos 2 dias de números pra receber a primeira análise."
                : "Seus números já dão pra analisar. Peça a leitura do diretor."}
            </p>
          )}
          <Button
            onClick={askInsight}
            disabled={insightLoading || rows.length < 2}
            className="w-full sm:w-auto bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
          >
            {insightLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
            {insight ? "Atualizar análise" : "Analisar meus números"}
          </Button>
        </CardContent>
      </Card>

      {/* LANÇAR NÚMEROS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lançar números</CardTitle>
          <CardDescription>Leva 1 minuto. Lance todo dia e o painel trabalha por você.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="us-date">Data</Label>
            <Input id="us-date" type="date" value={date} max={localISO(new Date())} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["leads", "Leads que chegaram"],
                ["conversas", "Conversas feitas"],
                ["propostas", "Propostas enviadas"],
                ["vendas", "Vendas fechadas"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`us-${key}`}>{label}</Label>
                <Input
                  id={`us-${key}`}
                  inputMode="numeric"
                  value={form[key]}
                  placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, "") }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="us-fat">Faturamento do dia</Label>
            <Input
              id="us-fat"
              inputMode="numeric"
              value={form.faturamento}
              placeholder="R$ 0,00"
              onChange={(e) => setForm((f) => ({ ...f, faturamento: maskMoney(e.target.value) }))}
            />
          </div>
          <Button
            onClick={saveMetrics}
            disabled={saving}
            className="w-full h-11 bg-[#0D2B5E] hover:bg-[#0D2B5E]/90 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.some((r) => r.metric_date === date) ? "Atualizar o dia" : "Salvar números do dia"}
          </Button>

          {recent.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs font-medium text-muted-foreground pt-2">Últimos lançamentos</p>
              {recent.map((r) => (
                <div key={r.metric_date} className="flex items-center gap-2 text-sm py-1">
                  <span className="w-14 text-muted-foreground tabular-nums">
                    {r.metric_date.slice(8, 10)}/{r.metric_date.slice(5, 7)}
                  </span>
                  <span className="flex-1 truncate text-xs sm:text-sm">
                    {r.leads} {r.leads === 1 ? "lead" : "leads"} · {r.vendas} {r.vendas === 1 ? "venda" : "vendas"} · {brl(Number(r.faturamento_cents))}
                  </span>
                  <button
                    aria-label="Editar lançamento"
                    className="p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setDate(r.metric_date)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Remover lançamento"
                    className="p-1.5 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteRow(r.metric_date)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
