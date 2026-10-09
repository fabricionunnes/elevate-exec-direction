import { useCallback, useEffect, useState } from "react";
import { Plus, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, AlertTriangle, Pencil } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl, dateTimeBR, todayISO } from "@/lib/format";
import { RecipeModal } from "@/pages/admin/CardapioAdmin";
import type { Ingredient, StockMovement, Product, ProductCost } from "@/lib/types";
import { Button, Card, Input, Select, Modal, Spinner, Empty, useToast } from "@/components/ui";

const emptyIng: Omit<Ingredient, "id"> = { name: "", unit: "g", qty_on_hand: 0, min_qty: 0, cost_per_unit: 0, supplier: "", active: true, pack_size: null, pack_label: "pacote" };

export default function Estoque() {
  const toast = useToast();
  const [ings, setIngs] = useState<Ingredient[] | null>(null);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [editing, setEditing] = useState<Partial<Ingredient> | null>(null);
  const [mov, setMov] = useState<{ ingredient: Ingredient; type: StockMovement["type"] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [costs, setCosts] = useState<ProductCost[]>([]);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);

  const load = useCallback(async () => {
    const [i, m, p, c] = await Promise.all([
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("product_costs").select("*"),
    ]);
    setIngs((i.data as Ingredient[]) ?? []);
    setMoves((m.data as StockMovement[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    setCosts((c.data as ProductCost[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing?.name) return toast("Nome do insumo.", "err");
    setBusy(true);
    const { id, ...rest } = editing;
    const payload = { ...emptyIng, ...rest };
    const { error } = id ? await supabase.from("ingredients").update(payload).eq("id", id) : await supabase.from("ingredients").insert(payload);
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    setEditing(null);
    void load();
  };

  const byId = Object.fromEntries((ings ?? []).map((i) => [i.id, i]));
  const stockValue = (ings ?? []).reduce((a, i) => a + Number(i.qty_on_hand) * Number(i.cost_per_unit), 0);
  const low = (ings ?? []).filter((i) => i.active && Number(i.qty_on_hand) <= Number(i.min_qty));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Estoque</h1>
        <Button onClick={() => setEditing({ ...emptyIng })}><Plus size={16} /> Novo insumo</Button>
      </div>
      <p className="text-sm text-choco-600">Cadastre os insumos e monte a receita de cada bolo no Cardápio. Quando um pedido entra em produção, o estoque baixa sozinho. Valor em estoque: <b>{brl(stockValue)}</b>.</p>

      {low.length > 0 && <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200"><AlertTriangle size={16} /> Repor: {low.map((i) => i.name).join(", ")}</div>}

      <Card title="Receitas, custo e margem por produto">
        {products.length === 0 ? <Empty>Cadastre produtos no Cardápio.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-choco-500"><tr><th className="py-1 pr-3">Produto</th><th className="py-1 pr-3 text-right">Preço</th><th className="py-1 pr-3 text-right">Custo</th><th className="py-1 pr-3 text-right">Margem</th><th className="py-1 text-right">%</th><th></th></tr></thead>
              <tbody className="divide-y divide-choco-100">
                {products.map((p) => {
                  const c = costs.find((x) => x.product_id === p.id);
                  const pct = Number(c?.margin_pct ?? 0);
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 font-semibold">{p.name}</td>
                      <td className="py-2 pr-3 text-right">{brl(p.price)}</td>
                      <td className="py-2 pr-3 text-right">{brl(c?.cost ?? 0)}</td>
                      <td className={clsx("py-2 pr-3 text-right font-bold", Number(c?.margin ?? 0) >= 0 ? "text-emerald-700" : "text-red-700")}>{brl(c?.margin ?? 0)}</td>
                      <td className={clsx("py-2 text-right font-bold", pct >= 50 ? "text-emerald-700" : pct >= 30 ? "text-amber-700" : "text-red-700")}>{pct}%</td>
                      <td className="py-2 pl-2 text-right"><Button size="sm" variant="outline" onClick={() => setRecipeFor(p)}>Editar receita</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-choco-500">O custo usa o último preço pago em cada insumo. Repôs mais caro, a margem cai na hora.</p>
      </Card>

      {ings === null ? <Spinner /> : ings.length === 0 ? <Empty>Nenhum insumo cadastrado.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-choco-100 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-choco-50 text-left text-xs uppercase tracking-wide text-choco-500">
              <tr><th className="p-3">Insumo</th><th className="p-3 text-right">Em estoque</th><th className="p-3 text-right">Mínimo</th><th className="p-3 text-right">Custo/unid.</th><th className="p-3">Fornecedor</th><th className="p-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-choco-100">
              {ings.map((i) => {
                const isLow = Number(i.qty_on_hand) <= Number(i.min_qty);
                return (
                  <tr key={i.id} className={clsx(!i.active && "opacity-50")}>
                    <td className="p-3 font-semibold">{i.name}</td>
                    <td className={clsx("p-3 text-right font-bold", isLow ? "text-red-600" : "text-choco-900")}>{Number(i.qty_on_hand).toLocaleString("pt-BR")} {i.unit}</td>
                    <td className="p-3 text-right text-choco-500">{Number(i.min_qty).toLocaleString("pt-BR")} {i.unit}</td>
                    <td className="p-3 text-right">{brl(i.cost_per_unit)}</td>
                    <td className="p-3 text-choco-600">{i.supplier}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button title="Entrada (compra)" className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" onClick={() => setMov({ ingredient: i, type: "entrada" })}><ArrowDownToLine size={16} /></button>
                        <button title="Saída (perda, uso avulso)" className="rounded-lg p-2 text-amber-700 hover:bg-amber-50" onClick={() => setMov({ ingredient: i, type: "saida" })}><ArrowUpFromLine size={16} /></button>
                        <button title="Ajuste (contagem)" className="rounded-lg p-2 text-choco-600 hover:bg-choco-100" onClick={() => setMov({ ingredient: i, type: "ajuste" })}><SlidersHorizontal size={16} /></button>
                        <button title="Editar" className="rounded-lg p-2 text-choco-500 hover:bg-choco-100" onClick={() => setEditing(i)}><Pencil size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <datalist id="fornecedores">{[...new Set(ings?.map((i) => i.supplier).filter(Boolean))].map((s) => <option key={s} value={s} />)}</datalist>
      <Card title="Últimas movimentações">
        {moves.length === 0 ? <Empty>Sem movimentações.</Empty> : (
          <ul className="divide-y divide-choco-100 text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-1.5">
                <span><b>{byId[m.ingredient_id]?.name ?? "?"}</b> <span className="text-choco-500">· {m.type}{m.supplier ? ` · ${m.supplier}` : ""}{m.total_cost ? ` · ${brl(m.total_cost)}` : ""}{m.note ? ` · ${m.note}` : ""}</span></span>
                <span className={clsx("font-bold", Number(m.qty) >= 0 ? "text-emerald-700" : "text-red-700")}>{Number(m.qty) >= 0 ? "+" : ""}{Number(m.qty).toLocaleString("pt-BR")} {byId[m.ingredient_id]?.unit} <span className="ml-2 text-xs font-normal text-choco-400">{dateTimeBR(m.created_at)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Editar insumo" : "Novo insumo"}>
          <div className="space-y-3">
            <Input label="Nome" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select label="Unidade" value={editing.unit ?? "g"} onChange={(e) => setEditing({ ...editing, unit: e.target.value as Ingredient["unit"] })}>
                <option value="g">gramas (g)</option><option value="kg">quilos (kg)</option><option value="ml">mililitros (ml)</option><option value="l">litros (l)</option><option value="un">unidade (un)</option>
              </Select>
              <Input label="Custo por unidade (R$)" type="number" step="0.0001" value={editing.cost_per_unit ?? 0} onChange={(e) => setEditing({ ...editing, cost_per_unit: Number(e.target.value) })} hint="Ex.: farinha a R$ 5/kg = 0,005 por g" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {!editing.id && <Input label="Quantidade inicial" type="number" step="any" value={editing.qty_on_hand ?? 0} onChange={(e) => setEditing({ ...editing, qty_on_hand: Number(e.target.value) })} />}
              <Input label="Estoque mínimo (alerta)" type="number" step="any" value={editing.min_qty ?? 0} onChange={(e) => setEditing({ ...editing, min_qty: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label={`Cada embalagem tem (${editing.unit ?? "g"})`} type="number" step="any" value={editing.pack_size ?? ""} onChange={(e) => setEditing({ ...editing, pack_size: e.target.value ? Number(e.target.value) : null })} hint="Ex.: farinha 1000, ovos 12" />
              <Input label="Nome da embalagem" value={editing.pack_label ?? "pacote"} onChange={(e) => setEditing({ ...editing, pack_label: e.target.value })} placeholder="pacote, lata, dúzia" />
            </div>
            <Input label="Fornecedor" value={editing.supplier ?? ""} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> ativo</label>
            <Button className="w-full" loading={busy} onClick={save}>Salvar</Button>
          </div>
        </Modal>
      )}

      {mov && <MovementModal ingredient={mov.ingredient} type={mov.type} onClose={() => setMov(null)} onDone={() => { setMov(null); void load(); }} />}
      {recipeFor && <RecipeModal product={recipeFor} onClose={() => { setRecipeFor(null); void load(); }} />}
    </div>
  );
}

function MovementModal({ ingredient, type, onClose, onDone }: { ingredient: Ingredient; type: StockMovement["type"]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [packs, setPacks] = useState("");
  const [packSize, setPackSize] = useState(ingredient.pack_size ? String(ingredient.pack_size) : "");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [supplier, setSupplier] = useState(ingredient.supplier ?? "");
  const [launchExpense, setLaunchExpense] = useState(true);
  const [busy, setBusy] = useState(false);
  const title = { entrada: "Compra de", saida: "Saída de", ajuste: "Ajustar contagem de", producao: "" }[type];
  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  const totalQty = type === "entrada" ? num(packs) * num(packSize) : num(qty);
  const totalCost = num(cost);
  const unitCost = totalQty > 0 && totalCost > 0 ? totalCost / totalQty : null;

  const submit = async () => {
    if (type === "entrada" && totalQty <= 0) return toast("Informe quantas embalagens e quanto vem em cada uma.", "err");
    if (type === "saida" && totalQty <= 0) return toast("Informe a quantidade.", "err");
    const signed = type === "entrada" ? totalQty : type === "saida" ? -totalQty : num(qty) - Number(ingredient.qty_on_hand);
    setBusy(true);
    let transaction_id: string | null = null;
    if (type === "entrada" && totalCost > 0 && launchExpense) {
      const { data, error } = await supabase.from("transactions").insert({
        type: "despesa", category: "Insumos", amount: totalCost, occurred_on: todayISO(),
        description: `${num(packs)} ${ingredient.pack_label}(s) de ${ingredient.name}${supplier ? ` · ${supplier}` : ""}${note ? ` · ${note}` : ""}`,
      }).select("id").single();
      if (error) { setBusy(false); return toast(friendlyError(error), "err"); }
      transaction_id = (data as { id: string }).id;
    }
    const payload: Partial<StockMovement> = { ingredient_id: ingredient.id, type, qty: signed, note, unit_cost: unitCost, total_cost: type === "entrada" && totalCost > 0 ? totalCost : null, transaction_id, supplier: type === "entrada" ? supplier.trim() : "" };
    const { error } = await supabase.from("stock_movements").insert(payload);
    if (!error && type === "entrada") {
      const upd: Record<string, unknown> = {};
      if (num(packSize) > 0 && num(packSize) !== Number(ingredient.pack_size ?? 0)) upd.pack_size = num(packSize);
      if (supplier.trim() && supplier.trim() !== ingredient.supplier) upd.supplier = supplier.trim();
      if (Object.keys(upd).length) await supabase.from("ingredients").update(upd).eq("id", ingredient.id);
      // tira da lista de compras o item ligado a esse insumo
      await supabase.from("shopping_items").update({ done: true }).eq("ingredient_id", ingredient.id).eq("done", false);
    }
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast(type === "entrada" ? `Entrou ${totalQty.toLocaleString("pt-BR")} ${ingredient.unit}. Custo atualizado.` : "Estoque atualizado.");
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={`${title} ${ingredient.name}`}>
      <div className="space-y-3">
        <p className="text-sm text-choco-600">Em estoque agora: <b>{Number(ingredient.qty_on_hand).toLocaleString("pt-BR")} {ingredient.unit}</b> · custo atual {brl(ingredient.cost_per_unit)}/{ingredient.unit}</p>
        {type === "entrada" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Input label={`Quantos ${ingredient.pack_label}s comprou`} inputMode="decimal" value={packs} onChange={(e) => setPacks(e.target.value)} autoFocus placeholder="Ex.: 3" />
              <Input label={`Cada ${ingredient.pack_label} tem (${ingredient.unit})`} inputMode="decimal" value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder={ingredient.unit === "un" ? "Ex.: 12" : "Ex.: 1000"} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Valor total pago (R$)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Ex.: 18,90" />
              <Input label="Onde comprou" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex.: Atacadão, Super Nosso" list="fornecedores" />
            </div>
            <div className="rounded-xl bg-choco-50 p-3 text-sm">
              <div>Entra no estoque: <b>{totalQty.toLocaleString("pt-BR")} {ingredient.unit}</b></div>
              {unitCost !== null && <div>Novo custo: <b>{brl(unitCost)}</b> por {ingredient.unit} <span className="text-choco-500">(antes {brl(ingredient.cost_per_unit)})</span></div>}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={launchExpense} onChange={(e) => setLaunchExpense(e.target.checked)} /> lançar como despesa no Financeiro</label>
          </>
        ) : (
          <Input label={type === "ajuste" ? `Nova contagem (${ingredient.unit})` : `Quantidade (${ingredient.unit})`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        )}
        <Input label="Observação" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "entrada" ? "Ex.: Atacadão, promoção" : "Ex.: perda, uso em teste"} />
        <Button className="w-full" loading={busy} onClick={submit}>Confirmar</Button>
      </div>
    </Modal>
  );
}
