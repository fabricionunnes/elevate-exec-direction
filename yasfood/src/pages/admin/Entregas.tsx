import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Clock, MapPin } from "lucide-react";
import { clsx } from "clsx";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl, hm, leadLabel, WEEKDAYS_SHORT } from "@/lib/format";
import type { DeliveryZone, DeliveryWindow } from "@/lib/types";
import { Button, Card, Input, Select, Modal, Spinner, Empty, useToast } from "@/components/ui";
import { geocodePlace, hasCoords, mapsPin } from "@/lib/route";

export default function Entregas() {
  const toast = useToast();
  const { settings, reload } = useSettings(true);
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("0");
  const [windows, setWindows] = useState<DeliveryWindow[] | null>(null);
  const [editingWin, setEditingWin] = useState<Partial<DeliveryWindow> | null>(null);
  const [busyWin, setBusyWin] = useState(false);

  const loadWindows = useCallback(async () => {
    const { data } = await supabase.from("delivery_windows").select("*").order("start_time").order("sort_order");
    setWindows((data as DeliveryWindow[]) ?? []);
  }, []);
  useEffect(() => { void loadWindows(); }, [loadWindows]);

  const saveWindow = async () => {
    if (!editingWin?.start_time || !editingWin.end_time) return toast("Informe início e fim.", "err");
    if (editingWin.end_time <= editingWin.start_time) return toast("O fim precisa ser depois do início.", "err");
    if (!editingWin.weekdays?.length) return toast("Escolha pelo menos um dia da semana.", "err");
    setBusyWin(true);
    const { id, ...rest } = editingWin;
    const payload = { label: rest.label ?? "", start_time: rest.start_time, end_time: rest.end_time, weekdays: rest.weekdays, min_lead_minutes: rest.min_lead_minutes ?? 120, applies_to: rest.applies_to ?? "ambos", active: rest.active ?? true, sort_order: rest.sort_order ?? 0 };
    const { error } = id ? await supabase.from("delivery_windows").update(payload).eq("id", id) : await supabase.from("delivery_windows").insert(payload);
    setBusyWin(false);
    if (error) return toast(friendlyError(error), "err");
    toast("Horário salvo.");
    setEditingWin(null);
    void loadWindows();
  };
  const removeWindow = async (w: DeliveryWindow) => {
    if (!confirm(`Remover o horário ${hm(w.start_time)}–${hm(w.end_time)}?`)) return;
    await supabase.from("delivery_windows").delete().eq("id", w.id);
    void loadWindows();
  };
  const toggleWindow = async (w: DeliveryWindow) => { await supabase.from("delivery_windows").update({ active: !w.active }).eq("id", w.id); void loadWindows(); };

  const load = useCallback(async () => {
    const { data } = await supabase.from("delivery_zones").select("*").order("sort_order").order("name");
    setZones((data as DeliveryZone[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("delivery_zones").insert({ name: name.trim(), fee: Number(fee.replace(",", ".")) || 0, sort_order: (zones?.length ?? 0) + 1 });
    if (error) return toast(friendlyError(error), "err");
    setName(""); setFee("0");
    void load();
  };

  const patch = async (id: string, p: Partial<DeliveryZone>) => {
    const { error } = await supabase.from("delivery_zones").update(p).eq("id", id);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const [locatingZone, setLocatingZone] = useState<string | null>(null);
  const locateZone = async (z: DeliveryZone) => {
    setLocatingZone(z.id);
    const bias = settings && hasCoords({ lat: settings.origin_lat, lng: settings.origin_lng }) ? { lat: settings.origin_lat as number, lng: settings.origin_lng as number } : null;
    const p = await geocodePlace(`${z.name}, Nova Lima, MG`, bias).catch(() => null);
    setLocatingZone(null);
    if (!p) return toast(`Não achei "${z.name}" no mapa. Use um nome de condomínio ou bairro reconhecível.`, "err");
    await patch(z.id, { lat: p.lat, lng: p.lng });
    toast("Localização da região salva.");
  };

  const remove = async (z: DeliveryZone) => {
    if (!confirm(`Remover "${z.name}"?`)) return;
    const { error } = await supabase.from("delivery_zones").delete().eq("id", z.id);
    if (error) return toast(friendlyError(error), "err");
    void load();
  };

  const patchSettings = async (p: Record<string, unknown>) => {
    const { error } = await supabase.from("settings").update(p).eq("id", 1);
    if (error) return toast(friendlyError(error), "err");
    void reload();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-choco-900">Entregas e frete</h1>
      <p className="text-sm text-choco-600">Cadastre cada condomínio ou região do Alphaville onde você entrega e quanto cobra. O cliente escolhe no checkout e o frete entra sozinho no total.</p>

      <Card title="Onde entregamos">
        {zones === null ? <Spinner /> : zones.length === 0 ? <Empty>Nenhuma região. Adicione abaixo.</Empty> : (
          <ul className="divide-y divide-choco-100">
            {zones.map((z) => (
              <li key={z.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <input className="h-9 min-w-[200px] flex-1 rounded-lg border border-choco-200 px-2" defaultValue={z.name} onBlur={(e) => e.target.value !== z.name && patch(z.id, { name: e.target.value })} />
                <span className="text-choco-500">R$</span>
                <input className="h-9 w-24 rounded-lg border border-choco-200 px-2 text-right" type="number" step="0.5" defaultValue={Number(z.fee)} onBlur={(e) => Number(e.target.value) !== Number(z.fee) && patch(z.id, { fee: Number(e.target.value) })} />
                <label className="flex items-center gap-1"><input type="checkbox" checked={z.active} onChange={(e) => patch(z.id, { active: e.target.checked })} /> ativa</label>
                {hasCoords(z)
                  ? <a href={mapsPin(z)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" title="Conferir no mapa"><MapPin size={14} /> no mapa</a>
                  : <Button size="sm" variant="ghost" loading={locatingZone === z.id} onClick={() => locateZone(z)}><MapPin size={14} /> Localizar</Button>}
                <button className="p-1 text-choco-400 hover:text-red-600" onClick={() => remove(z)} aria-label="Remover"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1"><Input label="Nova região" placeholder="Ex.: Alphaville Lagoa dos Ingleses" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="w-28"><Input label="Frete (R$)" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" /></div>
          <Button onClick={add}><Plus size={16} /> Adicionar</Button>
        </div>
        <p className="mt-2 text-xs text-choco-500">Dica: frete 0 aparece como "frete grátis". Regiões inativas somem do checkout, mas pedidos antigos ficam. "Localizar" marca a região no mapa: serve de referência pra rota quando o endereço exato do cliente não é encontrado.</p>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Clock size={18} /> Horários de entrega e retirada</span>} action={<Button size="sm" onClick={() => setEditingWin({ label: "", start_time: "14:00", end_time: "17:00", weekdays: [1, 2, 3, 4, 5, 6], min_lead_minutes: 120, applies_to: "ambos", active: true, sort_order: (windows?.length ?? 0) + 1 })}><Plus size={14} /> Novo horário</Button>}>
        <p className="mb-3 text-sm text-choco-600">O cliente escolhe a data e depois um desses horários. Cada horário tem sua antecedência: "pedir até 2h antes" some da tela quando passa do prazo. Sem horário cadastrado pro dia, o cliente só escolhe a data.</p>
        {windows === null ? <Spinner /> : windows.length === 0 ? <Empty>Nenhum horário. Sem horários, o cliente escolhe só a data.</Empty> : (
          <ul className="divide-y divide-choco-100">
            {windows.map((w) => (
              <li key={w.id} className={clsx("flex flex-wrap items-center gap-2 py-2 text-sm", !w.active && "opacity-50")}>
                <span className="w-28 font-bold">{hm(w.start_time)}–{hm(w.end_time)}</span>
                <span className="text-choco-600">{w.label}</span>
                <span className="flex gap-1">{[0, 1, 2, 3, 4, 5, 6].map((d) => <span key={d} className={clsx("rounded px-1 text-[10px] font-bold uppercase", w.weekdays.includes(d) ? "bg-vinho-600 text-white" : "bg-choco-100 text-choco-400")}>{WEEKDAYS_SHORT[d]}</span>)}</span>
                <span className="text-xs text-choco-500">pedir até {leadLabel(w.min_lead_minutes)} antes · {w.applies_to === "ambos" ? "entrega e retirada" : w.applies_to}</span>
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditingWin(w)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleWindow(w)}>{w.active ? "Desativar" : "Ativar"}</Button>
                  <button className="p-1 text-choco-400 hover:text-red-600" onClick={() => removeWindow(w)} aria-label="Remover"><Trash2 size={16} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editingWin && (
        <Modal open onClose={() => setEditingWin(null)} title={editingWin.id ? "Editar horário" : "Novo horário"}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <Input label="Início" type="time" value={hm(editingWin.start_time ?? "14:00")} onChange={(e) => setEditingWin({ ...editingWin, start_time: e.target.value })} />
              <Input label="Fim" type="time" value={hm(editingWin.end_time ?? "17:00")} onChange={(e) => setEditingWin({ ...editingWin, end_time: e.target.value })} />
              <Input label="Nome (opcional)" value={editingWin.label ?? ""} onChange={(e) => setEditingWin({ ...editingWin, label: e.target.value })} placeholder="Tarde" />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-choco-800">Dias da semana</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <button key={d} type="button" onClick={() => setEditingWin({ ...editingWin, weekdays: editingWin.weekdays?.includes(d) ? editingWin.weekdays.filter((x) => x !== d) : [...(editingWin.weekdays ?? []), d] })} className={clsx("h-9 w-11 rounded-full text-xs font-bold uppercase", editingWin.weekdays?.includes(d) ? "bg-vinho-600 text-white" : "bg-choco-100 text-choco-600")}>{WEEKDAYS_SHORT[d]}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Pedir até… antes do início" value={String(editingWin.min_lead_minutes ?? 120)} onChange={(e) => setEditingWin({ ...editingWin, min_lead_minutes: Number(e.target.value) })}>
                {[30, 60, 90, 120, 180, 240, 360, 720, 1440, 2880].map((m) => <option key={m} value={m}>{leadLabel(m)}</option>)}
              </Select>
              <Select label="Vale pra" value={editingWin.applies_to ?? "ambos"} onChange={(e) => setEditingWin({ ...editingWin, applies_to: e.target.value as DeliveryWindow["applies_to"] })}>
                <option value="ambos">Entrega e retirada</option><option value="entrega">Só entrega</option><option value="retirada">Só retirada</option>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingWin.active ?? true} onChange={(e) => setEditingWin({ ...editingWin, active: e.target.checked })} /> ativo</label>
            <Button className="w-full" loading={busyWin} onClick={saveWindow}>Salvar horário</Button>
          </div>
        </Modal>
      )}

      {settings && (
        <Card title="Retirada">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.pickup_enabled} onChange={(e) => patchSettings({ pickup_enabled: e.target.checked })} /> permitir retirada</label>
          <div className="mt-2"><Input label="Instruções de retirada (o cliente vê no pedido)" defaultValue={settings.pickup_address} onBlur={(e) => e.target.value !== settings.pickup_address && patchSettings({ pickup_address: e.target.value })} /></div>
        </Card>
      )}

      {zones && zones.length > 0 && (
        <Card title="Resumo pro cliente">
          <ul className="text-sm">{zones.filter((z) => z.active).map((z) => <li key={z.id}>• {z.name}: {Number(z.fee) === 0 ? "frete grátis" : brl(z.fee)}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}
