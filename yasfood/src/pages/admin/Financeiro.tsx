import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl, dateBR, todayISO } from "@/lib/format";
import type { Transaction, OrderItem } from "@/lib/types";
import { Button, Card, Input, Select, Modal, Stat, Spinner, Empty, useToast } from "@/components/ui";

const CATS_DESPESA = ["Insumos", "Embalagens", "Gás / energia", "Entrega / combustível", "Marketing", "Equipamentos", "Taxas", "Outros"];
const CATS_RECEITA = ["Vendas", "Encomenda especial", "Outros"];

export default function Financeiro() {
  const toast = useToast();
  const [tx, setTx] = useState<Transaction[] | null>(null);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; total: number }[]>([]);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [novo, setNovo] = useState<Partial<Transaction> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const from = format(subMonths(new Date(), 5), "yyyy-MM-01");
    const [t, i] = await Promise.all([
      supabase.from("transactions").select("*").gte("occurred_on", from).order("occurred_on", { ascending: false }),
      supabase.from("order_items").select("product_name, qty, line_total, orders!inner(status, scheduled_date)").gte("orders.scheduled_date", `${month}-01`).lte("orders.scheduled_date", format(endOfMonth(parseISO(`${month}-01`)), "yyyy-MM-dd")).neq("orders.status", "cancelado"),
    ]);
    setTx((t.data as Transaction[]) ?? []);
    const agg = new Map<string, { name: string; qty: number; total: number }>();
    for (const row of ((i.data as unknown as (OrderItem & { orders: unknown })[]) ?? [])) {
      const cur = agg.get(row.product_name) ?? { name: row.product_name, qty: 0, total: 0 };
      cur.qty += row.qty; cur.total += Number(row.line_total);
      agg.set(row.product_name, cur);
    }
    setTopProducts([...agg.values()].sort((a, b) => b.total - a.total));
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  const monthTx = useMemo(() => (tx ?? []).filter((t) => t.occurred_on.startsWith(month)), [tx, month]);
  const receita = monthTx.filter((t) => t.type === "receita").reduce((a, t) => a + Number(t.amount), 0);
  const despesa = monthTx.filter((t) => t.type === "despesa").reduce((a, t) => a + Number(t.amount), 0);
  const lucro = receita - despesa;

  const chart = useMemo(() => {
    const months: { key: string; label: string; receita: number; despesa: number }[] = [];
    for (let k = 5; k >= 0; k--) {
      const d = subMonths(new Date(), k);
      months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: ptBR }), receita: 0, despesa: 0 });
    }
    for (const t of tx ?? []) {
      const m = months.find((x) => t.occurred_on.startsWith(x.key));
      if (m) m[t.type] += Number(t.amount);
    }
    return months;
  }, [tx]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of monthTx.filter((t) => t.type === "despesa")) m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [monthTx]);

  const save = async () => {
    if (!novo?.amount) return toast("Informe o valor.", "err");
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({ type: novo.type ?? "despesa", category: novo.category ?? "Outros", amount: Number(novo.amount), occurred_on: novo.occurred_on ?? todayISO(), description: novo.description ?? "", payment_method: novo.payment_method ?? null });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    setNovo(null);
    void load();
  };

  const remove = async (t: Transaction) => {
    if (t.order_id) return toast("Receita de pedido: desmarque o pagamento no pedido.", "err");
    if (!confirm("Excluir lançamento?")) return;
    await supabase.from("transactions").delete().eq("id", t.id);
    void load();
  };

  const monthOptions = Array.from({ length: 6 }, (_, k) => { const d = subMonths(new Date(), k); return { v: format(d, "yyyy-MM"), l: format(startOfMonth(d), "MMMM yyyy", { locale: ptBR }) }; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Financeiro</h1>
        <div className="flex items-center gap-2">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="!h-10 capitalize">{monthOptions.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</Select>
          <Button onClick={() => setNovo({ type: "despesa", category: "Insumos", occurred_on: todayISO() })}><Plus size={16} /> Lançar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receita" value={brl(receita)} tone="good" sub={`${monthTx.filter((t) => t.type === "receita").length} lançamentos`} />
        <Stat label="Despesas" value={brl(despesa)} tone="bad" />
        <Stat label="Lucro" value={brl(lucro)} tone={lucro >= 0 ? "good" : "bad"} sub={receita ? `margem ${Math.round((lucro / receita) * 100)}%` : ""} />
        <Stat label="Bolos vendidos" value={topProducts.reduce((a, p) => a + p.qty, 0)} sub="no mês selecionado" tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Últimos 6 meses" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={chart} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3e7d8" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} width={60} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#b3173c" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesa" name="Despesas" fill="#d4a97c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Mais vendidos">
          {topProducts.length === 0 ? <Empty>Sem vendas no mês.</Empty> : (
            <ul className="space-y-1 text-sm">{topProducts.map((p) => <li key={p.name} className="flex justify-between"><span>{p.qty}x {p.name}</span><b>{brl(p.total)}</b></li>)}</ul>
          )}
          {byCat.length > 0 && (
            <>
              <h4 className="mb-1 mt-4 text-xs font-bold uppercase text-choco-500">Despesas por categoria</h4>
              <ul className="space-y-1 text-sm">{byCat.map(([c, v]) => <li key={c} className="flex justify-between"><span>{c}</span><b>{brl(v)}</b></li>)}</ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Lançamentos do mês">
        {tx === null ? <Spinner /> : monthTx.length === 0 ? <Empty>Nada lançado neste mês. Receitas entram sozinhas quando você marca o pedido como pago.</Empty> : (
          <ul className="divide-y divide-choco-100 text-sm">
            {monthTx.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <span className="w-20 text-choco-500">{dateBR(t.occurred_on)}</span>
                <span className="flex-1"><b>{t.category}</b>{t.description && <span className="text-choco-600"> · {t.description}</span>}{t.payment_method && <span className="text-xs text-choco-400"> · {t.payment_method}</span>}</span>
                <span className={clsx("font-bold", t.type === "receita" ? "text-emerald-700" : "text-red-700")}>{t.type === "receita" ? "+" : "-"}{brl(t.amount)}</span>
                <button className="p-1 text-choco-300 hover:text-red-600" onClick={() => remove(t)}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {novo && (
        <Modal open onClose={() => setNovo(null)} title="Novo lançamento">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select label="Tipo" value={novo.type} onChange={(e) => setNovo({ ...novo, type: e.target.value as Transaction["type"], category: e.target.value === "receita" ? "Vendas" : "Insumos" })}><option value="despesa">Despesa</option><option value="receita">Receita</option></Select>
              <Select label="Categoria" value={novo.category} onChange={(e) => setNovo({ ...novo, category: e.target.value })}>{(novo.type === "receita" ? CATS_RECEITA : CATS_DESPESA).map((c) => <option key={c}>{c}</option>)}</Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Valor (R$)" type="number" step="0.01" value={novo.amount ?? ""} onChange={(e) => setNovo({ ...novo, amount: Number(e.target.value) })} autoFocus />
              <Input label="Data" type="date" value={novo.occurred_on} onChange={(e) => setNovo({ ...novo, occurred_on: e.target.value })} />
            </div>
            <Input label="Descrição" value={novo.description ?? ""} onChange={(e) => setNovo({ ...novo, description: e.target.value })} placeholder="Ex.: 5kg farinha + 30 ovos" />
            <Select label="Forma de pagamento" value={novo.payment_method ?? ""} onChange={(e) => setNovo({ ...novo, payment_method: e.target.value || null })}><option value="">—</option><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option></Select>
            <Button className="w-full" loading={busy} onClick={save}>Salvar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
