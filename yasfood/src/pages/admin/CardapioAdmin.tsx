import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, ImagePlus, Trash2, Film, Star } from "lucide-react";
import { uploadMedia, captureVideoPoster, uploadBlob } from "@/lib/media";
import { supabase, friendlyError } from "@/lib/supabase";
import { brl } from "@/lib/format";
import type { Ingredient, Product, ProductCost, ProductIngredient, ProductMedia } from "@/lib/types";
import { Button, Card, Input, Textarea, Select, Modal, Spinner, Empty, Badge, useToast } from "@/components/ui";

const empty: Omit<Product, "id"> = { name: "", description: "", price: 35, weight_g: 570, image_url: null, category: "Bolos", active: true, sort_order: 0 };

export default function CardapioAdmin() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [costs, setCosts] = useState<Record<string, ProductCost>>({});
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [recipeFor, setRecipeFor] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverDims, setCoverDims] = useState<{ w: number; h: number } | null>(null);
  const IDEAL = { w: 1200, h: 900 };

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
                    {c && Number(c.cost) > 0
                      ? <div className="text-xs text-choco-500">custo {brl(c.cost)} · margem {brl(c.margin)} ({c.margin_pct}%)</div>
                      : <div className="text-xs font-semibold text-amber-700">sem receita: custo zerado no Financeiro</div>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil size={14} /> Editar</Button>
                  <Button size="sm" variant={c && Number(c.cost) > 0 ? "outline" : "primary"} onClick={() => setRecipeFor(p)}>{c && Number(c.cost) > 0 ? "Receita / custo" : "Montar receita"}</Button>
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
              {editing.image_url ? <img src={editing.image_url} alt="" className="h-24 w-32 rounded-xl object-cover" onLoad={(e) => setCoverDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} /> : <div className="flex h-24 w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-rosa-300 bg-rosa-100 text-[11px] text-choco-600"><span className="text-2xl">🎂</span>{IDEAL.w} × {IDEAL.h} px</div>}
              <div className="space-y-1">
                <label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-xl border border-choco-200 bg-white px-3 py-2 text-sm font-semibold"><ImagePlus size={16} /> {busy ? "Enviando…" : "Capa (1 foto)"}</span><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
                <p className="text-xs text-choco-500">Tamanho ideal: <b>{IDEAL.w} × {IDEAL.h} px</b> (proporção 4:3, horizontal).</p>
                {coverDims && editing.image_url && (
                  <p className={`text-xs ${Math.abs(coverDims.w / coverDims.h - 4 / 3) < 0.08 ? "text-emerald-700" : "text-amber-700"}`}>
                    Capa atual: {coverDims.w} × {coverDims.h} px{Math.abs(coverDims.w / coverDims.h - 4 / 3) < 0.08 ? " · proporção certa" : " · proporção diferente de 4:3, vai cortar nas bordas"}
                  </p>
                )}
              </div>
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
            {editing.id ? (
              <MediaManager productId={editing.id} cover={editing.image_url ?? null} onCover={(url) => setEditing({ ...editing, image_url: url })} />
            ) : (
              <p className="text-xs text-choco-500">Salve o produto pra adicionar mais fotos e vídeos.</p>
            )}
          </div>
        </Modal>
      )}

      {recipeFor && <RecipeModal product={recipeFor} onClose={() => { setRecipeFor(null); void load(); }} />}
    </div>
  );
}

