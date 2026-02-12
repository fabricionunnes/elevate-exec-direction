import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { AppointmentSettings } from "./types";

interface Props { projectId: string; canEdit: boolean; }

export function AppointmentSettingsPanel({ projectId, canEdit }: Props) {
  const [settings, setSettings] = useState<AppointmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    business_name: "",
    slot_interval_minutes: "30",
    allow_overlap: false,
    working_hours_start: "08:00",
    working_hours_end: "20:00",
  });

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("appointment_settings").select("*").eq("project_id", projectId).maybeSingle();
    const s = data as AppointmentSettings | null;
    setSettings(s);
    if (s) {
      setForm({
        business_name: s.business_name || "",
        slot_interval_minutes: String(s.slot_interval_minutes),
        allow_overlap: s.allow_overlap,
        working_hours_start: s.working_hours_start || "08:00",
        working_hours_end: s.working_hours_end || "20:00",
      });
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSave = async () => {
    const payload: any = {
      business_name: form.business_name || null,
      slot_interval_minutes: parseInt(form.slot_interval_minutes) || 30,
      allow_overlap: form.allow_overlap,
      working_hours_start: form.working_hours_start,
      working_hours_end: form.working_hours_end,
    };

    if (settings) {
      const { error } = await supabase.from("appointment_settings").update(payload).eq("id", settings.id);
      if (error) { toast.error("Erro ao salvar"); return; }
    } else {
      const { error } = await supabase.from("appointment_settings").insert({ ...payload, project_id: projectId });
      if (error) { toast.error("Erro ao salvar"); return; }
    }
    toast.success("Configurações salvas");
    fetch();
  };

  if (loading) return <div className="text-center py-10 text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Configurações do Módulo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Nome do negócio</Label><Input value={form.business_name} onChange={(e) => setForm(p => ({ ...p, business_name: e.target.value }))} disabled={!canEdit} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Intervalo entre horários (min)</Label><Input type="number" value={form.slot_interval_minutes} onChange={(e) => setForm(p => ({ ...p, slot_interval_minutes: e.target.value }))} disabled={!canEdit} /></div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.allow_overlap} onCheckedChange={(v) => setForm(p => ({ ...p, allow_overlap: v }))} disabled={!canEdit} />
            <Label>Permitir sobreposição</Label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Horário de início</Label><Input type="time" value={form.working_hours_start} onChange={(e) => setForm(p => ({ ...p, working_hours_start: e.target.value }))} disabled={!canEdit} /></div>
          <div><Label>Horário de encerramento</Label><Input type="time" value={form.working_hours_end} onChange={(e) => setForm(p => ({ ...p, working_hours_end: e.target.value }))} disabled={!canEdit} /></div>
        </div>
        {canEdit && <Button onClick={handleSave}>Salvar Configurações</Button>}
      </CardContent>
    </Card>
  );
}
