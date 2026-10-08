import { useCallback, useEffect, useState } from "react";
import { Plus, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, AlertTriangle, Pencil } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl, dateTimeBR } from "@/lib/format";
import type { Ingredient, StockMovement } from "@/lib/types";
import { Button, Card, Input, Select, Modal, Spinner, Empty, useToast } from "@/components/ui";

const emptyIng: Omit<Ingredient, "id"> = { name: "", unit: "g", qty_on_hand: 0, min_qty: 0, cost_per_unit: 0, supplier: "", active: true };

export default function Estoque() {
  const toast = useToast();
  const [ings, setIngs] = useState<Ingredient[] | null>(null);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [editing, setEditing] = useState<Partial<Ingredient> | null>(null);
  const [mov, setMov] = useState<{ ingredient: Ingredient; type: StockMovement["type"] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [i, m] = await Promise.all([
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    setIngs((i.data as Ingredient[]) ?? []);
    setMoves((m.data as StockMovement[]) ?? []);
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

      <Card title="Últimas movimentações">
        {moves.length === 0 ? <Empty>Sem movimentações.</Empty> : (
          <ul className="divide-y divide-choco-100 text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-1.5">
                <span><b>{byId[m.ingredient_id]?.name ?? "?"}</b> <span className="text-choco-500">· {m.type}{m.note ? ` · ${m.note}` : ""}</span></span>
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
            <Input label="Fornecedor" value={editing.supplier ?? ""} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> ativo</label>
            <Button className="w-full" loading={busy} onClick={save}>Salvar</Button>
          </div>
        </Modal>
      )}

      {mov && <MovementModal ingredient={mov.ingredient} type={mov.type} onClose={() => setMov(null)} onDone={() => { setMov(null); void load(); }} />}
    </div>
  );
}

function MovementModal({ ingredient, type, onClose, onDone }: { ingredient: Ingredient; type: StockMovement["type"]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const title = { entrada: "Entrada de", saida: "Saída de", ajuste: "Ajustar contagem de", producao: "" }[type];

  const submit = async () => {
    const q = Number(qty.replace(",", "."));
    if (!q && type !== "ajuste") return toast("Informe a quantidade.", "err");
    const signed = type === "entrada" ? Math.abs(q) : type === "saida" ? -Math.abs(q) : q - Number(ingredient.qty_on_hand);
    setBusy(true);
    const payload: Partial<StockMovement> = { ingredient_id: ingredient.id, type, qty: signed, note };
    if (type === "entrada" && cost) {
      // custo total da compra -> custo por unidade
      payload.unit_cost = Number(cost.replace(",", ".")) / Math.abs(q);
    }
    const { error } = await supabase.from("stock_movements").insert(payload);
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Estoque atualizado.");
    onDone();
  };

  return (
    <Modal open onClose={onClose} title={`${title} ${ingredient.name}`}>
      <div className="space-y-3">
        <p className="text-sm text-choco-600">Em estoque agora: <b>{Number(ingredient.qty_on_hand).toLocaleString("pt-BR")} {ingredient.unit}</b></p>
        <Input label={type === "ajuste" ? `Nova contagem (${ingredient.unit})` : `Quantidade (${ingredient.unit})`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        {type === "entrada" && <Input label="Valor total pago (R$, opcional)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} hint="Atualiza o custo por unidade e o custo dos bolos." />}
        <Input label="Observação" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "entrada" ? "Ex.: compra no atacadão" : "Ex.: perda, uso em teste"} />
        <Button className="w-full" loading={busy} onClick={submit}>Confirmar</Button>
      </div>
    </Modal>
  );
}
