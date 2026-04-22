import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

const WEEKDAYS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
  { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

export function CadenceGlobalSettingsDialog({ open, onOpenChange }: Props) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("crm_settings").select("setting_value").eq("setting_key", "cadence_global_window").maybeSingle().then(({ data }) => {
      const v: any = data?.setting_value || {};
      setStart(v.window_start || "09:00");
      setEnd(v.window_end || "18:00");
      setWeekdays(v.weekdays || [1, 2, 3, 4, 5]);
    });
  }, [open]);

  const toggleDay = (d: number) => setWeekdays((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort());

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("crm_settings").upsert({
      setting_key: "cadence_global_window",
      setting_value: { window_start: start, window_end: end, weekdays, timezone: "America/Sao_Paulo" },
    }, { onConflict: "setting_key" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar");
    else { toast.success("Configuração salva"); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Janela global de envio</DialogTitle>
          <DialogDescription>Horários e dias permitidos por padrão para todas as cadências.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Início</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Fim</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Dias permitidos</Label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((d) => (
                <label key={d.v} className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={weekdays.includes(d.v)} onCheckedChange={() => toggleDay(d.v)} />
                  <span className="text-sm">{d.l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
