import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Wallet, HandCoins, Users, ReceiptText, Banknote, TrendingUp } from "lucide-react";
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

const CORES = ["#6366f1", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#64748b"];

const fmtMesCurto = (m: string) => {
  const [, mm] = m.split("-");
  return MESES[parseInt(mm)]?.slice(0, 3) ?? m;
};
const fmtK = (v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));

function Card3D({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -6, scale: 1.015 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className={`relative rounded-2xl border border-border/50 bg-gradient-to-br shadow-lg hover:shadow-2xl transition-shadow overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, gradient, delay }: {
  icon: typeof Wallet; label: string; value: string; sub?: string; gradient: string; delay: number;
}) {
  return (
    <Card3D delay={delay} className={gradient}>
      <div className="absolute -right-6 -top-6 opacity-10">
        <Icon className="h-28 w-28" />
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-80">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className="mt-2 text-lg min-[480px]:text-xl sm:text-2xl font-bold tabular-nums break-words">{value}</div>
        {sub && <div className="mt-1 text-xs opacity-70">{sub}</div>}
      </div>
    </Card3D>
  );
}

export function CfinDashboardPanel({ projectId }: { projectId: string }) {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    supabase.rpc("cfin_dashboard", { p_project: projectId })
      .then(({ data }) => setD(data as unknown as Dash));
  }, [projectId]);

  if (!d) return <p className="text-sm text-muted-foreground animate-pulse">Carregando dashboard…</p>;

  const mesAtual = d.mensal[d.mensal.length - 1];
  const resultadoMes = mesAtual ? mesAtual.entradas - mesAtual.saidas : 0;
  const folhaAtual = d.folha_mensal[d.folha_mensal.length - 1];
  const mensalFmt = d.mensal.map(m => ({ ...m, nome: fmtMesCurto(m.mes) }));
  const folhaFmt = d.folha_mensal.map(f => ({ ...f, nome: fmtMesCurto(f.comp) }));
  const contasChart = d.contas.map(c => ({ nome: c.codigo, saldo: Math.round(c.saldo * 100) / 100 }));

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
    borderRadius: 10, fontSize: 12, color: "hsl(var(--foreground))",
  };

  return (
    <div className="space-y-5">
      {/* Cards de métricas */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard delay={0} icon={Wallet} label="Saldo contas ativas"
          value={fmtMoney(d.saldo_total)}
          sub={`${d.contas.length} contas com movimento`}
          gradient={d.saldo_total >= 0 ? "from-emerald-500/15 to-emerald-500/5" : "from-red-500/15 to-red-500/5"} />
        <MetricCard delay={0.05} icon={TrendingUp} label="Resultado do mês"
          value={fmtMoney(resultadoMes)}
          sub={mesAtual ? `entradas ${fmtMoney(mesAtual.entradas)}` : undefined}
          gradient={resultadoMes >= 0 ? "from-cyan-500/15 to-cyan-500/5" : "from-orange-500/15 to-orange-500/5"} />
        <MetricCard delay={0.1} icon={HandCoins} label="Empréstimos"
          value={fmtMoney(d.emprestimos.saldo_devedor)}
          sub={`${d.emprestimos.contratos_ativos} contratos · parcela mês ${fmtMoney(d.emprestimos.parcela_mensal)}`}
          gradient="from-red-500/15 to-red-500/5" />
        <MetricCard delay={0.15} icon={Users} label="Folha do mês"
          value={folhaAtual ? fmtMoney(folhaAtual.liquido) : "—"}
          sub={`${d.funcionarios_ativos} funcionários ativos`}
          gradient="from-violet-500/15 to-violet-500/5" />
        <MetricCard delay={0.2} icon={ReceiptText} label="Despesas pendentes"
          value={fmtMoney(d.despesas_pendentes)}
          gradient="from-amber-500/15 to-amber-500/5" />
        <MetricCard delay={0.25} icon={Banknote} label="Retiradas no mês"
          value={fmtMoney(d.retiradas_mes)}
          gradient="from-blue-500/15 to-blue-500/5" />
      </div>

      {/* Entradas vs saídas */}
      <Card3D delay={0.3} className="from-card to-card/60">
        <div className="p-4 sm:p-5">
          <h3 className="font-semibold mb-3">Entradas × Saídas — últimos 12 meses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mensalFmt}>
              <defs>
                <linearGradient id="gEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [fmtMoney(v), n === "entradas" ? "Entradas" : "Saídas"]} />
              <Legend formatter={(v) => v === "entradas" ? "Entradas" : "Saídas"} />
              <Area type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2.5} fill="url(#gEntradas)" />
              <Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2.5} fill="url(#gSaidas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card3D>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Despesas por grupo */}
        <Card3D delay={0.35} className="from-card to-card/60">
          <div className="p-4 sm:p-5">
            <h3 className="font-semibold mb-3">Despesas por grupo (DRE) — ano atual</h3>
            {d.despesas_grupo.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={d.despesas_grupo} dataKey="total" nameKey="grupo"
                    innerRadius={62} outerRadius={95} paddingAngle={3} strokeWidth={0}>
                    {d.despesas_grupo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">Sem despesas classificadas no período.</p>}
          </div>
        </Card3D>

        {/* Folha mensal */}
        <Card3D delay={0.4} className="from-card to-card/60">
          <div className="p-4 sm:p-5">
            <h3 className="font-semibold mb-3">Folha de pagamento — líquido por mês</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={folhaFmt}>
                <defs>
                  <linearGradient id="gFolha" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtMoney(v), "Líquido"]} />
                <Bar dataKey="liquido" fill="url(#gFolha)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card3D>
      </div>

      {/* Saldo por conta */}
      <Card3D delay={0.45} className="from-card to-card/60">
        <div className="p-4 sm:p-5">
          <h3 className="font-semibold mb-3">Saldo por conta ativa</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, contasChart.length * 34)}>
            <BarChart data={contasChart} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
              <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtMoney(v), "Saldo"]} />
              <Bar dataKey="saldo" radius={[0, 8, 8, 0]}>
                {contasChart.map((c, i) => <Cell key={i} fill={c.saldo >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {d.contas.map(c => (
              <div key={c.codigo} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{c.codigo} <span className="text-xs text-muted-foreground">({c.tipo})</span></div>
                  <div className="text-xs text-muted-foreground">{c.banco} · {c.titular} · últ. mov. {fmtDate(c.ultimo)}</div>
                </div>
                <div className={`font-semibold tabular-nums ${c.saldo < 0 ? "text-red-500" : "text-emerald-500"}`}>{fmtMoney(c.saldo)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card3D>
    </div>
  );
}
