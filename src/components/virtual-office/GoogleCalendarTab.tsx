import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Calendar, 
  Video, 
  ExternalLink, 
  RefreshCw, 
  LogOut,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  LayoutGrid,
  Plus,
  Copy,
  Check,
  Users,
  Pencil,
  Trash2,
  MoreVertical
} from "lucide-react";
import { 
  format, 
  parseISO, 
  isToday, 
  isTomorrow, 
  differenceInMinutes,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
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

interface StaffMember {
  id: string;
  name: string;
  role: string;
  user_id: string;
}

type ViewMode = "month" | "week" | "list";

interface GoogleCalendarTabProps {
  currentStaff?: {
    id: string;
    role: string;
    user_id?: string;
  };
}

const GoogleCalendarTab = ({ currentStaff }: GoogleCalendarTabProps) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Staff selection for CS/Admin
  const [connectedStaff, setConnectedStaff] = useState<StaffMember[]>([]);
  const [selectedStaffUserId, setSelectedStaffUserId] = useState<string | null>(null);
  const isCSOrAdmin = currentStaff?.role === "cs" || currentStaff?.role === "admin";
  
  // Day detail panel
  const [selectedDayForDetail, setSelectedDayForDetail] = useState<Date>(new Date());
  
  // Create/Edit event state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    attendees: "",
  });
  const [createdMeetLink, setCreatedMeetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkConnection();
    if (isCSOrAdmin) {
      loadConnectedStaff();
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const providerToken = session.provider_token;
        const providerRefreshToken = session.provider_refresh_token;
        
        if (providerToken) {
          console.log("Google OAuth token captured, saving...");
          try {
            await supabase.functions.invoke("google-calendar?action=save-token", {
              body: {
                access_token: providerToken,
                refresh_token: providerRefreshToken,
                expires_in: 3600,
              },
            });
            setConnected(true);
            await fetchEvents();
            if (isCSOrAdmin) {
              await loadConnectedStaff();
            }
          } catch (error) {
            console.error("Error saving Google token:", error);
          }
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (connected) {
      fetchEvents();
    }
  }, [selectedStaffUserId]);

  const loadConnectedStaff = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar?action=list-connected-staff", {
        body: {},
      });

      if (error) throw error;

      if (data?.staff) {
        setConnectedStaff(data.staff);
      }
    } catch (error) {
      console.error("Error loading connected staff:", error);
    }
  };

  const checkConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      if (session.provider_token) {
        console.log("Found provider token in current session, saving...");
        try {
          await supabase.functions.invoke("google-calendar?action=save-token", {
            body: {
              access_token: session.provider_token,
              refresh_token: session.provider_refresh_token,
              expires_in: 3600,
            },
          });
          setConnected(true);
          await fetchEvents();
          setLoading(false);
          return;
        } catch (error) {
          console.error("Error saving Google token:", error);
        }
      }

      const { data } = await supabase.functions.invoke("google-calendar?action=check-connection", {
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/onboarding-tasks/office`,
          scopes: "https://www.googleapis.com/auth/calendar.events",
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

      const targetParam = selectedStaffUserId ? `&target_user_id=${selectedStaffUserId}` : "";
      const { data, error } = await supabase.functions.invoke(`google-calendar?action=events${targetParam}`, {
        body: {},
      });

      if (error) throw error;

      if (data?.needsAuth) {
        if (!selectedStaffUserId) {
          setConnected(false);
        }
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

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.startTime || !newEvent.endTime) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setCreating(true);
    try {
      const startDateTime = `${newEvent.date}T${newEvent.startTime}:00`;
      const endDateTime = `${newEvent.date}T${newEvent.endTime}:00`;

      const attendees = newEvent.attendees
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      const action = editingEvent ? "update-event" : "create-event";
      const body: Record<string, unknown> = {
        title: newEvent.title,
        description: newEvent.description,
        startDateTime,
        endDateTime,
        attendees: attendees.length > 0 ? attendees : undefined,
      };

      if (editingEvent) {
        body.eventId = editingEvent.id;
      }

      // If CS/Admin is creating event for another user, pass target_user_id
      if (selectedStaffUserId && selectedStaffUserId !== currentStaff?.user_id) {
        body.target_user_id = selectedStaffUserId;
      }

      const { data, error } = await supabase.functions.invoke(`google-calendar?action=${action}`, {
        body,
      });

      if (error) throw error;

      if (data?.needsAuth) {
        toast.error("Reconecte sua conta Google com permissões de escrita");
        setConnected(false);
        return;
      }

      if (data?.success) {
        toast.success(editingEvent ? "Evento atualizado com sucesso!" : "Evento criado com sucesso!");
        
        if (!editingEvent && data.event.meetingLink) {
          setCreatedMeetLink(data.event.meetingLink);
        } else {
          resetCreateForm();
        }
        
        await fetchEvents();
      }
    } catch (error: unknown) {
      console.error("Create/Update event error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar evento";
      if (errorMessage.includes("403") || errorMessage.includes("Permissão")) {
        toast.error("Permissão negada. Reconecte com permissões de escrita.");
      } else {
        toast.error(editingEvent ? "Erro ao atualizar evento" : "Erro ao criar evento");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar?action=delete-event", {
        body: { eventId: eventToDelete.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Evento excluído com sucesso!");
        await fetchEvents();
      }
    } catch (error) {
      console.error("Delete event error:", error);
      toast.error("Erro ao excluir evento");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setEventToDelete(null);
    }
  };

  const resetCreateForm = () => {
    setShowCreateDialog(false);
    setSelectedDate(null);
    setEditingEvent(null);
    setNewEvent({
      title: "",
      description: "",
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      attendees: "",
    });
    setCreatedMeetLink(null);
    setCopied(false);
  };

  const openCreateDialog = (date?: Date) => {
    const targetDate = date || new Date();
    setSelectedDate(targetDate);
    setEditingEvent(null);
    setNewEvent({
      title: "",
      description: "",
      date: format(targetDate, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
      attendees: "",
    });
    setShowCreateDialog(true);
    setCreatedMeetLink(null);
    setCopied(false);
  };

  const openEditDialog = (event: CalendarEvent) => {
    const startDate = parseISO(event.start);
    const endDate = parseISO(event.end);
    
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      description: event.description || "",
      date: format(startDate, "yyyy-MM-dd"),
      startTime: format(startDate, "HH:mm"),
      endTime: format(endDate, "HH:mm"),
      attendees: "",
    });
    setShowCreateDialog(true);
    setCreatedMeetLink(null);
    setCopied(false);
  };

  const confirmDelete = (event: CalendarEvent) => {
    setEventToDelete(event);
    setShowDeleteConfirm(true);
  };

  const copyMeetLink = () => {
    if (createdMeetLink) {
      navigator.clipboard.writeText(createdMeetLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navigatePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const dateKey = format(parseISO(event.start), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [events]);

  // Events for the selected day detail panel
  const selectedDayEvents = useMemo(() => {
    const dateKey = format(selectedDayForDetail, "yyyy-MM-dd");
    return eventsByDate[dateKey] || [];
  }, [selectedDayForDetail, eventsByDate]);

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

  const groupEventsByDay = (evts: CalendarEvent[]) => {
    const grouped: Record<string, CalendarEvent[]> = {};
    evts.forEach((event) => {
      const dateKey = format(parseISO(event.start), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.meetingLink) {
      window.open(event.meetingLink, "_blank");
    } else {
      window.open(event.calendarLink, "_blank");
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDayForDetail(day);
  };

  const isViewingOwnCalendar = !selectedStaffUserId || selectedStaffUserId === currentStaff?.user_id;

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
              Visualize suas reuniões, crie eventos e entre nas chamadas diretamente do Escritório UNV.
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
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const selectedStaffName = selectedStaffUserId 
    ? connectedStaff.find(s => s.user_id === selectedStaffUserId)?.name 
    : null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">
              {selectedStaffName ? `Agenda de ${selectedStaffName}` : "Minha Agenda"}
            </h2>
          </div>
          
          {/* Staff Selector for CS/Admin */}
          {isCSOrAdmin && connectedStaff.length > 0 && (
            <Select
              value={selectedStaffUserId || "mine"}
              onValueChange={(value) => setSelectedStaffUserId(value === "mine" ? null : value)}
            >
              <SelectTrigger className="w-[200px] h-8">
                <Users className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Selecionar consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Minha Agenda</SelectItem>
                {connectedStaff
                  .filter(s => s.user_id !== currentStaff?.user_id)
                  .map((staff) => (
                    <SelectItem key={staff.id} value={staff.user_id}>
                      {staff.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Create Event Button - CS/Admin can create for any user, others only for own calendar */}
          {(isViewingOwnCalendar || isCSOrAdmin) && (
            <Button
              size="sm"
              onClick={() => openCreateDialog()}
              className="gap-1 h-7"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Evento</span>
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/50">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="h-7 px-2 gap-1"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mês</span>
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="h-7 px-2 gap-1"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Semana</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-7 px-2 gap-1"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchEvents}
            disabled={refreshing}
            className="gap-1 h-7"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="gap-1 text-destructive hover:text-destructive h-7"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Desconectar</span>
          </Button>
        </div>
      </div>

      {/* Calendar/List Content */}
      {viewMode === "list" ? (
        <ScrollArea className="flex-1 p-4">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">Nenhum evento nos próximos dias</p>
              {isViewingOwnCalendar && (
                <Button onClick={() => openCreateDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar primeiro evento
                </Button>
              )}
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
                        <Card 
                          key={event.id} 
                          className={cn(
                            "transition-colors cursor-pointer hover:bg-muted/50", 
                            isNow && "border-primary bg-primary/5"
                          )}
                          onClick={(e) => handleEventClick(event, e)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium truncate">{event.title}</h4>
                                  {event.meetingLink && (
                                    <Video className="h-4 w-4 text-blue-500 shrink-0" />
                                  )}
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
                              <div className="flex items-center gap-1">
                                {isViewingOwnCalendar && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(event);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        confirmDelete(event);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant={event.meetingLink ? "default" : "outline"}
                                  className="gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.meetingLink) {
                                      window.open(event.meetingLink, "_blank");
                                    } else {
                                      window.open(event.calendarLink, "_blank");
                                    }
                                  }}
                                >
                                  {event.meetingLink ? (
                                    <>
                                      <Video className="h-4 w-4" />
                                      Entrar
                                    </>
                                  ) : (
                                    <>
                                      <ExternalLink className="h-4 w-4" />
                                      Ver no Calendar
                                    </>
                                  )}
                                </Button>
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
      ) : (
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrevious} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday} className="h-8">
                Hoje
              </Button>
            </div>
            <h3 className="font-semibold capitalize">
              {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "'Semana de' d 'de' MMMM", { locale: ptBR })}
            </h3>
          </div>

          {/* Calendar Grid with Day Detail Panel */}
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-7 gap-1">
                {/* Week Day Headers */}
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isCurrentDay = isToday(day);
                  const isSelectedDay = format(day, "yyyy-MM-dd") === format(selectedDayForDetail, "yyyy-MM-dd");

                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        "border rounded-lg p-1 min-h-[70px] sm:min-h-[80px] transition-colors cursor-pointer",
                        viewMode === "week" && "min-h-[140px]",
                        !isCurrentMonth && viewMode === "month" && "bg-muted/30 opacity-50",
                        isCurrentDay && "border-primary bg-primary/5",
                        isSelectedDay && "ring-2 ring-primary ring-offset-1",
                        "hover:bg-muted/30"
                      )}
                      onClick={() => handleDayClick(day)}
                    >
                      <div className="flex items-center justify-between mb-1 px-0.5">
                        <span className={cn(
                          "text-xs font-medium",
                          isCurrentDay && "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        )}>
                          {format(day, "d")}
                        </span>
                        {dayEvents.length > 0 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            {dayEvents.length}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-0.5 px-0.5">
                        {dayEvents.slice(0, viewMode === "week" ? 4 : 2).map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-[9px] sm:text-[10px] p-0.5 rounded truncate",
                              event.meetingLink 
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" 
                                : "bg-muted"
                            )}
                            title={event.title}
                          >
                            <div className="flex items-center gap-0.5">
                              {event.meetingLink && <Video className="h-2 w-2 shrink-0" />}
                              <span className="truncate">{event.title}</span>
                            </div>
                          </div>
                        ))}
                        {dayEvents.length > (viewMode === "week" ? 4 : 2) && (
                          <span className="text-[9px] text-muted-foreground px-0.5">
                            +{dayEvents.length - (viewMode === "week" ? 4 : 2)} mais
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Detail Panel */}
            <Card className="w-80 shrink-0 hidden lg:flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">
                    {format(selectedDayForDetail, "EEEE, d", { locale: ptBR })}
                  </CardTitle>
                  {isViewingOwnCalendar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openCreateDialog(selectedDayForDetail)}
                      className="h-7 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Novo
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {format(selectedDayForDetail, "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-4 pb-4">
                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground mb-3">Nenhum evento neste dia</p>
                      {isViewingOwnCalendar && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => openCreateDialog(selectedDayForDetail)}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Criar evento
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayEvents
                        .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
                        .map((event) => {
                          const timeUntil = getTimeUntilEvent(event.start);
                          const isNow = timeUntil === "Em andamento";
                          
                          return (
                            <Card 
                              key={event.id}
                              className={cn(
                                "transition-colors",
                                isNow && "border-primary bg-primary/5"
                              )}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <h4 className="font-medium text-sm truncate">{event.title}</h4>
                                      {event.meetingLink && (
                                        <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        {format(parseISO(event.start), "HH:mm")} - {format(parseISO(event.end), "HH:mm")}
                                      </span>
                                      {timeUntil && (
                                        <Badge 
                                          variant={isNow ? "default" : "secondary"} 
                                          className="text-[10px] px-1.5 py-0"
                                        >
                                          {timeUntil}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {isViewingOwnCalendar && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(event)}>
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => confirmDelete(event)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                                
                                {event.description && (
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                                
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant={event.meetingLink ? "default" : "outline"}
                                    className="flex-1 h-7 text-xs gap-1"
                                    onClick={() => {
                                      if (event.meetingLink) {
                                        window.open(event.meetingLink, "_blank");
                                      } else {
                                        window.open(event.calendarLink, "_blank");
                                      }
                                    }}
                                  >
                                    {event.meetingLink ? (
                                      <>
                                        <Video className="h-3 w-3" />
                                        Entrar
                                      </>
                                    ) : (
                                      <>
                                        <ExternalLink className="h-3 w-3" />
                                        Ver
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => window.open(event.calendarLink, "_blank")}
                                    title="Abrir no Google Calendar"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Create/Edit Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && resetCreateForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {createdMeetLink ? "Evento Criado!" : editingEvent ? "Editar Evento" : "Novo Evento com Google Meet"}
            </DialogTitle>
          </DialogHeader>

          {createdMeetLink ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  Seu evento foi criado com sucesso e já está na sua agenda!
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdMeetLink}
                    readOnly
                    className="bg-white dark:bg-background text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyMeetLink}
                    className="shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => window.open(createdMeetLink, "_blank")}
                >
                  <Video className="h-4 w-4" />
                  Entrar na Reunião
                </Button>
                <Button variant="outline" onClick={resetCreateForm}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Reunião de alinhamento"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Detalhes da reunião (opcional)"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Início *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Fim *</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>

                {!editingEvent && (
                  <div className="space-y-2">
                    <Label htmlFor="attendees">Convidados (opcional)</Label>
                    <Input
                      id="attendees"
                      placeholder="email1@exemplo.com, email2@exemplo.com"
                      value={newEvent.attendees}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, attendees: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Separe os e-mails por vírgula. Eles receberão um convite automático.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={resetCreateForm} disabled={creating}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateEvent} disabled={creating} className="gap-2">
                  {creating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {editingEvent ? "Salvando..." : "Criando..."}
                    </>
                  ) : editingEvent ? (
                    <>
                      <Check className="h-4 w-4" />
                      Salvar Alterações
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4" />
                      Criar com Meet
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o evento "{eventToDelete?.title}"? 
              Esta ação não pode ser desfeita e os convidados serão notificados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GoogleCalendarTab;
