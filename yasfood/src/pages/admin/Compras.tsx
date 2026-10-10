import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, MessageCircle, Copy, ShoppingCart, RotateCcw, Receipt } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { IngredientNeed, ShoppingItem, Ingredient } from "@/lib/types";
import { MovementModal } from "@/pages/admin/Estoque";
import { LancarNota } from "@/pages/admin/LancarNota";
import { Button, Card, Input, Spinner, Empty, useToast } from "@/components/ui";

const fmtQty = (n: number, unit: string) => `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit}`;

export default function Compras() {
  const toast = useToast();
  const { settings } = useSettings(true);
  const [needs, setNeeds] = useState<IngredientNeed[] | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState("");
  const [qtyText, setQtyText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [buying, setBuying] = useState<Ingredient | null>(null);
  const [nota, setNota] = useState(false);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);

  const toIngredient = (n: IngredientNeed): Ingredient => ({
    id: n.ingredient_id, name: n.name, unit: n.unit, qty_on_hand: Number(n.qty_on_hand), min_qty: Number(n.min_qty),
    cost_per_unit: Number(n.cost_per_unit), supplier: n.supplier, active: true, pack_size: n.pack_size, pack_label: n.pack_label,
  });

  const load = useCallback(async () => {
    const [n, i, g] = await Promise.all([
      supabase.from("ingredient_needs").select("*").order("name"),
      supabase.from("shopping_items").select("*").order("done").order("created_at"),
      supabase.from("ingredients").select("*").eq("active", true).order("name"),
    ]);
    setNeeds((n.data as IngredientNeed[]) ?? []);
    setItems((i.data as ShoppingItem[]) ?? []);
    setAllIngredients((g.data as Ingredient[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // automáticos: falta pra pedidos ou abaixo do mínimo, e sem item manual pendente pro mesmo insumo
  const auto = useMemo(() => (needs ?? []).filter((n) => Number(n.shortage) > 0 || Number(n.qty_on_hand) <= Number(n.min_qty)), [needs]);
  const pendingManual = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);

  const suggestion = (n: IngredientNeed) => {
    const short = Math.max(Number(n.shortage), Number(n.pack_size ?? 0), 1);
    if (n.packs_to_buy && n.pack_size) return `${Math.max(n.packs_to_buy, 1)} ${n.pack_label}(s) de ${fmtQty(Number(n.pack_size), n.unit)}`;
    return fmtQty(short, n.unit);
  };

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("shopping_items").insert({ name: name.trim(), qty_text: qtyText.trim() });
    if (error) return toast(friendlyError(error), "err");
    setName(""); setQtyText("");
    void load();
  };
  const toggle = async (it: ShoppingItem) => { await supabase.from("shopping_items").update({ done: !it.done }).eq("id", it.id); void load(); };
  const remove = async (it: ShoppingItem) => { await supabase.from("shopping_items").delete().eq("id", it.id); void load(); };
  const clearDone = async () => { await supabase.from("shopping_items").delete().eq("done", true); void load(); };

  const listText = useMemo(() => {
    const lines = ["*Lista de compras · Yas Delícias*", ""];
    if (auto.length) {
      lines.push("*Repor (estoque):*");
      for (const n of auto) lines.push(`• ${n.name}: ${suggestion(n)}${n.supplier ? ` (${n.supplier})` : ""}`);
      lines.push("");
    }
    if (pendingManual.length) {
      lines.push("*Outros:*");
      for (const i of pendingManual) lines.push(`• ${i.name}${i.qty_text ? `: ${i.qty_text}` : ""}${i.note ? ` (${i.note})` : ""}`);
    }
    return lines.join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, pendingManual]);

  const copy = async () => { try { await navigator.clipboard.writeText(listText); toast("Lista copiada."); } catch { toast("Não consegui copiar.", "err"); } };
  const estTotal = auto.reduce((a, n) => a + Math.max(Number(n.shortage), Number(n.pack_size ?? 0)) * Number(n.cost_per_unit), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Lista de compras</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setNota(true)}><Receipt size={16} /> Lançar nota (foto)</Button>
          <Button variant="outline" onClick={copy}><Copy size={16} /> Copiar</Button>
          <a href={waLink(settings?.whatsapp ?? "", listText)} target="_blank" rel="noreferrer"><Button variant="wa"><MessageCircle size={16} /> Mandar pro WhatsApp</Button></a>
        </div>
      </div>
      <p className="text-sm text-choco-600">A parte automática olha o estoque mínimo e o que os pedidos dos próximos 14 dias vão consumir. Quando você lança a compra no Estoque, o item sai da lista sozinho.</p>

      <Card title={<span className="flex items-center gap-2"><ShoppingCart size={18} /> Repor automaticamente {auto.length > 0 && <span className="text-xs font-medium text-choco-500">estimativa {brl(estTotal)}</span>}</span>}>
        {needs === null ? <Spinner /> : auto.length === 0 ? <Empty>Estoque em dia pros próximos pedidos.</Empty> : (
          <ul className="divide-y divide-choco-100">
            {auto.map((n) => (
              <li key={n.ingredient_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="font-bold">{n.name} <span className="font-normal text-choco-500">· comprar {suggestion(n)}</span></div>
                  <div className="text-xs text-choco-500">
                    em estoque {fmtQty(Number(n.qty_on_hand), n.unit)} · mínimo {fmtQty(Number(n.min_qty), n.unit)}
                    {Number(n.needed_14d) > 0 && ` · pedidos precisam de ${fmtQty(Number(n.needed_14d), n.unit)}`}
                    {n.supplier && ` · ${n.supplier}`}
                  </div>
                </div>
                <Button size="sm" onClick={() => setBuying(toIngredient(n))}>Lançar compra</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Itens manuais" action={doneItems.length > 0 && <button onClick={() => setShowDone((s) => !s)} className="text-xs text-choco-500 hover:text-choco-800">{showDone ? "esconder" : "mostrar"} comprados ({doneItems.length})</button>}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1"><Input label="Item" placeholder="Ex.: forminhas, sacola, cenoura" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></div>
          <div className="w-36"><Input label="Quantidade" placeholder="Ex.: 2 pacotes" value={qtyText} onChange={(e) => setQtyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></div>
          <Button onClick={add}><Plus size={16} /> Adicionar</Button>
        </div>
        {pendingManual.length === 0 && !showDone ? <Empty>Nada manual na lista.</Empty> : (
          <ul className="divide-y divide-choco-100">
            {[...pendingManual, ...(showDone ? doneItems : [])].map((it) => (
              <li key={it.id} className={clsx("flex items-center gap-3 py-2 text-sm", it.done && "opacity-50")}>
                <input type="checkbox" checked={it.done} onChange={() => toggle(it)} className="h-4 w-4" />
                <span className={clsx("flex-1", it.done && "line-through")}>{it.name}{it.qty_text && <span className="text-choco-500"> · {it.qty_text}</span>}</span>
                <button onClick={() => remove(it)} className="p-1 text-choco-300 hover:text-red-600"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        {doneItems.length > 0 && showDone && <Button size="sm" variant="ghost" className="mt-2" onClick={clearDone}><RotateCcw size={14} /> limpar comprados</Button>}
      </Card>

      {buying && <MovementModal ingredient={buying} type="entrada" onClose={() => setBuying(null)} onDone={() => { setBuying(null); void load(); }} />}
      {nota && <LancarNota ingredients={allIngredients} onClose={() => setNota(false)} onDone={() => { setNota(false); void load(); }} />}
    </div>
  );
}
