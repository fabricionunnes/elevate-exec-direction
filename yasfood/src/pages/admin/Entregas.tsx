import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase, friendlyError } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import { brl } from "@/lib/format";
import type { DeliveryZone } from "@/lib/types";
import { Button, Card, Input, Spinner, Empty, useToast } from "@/components/ui";

export default function Entregas() {
  const toast = useToast();
  const { settings, reload } = useSettings();
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [name, setName] = useState("");
  const [fee, setFee] = useState("0");

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
      <p className="text-sm text-choco-600">Cadastre onde você entrega e quanto cobra. O cliente escolhe a região no checkout e o frete entra sozinho no total.</p>

      <Card title="Onde entregamos">
        {zones === null ? <Spinner /> : zones.length === 0 ? <Empty>Nenhuma região. Adicione abaixo.</Empty> : (
          <ul className="divide-y divide-choco-100">
            {zones.map((z) => (
              <li key={z.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <input className="h-9 min-w-[200px] flex-1 rounded-lg border border-choco-200 px-2" defaultValue={z.name} onBlur={(e) => e.target.value !== z.name && patch(z.id, { name: e.target.value })} />
                <span className="text-choco-500">R$</span>
                <input className="h-9 w-24 rounded-lg border border-choco-200 px-2 text-right" type="number" step="0.5" defaultValue={Number(z.fee)} onBlur={(e) => Number(e.target.value) !== Number(z.fee) && patch(z.id, { fee: Number(e.target.value) })} />
                <label className="flex items-center gap-1"><input type="checkbox" checked={z.active} onChange={(e) => patch(z.id, { active: e.target.checked })} /> ativa</label>
                <button className="p-1 text-choco-400 hover:text-red-600" onClick={() => remove(z)} aria-label="Remover"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1"><Input label="Nova região" placeholder="Ex.: Condomínio Vila das Flores" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="w-28"><Input label="Frete (R$)" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" /></div>
          <Button onClick={add}><Plus size={16} /> Adicionar</Button>
        </div>
        <p className="mt-2 text-xs text-choco-500">Dica: frete 0 aparece como "frete grátis". Regiões inativas somem do checkout, mas pedidos antigos ficam.</p>
      </Card>

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
