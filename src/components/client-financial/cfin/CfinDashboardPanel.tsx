import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Wallet, HandCoins, Users, ReceiptText, Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtMoney, fmtDate, MESES } from "./helpers";

interface Dash {
  saldo_total: number;
  contas: { codigo: string; banco: string; titular: string; tipo: string; saldo: number; qtd: number; ultimo: string | null }[];
  mensal: { mes: string; entradas: number; saidas: number }[];
  despesas_grupo: { grupo: string; total: number }[];
  folha_mensal: { comp: string; liquido: number; folhas: number }[];
  emprestimos: { saldo_devedor: number; contratos_ativos: number; parcela_mensal: number };
  funcionarios_ativos: number;
  retiradas_mes: number;
  despesas_pendentes: number;
}

// paleta categórica validada (dataviz validator, modo dark — todos os checks PASS)
const CORES = ["#3987e5", "#0e9aa7", "#c47d24", "#3fa34d", "#d6568c", "#8b6fd6"];
const EMERALD = "#10b981";
const RED = "#ef4444";

const fmtMesCurto = (m: string) => MESES[parseInt(m.split("-")[1])]?.slice(0, 3) ?? m;
const fmtK = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

type Tone = "neutral" | "emerald" | "red" | "violet" | "amber" | "cyan" | "blue";
const TONE: Record<Tone, { chip: string; icon: string; ring: string; value?: string }> = {
  neutral: { chip: "bg-muted", icon: "text-foreground", ring: "" },
  emerald: { chip: "bg-emerald-500/15", icon: "text-emerald-500", ring: "hover:border-emerald-500/40", value: "text-emerald-600 dark:text-emerald-400" },
  red: { chip: "bg-red-500/15", icon: "text-red-500", ring: "hover:border-red-500/40", value: "text-red-600 dark:text-red-400" },
  violet: { chip: "bg-violet-500/15", icon: "text-violet-500", ring: "hover:border-violet-500/40" },
  amber: { chip: "bg-amber-500/15", icon: "text-amber-500", ring: "hover:border-amber-500/40" },
  cyan: { chip: "bg-cyan-500/15", icon: "text-cyan-500", ring: "hover:border-cyan-500/40" },
  blue: { chip: "bg-blue-500/15", icon: "text-blue-500", ring: "hover:border-blue-500/40" },
};

