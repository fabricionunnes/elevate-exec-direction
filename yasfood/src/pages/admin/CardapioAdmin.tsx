import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, ImagePlus, Trash2 } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl } from "@/lib/format";
import type { Ingredient, Product, ProductCost, ProductIngredient } from "@/lib/types";
import { Button, Card, Input, Textarea, Modal, Spinner, Empty, Badge, useToast } from "@/components/ui";

const empty: Omit<Product, "id"> = { name: "", description: "", price: 35, weight_g: 570, image_url: null, category: "Bolos", active: true, sort_order: 0 };

export default function CardapioAdmin() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [costs, setCosts] = useState<Record<string, ProductCost>>({});
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").order("sort_order").order("name"),
      supabase.from("product_costs").select("*"),
    ]);
    setProducts((p.data as Product[]) ?? []);
    setCosts(Object.fromEntries(((c.data as ProductCost[]) ?? []).map((x) => [x.product_id, x])));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing?.name) return toast("Dê um nome ao produto.", "err");
    setBusy(true);
    const { id, ...rest } = editing;
    const payload = { ...empty, ...rest, price: Number(rest.price ?? 0), weight_g: rest.weight_g ? Number(rest.weight_g) : null };
    const q = id ? supabase.from("products").update(payload).eq("id", id) : supabase.from("products").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Salvo.");
    setEditing(null);
    void load();
  };

  const upload = async (file: File) => {
    if (!editing) return;
    setBusy(true);
    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage.from("produtos").upload(path, file, { upsert: true });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    const { data } = supabase.storage.from("produtos").getPublicUrl(path);
    setEditing({ ...editing, image_url: data.publicUrl });
  };

  const remove = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"? Pedidos antigos mantêm o nome.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-choco-900">Cardápio</h1>
        <Button onClick={() => setEditing({ ...empty })}><Plus size={16} /> Novo produto</Button>
      </div>
      {products === null ? <Spinner /> : products.length === 0 ? <Empty>Nenhum produto. Cadastre o primeiro bolo.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {products.map((p) => {
            const c = costs[p.id];
            return (
              <Card key={p.id} className={!p.active ? "opacity-60" : ""}>
                <div className="flex gap-3">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-rosa-100 text-3xl">🎂</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate font-bold">{p.name}</span>{!p.active && <Badge className="bg-neutral-100 text-neutral-600 ring-neutral-300">inativo</Badge>}</div>
                    <div className="text-sm text-choco-600">{brl(p.price)}{p.weight_g ? ` · ${p.weight_g}g` : ""} · {p.category}</div>
                    {c && <div className="text-xs text-choco-500">custo {brl(c.cost)} · margem {brl(c.margin)} ({c.margin_pct}%)</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil size={14} /> Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => setRecipeFor(p)}>Receita / custo</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 size={14} /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Editar produto" : "Novo produto"}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {editing.image_url ? <img src={editing.image_url} alt="" className="h-24 w-24 rounded-xl object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-rosa-100 text-4xl">🎂</div>}
              <label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-xl border border-choco-200 bg-white px-3 py-2 text-sm font-semibold"><ImagePlus size={16} /> {busy ? "Enviando…" : "Foto"}</span><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
            </div>
            <Input label="Nome" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Textarea label="Descrição" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Preço (R$)" type="number" step="0.01" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              <Input label="Peso (g)" type="number" value={editing.weight_g ?? ""} onChange={(e) => setEditing({ ...editing, weight_g: e.target.value ? Number(e.target.value) : null })} />
              <Input label="Ordem" type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
            <Input label="Categoria" value={editing.category ?? "Bolos"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> ativo no cardápio</label>
            <Button className="w-full" loading={busy} onClick={save}>Salvar</Button>
          </div>
        </Modal>
      )}

      {recipeFor && <RecipeModal product={recipeFor} onClose={() => { setRecipeFor(null); void load(); }} />}
    </div>
  );
}

function RecipeModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const toast = useToast();
  const [ings, setIngs] = useState<Ingredient[]>([]);
  const [recipe, setRecipe] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const [i, r] = await Promise.all([
        supabase.from("ingredients").select("*").eq("active", true).order("name"),
        supabase.from("product_ingredients").select("*").eq("product_id", product.id),
      ]);
      setIngs((i.data as Ingredient[]) ?? []);
      setRecipe(Object.fromEntries(((r.data as ProductIngredient[]) ?? []).map((x) => [x.ingredient_id, Number(x.qty)])));
    })();
  }, [product.id]);

  const cost = ings.reduce((a, i) => a + (recipe[i.id] ?? 0) * Number(i.cost_per_unit), 0);

  const save = async () => {
    await supabase.from("product_ingredients").delete().eq("product_id", product.id);
    const rows = Object.entries(recipe).filter(([, q]) => q > 0).map(([ingredient_id, qty]) => ({ product_id: product.id, ingredient_id, qty }));
    const { error } = rows.length ? await supabase.from("product_ingredients").insert(rows) : { error: null };
    if (error) return toast(friendlyError(error), "err");
    toast("Receita salva.");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Receita: ${product.name}`}>
      <p className="mb-3 text-sm text-choco-600">Quantidade de cada insumo por 1 unidade. Ao entrar em produção, o estoque é baixado automaticamente.</p>
      {ings.length === 0 ? <Empty>Cadastre insumos na aba Estoque primeiro.</Empty> : (
        <div className="space-y-2">
          {ings.map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{i.name} <span className="text-choco-400">({i.unit})</span></span>
              <input type="number" min={0} step="any" className="h-9 w-24 rounded-lg border border-choco-200 px-2 text-right" value={recipe[i.id] ?? ""} placeholder="0" onChange={(e) => setRecipe({ ...recipe, [i.id]: Number(e.target.value) })} />
              <span className="w-16 text-right text-xs text-choco-500">{brl((recipe[i.id] ?? 0) * Number(i.cost_per_unit))}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-choco-50 p-3 text-sm">
        <span>Custo por unidade: <b>{brl(cost)}</b></span>
        <span>Margem: <b className={Number(product.price) - cost >= 0 ? "text-emerald-700" : "text-red-700"}>{brl(Number(product.price) - cost)}</b> ({Number(product.price) ? Math.round(((Number(product.price) - cost) / Number(product.price)) * 100) : 0}%)</span>
      </div>
      <Button className="mt-3 w-full" onClick={save}>Salvar receita</Button>
    </Modal>
  );
}
