import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { format, parse, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  invoices: any[];
  payables: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface BPRow {
  label: string;
  value: number;
  indent?: number;
  bold?: boolean;
  section?: boolean;
  total?: boolean;
  tooltip?: string;
  color?: "green" | "red" | "blue" | "default";
}

export default function FinancialBalancoTab({ invoices, payables, formatCurrency, formatCurrencyCents }: Props) {
  const [banks, setBanks] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [banksRes, entriesRes, catRes] = await Promise.all([
        supabase.from("financial_banks").select("id, name, current_balance_cents, is_active").eq("is_active", true),
        supabase.from("staff_financial_entries").select("*").order("due_date"),
        supabase.from("staff_financial_categories").select("*").eq("is_active", true).order("sort_order"),
      ]);
      setBanks(banksRes.data || []);
      setEntries(entriesRes.data || []);
      setCategories(catRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const bp = useMemo(() => {
    const today = new Date();
    const in12months = addMonths(today, 12);

    // ── ATIVO CIRCULANTE ────────────────────────────────────────────────────

    // 1. Disponibilidades — soma dos saldos bancários ativos
    const disponibilidades = banks.reduce((s, b) => s + (b.current_balance_cents ?? 0), 0) / 100;

    // 2. Contas a Receber — faturas pendentes/vencidas (company_invoices + financial_receivables)
    const contasReceberCents = invoices
      .filter(i => ["pending", "overdue"].includes(i.status))
      .reduce((s: number, i: any) => s + (i.amount_cents || 0), 0);
    const contasReceber = contasReceberCents / 100;

    const ativoCirculante = disponibilidades + contasReceber;

    // ── ATIVO NÃO CIRCULANTE ────────────────────────────────────────────────
    // Sem tabela de imobilizado — placeholder
    const imobilizado = 0;
    const ativoNaoCirculante = imobilizado;

    const totalAtivo = ativoCirculante + ativoNaoCirculante;

    // ── PASSIVO CIRCULANTE ──────────────────────────────────────────────────
    // Contas a pagar pendentes com vencimento em até 12 meses
    const passivoCPCents = payables
      .filter((p: any) => p.status === "pending" && p.due_date && new Date(p.due_date) <= in12months)
      .reduce((s: number, p: any) => s + Math.round((p.amount || 0) * 100), 0);
    const passivoCirculante = passivoCPCents / 100;

    // ── PASSIVO NÃO CIRCULANTE ──────────────────────────────────────────────
    // Contas a pagar com vencimento acima de 12 meses
    const passivoNCPCents = payables
      .filter((p: any) => p.status === "pending" && p.due_date && new Date(p.due_date) > in12months)
      .reduce((s: number, p: any) => s + Math.round((p.amount || 0) * 100), 0);
    const passivoNaoCirculante = passivoNCPCents / 100;

    const totalPassivo = passivoCirculante + passivoNaoCirculante;

    // ── PATRIMÔNIO LÍQUIDO ──────────────────────────────────────────────────
    // Resultado acumulado = total de receitas pagas - total de despesas pagas (todas as entradas)
    const receitaAcumulada = entries
      .filter((e: any) => e.type === "receita" && e.status === "paid")
      .reduce((s: number, e: any) => s + (e.paid_amount_cents || e.amount_cents || 0), 0) / 100;

    const invoicesReceitaAcumulada = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100;

    const despesaAcumulada = entries
      .filter((e: any) => e.type === "despesa" && e.status === "paid")
      .reduce((s: number, e: any) => s + (e.paid_amount_cents || e.amount_cents || 0), 0) / 100;

    const payablesPagos = payables
      .filter((p: any) => p.status === "paid")
      .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);

    const resultadoAcumulado = (receitaAcumulada + invoicesReceitaAcumulada) - (despesaAcumulada + payablesPagos);

    // Cálculo do mês atual para resultado do exercício
    const mesEntradas = entries.filter((e: any) => e.due_date?.startsWith(currentMonth) && e.status === "paid");
    const receitaMes = mesEntradas.filter((e: any) => e.type === "receita")
      .reduce((s: number, e: any) => s + (e.paid_amount_cents || e.amount_cents || 0), 0) / 100;
    const despesaMes = mesEntradas.filter((e: any) => e.type === "despesa")
      .reduce((s: number, e: any) => s + (e.paid_amount_cents || e.amount_cents || 0), 0) / 100;
    const invoicesMes = invoices
      .filter((i: any) => i.status === "paid" && i.paid_at?.startsWith(currentMonth))
      .reduce((s: number, i: any) => s + (i.paid_amount_cents || i.amount_cents || 0), 0) / 100;
    const payablesMes = payables
      .filter((p: any) => p.status === "paid" && p.paid_date?.startsWith(currentMonth))
      .reduce((s: number, p: any) => s + (p.paid_amount || p.amount || 0), 0);
    const resultadoMes = (receitaMes + invoicesMes) - (despesaMes + payablesMes);

    const totalPL = resultadoAcumulado;
    const totalPassivoMaisPL = totalPassivo + totalPL;
    const diferenca = totalAtivo - totalPassivoMaisPL;
    const equilibrado = Math.abs(diferenca) < 1;

    return {
      disponibilidades, contasReceber, ativoCirculante,
      imobilizado, ativoNaoCirculante,
      totalAtivo,
      passivoCirculante, passivoNaoCirculante, totalPassivo,
      resultadoAcumulado, resultadoMes, totalPL,
      totalPassivoMaisPL, diferenca, equilibrado,
    };
  }, [banks, invoices, payables, entries]);

  const chartData = [
    { name: "Ativo Circ.", value: bp.ativoCirculante, color: "#22c55e" },
    { name: "Ativo N.Circ.", value: bp.ativoNaoCirculante, color: "#86efac" },
    { name: "Passivo Circ.", value: bp.passivoCirculante, color: "#ef4444" },
    { name: "Pass. N.Circ.", value: bp.passivoNaoCirculante, color: "#fca5a5" },
    { name: "Patr. Líquido", value: bp.totalPL, color: bp.totalPL >= 0 ? "#3b82f6" : "#f97316" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Balanço Patrimonial
            </h2>
            <p className="text-sm text-muted-foreground">Posição patrimonial da empresa — calculada automaticamente</p>
          </div>
          <div className="flex items-center gap-2">
            {bp.equilibrado ? (
              <Badge className="gap-1 bg-green-600 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Balanço equilibrado
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Diferença de {fmt(Math.abs(bp.diferenca))}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Totais rápidos */}
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Ativo</p>
              <p className="text-2xl font-bold text-green-600">{fmt(bp.totalAtivo)}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Passivo</p>
              <p className="text-2xl font-bold text-red-500">{fmt(bp.totalPassivo)}</p>
            </CardContent>
          </Card>
          <Card className={`${bp.totalPL >= 0 ? "bg-blue-500/10 border-blue-500/30" : "bg-orange-500/10 border-orange-500/30"}`}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Patrimônio Líquido</p>
              <p className={`text-2xl font-bold ${bp.totalPL >= 0 ? "text-blue-500" : "text-orange-500"}`}>{fmt(bp.totalPL)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ═══ TABELA BP ═══ */}
          <div className="space-y-4">
            {/* ATIVO */}
            <Card>
              <CardContent className="p-0">
                <BPSection
                  title="ATIVO"
                  sectionKey="ativo"
                  collapsed={collapsedSections.has("ativo")}
                  onToggle={toggleSection}
                  total={bp.totalAtivo}
                  totalColor="green"
                >
                  {/* Ativo Circulante */}
                  <BPGroup
                    title="Ativo Circulante"
                    groupKey="ativo-circ"
                    collapsed={collapsedSections.has("ativo-circ")}
                    onToggle={toggleSection}
                    total={bp.ativoCirculante}
                  >
                    <BPLine label="Disponibilidades" value={bp.disponibilidades} indent={2}
                      tooltip="Soma dos saldos de todas as contas bancárias ativas" />
                    <BPLine label="Contas a Receber" value={bp.contasReceber} indent={2}
                      tooltip="Faturas pendentes e vencidas a receber de clientes" />
                  </BPGroup>

                  {/* Ativo Não Circulante */}
                  <BPGroup
                    title="Ativo Não Circulante"
                    groupKey="ativo-nc"
                    collapsed={collapsedSections.has("ativo-nc")}
                    onToggle={toggleSection}
                    total={bp.ativoNaoCirculante}
                  >
                    <BPLine label="Imobilizado" value={bp.imobilizado} indent={2}
                      tooltip="Bens, máquinas e equipamentos — a ser configurado" muted />
                  </BPGroup>
                </BPSection>
              </CardContent>
            </Card>

            {/* PASSIVO + PL */}
            <Card>
              <CardContent className="p-0">
                <BPSection
                  title="PASSIVO + PATRIMÔNIO LÍQUIDO"
                  sectionKey="passivo"
                  collapsed={collapsedSections.has("passivo")}
                  onToggle={toggleSection}
                  total={bp.totalPassivoMaisPL}
                  totalColor={bp.equilibrado ? "green" : "red"}
                >
                  {/* Passivo Circulante */}
                  <BPGroup
                    title="Passivo Circulante"
                    groupKey="passivo-circ"
                    collapsed={collapsedSections.has("passivo-circ")}
                    onToggle={toggleSection}
                    total={bp.passivoCirculante}
                  >
                    <BPLine label="Contas a Pagar (≤ 12 meses)" value={bp.passivoCirculante} indent={2}
                      tooltip="Despesas pendentes com vencimento nos próximos 12 meses" />
                  </BPGroup>

                  {/* Passivo Não Circulante */}
                  <BPGroup
                    title="Passivo Não Circulante"
                    groupKey="passivo-nc"
                    collapsed={collapsedSections.has("passivo-nc")}
                    onToggle={toggleSection}
                    total={bp.passivoNaoCirculante}
                  >
                    <BPLine label="Contas a Pagar (> 12 meses)" value={bp.passivoNaoCirculante} indent={2}
                      tooltip="Despesas pendentes com vencimento acima de 12 meses" />
                  </BPGroup>

                  {/* Patrimônio Líquido */}
                  <BPGroup
                    title="Patrimônio Líquido"
                    groupKey="pl"
                    collapsed={collapsedSections.has("pl")}
                    onToggle={toggleSection}
                    total={bp.totalPL}
                    totalColor={bp.totalPL >= 0 ? "blue" : "orange"}
                  >
                    <BPLine label="Resultado Acumulado" value={bp.resultadoAcumulado} indent={2}
                      tooltip="Soma de todas as receitas pagas menos todas as despesas pagas desde o início"
                      color={bp.resultadoAcumulado >= 0 ? "green" : "red"} />
                  </BPGroup>
                </BPSection>
              </CardContent>
            </Card>

            {/* Nota */}
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Os valores são calculados automaticamente com base nos lançamentos financeiros do sistema.
              Ativo Não Circulante (imobilizado) e Capital Social precisam ser configurados manualmente para um BP completo.
            </p>
          </div>

          {/* ═══ GRÁFICO ═══ */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-4">Composição Patrimonial</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tickFormatter={(v) => `R$${Math.abs(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <RechartTooltip
                      formatter={(value: any) => [fmt(Math.abs(value)), ""]}
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Indicadores */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Indicadores de Saúde Patrimonial</p>
                <Indicador
                  label="Liquidez Corrente"
                  value={bp.passivoCirculante > 0 ? bp.ativoCirculante / bp.passivoCirculante : null}
                  format="ratio"
                  tooltip="Ativo Circulante ÷ Passivo Circulante. Acima de 1 = saudável"
                  threshold={1}
                />
                <Indicador
                  label="Endividamento"
                  value={bp.totalAtivo > 0 ? (bp.totalPassivo / bp.totalAtivo) * 100 : null}
                  format="percent"
                  tooltip="Passivo Total ÷ Ativo Total × 100. Abaixo de 50% = saudável"
                  threshold={50}
                  invertThreshold
                />
                <Indicador
                  label="Capital de Giro"
                  value={bp.ativoCirculante - bp.passivoCirculante}
                  format="currency"
                  tooltip="Ativo Circulante − Passivo Circulante. Positivo = saudável"
                  threshold={0}
                />
                <Indicador
                  label="Resultado do Mês Atual"
                  value={bp.resultadoMes}
                  format="currency"
                  tooltip={`Receitas pagas − Despesas pagas em ${format(new Date(), "MMMM/yyyy", { locale: ptBR })}`}
                  threshold={0}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function BPSection({ title, sectionKey, collapsed, onToggle, total, totalColor, children }: {
  title: string; sectionKey: string; collapsed: boolean; onToggle: (k: string) => void;
  total: number; totalColor?: "green" | "red" | "blue" | "orange"; children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    green: "text-green-500", red: "text-red-500", blue: "text-blue-500", orange: "text-orange-500"
  };
  const color = colorMap[totalColor ?? "default"] ?? "text-foreground";
  return (
    <div>
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => onToggle(sectionKey)}
      >
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${color}`}>{fmt(total)}</span>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}

function BPGroup({ title, groupKey, collapsed, onToggle, total, totalColor, children }: {
  title: string; groupKey: string; collapsed: boolean; onToggle: (k: string) => void;
  total: number; totalColor?: "green" | "red" | "blue" | "orange"; children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    green: "text-green-500", red: "text-red-500", blue: "text-blue-500", orange: "text-orange-500"
  };
  const color = colorMap[totalColor ?? "default"] ?? "text-foreground";
  return (
    <div className="border-t border-border/40">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
        onClick={() => onToggle(groupKey)}
      >
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${color}`}>{fmt(total)}</span>
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {!collapsed && <div className="pb-1">{children}</div>}
    </div>
  );
}

function BPLine({ label, value, indent = 0, tooltip, color, muted }: {
  label: string; value: number; indent?: number; tooltip?: string;
  color?: "green" | "red"; muted?: boolean;
}) {
  const colorClass = color === "green" ? "text-green-500" : color === "red" ? "text-red-400" : muted ? "text-muted-foreground" : "text-foreground";
  const content = (
    <div className={`flex items-center justify-between px-4 py-1.5 hover:bg-muted/10`}
      style={{ paddingLeft: `${(indent || 0) * 12 + 16}px` }}>
      <span className={`text-sm flex items-center gap-1.5 ${muted ? "text-muted-foreground" : ""}`}>
        {label}
        {tooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
      </span>
      <span className={`text-sm font-medium tabular-nums ${colorClass}`}>{fmt(value)}</span>
    </div>
  );
  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function Indicador({ label, value, format: fmt_, tooltip, threshold, invertThreshold }: {
  label: string; value: number | null; format: "ratio" | "percent" | "currency";
  tooltip: string; threshold: number; invertThreshold?: boolean;
}) {
  if (value === null) return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-muted-foreground">N/D</span>
    </div>
  );

  const isGood = invertThreshold ? value <= threshold : value >= threshold;
  const displayValue = fmt_ === "ratio"
    ? `${value.toFixed(2)}x`
    : fmt_ === "percent"
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 cursor-help">
          <span className="text-sm">{label}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold tabular-nums ${isGood ? "text-green-500" : "text-red-400"}`}>
              {displayValue}
            </span>
            {isGood
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            }
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