function MetricCard({ icon: Icon, label, value, sub, tone, delay, valueTone }: {
  icon: typeof Wallet; label: string; value: string; sub?: React.ReactNode; tone: Tone; delay: number; valueTone?: boolean;
}) {
  const t = TONE[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={`group rounded-2xl border border-border/60 bg-card p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${t.ring}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.chip}`}>
          <Icon className={`h-[18px] w-[18px] ${t.icon}`} />
        </span>
      </div>
      <div className={`mt-3 truncate text-[26px] font-bold leading-none tabular-nums ${valueTone && t.value ? t.value : "text-foreground"}`}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function ChartCard({ title, subtitle, right, children, delay }: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="rounded-2xl border border-border/60 bg-card p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </motion.div>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
  borderRadius: 12, fontSize: 12, color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 24px rgba(0,0,0,.18)", padding: "8px 12px",
};

export function CfinDashboardPanel({ projectId }: { projectId: string }) {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    supabase.rpc("cfin_dashboard", { p_project: projectId }).then(({ data }) => setD(data as unknown as Dash));
  }, [projectId]);

  if (!d) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[116px] animate-pulse rounded-2xl border border-border/60 bg-card" />
        ))}
      </div>
    );
  }

  const mesAtual = d.mensal[d.mensal.length - 1];
  const resultadoMes = mesAtual ? mesAtual.entradas - mesAtual.saidas : 0;
  const folhaAtual = d.folha_mensal[d.folha_mensal.length - 1];
  const mensalFmt = d.mensal.map(m => ({ ...m, nome: fmtMesCurto(m.mes) }));
  const folhaFmt = d.folha_mensal.map(f => ({ ...f, nome: fmtMesCurto(f.comp) }));
  const contasChart = d.contas.map(c => ({ nome: c.codigo, saldo: Math.round(c.saldo * 100) / 100 }));
  const totalDespesasGrupo = d.despesas_grupo.reduce((s, g) => s + g.total, 0);

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard delay={0} icon={Wallet} label="Saldo em conta" tone={d.saldo_total >= 0 ? "emerald" : "red"} valueTone
          value={fmtMoney(d.saldo_total)} sub={`${d.contas.length} contas ativas com movimento`} />
        <MetricCard delay={0.04} icon={resultadoMes >= 0 ? TrendingUp : TrendingDown} label="Resultado do mês" tone={resultadoMes >= 0 ? "emerald" : "red"} valueTone
          value={fmtMoney(resultadoMes)}
          sub={mesAtual ? (
            <span className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-emerald-500" />{fmtMoney(mesAtual.entradas)}</span>
              <span className="inline-flex items-center gap-1"><ArrowDownRight className="h-3 w-3 text-red-500" />{fmtMoney(mesAtual.saidas)}</span>
            </span>
          ) : undefined} />
        <MetricCard delay={0.08} icon={HandCoins} label="Empréstimos" tone="amber"
          value={fmtMoney(d.emprestimos.saldo_devedor)}
          sub={`${d.emprestimos.contratos_ativos} contratos · parcela/mês ${fmtMoney(d.emprestimos.parcela_mensal)}`} />
        <MetricCard delay={0.12} icon={Users} label="Folha do mês" tone="violet"
          value={folhaAtual ? fmtMoney(folhaAtual.liquido) : "—"}
          sub={`${d.funcionarios_ativos} funcionários ativos`} />
        <MetricCard delay={0.16} icon={ReceiptText} label="Despesas pendentes" tone="red"
          value={fmtMoney(d.despesas_pendentes)} sub="Contas a pagar em aberto" />
        <MetricCard delay={0.2} icon={Banknote} label="Retiradas no mês" tone="blue"
          value={fmtMoney(d.retiradas_mes)} sub="Retiradas em dinheiro das lojas" />
      </div>

      {/* Entradas × Saídas */}
      <ChartCard delay={0.24} title="Entradas × Saídas" subtitle="Últimos 12 meses"
        right={
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: EMERALD }} />Entradas</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: RED }} />Saídas</span>
          </div>
        }>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={mensalFmt} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EMERALD} stopOpacity={0.4} />
                <stop offset="100%" stopColor={EMERALD} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gSai" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
                <stop offset="100%" stopColor={RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtMoney(v), n === "entradas" ? "Entradas" : "Saídas"]} />
            <Area type="monotone" dataKey="entradas" stroke={EMERALD} strokeWidth={2} fill="url(#gEnt)" dot={false} activeDot={{ r: 4 }} />
            <Area type="monotone" dataKey="saidas" stroke={RED} strokeWidth={2} fill="url(#gSai)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Despesas por grupo */}
        <ChartCard delay={0.28} title="Despesas por grupo" subtitle="DRE · ano atual">
          {d.despesas_grupo.length ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={d.despesas_grupo} dataKey="total" nameKey="grupo" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                      {d.despesas_grupo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="text-sm font-bold tabular-nums">{fmtMoney(totalDespesasGrupo)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 w-full">
                {d.despesas_grupo.map((g, i) => (
                  <div key={g.grupo} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                    <span className="flex-1 truncate text-muted-foreground">{g.grupo}</span>
                    <span className="font-medium tabular-nums">{fmtMoney(g.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Sem despesas classificadas no período.</p>}
        </ChartCard>

        {/* Folha mensal */}
        <ChartCard delay={0.32} title="Folha de pagamento" subtitle="Líquido por mês">
          <ResponsiveContainer width="100%" height={228}>
            <BarChart data={folhaFmt} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gFolha" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b6fd6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8b6fd6" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v: number) => [fmtMoney(v), "Líquido"]} />
              <Bar dataKey="liquido" fill="url(#gFolha)" radius={[6, 6, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Saldo por conta */}
      <ChartCard delay={0.36} title="Saldo por conta ativa" subtitle={`${d.contas.length} contas com movimento`}>
        <div className="space-y-2">
          {d.contas.map(c => {
            const max = Math.max(...d.contas.map(x => Math.abs(x.saldo)), 1);
            const pct = Math.min(100, (Math.abs(c.saldo) / max) * 100);
            const neg = c.saldo < 0;
            return (
              <div key={c.codigo} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <div className="text-sm font-medium leading-tight">{c.codigo}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight truncate">{c.banco} · {c.tipo}</div>
                </div>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/40">
                  <div className={`h-full rounded-md ${neg ? "bg-red-500/70" : "bg-emerald-500/70"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className={`w-32 shrink-0 text-right text-sm font-semibold tabular-nums ${neg ? "text-red-500" : "text-emerald-500"}`}>{fmtMoney(c.saldo)}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Saldo pelos débitos/créditos migrados da planilha; lançamentos futuros e informativos não entram.</p>
      </ChartCard>
    </div>
  );
}
