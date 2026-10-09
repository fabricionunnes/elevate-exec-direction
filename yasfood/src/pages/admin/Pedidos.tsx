import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageCircle, Check, ArrowRight, XCircle, Banknote, Printer, Plus, Search, ExternalLink } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, dayLabel, dateTimeBR, dayLong, formatPhone, nextStatus, PAYMENT_LABEL, STATUS_COLOR, STATUS_LABEL, statusLabelFor, todayISO, addDaysISO, onlyDigits } from "@/lib/format";
import { waLink, msgs, trackingUrl } from "@/lib/whatsapp";
import type { Availability, Customer, DeliveryZone, Order, OrderEvent, OrderItem, OrderStatus, PaymentMethod, Product, Fulfillment } from "@/lib/types";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Button, Badge, Card, Modal, Empty, Spinner, Input, Select, Textarea, useToast } from "@/components/ui";

type Filter = "abertos" | "hoje" | "amanha" | "todos" | "cancelados";

export default function Pedidos() {
  const toast = useToast();
  const { settings } = useSettings(true);
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<Filter>("abertos");
  const [q, setQ] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(params.get("pagamento") === "pendente");
  const [openId, setOpenId] = useState<string | null>(params.get("abrir"));
  const [novo, setNovo] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("orders").select("*").order("scheduled_date").order("created_at");
    setOrders((data as Order[]) ?? []);
  }, []);

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
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      l = l.filter((o) => o.code.toLowerCase().includes(s) || o.customer_name.toLowerCase().includes(s) || o.customer_phone.includes(onlyDigits(s)));
    }
    if (filter === "todos" || filter === "cancelados") l = [...l].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return l;
  }, [orders, filter, q, onlyUnpaid]);

  const grouped = useMemo(() => {
    const m = new Map<string, Order[]>();
    for (const o of list) m.set(o.scheduled_date, [...(m.get(o.scheduled_date) ?? []), o]);
    return [...m.entries()];
  }, [list]);

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
        <Button onClick={() => setNovo(true)}><Plus size={16} /> Novo pedido manual</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["abertos", "hoje", "amanha", "todos", "cancelados"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={clsx("rounded-full px-3 py-1.5 text-sm font-semibold capitalize", filter === f ? "bg-vinho-600 text-white" : "bg-white text-choco-700 ring-1 ring-choco-200")}>{f === "amanha" ? "amanhã" : f}</button>
        ))}
        <label className="ml-1 flex items-center gap-1 text-sm text-choco-700"><input type="checkbox" checked={onlyUnpaid} onChange={(e) => setOnlyUnpaid(e.target.checked)} /> só não pagos</label>
        <div className="relative ml-auto">
          <Search size={16} className="absolute left-3 top-3 text-choco-400" />
          <input className="h-10 rounded-xl border border-choco-200 bg-white pl-9 pr-3 text-sm" placeholder="código, nome, telefone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {orders === null ? <Spinner /> : list.length === 0 ? <Empty>Nenhum pedido aqui.</Empty> : (
        grouped.map(([day, os]) => (
          <section key={day}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-choco-600">
              <span className="capitalize">{dayLabel(day)}</span>
              <span className="text-choco-400">· {os.length} pedido(s)</span>
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {os.map((o) => (
                <button key={o.id} onClick={() => open(o.id)} className="rounded-2xl border border-choco-100 bg-white p-3 text-left shadow-card hover:border-vinho-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{o.code} · {o.customer_name}</span>
                    <Badge className={STATUS_COLOR[o.status]}>{statusLabelFor(o.status, o.fulfillment)}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-choco-500">
                    <span>{o.fulfillment === "entrega" ? `Entrega · ${o.zone_name ?? ""}` : "Retirada"}</span>
                    <span>·</span>
                    <span>{PAYMENT_LABEL[o.payment_method]}</span>
                    <span className={clsx("ml-auto font-bold", o.payment_status === "pago" ? "text-emerald-700" : "text-amber-700")}>{brl(o.total)} {o.payment_status === "pago" ? "✓" : "pendente"}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {openId && <OrderDetail id={openId} onClose={() => open(null)} onChanged={load} siteUrl={settings?.site_url} pix={{ key: settings?.pix_key ?? "", name: settings?.pix_name ?? "" }} reviewTemplate={settings?.review_message ?? ""} />}
      {novo && <NovoPedido onClose={() => setNovo(false)} onCreated={() => { setNovo(false); void load(); toast("Pedido criado."); }} />}
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
              <div className="mt-1 capitalize text-choco-600">Para: {dayLong(order.scheduled_date)}</div>
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
function NovoPedido({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [avail, setAvail] = useState<Availability[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("entrega");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");

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
  const [date, setDate] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [p, z, a, c] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("sort_order"),
        supabase.from("delivery_zones").select("*").eq("active", true).order("sort_order"),
        supabase.rpc("availability", { p_from: todayISO(), p_to: addDaysISO(30) }),
        supabase.from("customers").select("*").order("name"),
      ]);
      setProducts((p.data as Product[]) ?? []);
      setCustomers((c.data as Customer[]) ?? []);
      const zs = (z.data as DeliveryZone[]) ?? [];
      setZones(zs);
      if (zs[0]) setZoneId(zs[0].id);
      setAvail(((a.data as Availability[]) ?? []).filter((d) => d.bookable));
    })();
  }, []);

  const submit = async () => {
    const items = Object.entries(qty).filter(([, q]) => q > 0).map(([product_id, q]) => ({ product_id, qty: q }));
    if (!items.length) return toast("Escolha pelo menos um produto.", "err");
    if (!date) return toast("Escolha a data da encomenda.", "err");
    setBusy(true);
    const { error } = await supabase.rpc("place_order", {
      p: { name, phone: onlyDigits(phone), fulfillment, zone_id: fulfillment === "entrega" ? zoneId : null, address, reference, scheduled_date: date, payment_method: payment, notes: notes ? `[manual] ${notes}` : "[manual]", items },
    });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    onCreated();
  };

  return (
    <Modal open onClose={onClose} title="Novo pedido (WhatsApp / presencial)" wide>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Produtos</h3>
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-choco-100 bg-white p-2 text-sm">
              <span>{p.name} <span className="text-choco-500">· {brl(p.price)}</span></span>
              <input type="number" min={0} className="h-9 w-16 rounded-lg border border-choco-200 px-2 text-center" value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })} />
            </div>
          ))}
          <Select label="Data" value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">Escolha…</option>
            {avail.map((d) => <option key={d.day} value={d.day}>{dayLabel(d.day)} · {d.remaining} vaga(s)</option>)}
          </Select>
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
