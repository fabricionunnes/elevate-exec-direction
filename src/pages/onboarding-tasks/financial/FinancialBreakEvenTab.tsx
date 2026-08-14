import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Crosshair, Plus, X, RotateCcw, TrendingUp, TrendingDown, Percent, Wallet, FileSpreadsheet, AlertTriangle } from "lucide-react";
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
const STORAGE_KEY = "nexus_breakeven_scenario_v2";

// Cenário base da planilha "Ponto de equilíbrio inicial Univendas" (consultoria BPO)
const SHEET_FIX: Omit<AmountRow, "id">[] = [
  { label: "Prolabore", value: 15000 },
  { label: "Folha de pagamento", value: 38000 },
  { label: "Aluguel", value: 15000 },
  { label: "Energia", value: 150 },
  { label: "Contador", value: 650 },
  { label: "Software", value: 6700 },
  { label: "Internet", value: 220 },
  { label: "Outros", value: 10000 },
];
const SHEET_VAR: Omit<PctRow, "id">[] = [
  { label: "% Custo Fornecedores (Tráfego)", pct: 20 },
  { label: "% Matéria Prima", pct: 0 },
  { label: "% Terceirizações", pct: 0 },
  { label: "% Impostos Venda", pct: 6 },
  { label: "% Comissão Vendas", pct: 0 },
  { label: "% Taxa cartão", pct: 6.5 },
  { label: "% Outros", pct: 2 },
];
const SHEET_FAT: Omit<AmountRow, "id">[] = [
  { label: "Maio", value: 55000 },
  { label: "Junho", value: 101000 },
  { label: "Julho", value: 84000 },
];
const SHEET_DEBT: Omit<AmountRow, "id">[] = [
  { label: "Mercado Pago", value: 3000 },
  { label: "Juro cheque especial", value: 0 },
];

const withIds = <T extends object>(rows: T[]): (T & { id: string })[] => rows.map((r) => ({ ...r, id: uid() }));

