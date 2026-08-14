import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Crosshair, Plus, X, RotateCcw, TrendingUp, TrendingDown, Percent, Wallet } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FinCategory, isVariableCategory, dfcSectionOf, monthKey } from "./financeClassification";

interface Props {
  invoices: any[];
  payables: any[];
  formatCurrency: (v: number) => string;
}

interface PctRow { id: string; label: string; pct: number }
interface AmountRow { id: string; label: string; value: number }

const uid = () => Math.random().toString(36).substring(2, 9);
const STORAGE_KEY = "nexus_breakeven_scenario_v1";

export default function FinancialBreakEvenTab({ invoices, payables, formatCurrency }: Props) {
  const [categories, setCategories] = useState<FinCategory[]>([]);
  const [varRows, setVarRows] = useState<PctRow[]>([]);
  const [fixRows, setFixRows] = useState<AmountRow[]>([]);
  const [debtRows, setDebtRows] = useState<AmountRow[]>([]);
  const [includeDebts, setIncludeDebts] = useState(true);
  const [faturamentoAtual, setFaturamentoAtual] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const baseline = useRef<{ peCom: number; peSem: number } | null>(null);

  useEffect(() => {
    supabase.from("staff_financial_categories").select("*").eq("is_active", true)
      .then(({ data }) => { if (data) setCategories(data as any); });
  }, []);

  // Médias reais dos últimos 3 meses fechados
  const realData = useMemo(() => {
    const now = new Date();
    const last3 = [1, 2, 3].map((i) => format(subMonths(now, i), "yyyy-MM"));
    const catById = new Map(categories.map((c) => [c.id, c]));

    let receita = 0;
    let fees = 0;
    invoices.forEach((inv: any) => {
      const mk = monthKey(inv.paid_at);
      if (inv.status !== "paid" || !mk || !last3.includes(mk)) return;
      receita += (inv.paid_amount_cents ?? inv.amount_cents) / 100;
      fees += (inv.payment_fee_cents || 0) / 100;
    });

    const varByCat = new Map<string, number>();
    const fixByGroup = new Map<string, number>();
    let debts = 0;
    payables.forEach((p: any) => {
      const mk = monthKey(p.paid_date);
      if (p.status !== "paid" || !mk || !last3.includes(mk)) return;
      const val = p.paid_amount ?? p.amount ?? 0;
      const cat = p.category_id ? catById.get(p.category_id) : null;
      const section = dfcSectionOf(cat);
      if (section === "financiamento") { debts += val; return; }
      if (section === "investimento") return;
      if (isVariableCategory(cat) || p.cost_type === "variavel") {
        varByCat.set(cat?.name || "Outros variáveis", (varByCat.get(cat?.name || "Outros variáveis") || 0) + val);
      } else {
        const g = cat?.group_name || "Sem categoria";
        fixByGroup.set(g, (fixByGroup.get(g) || 0) + val);
      }
    });

    const receitaMedia = receita / 3;
    return {
      receitaMedia,
      feesPct: receita > 0 ? (fees / receita) * 100 : 0,
      varPcts: [...varByCat.entries()].map(([label, total]) => ({
        label,
        pct: receita > 0 ? (total / receita) * 100 : 0,
      })).filter((r) => r.pct >= 0.05),
      fixAvgs: [...fixByGroup.entries()].map(([label, total]) => ({ label, value: total / 3 }))
        .filter((r) => r.value >= 1).sort((a, b) => b.value - a.value),
      debtAvg: debts / 3,
    };
  }, [invoices, payables, categories]);

  const seedFromReal = () => {
    const vr: PctRow[] = [
      { id: uid(), label: "Imposto (Simples)", pct: 6 },
      { id: uid(), label: "Taxa de Cartão / Gateway", pct: Math.max(Number(realData.feesPct.toFixed(1)), 3.5) },
      ...realData.varPcts
        .filter((r) => !/imposto/i.test(r.label))
        .map((r) => ({ id: uid(), label: r.label, pct: Number(r.pct.toFixed(1)) })),
    ];
    const fr: AmountRow[] = realData.fixAvgs.map((r) => ({ id: uid(), label: r.label, value: Math.round(r.value) }));
    const dr: AmountRow[] = realData.debtAvg >= 1
      ? [{ id: uid(), label: "Parcelas de dívidas / empréstimos", value: Math.round(realData.debtAvg) }]
      : [{ id: uid(), label: "Parcelas de dívidas / empréstimos", value: 0 }];
    setVarRows(vr);
    setFixRows(fr.length ? fr : [{ id: uid(), label: "Despesas fixas", value: 0 }]);
    setDebtRows(dr);
    setFaturamentoAtual(Math.round(realData.receitaMedia));
    baseline.current = null;
  };

  // Seed inicial: localStorage > dados reais.
  // Espera invoices E payables chegarem — senão o seed sai zerado e fica salvo errado.
  useEffect(() => {
    if (seeded || categories.length === 0 || invoices.length === 0 || payables.length === 0) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        const savedFixTotal = (s.fixRows || []).reduce((acc: number, r: any) => acc + (r.value || 0), 0);
        // Cenário salvo zerado com dado real disponível = seed antigo quebrado; recarrega do real
        if (savedFixTotal > 0 || realData.fixAvgs.length === 0) {
          setVarRows(s.varRows || []);
          setFixRows(s.fixRows || []);
          setDebtRows(s.debtRows || []);
          setIncludeDebts(s.includeDebts ?? true);
          setFaturamentoAtual(s.faturamentoAtual || Math.round(realData.receitaMedia));
          setSeeded(true);
          return;
        }
      } catch { /* cai no seed real */ }
    }
    seedFromReal();
    setSeeded(true);
  }, [categories, invoices, payables, seeded, realData]);

  const calc = useMemo(() => {
    const pctTotal = Math.min(varRows.reduce((s, r) => s + (r.pct || 0), 0), 95);
    const mcPct = 100 - pctTotal;
    const fixTotal = fixRows.reduce((s, r) => s + (r.value || 0), 0);
    const debtTotal = debtRows.reduce((s, r) => s + (r.value || 0), 0);
    const peSem = mcPct > 0 ? fixTotal / (mcPct / 100) : 0;
    const peCom = mcPct > 0 ? (fixTotal + debtTotal) / (mcPct / 100) : 0;
    const peAtivo = includeDebts ? peCom : peSem;
    const gap = faturamentoAtual - peAtivo;
    const progresso = peAtivo > 0 ? Math.min((faturamentoAtual / peAtivo) * 100, 150) : 0;
    return { pctTotal, mcPct, fixTotal, debtTotal, peSem, peCom, peAtivo, gap, progresso };
  }, [varRows, fixRows, debtRows, includeDebts, faturamentoAtual]);

  // Guarda o primeiro cálculo como cenário base para mostrar o delta das simulações
  useEffect(() => {
    if (seeded && !baseline.current && calc.peCom > 0) {
      baseline.current = { peCom: calc.peCom, peSem: calc.peSem };
    }
  }, [seeded, calc]);

  // Persistência do cenário
  useEffect(() => {
    if (!seeded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ varRows, fixRows, debtRows, includeDebts, faturamentoAtual }));
  }, [varRows, fixRows, debtRows, includeDebts, faturamentoAtual, seeded]);

  const deltaCom = baseline.current ? calc.peCom - baseline.current.peCom : 0;

  const num = (v: string) => {
    const parsed = parseFloat(v.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            Ponto de Equilíbrio
          </h2>
          <p className="text-sm text-muted-foreground">
            O mínimo que a empresa precisa faturar no mês pra pagar as contas. Edite qualquer valor e veja o impacto na hora.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); seedFromReal(); }}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Recarregar dos dados reais
        </Button>
      </div>

      {/* Resultado */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/40">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ponto de Equilíbrio {includeDebts ? "(com dívidas)" : "(sem dívidas)"}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(calc.peAtivo)}</p>
            {baseline.current && Math.abs(deltaCom) >= 1 && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${deltaCom > 0 ? "text-destructive" : "text-emerald-600"}`}>
                {deltaCom > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {deltaCom > 0 ? "+" : ""}{formatCurrency(deltaCom)} vs cenário inicial
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{includeDebts ? "Sem dívidas seria" : "Com dívidas seria"}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(includeDebts ? calc.peSem : calc.peCom)}</p>
            <p className="text-xs text-muted-foreground mt-1">Dívidas pesam {formatCurrency(calc.debtTotal)}/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Percent className="h-3 w-3" /> Margem de Contribuição</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${calc.mcPct < 50 ? "text-destructive" : "text-emerald-600"}`}>{calc.mcPct.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Custo variável: {calc.pctTotal.toFixed(1)}% da receita</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wallet className="h-3 w-3" /> Faturamento vs PE</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${calc.gap >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {calc.gap >= 0 ? "+" : ""}{formatCurrency(calc.gap)}
            </p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${calc.progresso >= 100 ? "bg-emerald-500" : "bg-destructive"}`}
                style={{ width: `${Math.min(calc.progresso, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{calc.progresso.toFixed(0)}% do ponto de equilíbrio</p>
          </CardContent>
        </Card>
      </div>

      {/* Simulação */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Custos variáveis % */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custos Variáveis (% da receita)</CardTitle>
            <p className="text-xs text-muted-foreground">Imposto, taxa de cartão, comissão, tráfego — o que cresce junto com a venda</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {varRows.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input value={r.label} onChange={(e) => setVarRows((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))} className="h-8 text-sm flex-1" />
                <div className="relative w-24">
                  <Input
                    type="number" step="0.1" min="0" value={r.pct}
                    onChange={(e) => setVarRows((p) => p.map((x) => x.id === r.id ? { ...x, pct: num(e.target.value) } : x))}
                    className="h-8 text-sm text-right pr-6 tabular-nums"
                  />
                  <span className="absolute right-2 top-1.5 text-xs text-muted-foreground">%</span>
                </div>
                <button onClick={() => setVarRows((p) => p.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setVarRows((p) => [...p, { id: uid(), label: "Novo custo variável", pct: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total variável</span>
              <span className="tabular-nums">{calc.pctTotal.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Despesas fixas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Despesas Fixas (R$/mês)</CardTitle>
            <p className="text-xs text-muted-foreground">Folha, pró-labore, aluguel, software — o que existe mesmo sem vender</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {fixRows.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input value={r.label} onChange={(e) => setFixRows((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))} className="h-8 text-sm flex-1" />
                <Input
                  type="number" step="100" min="0" value={r.value}
                  onChange={(e) => setFixRows((p) => p.map((x) => x.id === r.id ? { ...x, value: num(e.target.value) } : x))}
                  className="h-8 text-sm text-right w-28 tabular-nums"
                />
                <button onClick={() => setFixRows((p) => p.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setFixRows((p) => [...p, { id: uid(), label: "Nova despesa fixa", value: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total fixas</span>
              <span className="tabular-nums">{formatCurrency(calc.fixTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Dívidas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Dívidas e Parcelas (R$/mês)</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Considerar</span>
                <Switch checked={includeDebts} onCheckedChange={setIncludeDebts} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Parcelas de negociação, empréstimos, juros — ligue/desligue pra comparar</p>
          </CardHeader>
          <CardContent className={`space-y-2 ${includeDebts ? "" : "opacity-50"}`}>
            {debtRows.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input value={r.label} onChange={(e) => setDebtRows((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))} className="h-8 text-sm flex-1" />
                <Input
                  type="number" step="100" min="0" value={r.value}
                  onChange={(e) => setDebtRows((p) => p.map((x) => x.id === r.id ? { ...x, value: num(e.target.value) } : x))}
                  className="h-8 text-sm text-right w-28 tabular-nums"
                />
                <button onClick={() => setDebtRows((p) => p.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setDebtRows((p) => [...p, { id: uid(), label: "Nova parcela", value: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total dívidas</span>
              <span className="tabular-nums">{formatCurrency(calc.debtTotal)}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Faturamento de referência (média 3 meses)</label>
              <Input
                type="number" step="1000" min="0" value={faturamentoAtual}
                onChange={(e) => setFaturamentoAtual(num(e.target.value))}
                className="h-9 text-sm text-right tabular-nums mt-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        * PE = Despesas Fixas ÷ (1 − % Custo Variável). Valores iniciais vêm da média real dos últimos 3 meses fechados
        (faturas pagas e contas pagas categorizadas). O cenário editado fica salvo neste navegador.
      </p>
    </div>
  );
}
