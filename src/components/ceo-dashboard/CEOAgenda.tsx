import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Plus, CalendarIcon, Clock, Users, RefreshCw, Video, ExternalLink, AlertCircle } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus?: string }[];
  hangoutLink?: string;
  htmlLink?: string;
}

export function CEOAgenda() {
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: new Date(),
    start_time: "09:00",
    end_time: "10:00",
    attendees: "",
    addMeet: false,
  });

  const fetchEvents = async () => {
    try {
      setIsRefreshing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("google-calendar?action=events", {
        body: {},
      });

      if (error) throw error;

      if (data?.needsAuth) {
        setIsConnected(false);
        return;
      }

      setIsConnected(true);
      if (data?.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error("Fetch events error:", error);
      toast.error("Erro ao buscar eventos do calendário");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async () => {
    if (!formData.title) {
      toast.error("Preencha o título do evento");
      return;
    }

    setIsCreating(true);
    try {
      const startDateTime = `${format(formData.date, "yyyy-MM-dd")}T${formData.start_time}:00`;
      const endDateTime = `${format(formData.date, "yyyy-MM-dd")}T${formData.end_time}:00`;

      const attendees = formData.attendees
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      const body: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        startDateTime,
        endDateTime,
        attendees: attendees.length > 0 ? attendees : undefined,
        addMeet: formData.addMeet,
      };

      const { data, error } = await supabase.functions.invoke("google-calendar?action=create-event", {
        body,
      });

      if (error) throw error;

      toast.success("Evento criado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        date: new Date(),
        start_time: "09:00",
        end_time: "10:00",
        attendees: "",
        addMeet: false,
      });
      fetchEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Erro ao criar evento");
    } finally {
      setIsCreating(false);
    }
  };

  const getEventDateTime = (event: GoogleCalendarEvent) => {
    const startStr = event.start.dateTime || event.start.date;
    return startStr ? parseISO(startStr) : new Date();
  };

  const getFilteredEvents = () => {
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

    return events.filter((event) => {
      const eventDate = getEventDateTime(event);
      return eventDate >= startDate && eventDate <= endDate;
    });
  };

  const filteredEvents = getFilteredEvents();

  const renderEvent = (event: GoogleCalendarEvent) => {
    const eventDate = getEventDateTime(event);
    const endStr = event.end.dateTime || event.end.date;
    const endDate = endStr ? parseISO(endStr) : null;

    return (
      <div
        key={event.id}
        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{event.summary}</h4>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {format(eventDate, "HH:mm")}
                {endDate && ` - ${format(endDate, "HH:mm")}`}
              </span>
            </div>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {event.description}
              </p>
            )}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {event.attendees.slice(0, 3).map(a => a.email.split("@")[0]).join(", ")}
                  {event.attendees.length > 3 && ` +${event.attendees.length - 3}`}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {event.hangoutLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(event.hangoutLink, "_blank")}
              >
                <Video className="h-4 w-4" />
              </Button>
            )}
            {event.htmlLink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(event.htmlLink, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
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
          const dayEvents = filteredEvents.filter(e => isSameDay(getEventDateTime(e), day));
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
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-2 rounded bg-primary text-primary-foreground text-xs cursor-pointer hover:opacity-90"
                    onClick={() => event.htmlLink && window.open(event.htmlLink, "_blank")}
                  >
                    <p className="font-medium truncate">{event.summary}</p>
                    <p>{format(getEventDateTime(event), "HH:mm")}</p>
                  </div>
                ))}
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

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-500" />
            Agenda do CEO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">Google Calendar não conectado</h3>
            <p className="text-muted-foreground mb-4">
              Conecte sua conta Google no Escritório Virtual para visualizar sua agenda.
            </p>
            <Button onClick={() => window.open("/onboarding-tasks/office", "_self")}>
              Ir para Escritório Virtual
            </Button>
          </div>
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
          <Badge variant="outline" className="ml-2 text-xs font-normal">
            Google Calendar
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchEvents} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
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
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes do evento..."
                  />
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
                  <Label>Convidados (e-mails)</Label>
                  <Input
                    value={formData.attendees}
                    onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                    placeholder="email1@exemplo.com, email2@exemplo.com"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="addMeet"
                    checked={formData.addMeet}
                    onChange={(e) => setFormData({ ...formData, addMeet: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="addMeet" className="cursor-pointer">
                    Adicionar link do Google Meet
                  </Label>
                </div>
                <Button onClick={handleCreateEvent} className="w-full" disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar Evento"}
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
            {filteredEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum evento para este período
              </p>
            ) : (
              filteredEvents.map(renderEvent)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
