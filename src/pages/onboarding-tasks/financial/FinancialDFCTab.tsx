import { Fragment, useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft, ChevronRight, ChevronDown } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinCategory, isVariableCategory, dfcSectionOf, monthKey, monthRange } from "./financeClassification";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

interface DfcRow {
  id: string;
  label: string;
  values: number[]; // por mês, em reais (despesas negativas)
  children?: DfcRow[];
  kind: "section" | "detail" | "total" | "percent" | "final";
  highlight?: boolean;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const addInto = (map: Map<string, number[]>, key: string, idx: number, val: number, nMonths: number) => {
  if (!map.has(key)) map.set(key, new Array(nMonths).fill(0));
  map.get(key)![idx] += val;
};

export default function FinancialDFCTab({ invoices, payables, banks, formatCurrency }: Props) {
  const [categories, setCategories] = useState<FinCategory[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [view, setView] = useState<"realizado" | "projetado">("realizado");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["receitas", "variaveis", "fixas"]));

  const now = new Date();
  const [startMonth, setStartMonth] = useState(format(subMonths(now, 4), "yyyy-MM"));
  const [endMonth, setEndMonth] = useState(format(now, "yyyy-MM"));

  useEffect(() => {
    Promise.all([
      supabase.from("staff_financial_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("staff_financial_entries").select("*"),
    ]).then(([catRes, entRes]) => {
      if (catRes.data) setCategories(catRes.data as any);
      if (entRes.data) setEntries(entRes.data as any);
    });
  }, []);

  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    for (let i = 23; i >= -12; i--) opts.push(format(subMonths(now, i), "yyyy-MM"));
    return opts;
  }, []);

  const months = useMemo(() => monthRange(startMonth, endMonth), [startMonth, endMonth]);

  const model = useMemo(() => {
    const n = months.length;
    const idxOf = new Map(months.map((m, i) => [m, i]));
    const isPaid = view === "realizado";
    const catById = new Map(categories.map((c) => [c.id, c]));

    // ---------- Receitas (faturas + recebíveis + lançamentos manuais) ----------
    const revenueByCat = new Map<string, number[]>();
    const feesByMonth = new Array(n).fill(0);

    invoices.forEach((inv: any) => {
      const mk = monthKey(isPaid ? inv.paid_at : inv.due_date);
      if (mk == null || !idxOf.has(mk)) return;
      if (isPaid && inv.status !== "paid") return;
      const idx = idxOf.get(mk)!;
      const val = (isPaid ? inv.paid_amount_cents ?? inv.amount_cents : inv.amount_cents) / 100;
      const cat = inv.category_id ? catById.get(inv.category_id) : null;
      addInto(revenueByCat, cat ? cat.id : "__uncat_rev__", idx, val, n);
      if (isPaid) feesByMonth[idx] += (inv.payment_fee_cents || 0) / 100;
    });

    entries.forEach((e: any) => {
      if (e.type !== "receita") return;
      if (isPaid && e.status !== "paid") return;
      const mk = monthKey(isPaid ? e.paid_at || e.due_date : e.due_date);
      if (mk == null || !idxOf.has(mk)) return;
      const val = (isPaid ? e.paid_amount_cents ?? e.amount_cents : e.amount_cents) / 100;
      addInto(revenueByCat, e.category_id && catById.has(e.category_id) ? e.category_id : "__uncat_rev__", idxOf.get(mk)!, val, n);
    });

    // ---------- Despesas (contas a pagar + lançamentos manuais) ----------
    // buckets: variavel | fixa (por grupo) | investimento | financiamento — sempre por categoria
    const expenseByCat = new Map<string, number[]>();
    const pushExpense = (categoryId: string | null, costType: string | null, mk: string | null, val: number) => {
      if (mk == null || !idxOf.has(mk) || !val) return;
      const cat = categoryId ? catById.get(categoryId) : null;
      const key = cat ? cat.id : costType === "variavel" ? "__uncat_var__" : "__uncat_fix__";
      addInto(expenseByCat, key, idxOf.get(mk)!, val, n);
    };

    payables.forEach((p: any) => {
      if (isPaid) {
        if (p.status !== "paid") return;
        pushExpense(p.category_id, p.cost_type, monthKey(p.paid_date), p.paid_amount ?? p.amount ?? 0);
      } else {
        const mk = monthKey(p.due_date) ?? (p.reference_month ? String(p.reference_month).substring(0, 7) : null);
        pushExpense(p.category_id, p.cost_type, mk, p.amount ?? 0);
      }
    });

    entries.forEach((e: any) => {
      if (e.type !== "despesa") return;
      if (isPaid && e.status !== "paid") return;
      const mk = monthKey(isPaid ? e.paid_at || e.due_date : e.due_date);
      const val = (isPaid ? e.paid_amount_cents ?? e.amount_cents : e.amount_cents) / 100;
      pushExpense(e.category_id, null, mk, val);
    });

    // ---------- Montagem das linhas ----------
    const catLabel = (key: string) =>
      key === "__uncat_rev__" ? "Sem categoria" :
      key === "__uncat_var__" ? "Sem categoria" :
      key === "__uncat_fix__" ? "Sem categoria" :
      catById.get(key)?.name || "Sem categoria";

    const revenueChildren: DfcRow[] = [...revenueByCat.entries()]
      .sort((a, b) => sum(b[1]) - sum(a[1]))
      .map(([key, values]) => ({ id: `rev:${key}`, label: catLabel(key), values, kind: "detail" as const }));
    const receitas = months.map((_, i) => sum([...revenueByCat.values()].map((v) => v[i])));

    const varChildren: DfcRow[] = [];
    const fixedByGroup = new Map<string, DfcRow[]>();
    const investChildren: DfcRow[] = [];
    const finChildren: DfcRow[] = [];

    if (feesByMonth.some((v) => v > 0)) {
      varChildren.push({ id: "var:fees", label: "Taxas de Cartão / Gateway", values: feesByMonth.map((v) => -v), kind: "detail" });
    }

    [...expenseByCat.entries()].forEach(([key, values]) => {
      const cat = catById.get(key);
      const row: DfcRow = { id: `exp:${key}`, label: catLabel(key), values: values.map((v) => -v), kind: "detail" };
      if (key === "__uncat_var__") { varChildren.push(row); return; }
      if (key === "__uncat_fix__") {
        if (!fixedByGroup.has("Sem categoria")) fixedByGroup.set("Sem categoria", []);
        fixedByGroup.get("Sem categoria")!.push(row);
        return;
      }
      const section = dfcSectionOf(cat);
      if (section === "investimento") { investChildren.push(row); return; }
      if (section === "financiamento") { finChildren.push(row); return; }
      if (isVariableCategory(cat)) { varChildren.push(row); return; }
      const group = cat?.group_name || "Outros";
      if (!fixedByGroup.has(group)) fixedByGroup.set(group, []);
      fixedByGroup.get(group)!.push(row);
    });

    const sortRows = (rows: DfcRow[]) => rows.sort((a, b) => sum(a.values) - sum(b.values));
    sortRows(varChildren);
    sortRows(investChildren);
    sortRows(finChildren);

    const fixedGroupRows: DfcRow[] = [...fixedByGroup.entries()]
      .map(([group, rows]) => ({
        id: `fixgrp:${group}`,
        label: group,
        values: months.map((_, i) => sum(rows.map((r) => r.values[i]))),
        children: sortRows(rows),
        kind: "detail" as const,
      }))
      .sort((a, b) => sum(a.values) - sum(b.values));

    const totalOf = (rows: DfcRow[]) => months.map((_, i) => sum(rows.map((r) => r.values[i])));
    const variaveis = totalOf(varChildren);
    const fixas = totalOf(fixedGroupRows);
    const investimento = totalOf(investChildren);
    const financiamento = totalOf(finChildren);

    const margemContrib = months.map((_, i) => receitas[i] + variaveis[i]);
    const resultadoOp = months.map((_, i) => margemContrib[i] + fixas[i]);
    const variacaoCaixa = months.map((_, i) => resultadoOp[i] + investimento[i] + financiamento[i]);

    const rows: DfcRow[] = [
      { id: "receitas", label: "RECEITAS OPERACIONAIS (A)", values: receitas, children: revenueChildren, kind: "section" },
      { id: "variaveis", label: "CUSTOS VARIÁVEIS (B)", values: variaveis, children: varChildren, kind: "section" },
      { id: "mc", label: "MARGEM DE CONTRIBUIÇÃO (A+B)", values: margemContrib, kind: "total", highlight: true },
      { id: "mcpct", label: "% ((A+B)÷A)", values: margemContrib, kind: "percent" },
      { id: "fixas", label: "DESPESAS FIXAS / OPERACIONAIS (C)", values: fixas, children: fixedGroupRows, kind: "section" },
      { id: "ro", label: "RESULTADO OPERACIONAL (A+B+C=D)", values: resultadoOp, kind: "total", highlight: true },
      { id: "invest", label: "ATIVIDADE DE INVESTIMENTO (E)", values: investimento, children: investChildren, kind: "section" },
      { id: "fin", label: "ATIVIDADE DE FINANCIAMENTO (F)", values: financiamento, children: finChildren, kind: "section" },
      { id: "var", label: "VARIAÇÃO DE CAIXA (D+E+F)", values: variacaoCaixa, kind: "final", highlight: true },
    ];

    const saldoAtual = banks.reduce((s: number, b: any) => s + (b.current_balance_cents || 0), 0) / 100;
    return { rows, receitas, saldoAtual };
  }, [invoices, payables, entries, categories, banks, months, view]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fmtCell = (v: number) => {
    if (Math.abs(v) < 0.005) return "0";
    const abs = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.abs(v));
    return v < 0 ? `(${abs})` : abs;
  };

  const avPct = (v: number, monthIdx: number | null) => {
    const base = monthIdx == null ? sum(model.receitas) : model.receitas[monthIdx];
    if (!base) return "-";
    return `${Math.round((Math.abs(v) / base) * 100)}%`;
  };

  const renderRow = (row: DfcRow, depth: number): JSX.Element[] => {
    const hasChildren = !!row.children?.length;
    const isOpen = expanded.has(row.id);
    const total = sum(row.values);

    const labelCls =
      row.kind === "section" ? "font-semibold" :
      row.kind === "total" || row.kind === "final" ? "font-bold" :
      "text-muted-foreground";
    const rowBg =
      row.kind === "final" ? "bg-primary/10" :
      row.highlight ? "bg-primary/5" :
      row.kind === "section" ? "bg-muted/50" : "";

    const isPct = row.kind === "percent";

    const out: JSX.Element[] = [
      <tr key={row.id} className={`border-b ${rowBg}`}>
        <td
          className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-sm ${labelCls} ${rowBg || "bg-card"}`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggle(row.id)} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              {row.label}
            </button>
          ) : (
            <span className={hasChildren ? "" : "pl-[18px] inline-block"}>{row.label}</span>
          )}
        </td>
        {row.values.map((v, i) => (
          <Fragment key={i}>
            <td className={`px-2 py-2 text-right text-sm tabular-nums whitespace-nowrap ${v < 0 ? "text-destructive" : v > 0 ? (row.kind !== "detail" ? "text-emerald-600" : "") : "text-muted-foreground"}`}>
              {isPct ? avPct(v, i) : fmtCell(v)}
            </td>
            <td className="px-1 py-2 text-right text-[11px] text-muted-foreground tabular-nums border-r border-border/50">
              {isPct ? "" : avPct(v, i)}
            </td>
          </Fragment>
        ))}
        <td className={`px-2 py-2 text-right text-sm font-medium tabular-nums whitespace-nowrap ${total < 0 ? "text-destructive" : total > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
          {isPct ? avPct(total, null) : fmtCell(total)}
        </td>
        <td className="px-1 py-2 text-right text-[11px] text-muted-foreground tabular-nums">
          {isPct ? "" : avPct(total, null)}
        </td>
      </tr>,
    ];

    if (hasChildren && isOpen) row.children!.forEach((c) => out.push(...renderRow(c, depth + 1)));
    return out;
  };

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return `${format(new Date(Number(y), Number(mo) - 1, 1), "MMM", { locale: ptBR })}/${y.substring(2)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            DFC - Análise Vertical
          </h2>
          <p className="text-sm text-muted-foreground">Fluxo de caixa mensal por categoria, com % sobre a receita (AV%)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="realizado">Realizado</TabsTrigger>
              <TabsTrigger value="projetado">Projetado</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={startMonth} onValueChange={setStartMonth}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {monthOptions.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">até</span>
          <Select value={endMonth} onValueChange={setEndMonth}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {monthOptions.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/70">
                  <th className="sticky left-0 z-10 bg-muted/70 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide backdrop-blur">Resultados</th>
                  {months.map((m) => (
                    <Fragment key={m}>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold whitespace-nowrap">{monthLabel(m)}</th>
                      <th className="px-1 py-2.5 text-right text-[10px] font-medium text-muted-foreground border-r border-border/50">AV%</th>
                    </Fragment>
                  ))}
                  <th className="px-2 py-2.5 text-right text-xs font-semibold">Total</th>
                  <th className="px-1 py-2.5 text-right text-[10px] font-medium text-muted-foreground">AV%</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.flatMap((r) => renderRow(r, 0))}
                <tr className="bg-muted/30">
                  <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-sm font-medium">Saldo Bancário Atual</td>
                  <td colSpan={months.length * 2} />
                  <td className={`px-2 py-2.5 text-right text-sm font-bold tabular-nums ${model.saldoAtual >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {fmtCell(model.saldoAtual)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        * Valores em R$. Despesas entre parênteses. AV% = participação sobre a receita do mês.{" "}
        {view === "realizado"
          ? "Mostrando apenas movimentações efetivamente pagas/recebidas."
          : "Mostrando todas as movimentações previstas, independente do pagamento."}{" "}
        Custos variáveis seguem a classificação Fixa/Variável definida em Categorias.
      </p>
    </div>
  );
}
