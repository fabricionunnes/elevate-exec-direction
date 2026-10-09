import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Star } from "lucide-react";
import { clsx } from "clsx";
import { supabase } from "@/lib/supabase";
import { brl, dayLabel, todayISO, addDaysISO, STATUS_COLOR, statusLabelFor } from "@/lib/format";
import type { Availability, DeliveryWindow, DeliveryZone, Ingredient, Order, Review } from "@/lib/types";
import { prioritize, hasCoords, fmtKm } from "@/lib/route";
import { Stat, Card, Badge, Spinner, Empty, Stars } from "@/components/ui";

interface Summary {
  todayOrders: Order[];
  todayUnits: number;
  pending: Order[];
  unpaid: number;
  monthRevenue: number;
  monthExpenses: number;
  monthOrders: number;
  avgTicket: number;
  availability: Availability[];
  lowStock: Ingredient[];
  reviews: Review[];
  avgRating: number;
  reviewQueue: number;
  windows: DeliveryWindow[];
  zones: DeliveryZone[];
  origin: { lat: number; lng: number } | null;
}

export default function Dashboard() {
  const [s, setS] = useState<Summary | null>(null);

  useEffect(() => {
    void (async () => {
      const today = todayISO();
      const monthStart = today.slice(0, 8) + "01";
      const [todayRes, todayItemsRes, pendingRes, unpaidRes, txRes, ordersMonth, availRes, ingRes, revRes, queueRes] = await Promise.all([
        supabase.from("orders").select("*").eq("scheduled_date", today).neq("status", "cancelado").order("created_at"),
        supabase.from("order_items").select("qty, orders!inner(scheduled_date, status)").eq("orders.scheduled_date", today).neq("orders.status", "cancelado"),
        supabase.from("orders").select("*").eq("status", "recebido").order("created_at"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "pendente").neq("status", "cancelado"),
        supabase.from("transactions").select("type, amount").gte("occurred_on", monthStart),
        supabase.from("orders").select("total").gte("scheduled_date", monthStart).neq("status", "cancelado"),
        supabase.rpc("availability", { p_from: today, p_to: addDaysISO(7) }),
        supabase.from("ingredients").select("*").eq("active", true),
        supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.rpc("pending_review_requests"),
      ]);
      const [winRes, zoneRes, stRes] = await Promise.all([
        supabase.from("delivery_windows").select("id, start_time"),
        supabase.from("delivery_zones").select("id, lat, lng, sort_order"),
        supabase.from("settings").select("origin_lat, origin_lng").eq("id", 1).maybeSingle(),
      ]);
      const st = stRes.data as { origin_lat: number | null; origin_lng: number | null } | null;
      const tx = (txRes.data as { type: string; amount: number }[]) ?? [];
      const om = (ordersMonth.data as { total: number }[]) ?? [];
      const reviews = (revRes.data as Review[]) ?? [];
      const ings = ((ingRes.data as Ingredient[]) ?? []).filter((i) => Number(i.qty_on_hand) <= Number(i.min_qty));
      setS({
        todayOrders: (todayRes.data as Order[]) ?? [],
        todayUnits: (((todayItemsRes.data as unknown as { qty: number }[]) ?? [])).reduce((a, r) => a + Number(r.qty), 0),
        pending: (pendingRes.data as Order[]) ?? [],
        unpaid: unpaidRes.count ?? 0,
        monthRevenue: tx.filter((t) => t.type === "receita").reduce((a, t) => a + Number(t.amount), 0),
        monthExpenses: tx.filter((t) => t.type === "despesa").reduce((a, t) => a + Number(t.amount), 0),
        monthOrders: om.length,
        avgTicket: om.length ? om.reduce((a, o) => a + Number(o.total), 0) / om.length : 0,
        availability: (availRes.data as Availability[]) ?? [],
        lowStock: ings,
        reviews,
        avgRating: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0,
        reviewQueue: ((queueRes.data as unknown[]) ?? []).length,
        windows: (winRes.data as DeliveryWindow[]) ?? [],
        zones: (zoneRes.data as DeliveryZone[]) ?? [],
        origin: st && hasCoords({ lat: st.origin_lat, lng: st.origin_lng }) ? { lat: st.origin_lat as number, lng: st.origin_lng as number } : null,
      });
    })();
  }, []);

  if (!s) return <Spinner />;
  const profit = s.monthRevenue - s.monthExpenses;
  const todayList = prioritize(s.todayOrders, { origin: s.origin, windows: s.windows, zones: s.zones });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-choco-900">Bom dia, Yasmim</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bolos hoje" value={s.todayUnits} sub={`${s.todayOrders.length} pedido(s) pra hoje`} tone="accent" />
        <Stat label="Aguardando confirmação" value={s.pending.length} sub={s.pending.length ? "Confirme pra liberar produção" : "Tudo confirmado"} tone={s.pending.length ? "bad" : "good"} />
        <Stat label="Receita do mês" value={brl(s.monthRevenue)} sub={`${s.monthOrders} pedidos · ticket ${brl(s.avgTicket)}`} tone="good" />
        <Stat label="Lucro do mês" value={brl(profit)} sub={`despesas ${brl(s.monthExpenses)}`} tone={profit >= 0 ? "good" : "bad"} />
      </div>

      {(s.lowStock.length > 0 || s.unpaid > 0 || s.reviewQueue > 0) && (
        <div className="flex flex-wrap gap-2">
          {s.unpaid > 0 && <Link to="/admin/pedidos?pagamento=pendente" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200"><AlertTriangle size={16} /> {s.unpaid} pedido(s) sem pagamento confirmado</Link>}
          {s.lowStock.length > 0 && <Link to="/admin/estoque" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200"><AlertTriangle size={16} /> Estoque baixo: {s.lowStock.map((i) => i.name).join(", ")}</Link>}
          {s.reviewQueue > 0 && <Link to="/admin/avaliacoes" className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200"><Star size={16} /> {s.reviewQueue} cliente(s) pra pedir avaliação</Link>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pedidos de hoje" action={<Link to="/admin/pedidos" className="text-sm font-semibold text-vinho-600">ver todos</Link>}>
          {s.todayOrders.length === 0 ? <Empty>Nenhum pedido pra hoje.</Empty> : (
            <ul className="divide-y divide-choco-100">
              {todayList.map(({ order: o, rank, legKm, approx }) => (
                <li key={o.id} className="flex items-center gap-2 py-2 text-sm">
                  {o.status !== "entregue" && <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-choco-900 px-1.5 text-xs font-black text-white">{rank}º</span>}
                  <Link to={`/admin/pedidos?abrir=${o.id}`} className="font-semibold hover:text-vinho-600">{o.code} · {o.customer_name}</Link>
                  <span className="text-xs text-choco-500">{o.fulfillment === "retirada" ? "retirada" : o.window_label ?? ""}{legKm !== null ? ` · ${approx ? "~" : ""}${fmtKm(legKm)}` : ""}</span>
                  <Badge className={clsx("ml-auto", STATUS_COLOR[o.status])}>{statusLabelFor(o.status, o.fulfillment)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Agenda dos próximos 7 dias" action={<Link to="/admin/agenda" className="text-sm font-semibold text-vinho-600">gerenciar</Link>}>
          {s.availability.length === 0 ? <Empty>Agenda fechada. Abra dias na aba Agenda pra receber pedidos.</Empty> : (
            <ul className="space-y-1">
              {s.availability.map((d) => (
                <li key={d.day} className="flex items-center gap-3 text-sm">
                  <span className="w-28 capitalize">{dayLabel(d.day)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-choco-100">
                    <div className="h-full bg-vinho-500" style={{ width: `${d.max_units ? Math.min(100, (d.booked_units / d.max_units) * 100) : 0}%` }} />
                  </div>
                  <span className="w-16 text-right text-choco-600">{d.booked_units}/{d.max_units}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2">Avaliações {s.reviews.length > 0 && <span className="text-sm font-medium text-choco-500">média {s.avgRating.toFixed(1)}</span>}</span>} action={<Link to="/admin/avaliacoes" className="text-sm font-semibold text-vinho-600">ver todas</Link>}>
          {s.reviews.length === 0 ? <Empty>Ainda sem avaliações.</Empty> : (
            <ul className="space-y-2">
              {s.reviews.map((r) => (
                <li key={r.id} className="text-sm"><div className="flex items-center justify-between"><b>{r.customer_name}</b><Stars value={r.rating} size={14} /></div>{r.comment && <p className="text-choco-600">“{r.comment}”</p>}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Aguardando confirmação">
          {s.pending.length === 0 ? <Empty>Nenhum pedido pendente.</Empty> : (
            <ul className="divide-y divide-choco-100">
              {s.pending.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={`/admin/pedidos?abrir=${o.id}`} className="font-semibold hover:text-vinho-600">{o.code} · {o.customer_name}</Link>
                  <span className="capitalize text-choco-500">{dayLabel(o.scheduled_date)} · {brl(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
