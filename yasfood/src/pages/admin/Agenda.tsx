import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { dayLabel, weekdayBR, todayISO, addDaysISO } from "@/lib/format";
import type { Availability } from "@/lib/types";
import { Button, Card, Input, Spinner, Empty, useToast } from "@/components/ui";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function Agenda() {
  const toast = useToast();
  const { settings } = useSettings();
  const [days, setDays] = useState<Availability[] | null>(null);
  const [from, setFrom] = useState(addDaysISO(1));
  const [to, setTo] = useState(addDaysISO(30));
  const [units, setUnits] = useState(settings?.default_daily_capacity ?? 10);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (settings) setUnits(settings.default_daily_capacity); }, [settings]);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("availability", { p_from: todayISO(), p_to: addDaysISO(60) });
    setDays((data as Availability[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openRange = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("open_capacity_range", { p_from: from, p_to: to, p_max_units: units, p_weekdays: weekdays, p_overwrite: overwrite });
    setBusy(false);
    if (error) return toast(friendlyError(error), "err");
    toast(`${data} dia(s) na agenda.`);
    void load();
  };

  const update = async (day: string, patch: { max_units?: number; is_open?: boolean }) => {
    const { error } = await supabase.from("capacity_days").update(patch).eq("day", day);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const addSingle = async (day: string) => {
    const { error } = await supabase.from("capacity_days").upsert({ day, max_units: units, is_open: true });
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-choco-900">Agenda de produção</h1>
      <p className="text-sm text-choco-600">Você define quantos bolos consegue fazer por dia. O cliente só vê dias abertos com vaga.</p>

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

      <Card title="Próximos 60 dias" action={<Button size="sm" variant="outline" onClick={() => addSingle(prompt("Data (AAAA-MM-DD):", addDaysISO(1)) ?? "")}>+ dia avulso</Button>}>
        {days === null ? <Spinner /> : days.length === 0 ? <Empty>Nenhum dia aberto. Use "Abrir agenda" acima.</Empty> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {days.map((d) => {
              const pct = d.max_units ? Math.min(100, (d.booked_units / d.max_units) * 100) : 0;
              return (
                <div key={d.day} className={clsx("rounded-2xl border p-3", d.is_open ? "border-choco-100 bg-white" : "border-dashed border-choco-200 bg-choco-50 opacity-70")}>
                  <div className="flex items-center justify-between">
                    <div><div className="font-bold capitalize">{dayLabel(d.day)}</div><div className="text-xs capitalize text-choco-500">{weekdayBR(d.day)}</div></div>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={d.is_open} onChange={(e) => update(d.day, { is_open: e.target.checked })} /> aberto</label>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-choco-600">{d.booked_units} de</span>
                    <input type="number" min={d.booked_units} className="h-8 w-16 rounded-lg border border-choco-200 px-2 text-center" defaultValue={d.max_units} onBlur={(e) => Number(e.target.value) !== d.max_units && update(d.day, { max_units: Number(e.target.value) })} />
                    <span className="text-choco-600">bolos</span>
                    <span className={clsx("ml-auto text-xs font-bold", d.remaining === 0 ? "text-red-600" : "text-emerald-700")}>{d.remaining} livre(s)</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-choco-100"><div className={clsx("h-full", pct >= 100 ? "bg-red-500" : "bg-vinho-500")} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
