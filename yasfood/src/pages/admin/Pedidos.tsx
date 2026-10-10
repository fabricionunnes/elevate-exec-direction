import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageCircle, Check, ArrowRight, XCircle, Banknote, Printer, Plus, Search, ExternalLink, Pencil, Route, MapPin, LocateFixed, Navigation, ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, dayLabel, dateTimeBR, dayLong, formatPhone, nextStatus, PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL, statusLabelFor, todayISO, addDaysISO, onlyDigits, windowLabel } from "@/lib/format";
import { waLink, msgs, trackingUrl } from "@/lib/whatsapp";
import { prioritize, gmapsRouteUrl, geocodeAddress, fmtKm, hasCoords, mapsPin, currentPosition, usableOrigin, anchorFor as anchorOf, isCityCenter, wazeUrl, type RouteCtx, type LatLng } from "@/lib/route";
import { readOrderFromScreenshots, shrinkAll, type ReadOrder, type ShrunkImage } from "@/lib/readOrder";
import type { Availability, AvailableWindow, Customer, DeliveryWindow, DeliveryZone, Order, OrderEvent, OrderItem, OrderStatus, PaymentMethod, Product, Fulfillment } from "@/lib/types";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Button, Badge, Card, Modal, Empty, Spinner, Input, Select, Textarea, useToast } from "@/components/ui";

type Filter = "abertos" | "hoje" | "amanha" | "todos" | "cancelados";
type OrderRow = Order & { order_items: { product_id: string | null; product_name: string; qty: number }[] | null };

// Etiquetas por produto: tira o prefixo comum dos nomes ("Bolo de Cenoura ") e colore cada um.
const CORES_PRODUTO = [
  "bg-vinho-100 text-vinho-800 ring-vinho-300",
  "bg-caramelo-400/20 text-caramelo-600 ring-caramelo-400/50",
  "bg-choco-100 text-choco-800 ring-choco-300",
  "bg-rosa-100 text-rosa-500 ring-rosa-300",
  "bg-emerald-50 text-emerald-800 ring-emerald-300",
  "bg-sky-50 text-sky-800 ring-sky-300",
];
function etiquetas(nomes: string[]) {
  const sorted = [...new Set(nomes)].sort();
  let prefix = sorted[0] ?? "";
  for (const n of sorted) { let i = 0; while (i < prefix.length && i < n.length && prefix[i].toLowerCase() === n[i].toLowerCase()) i++; prefix = prefix.slice(0, i); }
  // só corta em limite de palavra e se sobrar algo
  prefix = sorted.length > 1 ? prefix.replace(/\S*$/, "") : "";
  const m = new Map<string, { short: string; cor: string }>();
  sorted.forEach((n, i) => {
    let short = prefix && n.length > prefix.length ? n.slice(prefix.length) : n.replace(/^bolo de /i, "");
    short = short.replace(/\s+de chocolate$/i, "").trim();
    m.set(n, { short: short.charAt(0).toUpperCase() + short.slice(1), cor: CORES_PRODUTO[i % CORES_PRODUTO.length] });
  });
  return m;
}

