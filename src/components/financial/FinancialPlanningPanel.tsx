import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Copy,
  Target,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: string; // "receita" | "despesa"
  sort_order?: number | null;
}

interface PlanningProps {
  /** company_invoices + financial_receivables já carregados na página (amount_cents) */
  invoices?: any[];
  /** financial_payables já carregados (amount em reais) */
  payables?: any[];
  /** staff_financial_categories ativas */
  categories?: Category[];
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);

const MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MES[m - 1]} ${y}`;
}

export function FinancialPlanningPanel({ invoices, payables, categories: catsProp }: PlanningProps = {}) {
  const inMemory = Array.isArray(invoices) && Array.isArray(payables);

  const [month, setMonth] = useState<string>(currentMonth());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catsState, setCatsState] = useState<Category[]>([]);
  const categories = catsProp && catsProp.length ? catsProp : catsState;

  // planejado salvo por category_id
  const [planned, setPlanned] = useState<Record<string, number>>({});
  // rascunho editável da aba Orçamento
  const [draft, setDraft] = useState<Record<string, number>>({});
  // realizado via RPC (modo sem props)
  const [rpcActual, setRpcActual] = useState<Record<string, number>>({});
  const [rpcUncat, setRpcUncat] = useState<{ receita: number; despesa: number }>({
    receita: 0,
    despesa: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<any>[] = [
        supabase
          .from("financial_budgets")
          .select("category_id,planned_amount")
          .eq("reference_month", month),
      ];
      if (!catsProp || !catsProp.length) {
        tasks.push(
          supabase
            .from("staff_financial_categories")
            .select("id,name,type,sort_order")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
        );
      }
      if (!inMemory) {
        tasks.push((supabase as any).rpc("financial_actuals_by_category", { p_month: month }));
      }
      const results = await Promise.all(tasks);

      const budRes = results[0];
      let idx = 1;
      if (!catsProp || !catsProp.length) {
        setCatsState((results[idx]?.data || []) as Category[]);
        idx++;
      }
      if (!inMemory) {
        const a: Record<string, number> = {};
        const unc = { receita: 0, despesa: 0 };
        (results[idx]?.data || []).forEach((r: any) => {
          const val = Number(r.realizado) || 0;
          if (r.category_id) a[r.category_id] = (a[r.category_id] || 0) + val;
          else unc[r.type === "receita" ? "receita" : "despesa"] += val;
        });
        setRpcActual(a);
        setRpcUncat(unc);
      }

      const p: Record<string, number> = {};
      (budRes.data || []).forEach((b: any) => {
        if (b.category_id) p[b.category_id] = Number(b.planned_amount) || 0;
      });
      setPlanned(p);
      setDraft(p);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar planejamento");
    } finally {
      setLoading(false);
    }
  }, [month, inMemory, catsProp]);

  useEffect(() => {
    load();
  }, [load]);

  const receitas = useMemo(
    () => categories.filter((c) => c.type === "receita"),
    [categories],
  );
  const despesas = useMemo(
    () => categories.filter((c) => c.type === "despesa"),
    [categories],
  );

  // categoria "Mensalidade" recebe a receita recorrente das faturas dos clientes
  const mensalidadeId = useMemo(
    () => receitas.find((c) => /mensalidade/i.test(c.name))?.id || receitas[0]?.id || null,
    [receitas],
  );

  // realizado in-memory a partir de invoices/payables
  const memoActual = useMemo(() => {
    const a: Record<string, number> = {};
    const unc = { receita: 0, despesa: 0 };
    if (!inMemory) return { a, unc };
    const catIds = new Set(categories.map((c) => c.id));

    (payables || []).forEach((p: any) => {
      if ((p.status || "") === "cancelled") return;
      const m = (p.reference_month && /^\d{4}-\d{2}/.test(p.reference_month))
        ? p.reference_month.slice(0, 7)
        : (p.due_date || "").slice(0, 7);
      if (m !== month) return;
      const val = Number(p.amount) || 0;
      if (p.category_id && catIds.has(p.category_id)) a[p.category_id] = (a[p.category_id] || 0) + val;
      else unc.despesa += val;
    });

    (invoices || []).forEach((inv: any) => {
      if ((inv.status || "") === "cancelled") return;
      if ((inv.due_date || "").slice(0, 7) !== month) return;
      const val = (Number(inv.amount_cents) || 0) / 100;
      const cat = inv.category_id && catIds.has(inv.category_id) ? inv.category_id : mensalidadeId;
      if (cat) a[cat] = (a[cat] || 0) + val;
      else unc.receita += val;
    });

    return { a, unc };
  }, [inMemory, invoices, payables, categories, month, mensalidadeId]);

  const actual = inMemory ? memoActual.a : rpcActual;
  const actualUncat = inMemory ? memoActual.unc : rpcUncat;

  const sum = (cats: Category[], src: Record<string, number>) =>
    cats.reduce((acc, c) => acc + (src[c.id] || 0), 0);

  const totals = useMemo(() => {
    const planReceita = sum(receitas, planned);
    const planDespesa = sum(despesas, planned);
    const realReceita = sum(receitas, actual) + actualUncat.receita;
    const realDespesa = sum(despesas, actual) + actualUncat.despesa;
    return {
      planReceita,
      planDespesa,
      planResultado: planReceita - planDespesa,
      realReceita,
      realDespesa,
      realResultado: realReceita - realDespesa,
    };
  }, [receitas, despesas, planned, actual, actualUncat]);

  const draftTotals = useMemo(
    () => ({
      receita: sum(receitas, draft),
      despesa: sum(despesas, draft),
    }),
    [receitas, despesas, draft],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = categories.map((c) => ({
        reference_month: month,
        category_id: c.id,
        category_name: c.name,
        type: c.type,
        planned_amount: draft[c.id] || 0,
      }));
      const { error } = await supabase
        .from("financial_budgets")
        .upsert(rows, { onConflict: "reference_month,category_id" });
      if (error) throw error;
      setPlanned({ ...draft });
      toast.success(`Orçamento de ${monthLabel(month)} salvo`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  };

  const copyPrevMonth = async () => {
    try {
      const prev = shiftMonth(month, -1);
      const { data } = await supabase
        .from("financial_budgets")
        .select("category_id,planned_amount")
        .eq("reference_month", prev);
      if (!data || data.length === 0) {
        toast.info(`Sem orçamento em ${monthLabel(prev)} para copiar`);
        return;
      }
      const next: Record<string, number> = {};
      data.forEach((b: any) => {
        if (b.category_id) next[b.category_id] = Number(b.planned_amount) || 0;
      });
      setDraft(next);
      toast.success(`Copiado de ${monthLabel(prev)} — revise e salve`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao copiar mês anterior");
    }
  };

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(planned),
    [draft, planned],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Planejamento Orçamentário</h2>
          <p className="text-muted-foreground">
            Defina o orçamento da empresa e acompanhe planejado vs realizado
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {monthLabel(month)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Receita"
          plan={totals.planReceita}
          real={totals.realReceita}
          tone="green"
          higherIsBetter
        />
        <SummaryCard
          label="Despesa"
          plan={totals.planDespesa}
          real={totals.realDespesa}
          tone="amber"
          higherIsBetter={false}
        />
        <SummaryCard
          label="Resultado"
          plan={totals.planResultado}
          real={totals.realResultado}
          tone="blue"
          higherIsBetter
        />
      </div>

      <Tabs defaultValue="comparativo">
        <TabsList>
          <TabsTrigger value="comparativo">
            <TrendingUp className="mr-2 h-4 w-4" /> Planejado vs Realizado
          </TabsTrigger>
          <TabsTrigger value="orcamento">
            <Target className="mr-2 h-4 w-4" /> Orçamento
          </TabsTrigger>
        </TabsList>

        {/* COMPARATIVO */}
        <TabsContent value="comparativo" className="mt-4 space-y-6">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <ComparativeSection
                title="Receitas"
                cats={receitas}
                planned={planned}
                actual={actual}
                uncat={actualUncat.receita}
                higherIsBetter
              />
              <ComparativeSection
                title="Despesas"
                cats={despesas}
                planned={planned}
                actual={actual}
                uncat={actualUncat.despesa}
                higherIsBetter={false}
              />
            </>
          )}
        </TabsContent>

        {/* ORÇAMENTO */}
        <TabsContent value="orcamento" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Editando orçamento de <strong>{monthLabel(month)}</strong>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyPrevMonth}>
                <Copy className="mr-2 h-4 w-4" /> Copiar mês anterior
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar orçamento"}
              </Button>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <BudgetEditor
                title="Receitas"
                subtotal={draftTotals.receita}
                cats={receitas}
                draft={draft}
                onChange={(id, v) => setDraft((d) => ({ ...d, [id]: v }))}
                tone="#34d399"
              />
              <BudgetEditor
                title="Despesas"
                subtotal={draftTotals.despesa}
                cats={despesas}
                draft={draft}
                onChange={(id, v) => setDraft((d) => ({ ...d, [id]: v }))}
                tone="#fbbf24"
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- subcomponentes ---------- */

function SummaryCard({
  label,
  plan,
  real,
  tone,
  higherIsBetter,
}: {
  label: string;
  plan: number;
  real: number;
  tone: "green" | "amber" | "blue";
  higherIsBetter: boolean;
}) {
  const TONE = { green: "#34d399", amber: "#fbbf24", blue: "#60a5fa" }[tone];
  const variance = real - plan;
  const pct = plan !== 0 ? (variance / Math.abs(plan)) * 100 : 0;
  const good = higherIsBetter ? variance >= 0 : variance <= 0;
  const varColor = plan === 0 ? "#94a3b8" : good ? "#34d399" : "#f87171";
  return (
    <Card style={{ background: `${TONE}0d`, borderColor: `${TONE}2e` }}>
      <CardContent className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TONE }}>
          {label}
        </p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold">{brl(real)}</span>
          <span className="text-xs text-muted-foreground">real</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Plano: {brl(plan)}</span>
          {plan !== 0 && (
            <span className="flex items-center gap-1 font-medium" style={{ color: varColor }}>
              {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {pct > 0 ? "+" : ""}
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetEditor({
  title,
  subtotal,
  cats,
  draft,
  onChange,
  tone,
}: {
  title: string;
  subtotal: number;
  cats: Category[];
  draft: Record<string, number>;
  onChange: (id: string, v: number) => void;
  tone: string;
}) {
  return (
    <Card style={{ borderColor: `${tone}2e` }}>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold" style={{ color: tone }}>
            {title}
          </h3>
          <span className="text-sm font-bold">{brl(subtotal)}</span>
        </div>
        <div className="space-y-2">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="flex-1 truncate text-sm">{c.name}</span>
              <div className="w-36">
                <CurrencyInput
                  value={draft[c.id] || 0}
                  onChange={(v) => onChange(c.id, v)}
                  className="h-8 text-right text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ComparativeSection({
  title,
  cats,
  planned,
  actual,
  uncat,
  higherIsBetter,
}: {
  title: string;
  cats: Category[];
  planned: Record<string, number>;
  actual: Record<string, number>;
  uncat: number;
  higherIsBetter: boolean;
}) {
  const rows = cats
    .map((c) => ({
      id: c.id,
      name: c.name,
      plan: planned[c.id] || 0,
      real: actual[c.id] || 0,
    }))
    .filter((r) => r.plan !== 0 || r.real !== 0);
  if (uncat !== 0) {
    rows.push({ id: "__uncat__", name: "Sem categoria", plan: 0, real: uncat });
  }

  const totalPlan = rows.reduce((a, r) => a + r.plan, 0);
  const totalReal = rows.reduce((a, r) => a + r.real, 0);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Categoria</th>
              <th className="px-3 py-2 text-right font-medium">Planejado</th>
              <th className="px-3 py-2 text-right font-medium">Realizado</th>
              <th className="px-3 py-2 text-right font-medium">Variação</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Sem orçamento nem lançamentos neste mês
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const variance = r.real - r.plan;
                const pct = r.plan !== 0 ? (variance / Math.abs(r.plan)) * 100 : null;
                const good = higherIsBetter ? variance >= 0 : variance <= 0;
                const color =
                  r.plan === 0 ? "#94a3b8" : good ? "#34d399" : "#f87171";
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{brl(r.plan)}</td>
                    <td className="px-3 py-2 text-right font-medium">{brl(r.real)}</td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color }}>
                      {variance > 0 ? "+" : ""}
                      {brl(variance)}
                    </td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell" style={{ color }}>
                      {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-3 py-2">Total {title}</td>
                <td className="px-3 py-2 text-right">{brl(totalPlan)}</td>
                <td className="px-3 py-2 text-right">{brl(totalReal)}</td>
                <td className="px-3 py-2 text-right">
                  {totalReal - totalPlan > 0 ? "+" : ""}
                  {brl(totalReal - totalPlan)}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