export function RecipeModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const toast = useToast();
  const [ings, setIngs] = useState<Ingredient[]>([]);
  const [recipe, setRecipe] = useState<Record<string, number>>({});
  const [others, setOthers] = useState<(Product & { itens: number; custo: number })[]>([]);
  const [copyId, setCopyId] = useState("");

  useEffect(() => {
    void (async () => {
      const [i, r, p, c, all] = await Promise.all([
        supabase.from("ingredients").select("*").eq("active", true).order("name"),
        supabase.from("product_ingredients").select("*").eq("product_id", product.id),
        supabase.from("products").select("*").neq("id", product.id).order("sort_order"),
        supabase.from("product_costs").select("product_id, cost"),
        supabase.from("product_ingredients").select("product_id"),
      ]);
      setIngs((i.data as Ingredient[]) ?? []);
      setRecipe(Object.fromEntries(((r.data as ProductIngredient[]) ?? []).map((x) => [x.ingredient_id, Number(x.qty)])));
      const custo = new Map(((c.data as { product_id: string; cost: number }[]) ?? []).map((x) => [x.product_id, Number(x.cost)]));
      const itens = new Map<string, number>();
      for (const x of ((all.data as { product_id: string }[]) ?? [])) itens.set(x.product_id, (itens.get(x.product_id) ?? 0) + 1);
      // só quem tem receita serve de modelo
      setOthers((((p.data as Product[]) ?? []).map((o) => ({ ...o, itens: itens.get(o.id) ?? 0, custo: custo.get(o.id) ?? 0 }))).filter((o) => o.itens > 0));
    })();
  }, [product.id]);

  /** Copia a receita de outro produto: substitui tudo ou só acrescenta o que falta. Depois é editar e salvar. */
  const copyFrom = async (mode: "substituir" | "juntar") => {
    if (!copyId) return toast("Escolha de qual produto copiar.", "err");
    const { data } = await supabase.from("product_ingredients").select("*").eq("product_id", copyId);
    const src = Object.fromEntries(((data as ProductIngredient[]) ?? []).map((x) => [x.ingredient_id, Number(x.qty)]));
    const hasCurrent = Object.keys(recipe).length > 0;
    if (mode === "substituir" && hasCurrent && !window.confirm("Substituir a receita atual pela copiada? Nada é salvo até você tocar em Salvar receita.")) return;
    setRecipe(mode === "substituir" ? src : { ...src, ...recipe });
    const nome = others.find((o) => o.id === copyId)?.name ?? "o outro produto";
    toast(`Receita de ${nome} ${mode === "substituir" ? "copiada" : "juntada"}. Ajuste quantidades, tire ou acrescente insumos e salve.`);
  };

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
      <p className="mb-2 text-sm text-choco-600">Quantidade de cada insumo por 1 unidade. Ao entrar em produção, o estoque é baixado automaticamente. Deixe em branco (ou 0) o que esse produto não usa: o bolo sem cobertura não leva chocolate, leite condensado nem manteiga.</p>
      {others.length > 0 && (
        <div className="mb-3 rounded-xl border border-rosa-200 bg-rosa-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-vinho-700">Copiar de outro bolo</div>
          <p className="mb-2 text-xs text-choco-600">Parte de uma receita pronta e muda só o que é diferente. Nada é gravado até salvar.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Select value={copyId} onChange={(e) => setCopyId(e.target.value)}>
                <option value="">— escolher o bolo modelo —</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.itens} insumo(s) · custo {brl(o.custo)}</option>)}
              </Select>
            </div>
            <Button size="sm" disabled={!copyId} onClick={() => void copyFrom("substituir")}>Copiar tudo</Button>
            <Button size="sm" variant="outline" disabled={!copyId} onClick={() => void copyFrom("juntar")} title="Mantém o que já está aqui e só acrescenta o que falta">Só acrescentar</Button>
          </div>
        </div>
      )}
      {ings.length === 0 ? <Empty>Cadastre insumos na aba Estoque primeiro.</Empty> : (
        <div className="space-y-2">
          {ings.filter((i) => i.id in recipe).length === 0 && <p className="text-sm text-choco-500">Nenhum insumo na receita ainda. Adicione abaixo.</p>}
          {ings.filter((i) => i.id in recipe).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{i.name} <span className="text-choco-400">({i.unit})</span></span>
              <input type="number" min={0} step="any" className="h-9 w-24 rounded-lg border border-choco-200 px-2 text-right" value={recipe[i.id] ?? ""} placeholder="0" onChange={(e) => setRecipe({ ...recipe, [i.id]: Number(e.target.value) })} />
              <span className="w-16 text-right text-xs text-choco-500">{brl((recipe[i.id] ?? 0) * Number(i.cost_per_unit))}</span>
              <button type="button" className="p-1 text-choco-300 hover:text-red-600" title="Tirar da receita" onClick={() => { const r = { ...recipe }; delete r[i.id]; setRecipe(r); }}><Trash2 size={16} /></button>
            </div>
          ))}
          {ings.some((i) => !(i.id in recipe)) && (
            <Select label="Adicionar insumo" value="" onChange={(e) => { if (e.target.value) setRecipe({ ...recipe, [e.target.value]: 0 }); }}>
              <option value="">— escolher —</option>
              {ings.filter((i) => !(i.id in recipe)).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </Select>
          )}
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

/** Galeria do produto: várias fotos e vídeos, com capa. */
function MediaManager({ productId, cover, onCover }: { productId: string; cover: string | null; onCover: (url: string) => void }) {
  const toast = useToast();
  const [items, setItems] = useState<ProductMedia[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order");
    setItems((data as ProductMedia[]) ?? []);
  }, [productId]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let n = 0;
    for (const f of Array.from(files)) {
      try {
        const { url, kind } = await uploadMedia(f, `produtos/${productId}`);
        let poster_url: string | null = null;
        if (kind === "video") {
          const poster = await captureVideoPoster(f);
          if (poster) poster_url = await uploadBlob(poster, `produtos/${productId}/posters`);
        }
        await supabase.from("product_media").insert({ product_id: productId, kind, url, poster_url, sort_order: items.length + n });
        if (!cover && kind === "image" && n === 0) {
          await supabase.from("products").update({ image_url: url }).eq("id", productId);
          onCover(url);
        }
        n++;
      } catch (e) {
        toast(friendlyError(e), "err");
      }
    }
    setBusy(false);
    if (n) toast(`${n} arquivo(s) adicionado(s).`);
    void load();
  };

  const remove = async (m: ProductMedia) => {
    await supabase.from("product_media").delete().eq("id", m.id);
    void load();
  };

  const setCover = async (m: ProductMedia) => {
    await supabase.from("products").update({ image_url: m.url }).eq("id", productId);
    onCover(m.url);
    toast("Capa atualizada.");
  };

  const move = async (m: ProductMedia, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === m.id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[i], b = items[j];
    await Promise.all([
      supabase.from("product_media").update({ sort_order: j }).eq("id", a.id),
      supabase.from("product_media").update({ sort_order: i }).eq("id", b.id),
    ]);
    void load();
  };

  return (
    <div className="rounded-2xl border border-choco-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold">Galeria: várias fotos e vídeos</h4>
        <label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-xl bg-vinho-600 px-3 py-1.5 text-xs font-semibold text-white"><Film size={14} /> {busy ? "Enviando…" : "Adicionar fotos / vídeos"}</span><input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} /></label>
      </div>
      {items.length === 0 ? <p className="text-xs text-choco-500">Clique em "Adicionar" e selecione várias fotos e vídeos de uma vez (até 50 MB cada, vídeo em MP4). Elas aparecem em carrossel no cardápio. Tamanho ideal das fotos: <b>1200 × 900 px</b> (4:3); vídeos na horizontal, 4:3 ou 16:9.</p> : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-xl bg-choco-50">
              {m.kind === "video" ? <video src={`${m.url}#t=0.1`} poster={m.poster_url ?? undefined} className="aspect-square w-full object-cover" muted playsInline preload="metadata" /> : <img src={m.url} alt="" className="aspect-square w-full object-cover" />}
              {cover === m.url && <span className="absolute left-1 top-1 rounded-full bg-vinho-600 px-1.5 py-0.5 text-[10px] font-bold text-white">capa</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-choco-900/60 p-1 text-white">
                <button onClick={() => move(m, -1)} className="px-1 text-xs" title="Mover pra esquerda">◀</button>
                {m.kind === "image" && <button onClick={() => setCover(m)} className="px-1" title="Usar como capa"><Star size={14} /></button>}
                <button onClick={() => remove(m)} className="px-1" title="Remover"><Trash2 size={14} /></button>
                <button onClick={() => move(m, 1)} className="px-1 text-xs" title="Mover pra direita">▶</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
