import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronLeft, ChevronRight, Clock, User, Scissors } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment, AppointmentClient, AppointmentService, AppointmentProfessional, AppointmentResource } from "./types";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from "./types";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week" | "month";

interface Props { projectId: string; canEdit: boolean; }

export function AppointmentAgendaPanel({ projectId, canEdit }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<AppointmentClient[]>([]);
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [professionals, setProfessionals] = useState<AppointmentProfessional[]>([]);
  const [resources, setResources] = useState<AppointmentResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const [form, setForm] = useState({
    client_id: "", service_id: "", professional_id: "", resource_id: "",
    date: format(new Date(), "yyyy-MM-dd"), start_time: "09:00",
    duration_minutes: "60", price: "0", notes: "", status: "scheduled",
  });

  const dateRange = useMemo(() => {
    if (viewMode === "day") return { start: currentDate, end: currentDate };
    if (viewMode === "week") return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  }, [currentDate, viewMode]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const startStr = format(dateRange.start, "yyyy-MM-dd") + "T00:00:00";
    const endStr = format(dateRange.end, "yyyy-MM-dd") + "T23:59:59";

    const [{ data: apts }, { data: cls }, { data: svcs }, { data: profs }, { data: ress }] = await Promise.all([
      supabase.from("appointments").select("*, client:appointment_clients(*), service:appointment_services(*), professional:appointment_professionals(*), resource:appointment_resources(*)").eq("project_id", projectId).gte("start_time", startStr).lte("start_time", endStr).order("start_time"),
      supabase.from("appointment_clients").select("*").eq("project_id", projectId).eq("is_active", true).order("full_name"),
      supabase.from("appointment_services").select("*").eq("project_id", projectId).eq("is_active", true).order("name"),
      supabase.from("appointment_professionals").select("*").eq("project_id", projectId).eq("is_active", true).order("name"),
      supabase.from("appointment_resources").select("*").eq("project_id", projectId).eq("is_active", true).order("name"),
    ]);
    setAppointments((apts as any[]) || []);
    setClients((cls as any[]) || []);
    setServices((svcs as any[]) || []);
    setProfessionals((profs as any[]) || []);
    setResources((ress as any[]) || []);
    setLoading(false);
  }, [projectId, dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const navigate = (dir: number) => {
    if (viewMode === "day") setCurrentDate(d => addDays(d, dir));
    else if (viewMode === "week") setCurrentDate(d => addDays(d, dir * 7));
    else setCurrentDate(d => addMonths(d, dir));
  };

  const resetForm = () => {
    setForm({ client_id: "", service_id: "", professional_id: "", resource_id: "", date: format(new Date(), "yyyy-MM-dd"), start_time: "09:00", duration_minutes: "60", price: "0", notes: "", status: "scheduled" });
  };

  const handleServiceSelect = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    setForm(p => ({
      ...p,
      service_id: serviceId,
      duration_minutes: svc ? String(svc.duration_minutes) : p.duration_minutes,
      price: svc ? String(svc.price) : p.price,
    }));
  };

  const checkConflicts = async (): Promise<boolean> => {
    const startTime = `${form.date}T${form.start_time}:00`;
    const endDate = new Date(startTime);
    endDate.setMinutes(endDate.getMinutes() + parseInt(form.duration_minutes));
    const endTime = endDate.toISOString();

    // Check professional conflict
    if (form.professional_id) {
      const { data } = await supabase.from("appointments").select("id")
        .eq("professional_id", form.professional_id)
        .neq("status", "cancelled")
        .lt("start_time", endTime)
        .gt("end_time", startTime);
      if (data && data.length > 0) {
        toast.error("Conflito: profissional já tem agendamento neste horário");
        return true;
      }
    }

    // Check resource conflict
    if (form.resource_id) {
      const { data } = await supabase.from("appointments").select("id")
        .eq("resource_id", form.resource_id)
        .neq("status", "cancelled")
        .lt("start_time", endTime)
        .gt("end_time", startTime);
      if (data && data.length > 0) {
        toast.error("Conflito: recurso já está em uso neste horário");
        return true;
      }
    }
    return false;
  };

  const handleSave = async () => {
    if (!form.client_id || !form.service_id) { toast.error("Cliente e serviço são obrigatórios"); return; }
    
    const hasConflict = await checkConflicts();
    if (hasConflict) return;

    const startTime = `${form.date}T${form.start_time}:00`;
    const endDate = new Date(startTime);
    endDate.setMinutes(endDate.getMinutes() + parseInt(form.duration_minutes));

    const payload = {
      project_id: projectId,
      client_id: form.client_id,
      service_id: form.service_id,
      professional_id: form.professional_id || null,
      resource_id: form.resource_id || null,
      start_time: startTime,
      end_time: endDate.toISOString(),
      duration_minutes: parseInt(form.duration_minutes),
      price: parseFloat(form.price) || 0,
      notes: form.notes || null,
      status: form.status,
    };

    const { error } = await supabase.from("appointments").insert(payload);
    if (error) { toast.error("Erro ao criar agendamento"); console.error(error); return; }

    toast.success("Agendamento criado");
    resetForm();
    setDialogOpen(false);
    fetchAll();
  };

  const handleStatusChange = async (apt: Appointment, newStatus: string) => {
    const updatePayload: any = { status: newStatus };
    if (newStatus === "cancelled") updatePayload.cancellation_reason = "Cancelado pelo usuário";
    
    const { error } = await supabase.from("appointments").update(updatePayload).eq("id", apt.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success("Status atualizado");
    setDetailOpen(false);
    fetchAll();
  };

  // Generate week days for week view
  const weekDays = useMemo(() => {
    if (viewMode !== "week") return [];
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate, viewMode]);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.start_time), day));

  const headerLabel = useMemo(() => {
    if (viewMode === "day") return format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    if (viewMode === "week") return `${format(dateRange.start, "dd/MM")} - ${format(dateRange.end, "dd/MM/yyyy")}`;
    return format(currentDate, "MMMM yyyy", { locale: ptBR });
  }, [currentDate, viewMode, dateRange]);

  const renderAppointmentCard = (apt: Appointment) => (
    <div
      key={apt.id}
      className={cn(
        "p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:shadow-sm transition-shadow",
        apt.status === "attended" ? "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10" :
        apt.status === "confirmed" ? "border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10" :
        apt.status === "cancelled" ? "border-l-red-500 bg-red-50/50 dark:bg-red-900/10 opacity-60" :
        apt.status === "no_show" ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10" :
        "border-l-primary bg-primary/5"
      )}
      onClick={() => { setSelectedAppointment(apt); setDetailOpen(true); }}
    >
      <div className="flex items-center gap-1 font-medium">
        <Clock className="h-3 w-3" />
        {format(parseISO(apt.start_time), "HH:mm")} - {format(parseISO(apt.end_time), "HH:mm")}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="truncate">{(apt.client as any)?.full_name}</span>
      </div>
      <div className="flex items-center gap-1">
        <Scissors className="h-3 w-3 text-muted-foreground" />
        <span className="truncate">{(apt.service as any)?.name}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium min-w-[200px] text-center capitalize">{headerLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            {(["day", "week", "month"] as ViewMode[]).map(m => (
              <button key={m} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => setViewMode(m)}>
                {m === "day" ? "Dia" : m === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Agendar</Button>
          )}
        </div>
      </div>

      {/* Calendar Views */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : viewMode === "day" ? (
        <div className="space-y-2">
          {getAppointmentsForDay(currentDate).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum agendamento para este dia</CardContent></Card>
          ) : getAppointmentsForDay(currentDate).map(renderAppointmentCard)}
        </div>
      ) : viewMode === "week" ? (
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div key={day.toISOString()} className="min-h-[120px]">
              <div className={cn("text-xs font-medium text-center p-1 rounded-t-lg", isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <div>{format(day, "EEE", { locale: ptBR })}</div>
                <div className="text-lg">{format(day, "dd")}</div>
              </div>
              <div className="space-y-1 p-1 border border-t-0 rounded-b-lg min-h-[80px]">
                {getAppointmentsForDay(day).map(renderAppointmentCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Month view - simple list grouped by day
        <div className="space-y-3">
          {(() => {
            const days = new Map<string, Appointment[]>();
            appointments.forEach(a => {
              const key = format(parseISO(a.start_time), "yyyy-MM-dd");
              if (!days.has(key)) days.set(key, []);
              days.get(key)!.push(a);
            });
            const sortedDays = Array.from(days.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            if (sortedDays.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum agendamento neste mês</CardContent></Card>;
            return sortedDays.map(([dateKey, dayApts]) => (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-muted-foreground mb-1 capitalize">
                  {format(parseISO(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{dayApts.map(renderAppointmentCard)}</div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* New Appointment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Agendamento</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm(p => ({ ...p, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Serviço *</Label>
              <Select value={form.service_id} onValueChange={handleServiceSelect}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min - R${Number(s.price).toFixed(2)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Profissional</Label>
              <Select value={form.professional_id} onValueChange={(v) => setForm(p => ({ ...p, professional_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>{professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Recurso (sala/equip.)</Label>
              <Select value={form.resource_id} onValueChange={(v) => setForm(p => ({ ...p, resource_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>{resources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div><Label>Horário</Label><Input type="time" value={form.start_time} onChange={(e) => setForm(p => ({ ...p, start_time: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm(p => ({ ...p, duration_minutes: e.target.value }))} /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleSave} className="w-full">Criar Agendamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes do Agendamento</DialogTitle></DialogHeader>
          {selectedAppointment && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{(selectedAppointment.client as any)?.full_name}</p></div>
                <div><span className="text-muted-foreground">Serviço:</span><p className="font-medium">{(selectedAppointment.service as any)?.name}</p></div>
                <div><span className="text-muted-foreground">Profissional:</span><p className="font-medium">{(selectedAppointment.professional as any)?.name || "—"}</p></div>
                <div><span className="text-muted-foreground">Recurso:</span><p className="font-medium">{(selectedAppointment.resource as any)?.name || "—"}</p></div>
                <div><span className="text-muted-foreground">Data/Hora:</span><p className="font-medium">{format(parseISO(selectedAppointment.start_time), "dd/MM/yyyy HH:mm")}</p></div>
                <div><span className="text-muted-foreground">Duração:</span><p className="font-medium">{selectedAppointment.duration_minutes}min</p></div>
                <div><span className="text-muted-foreground">Valor:</span><p className="font-medium">R$ {Number(selectedAppointment.price).toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Status:</span>
                  <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", APPOINTMENT_STATUS_COLORS[selectedAppointment.status])}>
                    {APPOINTMENT_STATUS_LABELS[selectedAppointment.status]}
                  </span>
                </div>
              </div>
              {selectedAppointment.notes && <div className="text-sm"><span className="text-muted-foreground">Obs:</span><p>{selectedAppointment.notes}</p></div>}
              
              {canEdit && selectedAppointment.status !== "cancelled" && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {selectedAppointment.status === "scheduled" && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedAppointment, "confirmed")}>Confirmar</Button>
                  )}
                  {(selectedAppointment.status === "scheduled" || selectedAppointment.status === "confirmed") && (
                    <>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusChange(selectedAppointment, "attended")}>Atendido</Button>
                      <Button size="sm" variant="outline" className="text-amber-600" onClick={() => handleStatusChange(selectedAppointment, "no_show")}>Falta</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange(selectedAppointment, "cancelled")}>Cancelar</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
