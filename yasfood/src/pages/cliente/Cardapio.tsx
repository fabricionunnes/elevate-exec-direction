import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, CalendarDays, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { useSettings } from "@/lib/useSettings";
import { brl, dayLabel, todayISO, addDaysISO, dateTimeBR } from "@/lib/format";
import type { Availability, Product, PublicReview } from "@/lib/types";
import { Button, Spinner, Empty, Stars } from "@/components/ui";

export default function Cardapio() {
  const { settings } = useSettings();
  const cart = useCart();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [avail, setAvail] = useState<Availability[]>([]);
  const [reviews, setReviews] = useState<PublicReview[]>([]);

  useEffect(() => {
    void (async () => {
      const [p, a, r] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("sort_order").order("name"),
        supabase.rpc("availability", { p_from: todayISO(), p_to: addDaysISO(14) }),
        supabase.from("public_reviews").select("*").order("created_at", { ascending: false }).limit(12),
      ]);
      setProducts((p.data as Product[]) ?? []);
      setAvail(((a.data as Availability[]) ?? []).filter((d) => d.bookable).slice(0, 7));
      setReviews((r.data as PublicReview[]) ?? []);
    })();
  }, []);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-6">
      {settings && !settings.is_open && (
        <div className="rounded-2xl bg-vinho-100 p-4 text-sm font-medium text-vinho-800">{settings.closed_message}</div>
      )}

      <section className="rounded-3xl bg-gradient-to-br from-vinho-600 to-vinho-800 p-5 text-white shadow-soft">
        <h1 className="text-2xl font-black leading-tight">Bolo caseiro de verdade, entregue no seu apê.</h1>
        <p className="mt-1 text-sm text-rosa-100">Assado no dia da entrega. Escolha o bolo, a data e pronto.</p>
        {reviews.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
            <Star size={14} fill="#f0801f" stroke="#f0801f" /> {avg.toFixed(1)} · {reviews.length} avaliaç{reviews.length === 1 ? "ão" : "ões"}
          </div>
        )}
      </section>

      {avail.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-choco-600"><CalendarDays size={16} /> Próximas datas com vaga</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {avail.map((d) => (
              <div key={d.day} className="min-w-[110px] rounded-2xl border border-choco-100 bg-white px-3 py-2 text-center shadow-card">
                <div className="text-sm font-bold capitalize text-choco-900">{dayLabel(d.day)}</div>
                <div className="text-xs text-emerald-700">{d.remaining} {d.remaining === 1 ? "vaga" : "vagas"}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-choco-600">Cardápio</h2>
        {products === null ? <Spinner /> : products.length === 0 ? <Empty>Cardápio em atualização. Volte já já!</Empty> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => {
              const line = cart.lines.find((l) => l.product.id === p.id);
              return (
                <article key={p.id} className="overflow-hidden rounded-3xl border border-choco-100 bg-white shadow-card">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-rosa-100 to-caramelo-400/30 text-6xl">🎂</div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-bold leading-tight text-choco-900">{p.name}</h3>
                    {p.description && <p className="mt-1 text-sm text-choco-600">{p.description}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black text-vinho-700">{brl(p.price)}</div>
                        {p.weight_g && <div className="text-xs text-choco-500">{p.weight_g}g</div>}
                      </div>
                      {line ? (
                        <div className="flex items-center gap-2 rounded-full bg-choco-100 p-1">
                          <button className="rounded-full bg-white p-1.5 text-choco-800 shadow-sm" onClick={() => cart.setQty(p.id, line.qty - 1)} aria-label="Menos"><Minus size={16} /></button>
                          <span className="w-6 text-center font-bold">{line.qty}</span>
                          <button className="rounded-full bg-vinho-600 p-1.5 text-white shadow-sm" onClick={() => cart.setQty(p.id, line.qty + 1)} aria-label="Mais"><Plus size={16} /></button>
                        </div>
                      ) : (
                        <Button onClick={() => cart.add(p)} disabled={settings ? !settings.is_open : false}><Plus size={16} /> Adicionar</Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {reviews.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-choco-600">O que os vizinhos dizem</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-choco-900">{r.first_name}</span>
                  <Stars value={r.rating} size={16} />
                </div>
                {r.comment && <p className="mt-1 text-sm text-choco-700">“{r.comment}”</p>}
                {r.reply && <p className="mt-2 rounded-xl bg-rosa-100 p-2 text-xs text-vinho-800"><b>Yasmim:</b> {r.reply}</p>}
                <div className="mt-1 text-[11px] text-choco-400">{dateTimeBR(r.created_at)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <Link to="/carrinho" className="mx-auto flex max-w-3xl items-center justify-between rounded-2xl bg-vinho-600 px-5 py-3 text-white shadow-soft">
            <span className="flex items-center gap-2 font-semibold"><ShoppingBag size={18} /> {cart.count} {cart.count === 1 ? "item" : "itens"}</span>
            <span className="font-black">{brl(cart.subtotal)} · Fechar pedido</span>
          </Link>
        </div>
      )}
    </div>
  );
}
