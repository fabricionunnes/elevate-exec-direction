// Agenda e capacidade num lugar só: bolos por dia, entregas e retiradas por dia (padrão + ajuste do dia)
// e o limite de pedidos de cada horário.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { Truck, Store, CakeSlice, Clock } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { dayLabel, weekdayBR, todayISO, addDaysISO, STATUS_COLOR, statusLabelFor, hm, WEEKDAYS_SHORT } from "@/lib/format";
import type { DeliveryWindow, OrderStatus } from "@/lib/types";
import { Button, Badge, Card, Input, Spinner, Empty, useToast } from "@/components/ui";

interface DayOrder { id: string; code: string; customer_name: string; status: OrderStatus; fulfillment: "entrega" | "retirada"; scheduled_date: string; units: number }
interface DayCap { day: string; is_open: boolean; max_units: number; booked_units: number; max_entregas: number | null; entregas_padrao: boolean; entregas: number; max_retiradas: number | null; retiradas_padrao: boolean; retiradas: number }

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v))));

/** Campo de limite: vazio = sem limite (ou "usa o padrão" no dia). Salva ao sair do campo. */
function LimitInput({ value, placeholder, onSave, className }: { value: number | null; placeholder: string; onSave: (v: number | null) => void; className?: string }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => setV(value == null ? "" : String(value)), [value]);
  return (
    <input
      type="number" min={0} inputMode="numeric" placeholder={placeholder} value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = numOrNull(v); if (n !== value) onSave(n); }}
      className={clsx("h-8 w-16 rounded-lg border border-choco-200 px-2 text-center placeholder:text-choco-300", className)}
    />
  );
}

