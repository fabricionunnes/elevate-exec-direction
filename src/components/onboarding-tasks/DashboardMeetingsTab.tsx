import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Video,
  Calendar as CalendarIcon,
  Building2,
  Clock,
  Loader2,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  X,
  Users,
} from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface StaffOption {
  id: string;
  name: string;
}

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  subject: string;
  notes: string | null;
  is_finalized: boolean;
  project_id: string;
  calendar_owner_name: string | null;
  project?: {
    product_name: string;
    onboarding_company_id?: string | null;
    onboarding_company?: {
      name: string;
      consultant_id?: string | null;
      cs_id?: string | null;
    } | null;
  } | null;
}

type MeetingFilter = "all" | "upcoming" | "pending_finalization" | "finalized";

interface MeetingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string | null;
  staffRole?: string | null;
}

export const MeetingsPanel = ({ open, onOpenChange, staffId, staffRole }: MeetingsPanelProps) => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MeetingFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");

  const isAdminOrMaster = staffRole === "admin" || staffRole === "master";

  useEffect(() => {
    if (open && staffId) {
      fetchMeetings();
      if (isAdminOrMaster) {
        fetchStaffOptions();
      }
    }
  }, [open, staffId]);

  const fetchStaffOptions = async () => {
    const { data } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .in("role", ["cs", "consultant", "admin", "master"])
      .order("name");
    setStaffOptions(data || []);
  };

  const fetchMeetings = async () => {
    if (!staffId) return;
    setLoading(true);
    try {
      const isAdminOrMaster = staffRole === "admin" || staffRole === "master";
      
      let companyIds: string[] = [];
      
      // Only filter by company for non-admin roles
      if (!isAdminOrMaster) {
        const { data: companiesAsConsultant } = await supabase
          .from("onboarding_companies")
          .select("id")
          .or(`consultant_id.eq.${staffId},cs_id.eq.${staffId}`);

        companyIds = (companiesAsConsultant || []).map(c => c.id);
      }

      const { data, error } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          id,
          meeting_title,
          meeting_date,
          subject,
          notes,
          is_finalized,
          project_id,
          calendar_owner_name,
          project:project_id (
            product_name,
            onboarding_company_id,
            onboarding_company:onboarding_company_id (
              name,
              consultant_id,
              cs_id
            )
          )
        `)
        .order("meeting_date", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Filter meetings - admins see all, others only their companies
      const filtered = isAdminOrMaster
        ? (data || [])
        : (data || []).filter((m: any) => {
            if (companyIds.length === 0) return false;
            return m.project && companyIds.includes(m.project.onboarding_company_id);
          });

      const transformedData = filtered.map((m: any) => ({
        ...m,
        project: m.project
          ? {
              product_name: m.project.product_name,
              onboarding_company_id: m.project.onboarding_company_id,
              onboarding_company: m.project.onboarding_company,
            }
          : null,
      }));

      setMeetings(transformedData);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  // Pre-filter by selected staff
  const staffFilteredMeetings = useMemo(() => {
    if (selectedStaffId === "all" || !isAdminOrMaster) return meetings;
    return meetings.filter((m) => {
      const company = m.project?.onboarding_company;
      if (!company) return false;
      return company.consultant_id === selectedStaffId || company.cs_id === selectedStaffId;
    });
  }, [meetings, selectedStaffId, isAdminOrMaster]);

  const filteredMeetings = useMemo(() => {
    return staffFilteredMeetings.filter((m) => {
      const meetingDate = parseISO(m.meeting_date);

      if (dateRange?.from && isBefore(meetingDate, startOfDay(dateRange.from))) return false;
      if (dateRange?.to && isAfter(startOfDay(meetingDate), startOfDay(dateRange.to))) return false;

      if (statusFilter === "upcoming") {
        return !m.is_finalized && isAfter(meetingDate, now);
      }
      if (statusFilter === "pending_finalization") {
        return !m.is_finalized && isBefore(meetingDate, now);
      }
      if (statusFilter === "finalized") {
        return m.is_finalized;
      }

      return true;
    });
  }, [staffFilteredMeetings, statusFilter, dateRange, now]);

  const counts = useMemo(() => {
    const upcoming = staffFilteredMeetings.filter((m) => !m.is_finalized && isAfter(parseISO(m.meeting_date), now)).length;
    const pending = staffFilteredMeetings.filter((m) => !m.is_finalized && isBefore(parseISO(m.meeting_date), now)).length;
    const finalized = staffFilteredMeetings.filter((m) => m.is_finalized).length;
    return { upcoming, pending, finalized, all: staffFilteredMeetings.length };
  }, [staffFilteredMeetings, now]);

  const statusButtons: { value: MeetingFilter; label: string; shortLabel: string; count: number }[] = [
    { value: "all", label: "Todas", shortLabel: "Todas", count: counts.all },
    { value: "upcoming", label: "A Realizar", shortLabel: "A Real.", count: counts.upcoming },
    { value: "pending_finalization", label: "Pend. Finalização", shortLabel: "Pend.", count: counts.pending },
    { value: "finalized", label: "Realizadas", shortLabel: "Realiz.", count: counts.finalized },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Reuniões
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Staff filter for admins */}
            {isAdminOrMaster && staffOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Filtrar por usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {staffOptions.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {statusButtons.map((btn) => (
                <Button
                  key={btn.value}
                  variant={statusFilter === btn.value ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setStatusFilter(btn.value)}
                >
                  <span className="hidden sm:inline">{btn.label}</span>
                  <span className="sm:hidden">{btn.shortLabel}</span>
                  <Badge
                    variant={statusFilter === btn.value ? "secondary" : "outline"}
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {btn.count}
                  </Badge>
                </Button>
              ))}

              {/* Date filter */}
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 text-xs ml-auto",
                      dateRange && "bg-primary/10 border-primary/30"
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd/MM", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yy", { locale: ptBR })
                      )
                    ) : (
                      "Filtrar data"
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    locale={ptBR}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {dateRange && (
                <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setDateRange(undefined)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "upcoming" && "ring-2 ring-blue-500"
                )}
                onClick={() => setStatusFilter("upcoming")}
              >
                <CardContent className="p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-blue-600">{counts.upcoming}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">A Realizar</p>
                </CardContent>
              </Card>
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "pending_finalization" && "ring-2 ring-orange-500"
                )}
                onClick={() => setStatusFilter("pending_finalization")}
              >
                <CardContent className="p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-orange-600">{counts.pending}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Pend. Finalização</p>
                </CardContent>
              </Card>
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  statusFilter === "finalized" && "ring-2 ring-emerald-500"
                )}
                onClick={() => setStatusFilter("finalized")}
              >
                <CardContent className="p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">{counts.finalized}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">Realizadas</p>
                </CardContent>
              </Card>
            </div>

            {/* Meetings list */}
            <ScrollArea className="flex-1">
              <div className="space-y-1.5 pr-2">
                {filteredMeetings.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhuma reunião encontrada com os filtros selecionados.
                  </div>
                ) : (
                  filteredMeetings.map((meeting) => {
                    const meetingDate = parseISO(meeting.meeting_date);
                    const isPast = isBefore(meetingDate, now);
                    const isUpcoming = !meeting.is_finalized && !isPast;
                    const isPending = !meeting.is_finalized && isPast;

                    return (
                      <Card
                        key={meeting.id}
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-all",
                          isPending && "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20",
                          isUpcoming && "border-blue-200 bg-blue-50/30 dark:bg-blue-950/20"
                        )}
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/onboarding-tasks/${meeting.project_id}?tab=meetings`);
                        }}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                              meeting.is_finalized
                                ? "bg-emerald-100 dark:bg-emerald-900/30"
                                : isPending
                                ? "bg-orange-100 dark:bg-orange-900/30"
                                : "bg-blue-100 dark:bg-blue-900/30"
                            )}
                          >
                            {meeting.is_finalized ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : isPending ? (
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Video className="h-4 w-4 text-blue-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {meeting.subject || meeting.meeting_title}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(meetingDate, "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(meetingDate, "HH:mm")}
                              </span>
                              {meeting.project && (
                                <span className="flex items-center gap-1 truncate">
                                  <Building2 className="h-3 w-3" />
                                  {meeting.project.onboarding_company?.name || meeting.project.product_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px]",
                              meeting.is_finalized
                                ? "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                                : isPending
                                ? "border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-950/30"
                                : "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30"
                            )}
                          >
                            {meeting.is_finalized ? "Realizada" : isPending ? "Pendente" : "Agendada"}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
