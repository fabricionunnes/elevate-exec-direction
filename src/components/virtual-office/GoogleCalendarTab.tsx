import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Calendar, 
  Video, 
  ExternalLink, 
  RefreshCw, 
  LogIn,
  LogOut,
  Clock,
  AlertCircle
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  meetingLink?: string;
  calendarLink: string;
}

const GoogleCalendarTab = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke("google-calendar", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Check if the URL has action parameter
      const { data, error } = await supabase.functions.invoke("google-calendar?action=check-connection", {
        body: {},
      });

      if (data?.connected) {
        setConnected(true);
        await fetchEvents();
      }
    } catch (error) {
      console.error("Error checking connection:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/onboarding-tasks/office`,
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("Erro ao conectar com Google");
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("google-calendar?action=disconnect", {
        body: {},
      });

      setConnected(false);
      setEvents([]);
      toast.success("Google Calendar desconectado");
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Erro ao desconectar");
    }
  };

  const fetchEvents = async () => {
    try {
      setRefreshing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("google-calendar?action=events", {
        body: {},
      });

      if (error) throw error;

      if (data?.needsAuth) {
        setConnected(false);
        return;
      }

      if (data?.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error("Fetch events error:", error);
      toast.error("Erro ao buscar eventos");
    } finally {
      setRefreshing(false);
    }
  };

  const getEventTimeLabel = (start: string) => {
    const date = parseISO(start);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  const getTimeUntilEvent = (start: string) => {
    const minutes = differenceInMinutes(parseISO(start), new Date());
    if (minutes < 0) return "Em andamento";
    if (minutes < 60) return `Em ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Em ${hours}h`;
    return null;
  };

  const groupEventsByDay = (events: CalendarEvent[]) => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const dateKey = format(parseISO(event.start), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Conecte seu Google Calendar</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Visualize suas reuniões e entre nas chamadas diretamente do escritório virtual.
            </p>
            <Button onClick={handleGoogleLogin} className="w-full gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const groupedEvents = groupEventsByDay(events);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b p-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Minha Agenda</h2>
          <Badge variant="outline" className="text-xs">Próximos 7 dias</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchEvents}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Atualizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Desconectar
          </Button>
        </div>
      </div>

      {/* Events List */}
      <ScrollArea className="flex-1 p-4">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhum evento nos próximos 7 dias</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3 capitalize">
                  {getEventTimeLabel(dayEvents[0].start)}
                </h3>
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const timeUntil = getTimeUntilEvent(event.start);
                    const isNow = timeUntil === "Em andamento";
                    
                    return (
                      <Card key={event.id} className={cn("transition-colors", isNow && "border-primary bg-primary/5")}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium truncate">{event.title}</h4>
                                {timeUntil && (
                                  <Badge variant={isNow ? "default" : "secondary"} className="text-xs shrink-0">
                                    {timeUntil}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {format(parseISO(event.start), "HH:mm")} - {format(parseISO(event.end), "HH:mm")}
                                </span>
                              </div>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              {event.meetingLink ? (
                                <Button
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => window.open(event.meetingLink, "_blank")}
                                >
                                  <Video className="h-4 w-4" />
                                  Entrar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => window.open(event.calendarLink, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Ver
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default GoogleCalendarTab;
