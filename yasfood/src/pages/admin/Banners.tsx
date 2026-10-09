import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ImagePlus, Pencil } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { uploadMedia } from "@/lib/media";
import type { Banner, Product } from "@/lib/types";
import { Button, Card, Input, Select, Modal, Spinner, Empty, Badge, useToast } from "@/components/ui";

const empty: Partial<Banner> = { title: "", subtitle: "", image_url: "", media_kind: "image", product_id: null, link_url: "", active: true, sort_order: 0, starts_at: null, ends_at: null };
const IDEAL = { w: 1600, h: 700 };

export default function Banners() {
  const toast = useToast();
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Banner> | null>(null);
  const [busy, setBusy] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const load = useCallback(async () => {
    const [b, p] = await Promise.all([
      supabase.from("banners").select("*").order("sort_order").order("created_at"),
      supabase.from("products").select("*").order("sort_order"),
    ]);
    setBanners((b.data as Banner[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    if (!editing) return;
    setBusy(true);
    try {
      const { url, kind } = await uploadMedia(file, "banners");
      setEditing({ ...editing, image_url: url, media_kind: kind });
      setDims(null);
    } catch (e) {
      toast(friendlyError(e), "err");
    }
    setBusy(false);
  };

  const save = async () => {
    if (!editing?.image_url) return toast("Envie a imagem do banner.", "err");
    setBusy(true);
    const { id, ...rest } = editing;
    const payload = { ...empty, ...rest, product_id: rest.product_id || null, link_url: rest.link_url?.trim() || null, starts_at: rest.starts_at || null, ends_at: rest.ends_at || null };
    const { error } = id ? await supabase.from("banners").update(payload).eq("id", id) : await supabase.from("banners").insert(payload);
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Banner salvo.");
    setEditing(null);
    void load();
  };

  const remove = async (b: Banner) => {
    if (!confirm("Remover este banner?")) return;
    await supabase.from("banners").delete().eq("id", b.id);
    void load();
  };

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-choco-900">Banners</h1>
        <Button onClick={() => setEditing({ ...empty, sort_order: (banners?.length ?? 0) + 1 })}><Plus size={16} /> Novo banner</Button>
      </div>
      <p className="text-sm text-choco-600">Aparecem no topo do cardápio, em carrossel. Ao tocar, o cliente vai direto pro produto escolhido. Pode ser foto ou vídeo curto (toca mudo, em loop). Tamanho ideal: <b>{IDEAL.w} × {IDEAL.h} px</b> (proporção 16:7).</p>

      {banners === null ? <Spinner /> : banners.length === 0 ? <Empty>Nenhum banner. Crie o primeiro pra destacar um bolo.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {banners.map((b) => (
            <Card key={b.id} className={!b.active ? "opacity-60" : ""}>
              {b.media_kind === "video" ? <video src={b.image_url} className="aspect-[16/7] w-full rounded-xl object-cover" muted playsInline preload="metadata" /> : <img src={b.image_url} alt={b.title} className="aspect-[16/7] w-full rounded-xl object-cover" />}
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">{b.title || "(sem título)"}</div>
                  <div className="text-xs text-choco-500">{b.product_id ? `→ ${productName(b.product_id) ?? "produto"}` : b.link_url ? `→ ${b.link_url}` : "sem link"}{b.starts_at || b.ends_at ? ` · ${b.starts_at ?? "…"} a ${b.ends_at ?? "…"}` : ""}</div>
                </div>
                {!b.active && <Badge className="bg-neutral-100 text-neutral-600 ring-neutral-300">inativo</Badge>}
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(b)}><Pencil size={14} /> Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Editar banner" : "Novo banner"}>
          <div className="space-y-3">
            {editing.image_url ? (
              editing.media_kind === "video"
                ? <video src={editing.image_url} className="aspect-[16/7] w-full rounded-xl object-cover" muted playsInline autoPlay loop />
                : <img src={editing.image_url} alt="" className="aspect-[16/7] w-full rounded-xl object-cover" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            ) : (
              <div className="flex aspect-[16/7] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-rosa-300 bg-rosa-100 text-sm text-choco-600">
                <span className="font-bold">Foto ou vídeo do banner</span>
                <span className="text-xs">tamanho ideal {IDEAL.w} × {IDEAL.h} px · proporção 16:7</span>
              </div>
            )}
            {dims && editing.media_kind !== "video" && (
              <p className={`text-xs ${Math.abs(dims.w / dims.h - IDEAL.w / IDEAL.h) < 0.08 ? "text-emerald-700" : "text-amber-700"}`}>
                Enviado: {dims.w} × {dims.h} px{Math.abs(dims.w / dims.h - IDEAL.w / IDEAL.h) < 0.08 ? " · proporção certa" : ` · proporção diferente de 16:7, vai cortar nas bordas (ideal ${IDEAL.w} × ${IDEAL.h})`}
              </p>
            )}
            <label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-xl border border-choco-200 bg-white px-3 py-2 text-sm font-semibold"><ImagePlus size={16} /> {busy ? "Enviando…" : "Enviar foto ou vídeo"}</span><input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
            <Input label="Título (opcional)" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ex.: Bolo de cenoura fresquinho" />
            <Input label="Subtítulo (opcional)" value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} placeholder="Ex.: Encomende pra sexta" />
            <Select label="Leva pro produto" value={editing.product_id ?? ""} onChange={(e) => setEditing({ ...editing, product_id: e.target.value || null })}>
              <option value="">— nenhum —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input label="Ou link externo (opcional)" value={editing.link_url ?? ""} onChange={(e) => setEditing({ ...editing, link_url: e.target.value })} placeholder="https://instagram.com/..." hint="Se tiver produto escolhido, o produto vale." />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Ordem" type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              <Input label="Começa em" type="date" value={editing.starts_at ?? ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} />
              <Input label="Termina em" type="date" value={editing.ends_at ?? ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> ativo</label>
            <Button className="w-full" loading={busy} onClick={save}>Salvar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