export default function Agenda() {
  const toast = useToast();
  const { settings, reload } = useSettings(true);
  const [days, setDays] = useState<DayCap[] | null>(null);
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [from, setFrom] = useState(addDaysISO(1));
  const [to, setTo] = useState(addDaysISO(30));
  const [units, setUnits] = useState(settings?.default_daily_capacity ?? 10);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<DayOrder[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { if (settings) setUnits(settings.default_daily_capacity); }, [settings]);

  const load = useCallback(async () => {
    const from = todayISO();
    const to = addDaysISO(60);
    const [{ data, error }, { data: os }, { data: ws }] = await Promise.all([
      supabase.rpc("agenda_capacity", { p_from: from, p_to: to }),
      supabase.from("orders").select("id, code, customer_name, status, fulfillment, scheduled_date, order_items(qty)").gte("scheduled_date", from).lte("scheduled_date", to).order("created_at"),
      supabase.from("delivery_windows").select("*").eq("active", true).order("start_time").order("sort_order"),
    ]);
    if (error) toast(friendlyError(error), "err");
    setDays((data as DayCap[]) ?? []);
    setWindows((ws as DeliveryWindow[]) ?? []);
    type Row = Omit<DayOrder, "units"> & { order_items: { qty: number }[] | null };
    setOrders(((os as Row[] | null) ?? []).map(({ order_items, ...o }) => ({ ...o, units: (order_items ?? []).reduce((a, i) => a + Number(i.qty), 0) })));
  }, [toast]);
  useEffect(() => {
    void load();
    const ch = supabase
      .channel("agenda-admin")
      .on("postgres_changes", { event: "*", schema: "yasfood", table: "orders" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, DayOrder[]>();
    for (const o of orders) m.set(o.scheduled_date, [...(m.get(o.scheduled_date) ?? []), o]);
    return m;
  }, [orders]);

  const saveDefault = async (patch: { cap_entregas?: number | null; cap_retiradas?: number | null }) => {
    const { error } = await supabase.from("settings").update(patch).eq("id", 1);
    if (error) return toast(friendlyError(error), "err");
    toast("Limite salvo.");
    reload();
    void load();
  };

  const saveWindowLimit = async (w: DeliveryWindow, v: number | null) => {
    const { error } = await supabase.from("delivery_windows").update({ max_orders: v && v > 0 ? v : null }).eq("id", w.id);
    if (error) return toast(friendlyError(error), "err");
    toast("Limite do horário salvo.");
    void load();
  };

  const openRange = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("open_capacity_range", { p_from: from, p_to: to, p_max_units: units, p_weekdays: weekdays, p_overwrite: overwrite });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast(`${data} dia(s) na agenda.`);
    void load();
  };

  const update = async (day: string, patch: { max_units?: number; is_open?: boolean; max_entregas?: number | null; max_retiradas?: number | null }) => {
    const { error } = await supabase.from("capacity_days").update(patch).eq("day", day);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const addSingle = async (day: string) => {
    const { error } = await supabase.from("capacity_days").upsert({ day, max_units: units, is_open: true });
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const padrao = (v: number | null | undefined) => (v == null ? "∞" : String(v));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-choco-900">Agenda e capacidade</h1>
      <p className="text-sm text-choco-600">Tudo o que limita os pedidos fica aqui: bolos por dia, entregas e retiradas por dia e pedidos por horário. O cliente só vê o que ainda tem vaga.</p>

      <Card title="Limites de todo dia">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-rosa-50 p-3">
              <Truck className="shrink-0 text-vinho-600" size={22} />
              <div className="flex-1"><div className="font-bold text-choco-900">Entregas por dia</div><div className="text-xs text-choco-500">Quantos pedidos você consegue entregar no dia. Vazio = sem limite.</div></div>
              <LimitInput value={settings?.cap_entregas ?? null} placeholder="—" onSave={(v) => void saveDefault({ cap_entregas: v })} className="h-10 w-20 text-lg font-bold" />
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-rosa-50 p-3">
              <Store className="shrink-0 text-vinho-600" size={22} />
              <div className="flex-1"><div className="font-bold text-choco-900">Retiradas por dia</div><div className="text-xs text-choco-500">Quantos pedidos podem ser retirados no dia. Vazio = sem limite.</div></div>
              <LimitInput value={settings?.cap_retiradas ?? null} placeholder="—" onSave={(v) => void saveDefault({ cap_retiradas: v })} className="h-10 w-20 text-lg font-bold" />
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-choco-50 p-3 text-sm text-choco-700">
              <CakeSlice className="shrink-0 text-vinho-600" size={22} />
              <div>Bolos por dia: em <b>Abrir dias em lote</b> ou direto em cada dia, embaixo.</div>
            </div>
            <p className="text-xs text-choco-500">Num dia diferente (feriado, encomenda grande), ajuste só aquele dia na lista embaixo. Campo vazio no dia = usa o limite de todo dia.</p>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 font-bold text-choco-900"><Clock size={18} /> Pedidos por horário</div>
            {windows.length === 0 ? <Empty>Nenhum horário ativo. Cadastre em <Link className="font-semibold text-vinho-700 underline" to="/admin/entregas">Entregas</Link>.</Empty> : (
              <ul className="divide-y divide-choco-100 rounded-2xl border border-choco-100 bg-white">
                {windows.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{hm(w.start_time)}–{hm(w.end_time)} {w.label && <span className="font-normal text-choco-600">· {w.label}</span>}</div>
                      <div className="text-xs text-choco-500">{w.applies_to === "ambos" ? "entrega e retirada" : w.applies_to === "entrega" ? "só entrega" : "só retirada"} · {w.weekdays.map((d) => WEEKDAYS_SHORT[d]).join(", ")}</div>
                    </div>
                    <span className="text-xs text-choco-500">até</span>
                    <LimitInput value={w.max_orders} placeholder="∞" onSave={(v) => void saveWindowLimit(w, v)} />
                    <span className="text-xs text-choco-500">pedidos</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-choco-500">Horário cheio some do site. Os horários (início, fim, antecedência) ficam em <Link className="font-semibold text-vinho-700 underline" to="/admin/entregas">Entregas</Link>.</p>
          </div>
        </div>
      </Card>

      <Card title="Abrir dias em lote">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input label="Bolos por dia" type="number" min={0} value={units} onChange={(e) => setUnits(Number(e.target.value))} />
          <div>
            <span className="mb-1 block text-sm font-medium text-choco-800">Dias da semana</span>
            <div className="flex gap-1">
              {WD.map((l, i) => (
                <button key={i} onClick={() => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))} className={clsx("h-9 w-9 rounded-full text-sm font-bold", weekdays.includes(i) ? "bg-vinho-600 text-white" : "bg-choco-100 text-choco-600")}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> sobrescrever dias já abertos</label>
          <Button loading={busy} onClick={openRange}>Abrir agenda</Button>
        </div>
      </Card>

      <Card title="Próximos 60 dias" action={<Button size="sm" variant="outline" onClick={() => { const d = prompt("Data (AAAA-MM-DD):", addDaysISO(1)); if (d) void addSingle(d); }}>+ dia avulso</Button>}>
        {days === null ? <Spinner /> : days.length === 0 ? <Empty>Nenhum dia aberto. Use "Abrir agenda" acima.</Empty> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((d) => {
              const remaining = Math.max(0, d.max_units - d.booked_units);
              const pct = d.max_units ? Math.min(100, (d.booked_units / d.max_units) * 100) : 0;
              const list = byDay.get(d.day) ?? [];
              const active = list.filter((o) => o.status !== "cancelado");
              const cancelled = list.length - active.length;
              const open = expanded === d.day;
              const full = (n: number, lim: number | null) => lim != null && n >= lim;
              return (
                <div key={d.day} className={clsx("rounded-2xl border p-3", d.is_open ? "border-choco-100 bg-white" : "border-dashed border-choco-200 bg-choco-50 opacity-70")}>
                  <div className="flex items-center justify-between">
                    <div><div className="font-bold capitalize">{dayLabel(d.day)}</div><div className="text-xs capitalize text-choco-500">{weekdayBR(d.day)}</div></div>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.is_open} onChange={(e) => update(d.day, { is_open: e.target.checked })} /> aberto</label>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <CakeSlice size={14} className="text-choco-400" />
                    <span className="text-choco-600">{d.booked_units} de</span>
                    <input type="number" min={d.booked_units} className="h-8 w-16 rounded-lg border border-choco-200 px-2 text-center" defaultValue={d.max_units} key={`${d.day}-${d.max_units}`} onBlur={(e) => Number(e.target.value) !== d.max_units && update(d.day, { max_units: Number(e.target.value) })} />
                    <span className="text-choco-600">bolos</span>
                    <span className={clsx("ml-auto text-xs font-bold", remaining === 0 ? "text-red-600" : "text-emerald-700")}>{remaining} livre(s)</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-choco-100"><div className={clsx("h-full", pct >= 100 ? "bg-red-500" : "bg-vinho-500")} style={{ width: `${pct}%` }} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className={clsx("flex items-center gap-1 rounded-xl px-2 py-1", full(d.entregas, d.max_entregas) ? "bg-red-50 text-red-700" : "bg-choco-50 text-choco-700")}>
                      <Truck size={13} /> <b>{d.entregas}</b> de
                      <LimitInput value={d.entregas_padrao ? null : d.max_entregas} placeholder={padrao(settings?.cap_entregas)} onSave={(v) => void update(d.day, { max_entregas: v })} className="h-7 w-12 text-xs" />
                    </div>
                    <div className={clsx("flex items-center gap-1 rounded-xl px-2 py-1", full(d.retiradas, d.max_retiradas) ? "bg-red-50 text-red-700" : "bg-choco-50 text-choco-700")}>
                      <Store size={13} /> <b>{d.retiradas}</b> de
                      <LimitInput value={d.retiradas_padrao ? null : d.max_retiradas} placeholder={padrao(settings?.cap_retiradas)} onSave={(v) => void update(d.day, { max_retiradas: v })} className="h-7 w-12 text-xs" />
                    </div>
                  </div>
                  {list.length > 0 && (
                    <button type="button" onClick={() => setExpanded(open ? null : d.day)} className="mt-2 w-full text-left text-xs text-choco-600 underline-offset-2 hover:underline">
                      {active.length} pedido(s) contando{cancelled > 0 && <span className="text-choco-400"> · {cancelled} cancelado(s) fora da conta</span>}{open ? " ▴" : " ▾"}
                    </button>
                  )}
                  {open && (
                    <ul className="mt-2 space-y-1 border-t border-choco-100 pt-2 text-xs">
                      {list.map((o) => (
                        <li key={o.id} className={clsx("flex items-center gap-2", o.status === "cancelado" && "line-through opacity-50")}>
                          <Link to={`/admin/pedidos?abrir=${o.id}`} className="font-bold text-vinho-700">{o.code}</Link>
                          <span className="truncate">{o.customer_name}</span>
                          <span className="ml-auto whitespace-nowrap font-semibold">{o.units} bolo(s) · {o.fulfillment === "entrega" ? "entrega" : "retirada"}</span>
                          <Badge className={STATUS_COLOR[o.status]}>{statusLabelFor(o.status, o.fulfillment)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