export default function Pedidos() {
  const toast = useToast();
  const { settings } = useSettings(true);
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [prod, setProd] = useState("");
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [filter, setFilter] = useState<Filter>("abertos");
  const [ordem, setOrdem] = useState<"horario" | "distancia">("horario");
  const [here, setHere] = useState<LatLng | null>(null);   // posição atual (ordem por distância)
  const [hereBusy, setHereBusy] = useState(false);
  const [q, setQ] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(params.get("pagamento") === "pendente");
  const [openId, setOpenId] = useState<string | null>(params.get("abrir"));
  const [novo, setNovo] = useState<false | { initial?: ReadOrder }>(false);
  const [prints, setPrints] = useState(false);
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [locating, setLocating] = useState<string | null>(null);
  const geoBusy = useRef(false);

  const load = useCallback(async () => {
    const [{ data }, w, z] = await Promise.all([
      supabase.from("orders").select("*, order_items(product_id, product_name, qty)").order("scheduled_date").order("created_at"),
      supabase.from("delivery_windows").select("id, start_time"),
      supabase.from("delivery_zones").select("id, lat, lng, sort_order"),
    ]);
    setOrders((data as OrderRow[]) ?? []);
    setWindows((w.data as DeliveryWindow[]) ?? []);
    setZones((z.data as DeliveryZone[]) ?? []);
  }, []);

  const ctx = useMemo<RouteCtx>(() => ({
    origin: usableOrigin(settings),
    windows,
    zones,
  }), [settings, windows, zones]);

  /** Referência da região do pedido: ponto da região, a casa quando é "meu condomínio", senão o Alphaville. Endereço fora do raio é descartado. */
  const anchorFor = useCallback((o: Order) => anchorOf(o, ctx.origin, zones), [zones, ctx.origin]);

  /** Localiza no mapa os endereços de entrega que ainda não têm coordenada. */
  const locate = useCallback(async (list: Order[], force = false) => {
    if (geoBusy.current) return;
    const todo = list.filter((o) => o.fulfillment === "entrega" && !["entregue", "cancelado"].includes(o.status) && !hasCoords(o) && (force || !o.geocoded_at)).slice(0, 12);
    if (!todo.length) return;
    geoBusy.current = true;
    try {
      // 1) cliente já tem localização marcada pra esse endereço? usa ela, sem consultar o mapa
      const ids = [...new Set(todo.map((o) => o.customer_id).filter((x): x is string => !!x))];
      const { data: known } = ids.length ? await supabase.from("customers").select("id, lat, lng, geo_address").in("id", ids) : { data: [] };
      const byCustomer = new Map(((known as { id: string; lat: number | null; lng: number | null; geo_address: string | null }[]) ?? []).map((c) => [c.id, c]));
      const norm = (a: string) => a.toLowerCase().replace(/\s+/g, " ").trim();
      for (const o of todo) {
        setLocating(o.id);
        const c = o.customer_id ? byCustomer.get(o.customer_id) : undefined;
        if (c && hasCoords(c) && c.geo_address && norm(c.geo_address) === norm(o.address)) {
          await supabase.from("orders").update({ lat: c.lat, lng: c.lng, geocoded_at: new Date().toISOString() }).eq("id", o.id);
          continue;
        }
        const p = await geocodeAddress(o.address, o.zone_name, ctx.origin, anchorFor(o)).catch(() => null);
        await supabase.from("orders").update({ lat: p?.lat ?? null, lng: p?.lng ?? null, geocoded_at: new Date().toISOString() }).eq("id", o.id);
      }
    } finally {
      geoBusy.current = false;
      setLocating(null);
      void load();
    }
  }, [ctx.origin, load]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "yasfood", table: "orders" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const list = useMemo(() => {
    if (!orders) return [];
    const today = todayISO();
    const tomorrow = addDaysISO(1);
    let l = orders;
    if (filter === "abertos") l = l.filter((o) => !["entregue", "cancelado"].includes(o.status));
    if (filter === "hoje") l = l.filter((o) => o.scheduled_date === today && o.status !== "cancelado");
    if (filter === "amanha") l = l.filter((o) => o.scheduled_date === tomorrow && o.status !== "cancelado");
    if (filter === "cancelados") l = l.filter((o) => o.status === "cancelado");
    if (onlyUnpaid) l = l.filter((o) => o.payment_status === "pendente" && o.status !== "cancelado");
    if (prod) l = l.filter((o) => (o.order_items ?? []).some((i) => i.product_name === prod));
    if (dFrom) l = l.filter((o) => o.scheduled_date >= dFrom);
    if (dTo) l = l.filter((o) => o.scheduled_date <= dTo);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter((o) => o.code.toLowerCase().includes(s) || o.customer_name.toLowerCase().includes(s) || o.customer_phone.includes(onlyDigits(s)));
    }
    if (filter === "todos" || filter === "cancelados") l = [...l].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return l;
  }, [orders, filter, q, onlyUnpaid, prod, dFrom, dTo]);

  // produtos que aparecem nos pedidos (nome gravado no item) → etiqueta curta e cor
  const tags = useMemo(() => etiquetas((orders ?? []).flatMap((o) => (o.order_items ?? []).map((i) => i.product_name))), [orders]);
  const itensDe = (o: OrderRow) => {
    const m = new Map<string, number>();
    for (const i of o.order_items ?? []) m.set(i.product_name, (m.get(i.product_name) ?? 0) + Number(i.qty));
    return [...m.entries()];
  };

  const grouped = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of list) m.set(o.scheduled_date, [...(m.get(o.scheduled_date) ?? []), o]);
    const opts = ordem === "distancia" ? { byDistance: true, start: here } : {};
    return [...m.entries()].map(([day, os]) => [day, filter === "cancelados" ? os.map((o, i) => ({ order: o, rank: i + 1, legKm: null, located: false, approx: false, windowKey: "" })) : prioritize(os, ctx, opts)] as const);
  }, [list, ctx, filter, ordem, here]);

  /** Ordem por distância: parte de onde ela está agora (GPS); sem GPS, parte de casa. */
  const usarMinhaPosicao = async () => {
    setHereBusy(true);
    try {
      const p = await currentPosition();
      setHere({ lat: p.lat, lng: p.lng });
      setOrdem("distancia");
    } catch (e) {
      setOrdem("distancia");
      toast(`${(e as Error).message} Partindo da sua casa.`, "err");
    } finally {
      setHereBusy(false);
    }
  };

  // Endereços novos são localizados sozinhos (1 por segundo, só os dias de hoje em diante).
  useEffect(() => {
    if (!orders) return;
    const today = todayISO();
    void locate(orders.filter((o) => o.scheduled_date >= today));
  }, [orders, locate]);

  const open = (id: string | null) => {
    setOpenId(id);
    const p = new URLSearchParams(params);
    if (id) p.set("abrir", id); else p.delete("abrir");
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black text-choco-900">Pedidos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPrints(true)}><ImagePlus size={16} /> Ler prints do WhatsApp</Button>
          <Button onClick={() => setNovo({})}><Plus size={16} /> Novo pedido manual</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["abertos", "hoje", "amanha", "todos", "cancelados"] as Filter[]).map((f) => (
          <button key={f} onClick={() => { setFilter(f); if (f === "hoje" || f === "amanha") { setDFrom(""); setDTo(""); } }} className={clsx("rounded-full px-3 py-1.5 text-sm font-semibold capitalize", filter === f ? "bg-vinho-600 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}>{f === "amanha" ? "amanhã" : f}</button>
        ))}
        <label className="ml-1 flex items-center gap-1 text-sm text-choco-700"><input type="checkbox" checked={onlyUnpaid} onChange={(e) => setOnlyUnpaid(e.target.checked)} /> só não pagos</label>
        {filter !== "cancelados" && (
          <div className="flex items-center gap-1 text-xs text-choco-500">
            <span>Ordem:</span>
            <button type="button" onClick={() => setOrdem("horario")} className={clsx("rounded-full px-2.5 py-1 font-semibold", ordem === "horario" ? "bg-choco-900 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}>por horário</button>
            <button type="button" disabled={hereBusy} onClick={() => void usarMinhaPosicao()} className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold disabled:opacity-50", ordem === "distancia" ? "bg-choco-900 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}><LocateFixed size={12} /> {hereBusy ? "pegando posição…" : ordem === "distancia" && here ? "mais perto de mim (atualizar)" : "mais perto de mim"}</button>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-choco-500">
          <span>Data:</span>
          <input type="date" value={dFrom} onChange={(e) => { setDFrom(e.target.value); if (e.target.value && (filter === "hoje" || filter === "amanha")) setFilter("todos"); }} className="h-8 rounded-lg border border-choco-200 bg-white px-2 text-xs text-choco-800" />
          <span>até</span>
          <input type="date" value={dTo} min={dFrom || undefined} onChange={(e) => { setDTo(e.target.value); if (e.target.value && (filter === "hoje" || filter === "amanha")) setFilter("todos"); }} className="h-8 rounded-lg border border-choco-200 bg-white px-2 text-xs text-choco-800" />
          {(dFrom || dTo) && <button type="button" onClick={() => { setDFrom(""); setDTo(""); }} className="rounded-full bg-choco-100 px-2 py-0.5 font-semibold text-choco-700">limpar</button>}
        </div>
        {tags.size > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
            <span className="text-xs text-choco-500">Produto:</span>
            <button onClick={() => setProd("")} className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", !prod ? "bg-choco-900 text-white ring-choco-900" : "bg-white text-choco-700 ring-choco-200")}>todos</button>
            {[...tags.entries()].map(([name, t]) => (
              <button key={name} onClick={() => setProd(prod === name ? "" : name)} title={name} className={clsx("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", t.cor, prod === name && "outline outline-2 outline-offset-1 outline-choco-900")}>{t.short}</button>
            ))}
          </div>
        )}
        <div className="relative ml-auto">
          <Search size={16} className="absolute left-3 top-3 text-choco-400" />
          <input className="h-10 rounded-xl border border-choco-200 bg-white pl-9 pr-3 text-sm" placeholder="código, nome, telefone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {orders === null ? <Spinner /> : list.length === 0 ? <Empty>Nenhum pedido aqui.</Empty> : (
        <>
          {filter !== "cancelados" && (
            <p className="text-xs text-choco-500">
              {ordem === "distancia"
                ? <>Ordem por distância: todas as entregas do dia numa rota só, da mais perta pra mais longe, partindo {here ? "de onde você está agora" : "da sua casa"}. Sem olhar o horário.</>
                : <>Ordem sugerida pelo sistema: horário mais cedo primeiro; dentro do horário, retiradas e depois as entregas do mais perto pro mais longe partindo da sua casa.</>}
              {!ctx.origin && (settings && hasCoords({ lat: settings.origin_lat, lng: settings.origin_lng })
                ? <> <b className="text-vinho-700">A localização da sua casa está marcada no centro de Nova Lima, errada.</b> <a href="/admin/configuracoes" className="font-semibold text-vinho-600 underline">Vá em Configurações</a> e toque em "Usar minha localização atual" estando em casa.</>
                : <> Pra rota por distância, <a href="/admin/configuracoes" className="font-semibold text-vinho-600 underline">cadastre a localização da sua casa</a>.</>)}
            </p>
          )}
          {grouped.map(([day, ps]) => {
            // uma rota por horário: cada horário é uma saída de casa
            const routes = filter === "cancelados" ? [] : [...new Set(ps.filter((p) => p.order.fulfillment === "entrega" && !["entregue", "cancelado"].includes(p.order.status)).map((p) => p.windowKey))]
              .map((k) => ({ k, url: gmapsRouteUrl(ps.filter((p) => p.windowKey === k), ctx, settings?.pickup_address ?? "", ordem === "distancia" ? here : null) }))
              .filter((r): r is { k: string; url: string } => !!r.url);
            const unlocated = ps.filter((p) => p.order.fulfillment === "entrega" && !["entregue", "cancelado"].includes(p.order.status) && !hasCoords(p.order)).length;
            // Waze não aceita rota com várias paradas: vai pra próxima entrega na ordem sugerida
            const next = filter === "cancelados" ? undefined : ps.find((p) => p.order.fulfillment === "entrega" && !["entregue", "cancelado"].includes(p.order.status));
            return (
              <section key={day}>
                <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-wide text-choco-600">
                  <span className="capitalize">{dayLabel(day)}</span>
                  <span className="text-choco-400">· {ps.length} pedido(s)</span>
                  {(() => {
                    const tot = new Map<string, number>();
                    for (const p of ps) if (p.order.status !== "cancelado") for (const [n, qn] of itensDe(p.order as OrderRow)) tot.set(n, (tot.get(n) ?? 0) + qn);
                    return [...tot.entries()].map(([n, qn]) => <span key={n} className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal ring-1 ring-inset", tags.get(n)?.cor)}>{qn}x {tags.get(n)?.short ?? n}</span>);
                  })()}
                  <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
                    {unlocated > 0 && filter !== "cancelados" && (
                      <Button size="sm" variant="ghost" loading={!!locating} onClick={() => locate(ps.map((p) => p.order), true)}><MapPin size={14} /> Localizar {unlocated} endereço(s)</Button>
                    )}
                    {routes.map((r) => <a key={r.k} href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-vinho-600 px-3 py-1 text-xs font-semibold text-white"><Route size={14} /> Rota{routes.length > 1 && r.k ? ` ${r.k}` : ""} no Maps</a>)}
                    {next && <a href={wazeUrl(next.order)} target="_blank" rel="noreferrer" title={`Próxima entrega: ${next.order.code} · ${next.order.customer_name}`} className="inline-flex items-center gap-1 rounded-full bg-[#33ccff] px-3 py-1 text-xs font-semibold text-choco-900"><Navigation size={14} /> Próxima no Waze</a>}
                  </span>
                </h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {ps.map(({ order: o, rank, legKm, located, approx }) => (
                    <button key={o.id} onClick={() => open(o.id)} className="rounded-2xl border border-choco-100 bg-white p-3 text-left shadow-card hover:border-vinho-300">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-bold">
                          {filter !== "cancelados" && !["entregue", "cancelado"].includes(o.status) && <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-choco-900 px-1.5 text-xs font-black text-white">{rank}º</span>}
                          <span>{o.code} · {o.customer_name}</span>
                        </span>
                        <Badge className={STATUS_COLOR[o.status]}>{statusLabelFor(o.status, o.fulfillment)}</Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {itensDe(o as OrderRow).map(([n, qn]) => <span key={n} className={clsx("rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset", tags.get(n)?.cor)} title={n}>{qn}x {tags.get(n)?.short ?? n}</span>)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-choco-500">
                        <span>{o.fulfillment === "entrega" ? `Entrega · ${o.zone_name ?? ""}` : "Retirada"}{o.window_label ? ` · ${o.window_label}` : ""}</span>
                        {o.fulfillment === "entrega" && !["entregue", "cancelado"].includes(o.status) && (
                          legKm !== null ? <span className="rounded-full bg-choco-100 px-2 py-0.5 font-semibold text-choco-700">{approx ? "~" : ""}{fmtKm(legKm)} da parada anterior</span>
                          : located ? null
                          : <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">{locating === o.id ? "localizando…" : "sem localização"}</span>
                        )}
                        <span>·</span>
                        <span>{PAYMENT_LABEL[o.payment_method]}</span>
                        <span className={clsx("ml-auto font-bold", o.payment_status === "pago" ? "text-emerald-700" : "text-amber-700")}>{brl(o.total)} {o.payment_status === "pago" ? "✓" : "pendente"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      {openId && <OrderDetail id={openId} onClose={() => open(null)} onChanged={load} siteUrl={settings?.site_url} pix={{ key: settings?.pix_key ?? "", name: settings?.pix_name ?? "" }} reviewTemplate={settings?.review_message ?? ""} />}
      {novo && <NovoPedido initial={novo.initial} onClose={() => setNovo(false)} onCreated={() => { setNovo(false); void load(); toast("Pedido criado."); }} />}
      {prints && <LerPrints onClose={() => setPrints(false)} onRead={(o) => { setPrints(false); setNovo({ initial: o }); }} />}
    </div>
  );
}

/* ----------------------------- Detalhe ----------------------------- */
function OrderDetail({ id, onClose, onChanged, siteUrl, pix, reviewTemplate }: { id: string; onClose: () => void; onChanged: () => void; siteUrl?: string; pix: { key: string; name: string }; reviewTemplate: string }) {
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const { settings: full } = useSettings(true);

  /** Na porta do cliente: grava o GPS no pedido e no cliente (próximos pedidos já saem certos). */
  const markHere = async () => {
    if (!order) return;
    setGeoBusy(true);
    try {
      const p = await currentPosition();
      const { error } = await supabase.from("orders").update({ lat: p.lat, lng: p.lng, geocoded_at: new Date().toISOString() }).eq("id", order.id);
      if (error) throw new Error(friendlyError(error));
      if (order.customer_id) await supabase.from("customers").update({ lat: p.lat, lng: p.lng, geo_address: order.address }).eq("id", order.customer_id);
      toast(`Localização marcada (precisão de ${Math.round(p.accuracy)} m). Vale pros próximos pedidos deste endereço.`);
      onChanged();
      void load();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setGeoBusy(false);
    }
  };

  /** Tenta localizar o endereço outra vez (ex.: quando caiu no lugar errado). */
  const relocate = async () => {
    if (!order) return;
    setGeoBusy(true);
    const bias = usableOrigin(full);
    const p = await geocodeAddress(order.address, order.zone_name, bias, anchorOf(order, bias)).catch(() => null);
    const { error } = await supabase.from("orders").update({ lat: p?.lat ?? null, lng: p?.lng ?? null, geocoded_at: new Date().toISOString() }).eq("id", order.id);
    setGeoBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast(p ? `Encontrado: ${p.label}` : "Não achei esse endereço no mapa. Confira se a rua e o número estão certos.", p ? "ok" : "err");
    onChanged();
    void load();
  };

  const load = useCallback(async () => {
    const [o, i, e] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id),
      supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
    ]);
    setOrder(o.data as Order);
    setItems((i.data as OrderItem[]) ?? []);
    setEvents((e.data as OrderEvent[]) ?? []);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (!order) return <Modal open onClose={onClose} title="Pedido"><Spinner /></Modal>;

  const setStatus = async (s: OrderStatus, n = "") => {
    setBusy(true);
    const { error } = await supabase.rpc("set_order_status", { p_order_id: id, p_status: s, p_note: n });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    setNote("");
    setCancelOpen(false);
    toast(`Status: ${STATUS_LABEL[s]}`);
    await load();
    onChanged();
  };

  const setPaid = async (paid: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_order_paid", { p_order_id: id, p_paid: paid });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast(paid ? "Pagamento confirmado e lançado no financeiro." : "Pagamento desmarcado.");
    await load();
    onChanged();
  };

  const next = nextStatus(order.status, order.fulfillment);
  const wa = (text: string) => waLink(order.customer_phone, text);
  if (editOpen) return <EditOrder order={order} items={items} onClose={() => setEditOpen(false)} onSaved={async () => { setEditOpen(false); await load(); onChanged(); }} />;
  const print = () => window.print();

  return (
    <Modal open onClose={onClose} title={<span>{order.code} <Badge className={clsx("ml-2", STATUS_COLOR[order.status])}>{statusLabelFor(order.status, order.fulfillment)}</Badge></span>} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Card title="Cliente">
            <div className="text-sm">
              <div className="font-bold">{order.customer_name}</div>
              <div>{formatPhone(order.customer_phone)}</div>
              <div className="mt-1 text-choco-600">{order.fulfillment === "entrega" ? `Entrega · ${order.zone_name ?? ""} · ${order.address}${order.reference ? ` (${order.reference})` : ""}` : "Retirada"}</div>
              {order.fulfillment === "entrega" && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {hasCoords(order)
                    ? <a href={mapsPin(order)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-700"><MapPin size={12} /> ver no mapa</a>
                    : <span className="text-amber-800">{order.geocoded_at ? "endereço não encontrado no mapa" : "ainda não localizado"}</span>}
                  {!["entregue", "cancelado"].includes(order.status) && <a href={wazeUrl(order)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#33ccff] px-2.5 py-1 font-semibold text-choco-900"><Navigation size={12} /> ir no Waze</a>}
                  <button type="button" disabled={geoBusy} onClick={() => void relocate()} className="font-semibold text-vinho-600 underline-offset-2 hover:underline disabled:opacity-50">{geoBusy ? "localizando…" : "localizar de novo"}</button>
                  <button type="button" disabled={geoBusy} onClick={() => void markHere()} className="inline-flex items-center gap-1 rounded-full bg-choco-900 px-2.5 py-1 font-semibold text-white disabled:opacity-50" title="Use quando estiver na porta do cliente"><LocateFixed size={12} /> estou na porta: marcar aqui</button>
                </div>
              )}
              <div className="mt-1 capitalize text-choco-600">Para: {dayLong(order.scheduled_date)}{order.window_label && <span className="normal-case"> · {order.window_label}</span>}</div>
              {order.notes && <div className="mt-2 rounded-xl bg-amber-50 p-2 text-amber-900">Obs.: {order.notes}</div>}
              <div className="mt-1 text-xs text-choco-400">Pedido em {dateTimeBR(order.created_at)}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={wa(msgs.confirmacao(order, items, siteUrl))} target="_blank" rel="noreferrer"><Button variant="wa" size="sm"><MessageCircle size={14} /> Confirmar no Whats</Button></a>
              {order.payment_method === "pix" && pix.key && <a href={wa(msgs.pix(order, pix.key, pix.name))} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Enviar Pix</Button></a>}
              {order.status === "saiu_entrega" && <a href={wa(msgs.saiu(order, siteUrl))} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Avisar saída</Button></a>}
              {order.status === "pronto" && order.fulfillment === "retirada" && <a href={wa(msgs.pronto(order))} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Avisar pronto</Button></a>}
              {order.status === "entregue" && <a href={wa(msgs.avaliacao(order, reviewTemplate, siteUrl))} target="_blank" rel="noreferrer"><Button variant="outline" size="sm">Pedir avaliação</Button></a>}
              <a href={trackingUrl(order.tracking_token, siteUrl)} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink size={14} /> Rastreio</Button></a>
              <Button variant="ghost" size="sm" onClick={print}><Printer size={14} /> Imprimir</Button>
              {order.status !== "cancelado" && <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}><Pencil size={14} /> Editar pedido</Button>}
            </div>
          </Card>

          <Card title="Itens">
            <ul className="divide-y divide-choco-100 text-sm">
              {items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span><b>{i.qty}x</b> {i.product_name}</span><span>{brl(i.line_total)}</span></li>)}
              {Number(order.delivery_fee) > 0 && <li className="flex justify-between py-1.5 text-choco-600"><span>Entrega</span><span>{brl(order.delivery_fee)}</span></li>}
              <li className="flex justify-between py-1.5 text-base font-black"><span>Total</span><span className="text-vinho-700">{brl(order.total)}</span></li>
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-choco-50 p-2 text-sm">
              <span>{PAYMENT_LABEL[order.payment_method]}{order.change_for ? ` · troco p/ ${brl(order.change_for)}` : ""} · <b className={order.payment_status === "pago" ? "text-emerald-700" : "text-amber-700"}>{order.payment_status}</b></span>
              {order.payment_status === "pago" ? (
                <Button variant="ghost" size="sm" loading={busy} onClick={() => setPaid(false)}>desmarcar</Button>
              ) : (
                <Button size="sm" loading={busy} onClick={() => setPaid(true)}><Banknote size={14} /> Marcar pago</Button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <Card title="Andamento">
            <StatusTimeline status={order.status} fulfillment={order.fulfillment} events={events} />
          </Card>
          {order.status !== "cancelado" && (
            <Card title="Atualizar">
              <Input placeholder="Observação pro cliente (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-2">
                {next && <Button loading={busy} onClick={() => setStatus(next, note)}><ArrowRight size={16} /> {next === "entregue" && order.fulfillment === "retirada" ? "Retirado" : STATUS_LABEL[next]}</Button>}
                {order.status === "recebido" && <Button variant="secondary" loading={busy} onClick={() => setStatus("confirmado", note)}><Check size={16} /> Confirmar</Button>}
                {order.status !== "entregue" && <Button variant="ghost" onClick={() => setCancelOpen(true)}><XCircle size={16} /> Cancelar</Button>}
              </div>
              {cancelOpen && (
                <div className="mt-3 rounded-xl bg-red-50 p-3">
                  <Textarea label="Motivo do cancelamento" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="mt-2 flex gap-2">
                    <Button variant="danger" size="sm" loading={busy} onClick={() => setStatus("cancelado", note)}>Confirmar cancelamento</Button>
                    <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>Voltar</Button>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-choco-500">Status muda pra todos os pedidos, inclusive na tela do cliente. Ao entrar em produção, o estoque é baixado pela receita.</p>
            </Card>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------- Novo pedido manual ----------------------------- */
/* ----------------------------- Ler prints do WhatsApp ----------------------------- */
function LerPrints({ onClose, onRead }: { onClose: () => void; onRead: (o: ReadOrder) => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  // rodada de dúvidas: a IA leu, mas precisa de respostas antes de montar o pedido
  const [draft, setDraft] = useState<ReadOrder | null>(null);
  const [images, setImages] = useState<ShrunkImage[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [round, setRound] = useState(0);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((cur) => [...cur, ...imgs].slice(0, 6));
  };
  const run = async () => {
    if (!files.length) return toast("Escolha pelo menos um print.", "err");
    setBusy(true);
    try {
      const imgs = await shrinkAll(files);
      setImages(imgs);
      const o = await readOrderFromScreenshots(imgs, hint);
      if (o.doubts.length) { setDraft(o); setAnswers(o.doubts.map(() => "")); setRound(1); }
      else onRead(o);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const respond = async () => {
    if (!draft) return;
    const qa = draft.doubts.map((q, i) => ({ question: q, answer: answers[i] ?? "" })).filter((x) => x.answer.trim());
    if (extra.trim()) qa.push({ question: "Observação adicional da confeiteira", answer: extra.trim() });
    if (!qa.length) return toast("Responde pelo menos uma dúvida, ou abre o pedido assim mesmo.", "err");
    setBusy(true);
    try {
      const o = await readOrderFromScreenshots(images, hint, draft, qa);
      // no máximo duas rodadas de perguntas; depois abre o pedido com o que sobrou
      if (o.doubts.length && round < 2) { setDraft(o); setAnswers(o.doubts.map(() => "")); setExtra(""); setRound(round + 1); }
      else onRead(o);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (draft) {
    return (
      <Modal open onClose={onClose} title="Li os prints. Só me confirma umas coisas">
        <div className="space-y-3">
          <div className="rounded-xl bg-choco-50 p-3 text-sm text-choco-800">
            <div className="font-bold">Até agora entendi:</div>
            <div className="mt-1 text-xs text-choco-700">
              {draft.customer_name ?? "cliente sem nome"}{draft.phone ? ` · ${formatPhone(draft.phone)}` : ""} · {draft.items.length ? draft.items.map((i) => `${i.qty}x ${i.product_name ?? i.raw_text}`).join(", ") : "sem itens"}{draft.scheduled_date ? ` · ${dayLong(draft.scheduled_date)}` : ""}{draft.window_label ? ` ${draft.window_label}` : ""} · {draft.fulfillment === "indefinido" ? "entrega ou retirada?" : draft.fulfillment}{draft.payment_method ? ` · ${PAYMENT_LABEL[draft.payment_method]}` : ""}
            </div>
          </div>
          {draft.doubts.map((q, i) => (
            <Input key={i} label={q} value={answers[i] ?? ""} onChange={(e) => setAnswers((cur) => cur.map((a, k) => (k === i ? e.target.value : a)))} placeholder="Digite a resposta" autoFocus={i === 0} />
          ))}
          <Input label="Mais alguma coisa? (opcional)" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex.: ela mora no bloco B, entregar na portaria" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => onRead(draft)}>Abrir assim mesmo</Button>
            <Button loading={busy} onClick={respond}><Sparkles size={16} /> {busy ? "Atualizando…" : "Responder e montar o pedido"}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Ler prints do WhatsApp">
      <div className="space-y-3">
        <p className="text-sm text-choco-600">Tira print da conversa com o cliente (pode ser mais de um, na ordem). O sistema lê nome, itens, quantidade, data, horário, endereço e pagamento e abre o pedido preenchido pra você conferir antes de salvar.</p>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-choco-200 bg-choco-50 p-6 text-center text-sm text-choco-600 hover:border-vinho-300" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
          <ImagePlus size={28} className="mb-2 text-vinho-500" />
          <span className="font-semibold text-choco-800">Toque pra escolher os prints</span>
          <span className="text-xs">ou arraste aqui · até 6 imagens</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((f, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-choco-100 bg-white">
                <img src={previews[i]} alt="" className="h-28 w-full object-cover object-top" />
                <span className="absolute left-1 top-1 rounded-full bg-choco-900/80 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
                <button type="button" onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-choco-600 hover:text-red-600" aria-label="Remover"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <Input label="Alguma observação pra ajudar a leitura? (opcional)" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Ex.: é pra sexta, ela vai buscar" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button loading={busy} onClick={run}><Sparkles size={16} /> {busy ? "Lendo os prints…" : "Ler e montar o pedido"}</Button>
        </div>
        {busy && <p className="text-center text-xs text-choco-500">Leva uns 10 a 20 segundos.</p>}
      </div>
    </Modal>
  );
}

function NovoPedido({ onClose, onCreated, initial }: { onClose: () => void; onCreated: () => void; initial?: ReadOrder }) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [avail, setAvail] = useState<Availability[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState(initial?.customer_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ? formatPhone(initial.phone) : "");
  const [fulfillment, setFulfillment] = useState<Fulfillment>(initial?.fulfillment === "retirada" ? "retirada" : "entrega");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");

  const pickCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setCustomerOpen(false);
    setName(c.name);
    setPhone(formatPhone(c.phone));
    if (c.zone_id) setZoneId(c.zone_id);
    if (c.address) setAddress(c.address);
    if (c.reference) setReference(c.reference);
  };

  const customerMatches = customerQuery.trim().length >= 2
    ? customers.filter((c) => {
        const q = customerQuery.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(onlyDigits(q));
      }).slice(0, 8)
    : [];
  const [date, setDate] = useState(initial?.scheduled_date ?? "");
  const [windows, setWindows] = useState<AvailableWindow[]>([]);
  const [windowId, setWindowId] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>(initial?.payment_method ?? "pix");
  const [notes, setNotes] = useState(() => {
    if (!initial) return "";
    const extra = [initial.notes, initial.time_text && !initial.window_label ? `horário pedido: ${initial.time_text}` : null, initial.change_for ? `troco pra R$ ${initial.change_for}` : null].filter(Boolean);
    return extra.join(" · ");
  });
  const [busy, setBusy] = useState(false);
  const wantedWindow = useRef(initial?.window_label ?? null);

  useEffect(() => {
    setWindowId("");
    if (!date) { setWindows([]); return; }
    void supabase.rpc("available_windows", { p_date: date, p_fulfillment: fulfillment }).then(({ data }) => {
      const ws = (data as AvailableWindow[]) ?? [];
      setWindows(ws);
      // pedido lido dos prints: casa o horário sugerido com o do dia, uma vez só
      if (wantedWindow.current) {
        const w = ws.find((x) => windowLabel(x) === wantedWindow.current || (x.label && wantedWindow.current!.includes(x.label)));
        if (w) setWindowId(w.id);
        wantedWindow.current = null;
      }
    });
  }, [date, fulfillment]);

  useEffect(() => {
    void (async () => {
      const [p, z, a, c] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("sort_order"),
        supabase.from("delivery_zones").select("*").eq("active", true).order("sort_order"),
        supabase.rpc("availability", { p_from: todayISO(), p_to: addDaysISO(30) }),
        supabase.from("customers").select("*").order("name"),
      ]);
      const ps = (p.data as Product[]) ?? [];
      const cs = (c.data as Customer[]) ?? [];
      setProducts(ps);
      setCustomers(cs);
      const zs = (z.data as DeliveryZone[]) ?? [];
      setZones(zs);
      if (zs[0]) setZoneId(zs[0].id);
      setAvail((a.data as Availability[]) ?? []);
      if (initial) {
        // produtos: nome exato do catálogo, senão o mais parecido
        const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const q: Record<string, number> = {};
        for (const it of initial.items) {
          const alvo = it.product_name ?? it.raw_text;
          const found = ps.find((x) => norm(x.name) === norm(alvo)) ?? ps.find((x) => norm(x.name).includes(norm(alvo)) || norm(alvo).includes(norm(x.name)));
          if (found) q[found.id] = (q[found.id] ?? 0) + it.qty;
        }
        setQty(q);
        if (initial.zone_name) { const zz = zs.find((x) => norm(x.name) === norm(initial.zone_name!)); if (zz) setZoneId(zz.id); }
        // cliente já cadastrado pelo telefone: puxa cadastro (endereço, região)
        const digits = (initial.phone ?? "").replace(/\D/g, "").replace(/^55/, "");
        const known = digits ? cs.find((x) => x.phone.replace(/^55/, "") === digits) : undefined;
        if (known) {
          setSelectedCustomer(known); setCustomerQuery(known.name);
          if (!initial.address && known.address) setAddress(known.address);
          if (!initial.reference && known.reference) setReference(known.reference);
          if (!initial.zone_name && known.zone_id) setZoneId(known.zone_id);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const items = Object.entries(qty).filter(([, q]) => q > 0).map(([product_id, q]) => ({ product_id, qty: q }));
    if (!items.length) return toast("Escolha pelo menos um produto.", "err");
    if (!date) return toast("Escolha a data da encomenda.", "err");
    setBusy(true);
    const { error } = await supabase.rpc("place_order", {
      p: { name, phone: onlyDigits(phone), fulfillment, zone_id: fulfillment === "entrega" ? zoneId : null, address, reference, scheduled_date: date, window_id: windowId || null, payment_method: payment, notes: notes ? `[${initial ? "prints" : "manual"}] ${notes}` : `[${initial ? "prints" : "manual"}]`, items },
    });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    onCreated();
  };

  return (
    <Modal open onClose={onClose} title={initial ? "Pedido lido dos prints: confira e salve" : "Novo pedido (WhatsApp / presencial)"} wide>
      {initial && (
        <div className={clsx("mb-3 rounded-xl p-3 text-sm ring-1", initial.doubts.length ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-emerald-50 text-emerald-900 ring-emerald-200")}>
          <div className="flex items-center gap-2 font-bold"><Sparkles size={16} /> Leitura {initial.confidence === "alta" ? "com confiança alta" : initial.confidence === "media" ? "com confiança média" : "com confiança baixa"}{initial.items.some((i) => !i.product_name) ? " · tem item que não casou com o cardápio" : ""}</div>
          {initial.doubts.length > 0 && <ul className="mt-1 list-disc pl-5">{initial.doubts.map((d, i) => <li key={i}>{d}</li>)}</ul>}
          {initial.items.some((i) => !i.product_name) && <div className="mt-1 text-xs">Itens não reconhecidos: {initial.items.filter((i) => !i.product_name).map((i) => `"${i.raw_text}" (${i.qty})`).join(", ")}. Ajuste as quantidades ao lado.</div>}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Produtos</h3>
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-choco-100 bg-white p-2 text-sm">
              <span>{p.name} <span className="text-choco-500">· {brl(p.price)}</span></span>
              <input type="number" min={0} className="h-9 w-16 rounded-lg border border-choco-200 px-2 text-center" value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })} />
            </div>
          ))}
          <Input
            label="Data da entrega / retirada"
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint={(() => {
              if (!date) return "Pode ser hoje. Pedido manual não trava por prazo nem por limite do dia.";
              const d = avail.find((x) => x.day === date);
              if (!d) return "Dia fora da agenda: será aberto automaticamente com a capacidade padrão.";
              return `${d.remaining} vaga(s) livres de ${d.max_units} nesse dia${d.remaining <= 0 ? " (vai passar do limite)" : ""}`;
            })()}
          />
          {windows.length > 0 && (
            <Select label="Horário" value={windowId} onChange={(e) => setWindowId(e.target.value)}>
              <option value="">— sem horário fixo —</option>
              {windows.map((w) => <option key={w.id} value={w.id}>{windowLabel(w)}{w.label ? ` · ${w.label}` : ""}{w.bookable ? "" : " (prazo passou, ok pra manual)"}</option>)}
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <div className="relative">
            <Input
              label="Cliente cadastrado"
              placeholder="Busca por nome ou telefone…"
              value={customerQuery}
              onChange={(e) => { setCustomerQuery(e.target.value); setCustomerOpen(true); if (selectedCustomer) setSelectedCustomer(null); }}
              onFocus={() => setCustomerOpen(true)}
              onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
              hint={selectedCustomer ? `Selecionado: ${selectedCustomer.name} · ${formatPhone(selectedCustomer.phone)}` : "Ou preencha os dados abaixo pra um cliente novo."}
            />
            {customerOpen && customerMatches.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-choco-200 bg-white shadow-soft">
                {customerMatches.map((c) => (
                  <li key={c.id}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickCustomer(c)} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-rosa-100">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs text-choco-500">{formatPhone(c.phone)}{c.address ? ` · ${c.address}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="WhatsApp" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
          <Select label="Entrega" value={fulfillment} onChange={(e) => setFulfillment(e.target.value as Fulfillment)}>
            <option value="entrega">Entregar</option>
            <option value="retirada">Retirada</option>
          </Select>
          {fulfillment === "entrega" && (
            <>
              <Select label="Zona" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {brl(z.fee)}</option>)}</Select>
              <Input label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Input label="Referência" value={reference} onChange={(e) => setReference(e.target.value)} />
            </>
          )}
          <Select label="Pagamento" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
          </Select>
          <Input label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <Button className="mt-4 w-full" loading={busy} onClick={submit}>Criar pedido</Button>
    </Modal>
  );
}

/* ----------------------------- Editar pedido ----------------------------- */
function EditOrder({ order, items, onClose, onSaved }: { order: Order; items: OrderItem[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [windows, setWindows] = useState<AvailableWindow[]>([]);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.filter((i) => i.product_id).map((i) => [i.product_id as string, i.qty])));
  const [name, setName] = useState(order.customer_name);
  const [phone, setPhone] = useState(formatPhone(order.customer_phone));
  const [fulfillment, setFulfillment] = useState<Fulfillment>(order.fulfillment);
  const [zoneId, setZoneId] = useState(order.zone_id ?? "");
  const [address, setAddress] = useState(order.address);
  const [reference, setReference] = useState(order.reference);
  const [date, setDate] = useState(order.scheduled_date);
  const [windowId, setWindowId] = useState(order.window_id ?? "");
  const [payment, setPayment] = useState<PaymentMethod>(order.payment_method);
  const [changeFor, setChangeFor] = useState(order.change_for ? String(order.change_for) : "");
  const [notes, setNotes] = useState(order.notes);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [p, z] = await Promise.all([
        supabase.from("products").select("*").order("sort_order"),
        supabase.from("delivery_zones").select("*").order("sort_order"),
      ]);
      setProducts((p.data as Product[]) ?? []);
      const zs = (z.data as DeliveryZone[]) ?? [];
      setZones(zs);
      if (!order.zone_id && zs[0]) setZoneId(zs[0].id);
    })();
  }, [order.zone_id]);

  useEffect(() => {
    if (!date) { setWindows([]); return; }
    void supabase.rpc("available_windows", { p_date: date, p_fulfillment: fulfillment }).then(({ data }) => {
      const ws = (data as AvailableWindow[]) ?? [];
      setWindows(ws);
      if (windowId && !ws.some((w) => w.id === windowId)) setWindowId("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fulfillment]);

  const zone = zones.find((z) => z.id === zoneId);
  const itemsTotal = products.reduce((a, p) => a + (qty[p.id] ?? 0) * Number(p.price), 0);
  const fee = fulfillment === "entrega" ? Number(zone?.fee ?? 0) : 0;

  const save = async () => {
    const list = Object.entries(qty).filter(([, q]) => q > 0).map(([product_id, q]) => ({ product_id, qty: q }));
    if (!list.length) return toast("O pedido precisa de pelo menos um item.", "err");
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_order", {
      p_order_id: order.id,
      p: { name, phone: onlyDigits(phone), fulfillment, zone_id: fulfillment === "entrega" ? zoneId : null, address, reference, scheduled_date: date, window_id: windowId || null, payment_method: payment, change_for: payment === "dinheiro" && changeFor ? Number(changeFor.replace(",", ".")) : null, notes, items: list },
    });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Pedido atualizado. O cliente já vê a mudança no rastreio.");
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`Editar ${order.code}`} wide>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Itens</h3>
          {products.map((p) => (
            <div key={p.id} className={clsx("flex items-center justify-between rounded-xl border border-choco-100 bg-white p-2 text-sm", !p.active && "opacity-60")}>
              <span>{p.name} <span className="text-choco-500">· {brl(p.price)}</span></span>
              <input type="number" min={0} className="h-9 w-16 rounded-lg border border-choco-200 px-2 text-center" value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })} />
            </div>
          ))}
          <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Horário" value={windowId} onChange={(e) => setWindowId(e.target.value)}>
            <option value="">— sem horário fixo —</option>
            {windows.map((w) => <option key={w.id} value={w.id}>{windowLabel(w)}{w.label ? ` · ${w.label}` : ""}</option>)}
          </Select>
          <div className="rounded-xl bg-choco-50 p-3 text-sm">
            <div className="flex justify-between"><span>Itens</span><span>{brl(itemsTotal)}</span></div>
            <div className="flex justify-between"><span>Entrega</span><span>{fulfillment === "retirada" ? "Retirada" : fee === 0 ? "Grátis" : brl(fee)}</span></div>
            <div className="mt-1 flex justify-between border-t border-choco-200 pt-1 font-black"><span>Total</span><span className="text-vinho-700">{brl(itemsTotal + fee)}</span></div>
            {order.payment_status === "pago" && <p className="mt-1 text-xs text-amber-700">Pedido já pago: a receita no financeiro acompanha o novo total.</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="WhatsApp" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
          <Select label="Entrega ou retirada" value={fulfillment} onChange={(e) => setFulfillment(e.target.value as Fulfillment)}>
            <option value="entrega">Entregar</option>
            <option value="retirada">Retirada</option>
          </Select>
          {fulfillment === "entrega" && (
            <>
              <Select label="Região (frete)" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>{zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {brl(z.fee)}</option>)}</Select>
              <Input label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Input label="Referência" value={reference} onChange={(e) => setReference(e.target.value)} />
            </>
          )}
          <Select label="Pagamento" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option>
          </Select>
          {payment === "dinheiro" && <Input label="Troco para (R$)" inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} />}
          <Textarea label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" loading={busy} onClick={save}>Salvar alterações</Button>
        <Button variant="ghost" onClick={onClose}>Voltar</Button>
      </div>
    </Modal>
  );
}
