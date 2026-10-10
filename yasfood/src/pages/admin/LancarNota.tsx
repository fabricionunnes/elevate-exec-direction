// Lançar nota de compra pela foto: a IA lê o cupom, casa cada linha com um insumo,
// a Yasmim confere e confirma. Confirmar = entrada no estoque de cada item + uma
// despesa "Insumos" no Financeiro com o total da nota + itens da lista de compras marcados.
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Sparkles, Trash2, Receipt } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl, todayISO } from "@/lib/format";
import { shrinkAll, type ShrunkImage } from "@/lib/readOrder";
import { readReceipt, type Receipt as ReceiptData } from "@/lib/readReceipt";
import type { Ingredient } from "@/lib/types";
import { costProblem, toStockUnit } from "@/lib/costGuard";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";

const NOVO = "__novo__";
const IGNORAR = "";

interface Line {
  description: string;
  ingredientId: string;       // id do insumo, "" = não lançar, "__novo__" = criar insumo
  newName: string;
  newUnit: Ingredient["unit"];
  packs: string;
  packSize: string;
  total: string;
  relevant: boolean;
}

const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

export function LancarNota({ ingredients, onClose, onDone }: { ingredients: Ingredient[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<ShrunkImage[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(todayISO());
  const [launchExpense, setLaunchExpense] = useState(true);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const byName = useMemo(() => new Map(ingredients.map((i) => [i.name.toLowerCase(), i])), [ingredients]);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((cur) => [...cur, ...Array.from(list).filter((f) => f.type.startsWith("image/"))].slice(0, 6));
  };

  const run = async () => {
    if (!files.length) return toast("Escolha a foto da nota.", "err");
    setBusy(true);
    try {
      const imgs = await shrinkAll(files);
      setImages(imgs);
      const r = await readReceipt(imgs, hint);
      setReceipt(r);
      setSupplier(r.supplier ?? "");
      if (r.purchased_on) setDate(r.purchased_on);
      setLines(r.items.map((it) => {
        const ing = it.ingredient_name ? byName.get(it.ingredient_name.toLowerCase()) : undefined;
        const newUnit: Ingredient["unit"] = it.unit === "kg" || it.unit === "g" ? "g" : it.unit === "l" || it.unit === "ml" ? "ml" : it.unit === "un" ? "un" : "g";
        // tamanho da embalagem sempre na unidade do estoque (cupom "1 KG" com insumo em g → 1000)
        const packSize = toStockUnit(it.pack_size, it.unit, ing ? ing.unit : newUnit);
        return {
          description: it.description,
          ingredientId: ing ? ing.id : it.relevant ? NOVO : IGNORAR,
          newName: it.description, newUnit,
          packs: String(it.packs || 1),
          packSize: packSize != null ? String(packSize) : ing?.pack_size ? String(ing.pack_size) : "",
          total: it.total_price != null ? String(it.total_price) : "",
          relevant: it.relevant,
        };
      }));
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const set = (i: number, patch: Partial<Line>) => setLines((cur) => cur.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const active = lines.filter((l) => l.ingredientId !== IGNORAR);
  const totalNota = active.reduce((a, l) => a + num(l.total), 0);

  const confirm = async () => {
    const problems = active.filter((l) => num(l.packs) <= 0 || num(l.packSize) <= 0 || (l.ingredientId === NOVO && !l.newName.trim()));
    if (!active.length) return toast("Nenhum item marcado pra lançar.", "err");
    if (problems.length) return toast("Tem item sem quantidade, sem tamanho da embalagem ou sem nome.", "err");
    // custo por unidade absurdo (ex.: 1 kg lido como 1 g) não entra: estouraria o custo do bolo no Financeiro
    for (const l of active) {
      const ing = l.ingredientId === NOVO ? undefined : byId.get(l.ingredientId);
      const qty = num(l.packs) * num(l.packSize);
      const bad = costProblem(ing?.name ?? l.newName, ing?.unit ?? l.newUnit, num(l.total) > 0 && qty > 0 ? num(l.total) / qty : null, ing?.cost_per_unit);
      if (bad) return toast(bad, "err");
    }
    setBusy(true);
    try {
      // 1) despesa única com o total da nota
      let transaction_id: string | null = null;
      if (launchExpense && totalNota > 0) {
        const { data, error } = await supabase.from("transactions").insert({
          type: "despesa", category: "Insumos", amount: totalNota, occurred_on: date || todayISO(),
          description: `Nota de compra${supplier ? ` · ${supplier}` : ""} · ${active.length} item(ns)`,
        }).select("id").single();
        if (error) throw new Error(friendlyError(error));
        transaction_id = (data as { id: string }).id;
      }
      // 2) cada linha: cria insumo se precisar, dá entrada no estoque
      for (const l of active) {
        let ing = l.ingredientId === NOVO ? undefined : byId.get(l.ingredientId);
        if (l.ingredientId === NOVO) {
          const { data, error } = await supabase.from("ingredients").insert({ name: l.newName.trim(), unit: l.newUnit, qty_on_hand: 0, min_qty: 0, cost_per_unit: 0, supplier: supplier.trim(), pack_size: num(l.packSize), pack_label: "pacote", active: true }).select("*").single();
          if (error) throw new Error(friendlyError(error));
          ing = data as Ingredient;
        }
        if (!ing) continue;
        const qty = num(l.packs) * num(l.packSize);
        const total = num(l.total);
        const { error } = await supabase.from("stock_movements").insert({
          ingredient_id: ing.id, type: "entrada", qty, note: `Nota: ${l.description}`,
          unit_cost: total > 0 ? total / qty : null, total_cost: total > 0 ? total : null, transaction_id, supplier: supplier.trim(),
        });
        if (error) throw new Error(friendlyError(error));
        const upd: Record<string, unknown> = {};
        if (num(l.packSize) !== Number(ing.pack_size ?? 0)) upd.pack_size = num(l.packSize);
        if (supplier.trim() && supplier.trim() !== ing.supplier) upd.supplier = supplier.trim();
        if (Object.keys(upd).length) await supabase.from("ingredients").update(upd).eq("id", ing.id);
        await supabase.from("shopping_items").update({ done: true }).eq("ingredient_id", ing.id).eq("done", false);
      }
      toast(`${active.length} item(ns) no estoque${transaction_id ? ` e ${brl(totalNota)} lançados no Financeiro` : ""}.`);
      onDone();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!receipt) {
    return (
      <Modal open onClose={onClose} title="Lançar nota de compra">
        <div className="space-y-3">
          <p className="text-sm text-choco-600">Tira foto do cupom (ou mais de uma, se for longo). A IA lê cada linha, casa com os insumos do estoque e você confere antes de lançar. Ao confirmar, entra no estoque e vai pro Financeiro de uma vez.</p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-choco-200 bg-choco-50 p-6 text-center text-sm text-choco-600 hover:border-vinho-300" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
            <ImagePlus size={28} className="mb-2 text-vinho-500" />
            <span className="font-semibold text-choco-800">Toque pra escolher a foto da nota</span>
            <span className="text-xs">ou arraste aqui · até 6 fotos</span>
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl border border-choco-100 bg-white">
                  <img src={previews[i]} alt="" className="h-28 w-full object-cover object-top" />
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-choco-600 hover:text-red-600" aria-label="Remover"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <Input label="Observação pra ajudar (opcional)" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Ex.: comprei no Atacadão, os ovos são de 30" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button loading={busy} onClick={run}><Sparkles size={16} /> {busy ? "Lendo a nota…" : "Ler a nota"}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><Receipt size={18} /> Confira e lance a nota</span>} wide>
      <div className="space-y-3">
        {receipt.doubts.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <div className="font-bold">Confere isso aqui:</div>
            <ul className="mt-1 list-disc pl-5">{receipt.doubts.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Input label="Onde comprou" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex.: Atacadão" />
          <Input label="Data da compra" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="rounded-xl bg-choco-50 p-2 text-sm"><div className="text-[10px] uppercase text-choco-500">Total a lançar</div><b className="text-lg">{brl(totalNota)}</b>{receipt.total != null && Math.abs(receipt.total - totalNota) > 0.05 && <div className="text-[11px] text-choco-500">cupom diz {brl(receipt.total)}</div>}</div>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => {
            const ing = byId.get(l.ingredientId);
            const unit = l.ingredientId === NOVO ? l.newUnit : ing?.unit ?? "";
            const qty = num(l.packs) * num(l.packSize);
            const off = l.ingredientId === IGNORAR;
            return (
              <div key={i} className={clsx("rounded-xl border p-2", off ? "border-choco-100 bg-choco-50/60 opacity-70" : "border-choco-200 bg-white")}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-choco-500"><span className="truncate" title={l.description}>Cupom: <b className="text-choco-800">{l.description}</b></span>{!l.relevant && <span className="whitespace-nowrap rounded-full bg-choco-100 px-2 py-0.5">não parece insumo</span>}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="col-span-2">
                    <Select label="Insumo no estoque" value={l.ingredientId} onChange={(e) => set(i, { ingredientId: e.target.value })}>
                      <option value={IGNORAR}>— não lançar —</option>
                      <option value={NOVO}>+ criar insumo novo</option>
                      {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                    </Select>
                    {l.ingredientId === NOVO && (
                      <div className="mt-1 grid grid-cols-[1fr_80px] gap-1">
                        <Input value={l.newName} onChange={(e) => set(i, { newName: e.target.value })} placeholder="Nome do insumo" />
                        <Select value={l.newUnit} onChange={(e) => set(i, { newUnit: e.target.value as Ingredient["unit"] })}><option value="g">g</option><option value="ml">ml</option><option value="un">un</option></Select>
                      </div>
                    )}
                  </div>
                  <Input label="Qtd. embalagens" inputMode="decimal" value={l.packs} onChange={(e) => set(i, { packs: e.target.value })} disabled={off} />
                  <Input label={`Cada uma tem (${unit || "?"})`} inputMode="decimal" value={l.packSize} onChange={(e) => set(i, { packSize: e.target.value })} disabled={off} />
                  <Input label="Total pago (R$)" inputMode="decimal" value={l.total} onChange={(e) => set(i, { total: e.target.value })} disabled={off} />
                </div>
                {!off && qty > 0 && <div className="mt-1 text-xs text-choco-600">Entra no estoque: <b>{qty.toLocaleString("pt-BR")} {unit}</b>{num(l.total) > 0 && <> · custo <b>{brl(num(l.total) / qty)}</b>/{unit}{ing && Number(ing.cost_per_unit) > 0 && <span className="text-choco-400"> (antes {brl(ing.cost_per_unit)})</span>}</>}</div>}
              </div>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={launchExpense} onChange={(e) => setLaunchExpense(e.target.checked)} /> lançar {brl(totalNota)} como despesa "Insumos" no Financeiro</label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => { setReceipt(null); setImages([]); }}>Voltar{images.length ? "" : ""}</Button>
          <Button loading={busy} onClick={confirm}>Confirmar: estoque + financeiro</Button>
        </div>
      </div>
    </Modal>
  );
}
