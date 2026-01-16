import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Plus, CalendarIcon, Clock, Users, Target, Coffee, Briefcase, Video } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AgendaEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  objective: string | null;
  attendees: string[] | null;
  observations: string | null;
}

const EVENT_TYPES = [
  { value: "reuniao_estrategica", label: "Reunião Estratégica", icon: Target, color: "bg-purple-500" },
  { value: "reuniao_cliente", label: "Reunião com Cliente", icon: Briefcase, color: "bg-blue-500" },
  { value: "reuniao_interna", label: "Reunião Interna", icon: Users, color: "bg-green-500" },
  { value: "evento", label: "Evento", icon: Video, color: "bg-orange-500" },
  { value: "tempo_foco", label: "Tempo de Foco", icon: Coffee, color: "bg-gray-500" },
];

export function CEOAgenda() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [formData, setFormData] = useState({
    title: "",
    date: new Date(),
    start_time: "09:00",
    end_time: "10:00",
    event_type: "",
    objective: "",
    attendees: "",
    observations: "",
  });

  const fetchEvents = async () => {
    try {
      let startDate: Date;
      let endDate: Date;

      switch (viewMode) {
        case "day":
          startDate = startOfDay(selectedDate);
          endDate = endOfDay(selectedDate);
          break;
        case "week":
          startDate = startOfWeek(selectedDate, { locale: ptBR });
          endDate = endOfWeek(selectedDate, { locale: ptBR });
          break;
        case "month":
          startDate = startOfMonth(selectedDate);
          endDate = endOfMonth(selectedDate);
          break;
      }

      const { data, error } = await supabase
        .from("ceo_agenda")
        .select("*")
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching agenda:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedDate, viewMode]);

  const handleSubmit = async () => {
    if (!formData.title || !formData.event_type) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      const startDateTime = new Date(formData.date);
      const [startHour, startMin] = formData.start_time.split(":");
      startDateTime.setHours(Number(startHour), Number(startMin));

      const endDateTime = new Date(formData.date);
      const [endHour, endMin] = formData.end_time.split(":");
      endDateTime.setHours(Number(endHour), Number(endMin));

      const { error } = await supabase.from("ceo_agenda").insert({
        title: formData.title,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        event_type: formData.event_type,
        objective: formData.objective || null,
        attendees: formData.attendees ? formData.attendees.split(",").map(a => a.trim()) : null,
        observations: formData.observations || null,
      });

      if (error) throw error;

      toast.success("Evento criado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        title: "",
        date: new Date(),
        start_time: "09:00",
        end_time: "10:00",
        event_type: "",
        objective: "",
        attendees: "",
        observations: "",
      });
      fetchEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Erro ao criar evento");
    }
  };

  const getEventTypeConfig = (type: string) => EVENT_TYPES.find(t => t.value === type);

  const renderEvent = (event: AgendaEvent) => {
    const typeConfig = getEventTypeConfig(event.event_type);
    const Icon = typeConfig?.icon || CalendarIcon;

    return (
      <div
        key={event.id}
        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg text-white", typeConfig?.color || "bg-gray-500")}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{event.title}</h4>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {format(new Date(event.start_time), "HH:mm")}
                {event.end_time && ` - ${format(new Date(event.end_time), "HH:mm")}`}
              </span>
            </div>
            {event.objective && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {event.objective}
              </p>
            )}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {event.attendees.slice(0, 3).join(", ")}
                  {event.attendees.length > 3 && ` +${event.attendees.length - 3}`}
                </span>
              </div>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {typeConfig?.label || event.event_type}
          </Badge>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { locale: ptBR });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map((day) => {
          const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), day));
          return (
            <div key={day.toISOString()} className="min-h-[200px]">
              <div className={cn(
                "text-center p-2 rounded-lg mb-2",
                isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <p className="text-xs">{format(day, "EEE", { locale: ptBR })}</p>
                <p className="text-lg font-bold">{format(day, "d")}</p>
              </div>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const typeConfig = getEventTypeConfig(event.event_type);
                  return (
                    <div
                      key={event.id}
                      className={cn("p-2 rounded text-white text-xs", typeConfig?.color || "bg-gray-500")}
                    >
                      <p className="font-medium truncate">{event.title}</p>
                      <p>{format(new Date(event.start_time), "HH:mm")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-blue-500" />
          Agenda do CEO
        </CardTitle>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Reunião de planejamento Q2"
                  />
                </div>
                <div>
                  <Label>Tipo de Evento *</Label>
                  <Select value={formData.event_type} onValueChange={(v) => setFormData({ ...formData, event_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.date, "PPP", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(d) => d && setFormData({ ...formData, date: d })}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Término</Label>
                    <Input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Objetivo</Label>
                  <Input
                    value={formData.objective}
                    onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                    placeholder="Qual o objetivo deste evento?"
                  />
                </div>
                <div>
                  <Label>Participantes</Label>
                  <Input
                    value={formData.attendees}
                    onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                    placeholder="Nomes separados por vírgula"
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    placeholder="Observações adicionais..."
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  Criar Evento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, viewMode === "day" ? -1 : viewMode === "week" ? -7 : -30))}>
            Anterior
          </Button>
          <span className="font-medium">
            {viewMode === "day" && format(selectedDate, "PPP", { locale: ptBR })}
            {viewMode === "week" && `${format(startOfWeek(selectedDate, { locale: ptBR }), "d MMM", { locale: ptBR })} - ${format(endOfWeek(selectedDate, { locale: ptBR }), "d MMM", { locale: ptBR })}`}
            {viewMode === "month" && format(selectedDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, viewMode === "day" ? 1 : viewMode === "week" ? 7 : 30))}>
            Próximo
          </Button>
        </div>

        {viewMode === "week" ? (
          renderWeekView()
        ) : (
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum evento para este período
              </p>
            ) : (
              events.map(renderEvent)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
