// Cadastro dos adicionais do pedido (vela, cartão, embalagem presente, cobertura extra…).
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl } from "@/lib/format";
import type { Addon, Product } from "@/lib/types";
import { Button, Card, Input, Textarea, Modal, Badge, useToast } from "@/components/ui";

const vazio: Omit<Addon, "id"> = { name: "", description: "", price: 0, max_qty: 5, product_ids: [], active: true, sort_order: 0 };

export function AdicionaisAdmin({ products }: { products: Product[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<Addon[]>([]);
  const [editing, setEditing] = useState<Partial<Addon> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("addons").select("*").order("sort_order").order("name");
    setRows((data as Addon[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing?.name?.trim()) return toast("Dê um nome ao adicional.", "err");
    if (Number(editing.price ?? 0) < 0) return toast("Preço não pode ser negativo.", "err");
    setBusy(true);
    const { id, ...rest } = editing;
    const payload = { ...vazio, ...rest, name: rest.name!.trim(), price: Number(rest.price ?? 0), max_qty: Math.max(1, Number(rest.max_qty ?? 5)) };
    const { error } = id ? await supabase.from("addons").update(payload).eq("id", id) : await supabase.from("addons").insert(payload);
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Adicional salvo.");
    setEditing(null);
    void load();
  };

  const toggle = async (a: Addon) => { await supabase.from("addons").update({ active: !a.active }).eq("id", a.id); void load(); };
  const remove = async (a: Addon) => {
    if (!window.confirm(`Apagar "${a.name}"? Pedidos antigos continuam mostrando o adicional.`)) return;
    const { error } = await supabase.from("addons").delete().eq("id", a.id);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const nomes = (ids: string[]) => ids.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean).join(", ");

  return (
    <Card title={<span className="flex items-center gap-2"><Sparkles size={18} /> Adicionais do pedido</span>} action={<Button size="sm" onClick={() => setEditing({ ...vazio, sort_order: rows.length + 1 })}><Plus size={14} /> Novo adicional</Button>}>
      <p className="mb-3 text-sm text-choco-600">Aparecem no fechamento do pedido, com preço que soma no total. Não contam na vaga do dia nem baixam estoque. Ex.: vela, cartão com recado, embalagem de presente, cobertura extra.</p>
      {rows.length === 0 ? <p className="text-sm text-choco-500">Nenhum adicional ainda.</p> : (
        <ul className="divide-y divide-choco-100">
          {rows.map((a) => (
            <li key={a.id} className={clsx("flex flex-wrap items-center gap-2 py-2 text-sm", !a.active && "opacity-50")}>
              <span className="font-bold">{a.name}</span>
              <span className="text-choco-700">{Number(a.price) > 0 ? `+ ${brl(a.price)}` : "sem custo"}</span>
              <span className="text-xs text-choco-500">até {a.max_qty} por pedido · {a.product_ids?.length ? `só com: ${nomes(a.product_ids)}` : "qualquer pedido"}</span>
              {!a.active && <Badge className="bg-neutral-100 text-neutral-600 ring-neutral-300">desligado</Badge>}
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(a)}><Pencil size={14} /> Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => void toggle(a)}>{a.active ? "Desligar" : "Ligar"}</Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(a)}><Trash2 size={14} /></Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Editar adicional" : "Novo adicional"}>
          <div className="space-y-3">
            <Input label="Nome" placeholder="Ex.: Vela de aniversário" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Textarea label="Descrição (opcional)" rows={2} placeholder="Ex.: vela dourada com número" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Preço (R$)" type="number" step="0.01" min={0} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              <Input label="Máx. por pedido" type="number" min={1} value={editing.max_qty ?? 5} onChange={(e) => setEditing({ ...editing, max_qty: Number(e.target.value) })} />
              <Input label="Ordem" type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold text-choco-800">Aparece com quais produtos?</div>
              <p className="mb-2 text-xs text-choco-500">Nenhum marcado = aparece em qualquer pedido.</p>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const on = (editing.product_ids ?? []).includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => setEditing({ ...editing, product_ids: on ? (editing.product_ids ?? []).filter((x) => x !== p.id) : [...(editing.product_ids ?? []), p.id] })} className={clsx("rounded-full px-3 py-1 text-xs font-semibold ring-1", on ? "bg-vinho-600 text-white ring-vinho-600" : "bg-white text-choco-700 ring-choco-200")}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> ligado no site</label>
            <Button className="w-full" loading={busy} onClick={save}>Salvar adicional</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}
