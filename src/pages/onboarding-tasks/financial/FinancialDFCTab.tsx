import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowRightLeft, ChevronRight, ChevronDown, Tag, Loader2 } from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FinCategory, isVariableCategory, dfcSectionOf, monthKey, monthRange } from "./financeClassification";

interface Props {
  invoices: any[];
  payables: any[];
  banks: any[];
  formatCurrency: (v: number) => string;
  formatCurrencyCents: (v: number) => string;
}

interface DfcItem { id: string; source: string }

interface DfcRow {
  id: string;
  label: string;
  values: number[]; // por mês, em reais (despesas negativas)
  children?: DfcRow[];
  kind: "section" | "detail" | "total" | "percent" | "final";
  highlight?: boolean;
  items?: DfcItem[]; // lançamentos por trás da linha (nível item) — habilita "Categorizar"
  catType?: "receita" | "despesa";
}

interface Bucket {
  values: number[];
  byName: Map<string, { values: number[]; items: DfcItem[] }>;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export default function FinancialDFCTab({ invoices, payables, banks, formatCurrency }: Props) {
  const [staffCats, setStaffCats] = useState<FinCategory[]>([]);
  const [legacyCats, setLegacyCats] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [view, setView] = useState<"realizado" | "projetado">("realizado");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["receitas", "variaveis", "fixas"]));
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [catDialog, setCatDialog] = useState<{ open: boolean; label: string; catType: "receita" | "despesa"; items: DfcItem[] }>({ open: false, label: "", catType: "despesa", items: [] });
  const [dialogCatId, setDialogCatId] = useState("");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [startMonth, setStartMonth] = useState(format(subMonths(now, 4), "yyyy-MM"));
  const [endMonth, setEndMonth] = useState(format(now, "yyyy-MM"));

  // Drag-to-pan horizontal
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("staff_financial_categories").select("*"),
      (supabase as any).from("financial_categories").select("id, name, type"),
      supabase.from("staff_financial_entries").select("*"),
    ]).then(([catRes, legacyRes, entRes]) => {
      if (catRes.data) setStaffCats(catRes.data as any);
      if (legacyRes.data) setLegacyCats(legacyRes.data);
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
    const staffById = new Map(staffCats.map((c) => [c.id, c]));
    const legacyById = new Map(legacyCats.map((c: any) => [c.id, c]));

    const catOf = (row: any, source: string) => {
      const id = overrides.get(`${source}:${row.id}`) ?? row.category_id;
      if (!id) return null;
      const staff = staffById.get(id);
      if (staff) return { key: staff.id, label: staff.name, staff };
      const legacy = legacyById.get(id);
      if (legacy) return { key: `legacy:${legacy.id}`, label: `${legacy.name} (plano antigo)`, legacy };
      return null;
    };

    const buckets = new Map<string, Bucket>();
    const push = (bucketKey: string, name: string, idx: number, val: number, item: DfcItem | null) => {
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, { values: new Array(n).fill(0), byName: new Map() });
      const b = buckets.get(bucketKey)!;
      b.values[idx] += val;
      if (!b.byName.has(name)) b.byName.set(name, { values: new Array(n).fill(0), items: [] });
      const e = b.byName.get(name)!;
      e.values[idx] += val;
      if (item) e.items.push(item);
    };

    const feesByMonth = new Array(n).fill(0);

    // ---------- Receitas (faturas + recebíveis + lançamentos manuais) ----------
    invoices.forEach((inv: any) => {
      const mk = monthKey(isPaid ? inv.paid_at : inv.due_date);
      if (mk == null || !idxOf.has(mk)) return;
      if (isPaid && inv.status !== "paid") return;
      const idx = idxOf.get(mk)!;
      const val = (isPaid ? inv.paid_amount_cents ?? inv.amount_cents : inv.amount_cents) / 100;
      const source = inv.source_table || "company_invoices";
      const cat = catOf(inv, source);
      const name = inv.company_name && inv.company_name !== "Empresa desconhecida" ? inv.company_name : (inv.custom_receiver_name || inv.description || "Sem descrição");
      push(cat ? `rev:${cat.key}` : "rev:__uncat__", name, idx, val, { id: inv.id, source });
      if (isPaid) feesByMonth[idx] += (inv.payment_fee_cents || 0) / 100;
    });

    entries.forEach((e: any) => {
      if (e.type !== "receita") return;
      if (isPaid && e.status !== "paid") return;
      const mk = monthKey(isPaid ? e.paid_at || e.due_date : e.due_date);
      if (mk == null || !idxOf.has(mk)) return;
      const val = (isPaid ? e.paid_amount_cents ?? e.amount_cents : e.amount_cents) / 100;
      const cat = catOf(e, "staff_financial_entries");
      push(cat ? `rev:${cat.key}` : "rev:__uncat__", e.description || "Lançamento manual", idxOf.get(mk)!, val, { id: e.id, source: "staff_financial_entries" });
    });

    // ---------- Despesas (contas a pagar + lançamentos manuais) ----------
    const classifyExpense = (cat: ReturnType<typeof catOf>, fallbackCostType: string | null): { bucket: string } => {
      if (!cat) return { bucket: fallbackCostType === "variavel" ? "var:__uncat__" : "fix:Sem categoria:__uncat__" };
      if (cat.staff) {
        const section = dfcSectionOf(cat.staff);
        if (section === "investimento") return { bucket: `inv:${cat.key}` };
        if (section === "financiamento") return { bucket: `fin:${cat.key}` };
        if (isVariableCategory(cat.staff)) return { bucket: `var:${cat.key}` };
        return { bucket: `fix:${cat.staff.group_name || "Outros"}:${cat.key}` };
      }
      // categoria do plano antigo
      const pseudo = { name: cat.label } as FinCategory;
      if (isVariableCategory(pseudo)) return { bucket: `var:${cat.key}` };
      return { bucket: `fix:Plano antigo:${cat.key}` };
    };

    const pushExpense = (row: any, source: string, mk: string | null, val: number) => {
      if (mk == null || !idxOf.has(mk) || !val) return;
      const cat = catOf(row, source);
      const { bucket } = classifyExpense(cat, row.cost_type ?? null);
      const name = row.supplier_name || row.description || "Sem descrição";
      push(bucket, name, idxOf.get(mk)!, -val, { id: row.id, source });
    };

    payables.forEach((p: any) => {
      if (isPaid) {
        if (p.status === "paid") pushExpense(p, "financial_payables", monthKey(p.paid_date), p.paid_amount ?? p.amount ?? 0);
        else if (p.status === "partial" && p.paid_amount) pushExpense(p, "financial_payables", monthKey(p.paid_date), p.paid_amount);
      } else {
        const mk = monthKey(p.due_date) ?? (p.reference_month ? String(p.reference_month).substring(0, 7) : null);
        pushExpense(p, "financial_payables", mk, p.amount ?? 0);
      }
    });

    entries.forEach((e: any) => {
      if (e.type !== "despesa") return;
      if (isPaid && e.status !== "paid") return;
      const mk = monthKey(isPaid ? e.paid_at || e.due_date : e.due_date);
      const val = (isPaid ? e.paid_amount_cents ?? e.amount_cents : e.amount_cents) / 100;
      pushExpense(e, "staff_financial_entries", mk, val);
    });

    // ---------- Montagem das linhas ----------
    const labelOfKey = (key: string) => {
      if (key.endsWith("__uncat__")) return "Sem categoria";
      if (key.startsWith("legacy:")) {
        const lc = legacyById.get(key.substring(7));
        return lc ? `${lc.name} (plano antigo)` : "Sem categoria";
      }
      return staffById.get(key)?.name || "Sem categoria";
    };

    const nameRows = (b: Bucket, parentId: string, catType: "receita" | "despesa"): DfcRow[] =>
      [...b.byName.entries()]
        .sort((a, bb) => Math.abs(sum(bb[1].values)) - Math.abs(sum(a[1].values)))
        .map(([name, e]) => ({
          id: `${parentId}:item:${name}`,
          label: name,
          values: e.values,
          kind: "detail" as const,
          items: e.items,
          catType,
        }));

    const bucketRows = (prefix: string, catType: "receita" | "despesa"): DfcRow[] =>
      [...buckets.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, b]) => {
          const catKey = k.substring(prefix.length);
          const row: DfcRow = {
            id: k,
            label: labelOfKey(catKey),
            values: b.values,
            kind: "detail",
            children: nameRows(b, k, catType),
            catType,
          };
          return row;
        })
        .sort((a, b2) => Math.abs(sum(b2.values)) - Math.abs(sum(a.values)));

    const revenueChildren = bucketRows("rev:", "receita");
    const receitas = months.map((_, i) => sum(revenueChildren.map((r) => r.values[i])));

    const varChildren = bucketRows("var:", "despesa");
    if (feesByMonth.some((v) => v > 0)) {
      varChildren.unshift({ id: "var:fees", label: "Taxas de Cartão / Gateway (faturas)", values: feesByMonth.map((v) => -v), kind: "detail" });
    }

    // fixas: fix:<grupo>:<catKey>
    const fixGroups = new Map<string, DfcRow[]>();
    [...buckets.entries()].filter(([k]) => k.startsWith("fix:")).forEach(([k, b]) => {
      const rest = k.substring(4);
      const sep = rest.indexOf(":");
      const group = rest.substring(0, sep);
      const catKey = rest.substring(sep + 1);
      if (!fixGroups.has(group)) fixGroups.set(group, []);
      fixGroups.get(group)!.push({ id: k, label: labelOfKey(catKey), values: b.values, kind: "detail", children: nameRows(b, k, "despesa"), catType: "despesa" });
    });
    const fixedGroupRows: DfcRow[] = [...fixGroups.entries()]
      .map(([group, rows]) => ({
        id: `fixgrp:${group}`,
        label: group,
        values: months.map((_, i) => sum(rows.map((r) => r.values[i]))),
        children: rows.sort((a, b2) => sum(a.values) - sum(b2.values)),
        kind: "detail" as const,
      }))
      .sort((a, b2) => sum(a.values) - sum(b2.values));

    const investChildren = bucketRows("inv:", "despesa");
    const finChildren = bucketRows("fin:", "despesa");

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
  }, [invoices, payables, entries, staffCats, legacyCats, banks, months, view, overrides]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCategorize = (row: DfcRow) => {
    if (!row.items?.length || !row.catType) return;
    setDialogCatId("");
    setCatDialog({ open: true, label: row.label, catType: row.catType, items: row.items });
  };

  const applyCategory = async () => {
    if (!dialogCatId) { toast.error("Escolha uma categoria"); return; }
    setSaving(true);
    try {
      const bySource = new Map<string, string[]>();
      catDialog.items.forEach((it) => {
        if (!bySource.has(it.source)) bySource.set(it.source, []);
        bySource.get(it.source)!.push(it.id);
      });
      for (const [table, ids] of bySource.entries()) {
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { error } = await (supabase as any).from(table).update({ category_id: dialogCatId }).in("id", chunk);
          if (error) throw error;
        }
      }
      setOverrides((prev) => {
        const next = new Map(prev);
        catDialog.items.forEach((it) => next.set(`${it.source}:${it.id}`, dialogCatId));
        return next;
      });
      toast.success(`${catDialog.items.length} lançamento(s) categorizados`);
      setCatDialog((d) => ({ ...d, open: false }));
    } catch (e: any) {
      toast.error("Erro ao categorizar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
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
      depth >= 2 ? "text-muted-foreground text-[13px]" : "text-muted-foreground";
    const rowBg =
      row.kind === "final" ? "bg-primary/10" :
      row.highlight ? "bg-primary/5" :
      row.kind === "section" ? "bg-muted/50" : "";

    const isPct = row.kind === "percent";
    const canCategorize = !!row.items?.length && !!row.catType;

    const out: JSX.Element[] = [
      <tr key={row.id} className={`group border-b ${rowBg}`}>
        <td
          className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2 text-sm ${labelCls} ${rowBg || "bg-card"}`}
          style={{ paddingLeft: `${12 + depth * 18}px`, minWidth: "260px", maxWidth: "340px" }}
        >
          <span className="flex items-center gap-1">
            {hasChildren ? (
              <button onClick={() => toggle(row.id)} className="inline-flex items-center gap-1 hover:text-primary transition-colors text-left">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{row.label}</span>
              </button>
            ) : (
              <span className={`truncate ${row.kind === "detail" ? "pl-[18px]" : ""}`}>{row.label}</span>
            )}
            {canCategorize && (
              <button
                onClick={() => openCategorize(row)}
                title="Categorizar estes lançamentos"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-primary hover:text-primary/70"
              >
                <Tag className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
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

  const activeCatOptions = staffCats
    .filter((c) => (c as any).is_active !== false && c.type === catDialog.catType)
    .sort((a, b) => (a.group_name || "").localeCompare(b.group_name || "") || a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            DFC - Análise Vertical
          </h2>
          <p className="text-sm text-muted-foreground">
            Clique no <ChevronRight className="h-3 w-3 inline" /> para abrir até o lançamento. Passe o mouse numa linha e use o <Tag className="h-3 w-3 inline text-primary" /> para categorizar. Arraste a tabela para o lado.
          </p>
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
          <div
            ref={scrollRef}
            className={`overflow-x-auto ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
            style={{ scrollbarWidth: "thin" }}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              dragState.current = { x: e.clientX, left: scrollRef.current!.scrollLeft };
              setDragging(true);
            }}
            onMouseMove={(e) => {
              if (!dragState.current) return;
              scrollRef.current!.scrollLeft = dragState.current.left - (e.clientX - dragState.current.x);
            }}
            onMouseUp={() => { dragState.current = null; setDragging(false); }}
            onMouseLeave={() => { dragState.current = null; setDragging(false); }}
          >
            <table className="min-w-full w-max border-collapse">
              <thead>
                <tr className="border-b bg-muted/70">
                  <th className="sticky left-0 z-10 bg-muted px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Resultados</th>
                  {months.map((m) => (
                    <Fragment key={m}>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold whitespace-nowrap min-w-[90px]">{monthLabel(m)}</th>
                      <th className="px-1 py-2.5 text-right text-[10px] font-medium text-muted-foreground border-r border-border/50">AV%</th>
                    </Fragment>
                  ))}
                  <th className="px-2 py-2.5 text-right text-xs font-semibold min-w-[100px]">Total</th>
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
          ? "Mostrando apenas movimentações efetivamente pagas/recebidas (inclui pagamentos parciais)."
          : "Mostrando todas as movimentações previstas, independente do pagamento."}{" "}
        "(plano antigo)" = categoria do sistema anterior — use o ícone de etiqueta para migrar para o plano de contas atual.
      </p>

      <Dialog open={catDialog.open} onOpenChange={(open) => setCatDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Categorizar lançamentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{catDialog.label}</span> — {catDialog.items.length} lançamento(s) no período visível receberão a categoria escolhida.
            </p>
            <Select value={dialogCatId} onValueChange={setDialogCatId}>
              <SelectTrigger><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {activeCatOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.group_name} · {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog((d) => ({ ...d, open: false }))}>Cancelar</Button>
            <Button onClick={applyCategory} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aplicar categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