export default function FinancialBreakEvenTab({ invoices, payables, formatCurrency }: Props) {
  const [categories, setCategories] = useState<FinCategory[]>([]);
  const [varRows, setVarRows] = useState<PctRow[]>([]);
  const [fixRows, setFixRows] = useState<AmountRow[]>([]);
  const [debtRows, setDebtRows] = useState<AmountRow[]>([]);
  const [fatRows, setFatRows] = useState<AmountRow[]>([]);
  const [includeDebts, setIncludeDebts] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const baseline = useRef<{ peCom: number } | null>(null);

  useEffect(() => {
    supabase.from("staff_financial_categories").select("*").eq("is_active", true)
      .then(({ data }) => { if (data) setCategories(data as any); });
  }, []);

  // Médias reais dos últimos 3 meses fechados (faturas pagas + contas pagas/parciais)
  const realData = useMemo(() => {
    const now = new Date();
    const last3 = [3, 2, 1].map((i) => format(subMonths(now, i), "yyyy-MM"));
    const catById = new Map(categories.map((c) => [c.id, c]));

    const revenueByMonth = new Map<string, number>(last3.map((m) => [m, 0]));
    let receita = 0;
    let fees = 0;
    invoices.forEach((inv: any) => {
      const mk = monthKey(inv.paid_at);
      if (inv.status !== "paid" || !mk || !last3.includes(mk)) return;
      const val = (inv.paid_amount_cents ?? inv.amount_cents) / 100;
      receita += val;
      revenueByMonth.set(mk, (revenueByMonth.get(mk) || 0) + val);
      fees += (inv.payment_fee_cents || 0) / 100;
    });

    const varByCat = new Map<string, number>();
    const fixByName = new Map<string, number>();
    let debts = 0;
    payables.forEach((p: any) => {
      const mk = monthKey(p.paid_date);
      const isPago = p.status === "paid" || (p.status === "partial" && p.paid_amount);
      if (!isPago || !mk || !last3.includes(mk)) return;
      const val = (p.status === "partial" ? p.paid_amount : p.paid_amount ?? p.amount) || 0;
      const cat = p.category_id ? catById.get(p.category_id) : null;
      const section = dfcSectionOf(cat);
      if (section === "financiamento") { debts += val; return; }
      if (section === "investimento") return;
      if (isVariableCategory(cat) || p.cost_type === "variavel") {
        const key = cat?.name || "Outros variáveis";
        varByCat.set(key, (varByCat.get(key) || 0) + val);
      } else {
        // Mapeia grupos/categorias do sistema para as linhas da planilha
        const catName = cat?.name || "";
        const group = cat?.group_name || "";
        const key =
          /sal[aá]rio|pessoal/i.test(catName) || group === "Despesas com Pessoal" ? "Folha de pagamento" :
          /aluguel/i.test(catName) ? "Aluguel" :
          /energia|internet|telefone/i.test(catName) ? "Energia / Internet" :
          /contabil|jur[ií]dico/i.test(catName) ? "Contador" :
          /software|ferramenta/i.test(catName) ? "Software" :
          "Outros";
        fixByName.set(key, (fixByName.get(key) || 0) + val);
      }
    });

    const receitaMedia = receita / 3;
    return {
      last3,
      revenueByMonth,
      receitaMedia,
      feesPct: receita > 0 ? (fees / receita) * 100 : 0,
      varByCat,
      fixByName,
      debtAvg: debts / 3,
      receita,
    };
  }, [invoices, payables, categories]);

  const seedFromSheet = () => {
    setFixRows(withIds(SHEET_FIX));
    setVarRows(withIds(SHEET_VAR));
    setFatRows(withIds(SHEET_FAT));
    setDebtRows(withIds(SHEET_DEBT));
    baseline.current = null;
  };

  const seedFromReal = () => {
    const pctOf = (total: number) => (realData.receita > 0 ? Number(((total / realData.receita) * 100).toFixed(1)) : 0);
    const varNamed = (re: RegExp) => {
      let t = 0;
      realData.varByCat.forEach((v, k) => { if (re.test(k)) t += v; });
      return pctOf(t);
    };
    const outrosVar = (() => {
      let t = 0;
      realData.varByCat.forEach((v, k) => {
        if (!/tr[aá]fego|marketing|imposto|comiss|estorno|devolu/i.test(k)) t += v;
      });
      return pctOf(t);
    })();
    const vr: PctRow[] = withIds([
      { label: "% Custo Fornecedores (Tráfego)", pct: varNamed(/tr[aá]fego|marketing/i) },
      { label: "% Impostos Venda", pct: Math.max(varNamed(/imposto/i), 6) },
      { label: "% Comissão Vendas", pct: varNamed(/comiss/i) },
      { label: "% Taxa cartão", pct: Math.max(Number(realData.feesPct.toFixed(1)), 3.5) },
      { label: "% Estornos / Devoluções", pct: varNamed(/estorno|devolu/i) },
      { label: "% Outros", pct: outrosVar },
    ]);

    const fixOrder = ["Prolabore", "Folha de pagamento", "Aluguel", "Energia / Internet", "Contador", "Software", "Outros"];
    const fr: AmountRow[] = withIds(
      fixOrder.map((label) => ({ label, value: Math.round((realData.fixByName.get(label) || 0) / 3) }))
    );

    const ft: AmountRow[] = withIds(
      realData.last3.map((m) => ({
        label: format(new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1), "MMMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
        value: Math.round(realData.revenueByMonth.get(m) || 0),
      }))
    );

    const dr: AmountRow[] = withIds([{ label: "Parcelas de dívidas / empréstimos", value: Math.round(realData.debtAvg) }]);

    setVarRows(vr);
    setFixRows(fr);
    setFatRows(ft);
    setDebtRows(dr);
    baseline.current = null;
  };

  // Seed inicial: localStorage > planilha da consultoria
  useEffect(() => {
    if (seeded) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if ((s.fixRows || []).length) {
          setVarRows(s.varRows || []);
          setFixRows(s.fixRows || []);
          setDebtRows(s.debtRows || []);
          setFatRows(s.fatRows || []);
          setIncludeDebts(s.includeDebts ?? true);
          setSeeded(true);
          return;
        }
      } catch { /* cai no seed da planilha */ }
    }
    seedFromSheet();
    setSeeded(true);
  }, [seeded]);

  const calc = useMemo(() => {
    const pctTotal = Math.min(varRows.reduce((s, r) => s + (r.pct || 0), 0), 95);
    const mcPct = 100 - pctTotal;
    const fixTotal = fixRows.reduce((s, r) => s + (r.value || 0), 0);
    const debtTotal = debtRows.reduce((s, r) => s + (r.value || 0), 0);
    const fatValid = fatRows.filter((r) => (r.value || 0) > 0);
    const fatMedia = fatValid.length ? fatValid.reduce((s, r) => s + r.value, 0) / fatValid.length : 0;
    const peSem = mcPct > 0 ? fixTotal / (mcPct / 100) : 0;
    const peCom = mcPct > 0 ? (fixTotal + debtTotal) / (mcPct / 100) : 0;
    const peAtivo = includeDebts ? peCom : peSem;
    const gap = fatMedia - peAtivo;
    const progresso = peAtivo > 0 ? Math.min((fatMedia / peAtivo) * 100, 150) : 0;
    const peXFatCom = fatMedia > 0 ? peCom / fatMedia : 0;
    const peXFatSem = fatMedia > 0 ? peSem / fatMedia : 0;
    const dividaXFat = fatMedia > 0 ? (debtTotal / fatMedia) * 100 : 0;
    const prolaboreRow = fixRows.find((r) => /pr[oó].?labore/i.test(r.label));
    const prolaboreXFat = fatMedia > 0 && prolaboreRow ? ((prolaboreRow.value || 0) / fatMedia) * 100 : 0;
    return { pctTotal, mcPct, fixTotal, debtTotal, fatMedia, peSem, peCom, peAtivo, gap, progresso, peXFatCom, peXFatSem, dividaXFat, prolaboreXFat };
  }, [varRows, fixRows, debtRows, fatRows, includeDebts]);

  useEffect(() => {
    if (seeded && !baseline.current && calc.peCom > 0) baseline.current = { peCom: calc.peCom };
  }, [seeded, calc]);

  useEffect(() => {
    if (!seeded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ varRows, fixRows, debtRows, fatRows, includeDebts }));
  }, [varRows, fixRows, debtRows, fatRows, includeDebts, seeded]);

  const deltaCom = baseline.current ? calc.peCom - baseline.current.peCom : 0;

  const num = (v: string) => {
    const parsed = parseFloat(v.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  };

  const dividaStatus =
    calc.dividaXFat <= 3 ? { label: "Saudável", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" } :
    calc.dividaXFat <= 10 ? { label: "Perigoso", cls: "bg-amber-100 text-amber-700 border-amber-300" } :
    { label: "Crítico", cls: "bg-red-100 text-red-700 border-red-300" };

  const rowEditor = (
    rows: AmountRow[],
    setRows: (fn: (p: AmountRow[]) => AmountRow[]) => void,
    addLabel: string,
    step = 100,
  ) => (
    <>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <Input value={r.label} onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))} className="h-8 text-sm flex-1" />
          <Input
            type="number" step={step} min="0" value={r.value}
            onChange={(e) => setRows((p) => p.map((x) => x.id === r.id ? { ...x, value: num(e.target.value) } : x))}
            className="h-8 text-sm text-right w-28 tabular-nums"
          />
          <button onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="w-full" onClick={() => setRows((p) => [...p, { id: uid(), label: addLabel, value: 0 }])}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            Ponto de Equilíbrio
          </h2>
          <p className="text-sm text-muted-foreground">
            Modelo da consultoria: levantamento de dados + cálculo e análise. Edite qualquer valor e veja o impacto na hora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); seedFromSheet(); }}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Cenário da planilha
          </Button>
          <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); seedFromReal(); }}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Dados reais do sistema
          </Button>
        </div>
      </div>

      {/* ===== Cálculo ===== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/40">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">P.E Completo (com dívidas)</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(calc.peCom)}</p>
            <p className="text-xs text-muted-foreground mt-1">= {calc.peXFatCom.toFixed(2)}x o faturamento médio</p>
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
            <p className="text-xs text-muted-foreground uppercase tracking-wide">P.E Sem Dívidas</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(calc.peSem)}</p>
            <p className="text-xs text-muted-foreground mt-1">= {calc.peXFatSem.toFixed(2)}x o faturamento médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Percent className="h-3 w-3" /> MC Simples</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${calc.mcPct < 50 ? "text-destructive" : "text-emerald-600"}`}>{calc.mcPct.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Custo variável: {calc.pctTotal.toFixed(1)}% da receita</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wallet className="h-3 w-3" /> Faturamento vs P.E</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${calc.gap >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {calc.gap >= 0 ? "+" : ""}{formatCurrency(calc.gap)}
            </p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${calc.progresso >= 100 ? "bg-emerald-500" : "bg-destructive"}`}
                style={{ width: `${Math.min(calc.progresso, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{calc.progresso.toFixed(0)}% do ponto de equilíbrio {includeDebts ? "(com dívidas)" : "(sem dívidas)"}</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Análise ===== */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Análise Dívida x Faturamento</p>
              <Badge variant="outline" className={dividaStatus.cls}>{dividaStatus.label}</Badge>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{calc.dividaXFat.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-2">Até 3% = saudável · até 10% = perigoso · acima de 10% = crítico</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Prolabore x Faturamento</p>
              {calc.prolaboreXFat > 15 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                  <AlertTriangle className="h-3 w-3" /> Atenção
                </Badge>
              )}
            </div>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${calc.prolaboreXFat > 15 ? "text-amber-600" : ""}`}>{calc.prolaboreXFat.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-2">Acima de ~15% o pró-labore pesa demais na estrutura</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Levantamento de dados ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estimativa de Despesas Fixas (R$/mês)</CardTitle>
            <p className="text-xs text-muted-foreground">O que existe mesmo sem vender</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {rowEditor(fixRows, setFixRows, "Nova despesa fixa")}
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total Despesas Fixas</span>
              <span className="tabular-nums">{formatCurrency(calc.fixTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Estimativa de Custos Variáveis (% da receita)</CardTitle>
            <p className="text-xs text-muted-foreground">O que cresce junto com a venda</p>
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
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setVarRows((p) => [...p, { id: uid(), label: "% Novo custo variável", pct: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Total Custos Variáveis</span>
              <span className="tabular-nums">{calc.pctTotal.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Margem de Contribuição</span>
              <span className="tabular-nums">{calc.mcPct.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Faturamento médio (3 meses)</CardTitle>
              <p className="text-xs text-muted-foreground">Recebido em cada um dos últimos meses</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {rowEditor(fatRows, setFatRows, "Novo mês", 1000)}
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Média Mensal</span>
                <span className="tabular-nums">{formatCurrency(calc.fatMedia)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Dívidas Mensais (R$/mês)</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Considerar</span>
                  <Switch checked={includeDebts} onCheckedChange={setIncludeDebts} />
                </div>
              </div>
            </CardHeader>
            <CardContent className={`space-y-2 ${includeDebts ? "" : "opacity-50"}`}>
              {rowEditor(debtRows, setDebtRows, "Nova dívida")}
              <div className="flex justify-between text-sm font-semibold border-t pt-2">
                <span>Média Mensal</span>
                <span className="tabular-nums">{formatCurrency(calc.debtTotal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        * P.E = Despesas Fixas (+ dívidas) ÷ Margem de Contribuição. Estrutura baseada na planilha "Ponto de equilíbrio inicial Univendas" da consultoria.
        "Cenário da planilha" carrega os valores originais dela; "Dados reais do sistema" preenche com a média dos últimos 3 meses fechados. O cenário editado fica salvo neste navegador.
      </p>
    </div>
  );
}
