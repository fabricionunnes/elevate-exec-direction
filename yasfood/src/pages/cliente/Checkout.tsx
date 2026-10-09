import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, Truck, Store, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useCart, rememberOrder, saveMe, loadMe } from "@/lib/cart";
import { useSettings } from "@/lib/useSettings";
import { brl, dayLabel, weekdayBR, todayISO, addDaysISO, onlyDigits, formatPhone, PAYMENT_LABEL, windowLabel, leadLabel } from "@/lib/format";
import { waLink, pedidoClienteMsg } from "@/lib/whatsapp";
import type { Availability, AvailableWindow, DeliveryZone, Fulfillment, PaymentMethod } from "@/lib/types";
import { Button, Input, Textarea, Select, Empty, useToast } from "@/components/ui";

export default function Checkout() {
  const cart = useCart();
  const { settings } = useSettings();
  const nav = useNavigate();
  const toast = useToast();

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [avail, setAvail] = useState<Availability[]>([]);
  const me = useMemo(loadMe, []);

  const [name, setName] = useState(me?.name ?? "");
  const [phone, setPhone] = useState(me?.phone ? formatPhone(me.phone) : "");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("entrega");
  const [zoneId, setZoneId] = useState(me?.zone_id ?? "");
  const [address, setAddress] = useState(me?.address ?? "");
  const [reference, setReference] = useState(me?.reference ?? "");
  const [date, setDate] = useState("");
  const [windows, setWindows] = useState<AvailableWindow[] | null>(null);
  const [windowId, setWindowId] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [z, a] = await Promise.all([
        supabase.from("delivery_zones").select("*").eq("active", true).order("sort_order").order("name"),
        supabase.rpc("availability", { p_from: todayISO(), p_to: addDaysISO(30) }),
      ]);
      setZones((z.data as DeliveryZone[]) ?? []);
      setAvail((a.data as Availability[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (settings && !settings.pickup_enabled) setFulfillment("entrega");
    if (!zoneId && zones.length) setZoneId(zones[0].id);
  }, [settings, zones, zoneId]);

  useEffect(() => {
    setWindowId("");
    if (!date) { setWindows(null); return; }
    void supabase.rpc("available_windows", { p_date: date, p_fulfillment: fulfillment }).then(({ data }) => setWindows((data as AvailableWindow[]) ?? []));
  }, [date, fulfillment]);

  const zone = zones.find((z) => z.id === zoneId);
  const fee = fulfillment === "entrega" ? Number(zone?.fee ?? 0) : 0;
  const total = cart.subtotal + fee;
  const selectedDay = avail.find((d) => d.day === date);
  const notEnough = selectedDay ? cart.count > selectedDay.remaining : false;

  const submit = async () => {
    setError(null);
    if (!date) return setError("Escolha a data da encomenda.");
    if (notEnough) return setError(`Só temos ${selectedDay?.remaining} vaga(s) nesse dia. Reduza a quantidade ou escolha outra data.`);
    if (windows && windows.length > 0 && !windowId) return setError(`Escolha o horário de ${fulfillment === "entrega" ? "entrega" : "retirada"}.`);
    setSending(true);
    // Abre a aba ainda dentro do clique (bloqueador de pop-up deixa) e preenche depois.
    const waWindow = settings?.whatsapp ? window.open("", "_blank") : null;
    const payload = {
      name: name.trim(),
      phone: onlyDigits(phone),
      fulfillment,
      zone_id: fulfillment === "entrega" ? zoneId : null,
      address: address.trim(),
      reference: reference.trim(),
      scheduled_date: date,
      window_id: windowId || null,
      payment_method: payment,
      change_for: payment === "dinheiro" && changeFor ? Number(changeFor.replace(",", ".")) : null,
      notes: notes.trim(),
      items: cart.lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
    };
    const { data, error: err } = await supabase.rpc("place_order", { p: payload });
    setSending(false);
    if (err) {
      waWindow?.close();
      setError(friendlyError(err));
      return;
    }
    const res = data as { order_id: string; code: string; tracking_token: string; total: number };
    if (waWindow && settings?.whatsapp) {
      const msg = pedidoClienteMsg({
        code: res.code,
        name: payload.name,
        items: cart.lines.map((l) => ({ name: l.product.name, qty: l.qty })),
        fulfillment,
        zoneName: zone?.name,
        address: payload.address,
        reference: payload.reference,
        scheduledDate: date,
        windowLabel: windows?.find((w) => w.id === windowId) ? windowLabel(windows.find((w) => w.id === windowId)!) : null,
        paymentLabel: PAYMENT_LABEL[payment],
        changeFor: payload.change_for,
        total: res.total,
        notes: payload.notes,
        token: res.tracking_token,
        siteUrl: settings.site_url,
      });
      waWindow.location.href = waLink(settings.whatsapp, msg);
    }
    rememberOrder({ code: res.code, token: res.tracking_token, created_at: new Date().toISOString() });
    saveMe({ name: payload.name, phone: payload.phone, zone_id: zoneId, address: payload.address, reference: payload.reference });
    cart.clear();
    toast(`Pedido ${res.code} enviado!`);
    nav(`/pedido/${res.tracking_token}?novo=1`);
  };

  if (cart.lines.length === 0) {
    return (
      <Empty>
        Seu carrinho está vazio.
        <div className="mt-3"><Link to="/"><Button>Ver cardápio</Button></Link></div>
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-choco-900">Fechar pedido</h1>

      {/* Itens */}
      <section className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <h2 className="mb-2 font-bold">Seu pedido</h2>
        <ul className="divide-y divide-choco-100">
          {cart.lines.map((l) => (
            <li key={l.product.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-choco-900">{l.product.name}</div>
                <div className="text-xs text-choco-500">{brl(l.product.price)} cada</div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-choco-100 p-0.5">
                <button className="rounded-full bg-white p-1 text-choco-800" onClick={() => cart.setQty(l.product.id, l.qty - 1)} aria-label="Menos"><Minus size={14} /></button>
                <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                <button className="rounded-full bg-vinho-600 p-1 text-white" onClick={() => cart.setQty(l.product.id, l.qty + 1)} aria-label="Mais"><Plus size={14} /></button>
              </div>
              <div className="w-20 text-right font-bold">{brl(l.qty * Number(l.product.price))}</div>
              <button className="p-1 text-choco-400 hover:text-red-600" onClick={() => cart.remove(l.product.id)} aria-label="Remover"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </section>

      {/* Data */}
      <section className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <h2 className="font-bold">Para qual dia?</h2>
        <p className="mb-3 text-xs text-choco-500">Preparamos no dia da entrega. Mostramos só os dias com vaga.</p>
        {avail.filter((d) => d.bookable).length === 0 ? (
          <Empty>Sem datas disponíveis no momento. Chama no WhatsApp que a gente dá um jeito.</Empty>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {avail.filter((d) => d.bookable).map((d) => {
              const low = d.remaining <= 2;
              const sel = date === d.day;
              return (
                <button
                  key={d.day}
                  onClick={() => setDate(d.day)}
                  className={clsx("rounded-2xl border p-2 text-center transition", sel ? "border-vinho-600 bg-vinho-50 ring-2 ring-vinho-300" : "border-choco-100 bg-white hover:border-choco-300")}
                >
                  <div className="text-sm font-bold capitalize">{dayLabel(d.day)}</div>
                  <div className="text-[11px] capitalize text-choco-500">{weekdayBR(d.day)}</div>
                  <div className={clsx("mt-1 text-[11px] font-semibold", low ? "text-red-600" : "text-emerald-700")}>{d.remaining} {d.remaining === 1 ? "vaga" : "vagas"}</div>
                </button>
              );
            })}
          </div>
        )}
        {notEnough && <p className="mt-2 text-sm text-red-600">Esse dia tem só {selectedDay?.remaining} vaga(s) e você pediu {cart.count}.</p>}

        {date && windows && windows.length > 0 && (
          <div className="mt-4">
            <h3 className="font-bold">Qual horário?</h3>
            <p className="mb-2 text-xs text-choco-500">Horários de {fulfillment === "entrega" ? "entrega" : "retirada"} pra esse dia.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {windows.map((w) => {
                const sel = windowId === w.id;
                return (
                  <button
                    key={w.id}
                    disabled={!w.bookable}
                    onClick={() => setWindowId(w.id)}
                    className={clsx("rounded-2xl border p-2 text-center transition disabled:opacity-40", sel ? "border-vinho-600 bg-vinho-50 ring-2 ring-vinho-300" : "border-choco-100 bg-white hover:border-choco-300")}
                  >
                    <div className="text-sm font-bold">{windowLabel(w)}</div>
                    {w.label && <div className="text-[11px] text-choco-500">{w.label}</div>}
                    <div className={clsx("text-[11px]", w.bookable ? "text-emerald-700" : "text-red-600")}>{w.bookable ? `pedir até ${leadLabel(w.min_lead_minutes)} antes` : "prazo encerrado"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {date && windows && windows.length === 0 && <p className="mt-3 text-xs text-choco-500">Sem horários fixos nesse dia: a Yasmim combina o horário com você pelo WhatsApp.</p>}
      </section>

      {/* Entrega */}
      <section className="rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <h2 className="mb-3 font-bold">Entrega ou retirada?</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setFulfillment("entrega")} className={clsx("flex items-center justify-center gap-2 rounded-2xl border p-3 font-semibold", fulfillment === "entrega" ? "border-vinho-600 bg-vinho-50 ring-2 ring-vinho-300" : "border-choco-100")}><Truck size={18} /> Entregar</button>
          <button disabled={settings ? !settings.pickup_enabled : false} onClick={() => setFulfillment("retirada")} className={clsx("flex items-center justify-center gap-2 rounded-2xl border p-3 font-semibold disabled:opacity-40", fulfillment === "retirada" ? "border-vinho-600 bg-vinho-50 ring-2 ring-vinho-300" : "border-choco-100")}><Store size={18} /> Retirar</button>
        </div>
        {fulfillment === "entrega" ? (
          <div className="mt-3 space-y-3">
            <Select label="Qual condomínio / região?" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {Number(z.fee) === 0 ? "frete grátis" : brl(z.fee)}</option>)}
            </Select>
            <Input label="Endereço (rua, número, casa ou apto)" placeholder="Ex.: Rua das Acácias, 120, casa 7" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Input label="Ponto de referência (opcional)" placeholder="Ex.: portaria principal, deixar com o porteiro" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        ) : (
          settings?.pickup_address && <p className="mt-3 rounded-xl bg-choco-50 p-3 text-sm text-choco-700">{settings.pickup_address}</p>
        )}
      </section>

      {/* Dados */}
      <section className="space-y-3 rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <h2 className="font-bold">Seus dados</h2>
        <Input label="Nome" placeholder="Como quer ser chamado(a)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Input label="WhatsApp" placeholder="(31) 99999-9999" inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} autoComplete="tel" hint="A gente avisa por aqui quando o pedido sair." />
      </section>

      {/* Pagamento */}
      <section className="space-y-3 rounded-2xl border border-choco-100 bg-white p-4 shadow-card">
        <h2 className="font-bold">Pagamento</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["pix", "dinheiro", "cartao"] as PaymentMethod[]).map((m) => (
            <button key={m} onClick={() => setPayment(m)} className={clsx("rounded-2xl border p-3 text-sm font-semibold", payment === m ? "border-vinho-600 bg-vinho-50 ring-2 ring-vinho-300" : "border-choco-100")}>
              {m === "pix" ? "Pix" : m === "dinheiro" ? "Dinheiro" : "Cartão"}
            </button>
          ))}
        </div>
        {payment === "dinheiro" && <Input label="Troco para quanto? (opcional)" placeholder="Ex.: 50" inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} />}
        {payment === "pix" && settings?.pix_key && <p className="rounded-xl bg-choco-50 p-3 text-xs text-choco-700">A chave Pix aparece na tela do pedido. O pagamento confirma sua vaga.</p>}
        <Textarea label="Observações (opcional)" placeholder="Ex.: entregar depois das 18h, deixar na portaria" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      {/* Resumo */}
      <section className="rounded-2xl border border-vinho-200 bg-white p-4 shadow-card">
        <div className="flex justify-between text-sm"><span>Itens</span><span>{brl(cart.subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span>Entrega</span><span>{fulfillment === "retirada" ? "Retirada" : fee === 0 ? "Grátis" : brl(fee)}</span></div>
        <div className="mt-2 flex justify-between border-t border-choco-100 pt-2 text-lg font-black"><span>Total</span><span className="text-vinho-700">{brl(total)}</span></div>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button size="lg" className="mt-4 w-full" loading={sending} onClick={submit}><CheckCircle2 size={18} /> Confirmar pedido</Button>
        <p className="mt-2 text-center text-[11px] text-choco-500">Você acompanha o pedido em tempo real depois de confirmar.</p>
      </section>
    </div>
  );
}
