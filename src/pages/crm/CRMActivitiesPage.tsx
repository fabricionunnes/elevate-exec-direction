import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { AddActivityDialog } from "@/components/crm/AddActivityDialog";
import { EditActivityDialog } from "@/components/crm/EditActivityDialog";
import { ActivitiesCalendar, CalendarMode, calendarRange } from "@/components/crm/activities/ActivitiesCalendar";
import { isoToBrasiliaLocal, moveActivityEvent } from "@/lib/crm/activityGoogleSync";
import { fetchAllRows } from "@/lib/fetchAllRows";
import {
  Search,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronDown,
  Plus,
  RefreshCw,
  List,
  CalendarDays,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, addDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCRMContext } from "./CRMLayout";
import { DateRange } from "react-day-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { activityIcon } from "@/lib/crm/activityTypes";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  lead_id: string;
  responsible_staff_id: string | null;
  google_calendar_event_id?: string | null;
  google_calendar_user_id?: string | null;
  lead?: {
    name: string;
    company: string | null;
    origin_id?: string | null;
    stage_id?: string | null;
    origin?: { name: string } | null;
    stage?: { name: string } | null;
    tags?: { tag: { id: string; name: string; color: string } }[];
  } | null;
  responsible?: { name: string; avatar_url?: string | null } | null;
  created_at: string;
}

const ACTIVITY_SELECT = `
  *,
  lead:crm_leads(
    name,
    company,
    origin_id,
    stage_id,
    origin:crm_origins(name),
    stage:crm_stages(name),
    tags:crm_lead_tags(tag:crm_tags(id, name, color))
  ),
  responsible:onboarding_staff!crm_activities_responsible_staff_id_fkey(name, avatar_url)
`;

export const CRMActivitiesPage = () => {
  const { isAdmin, staffId } = useCRMContext();
  // Tipos configuráveis (crm_activity_types) pro filtro, rótulo e ícone.
  const { types: configuredTypes, labelOf: typeLabelOf, iconOf: typeIconOf } = useActivityTypes({ includeInactive: true });
  // cor do tipo (crm_activity_types.color) pro calendário; sem cor válida, cinza
  const typeColorOf = useMemo(() => {
    const map = new Map<string, string>();
    configuredTypes.forEach((t) => { if (t.color && /^#[0-9a-f]{6}$/i.test(t.color)) map.set(t.value, t.color); });
    return (type: string) => map.get(type) || "#64748b";
  }, [configuredTypes]);

  // Lista | Calendário (lembra a última escolha)
  const [viewMode, setViewMode] = useState<"list" | "calendar">(() => {
    try { return localStorage.getItem("crm-activities-view") === "calendar" ? "calendar" : "list"; } catch { return "list"; }
  });
  const changeView = (v: "list" | "calendar") => {
    setViewMode(v);
    try { localStorage.setItem("crm-activities-view", v); } catch { /* sem storage */ }
  };
  const [calMode, setCalMode] = useState<CalendarMode>("month");
  // dia de referência do calendário: hoje em Brasília, ao meio-dia (longe da virada do dia)
  const [calCursor, setCalCursor] = useState<Date>(() => new Date(`${isoToBrasiliaLocal(new Date().toISOString()).slice(0, 10)}T12:00:00`));
  const [calActivities, setCalActivities] = useState<Activity[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  // clique numa atividade abre a edição; clique num dia vazio (ou no botão Atividade) cria
  const [editing, setEditing] = useState<Activity | null>(null);
  const [creating, setCreating] = useState<{ date?: string } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");
  const [filterOrigin, setFilterOrigin] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  // Pós-conclusão: lead nunca fica sem tarefa pendente — concluir abre a criação
  // da próxima atividade; se o lead não tiver outra pendente, criar é obrigatório.
  const [nextTask, setNextTask] = useState<{ leadId: string; leadName: string; mandatory: boolean } | null>(null);
  // Contagem real de pendentes (o badge era um "2" fixo). Contada no banco
  // (head + count), com a mesma visibilidade da lista: admin ve tudo, closer/sdr
  // so o que a RPC crm_visible_activities devolve.
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Filter options
  const [origins, setOrigins] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      // Closer/SDR/Social Setter: só veem atividades que criaram, que foram
      // atribuídas a eles, ou de leads onde são o dono. A visibilidade é
      // resolvida no banco (RPC crm_visible_activities, SETOF), permitindo
      // embutir os joins e filtrar/ordenar como na visão de admin.
      const base = (!isAdmin && staffId)
        ? supabase.rpc("crm_visible_activities", { p_staff: staffId })
        : supabase.from("crm_activities");

      let query = base
        .select(ACTIVITY_SELECT)
        .order("scheduled_at", { ascending: true });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterType !== "all") {
        query = query.eq("type", filterType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error loading activities:", error);
      toast.error("Erro ao carregar atividades");
    } finally {
      setLoading(false);
    }
  };

  // Calendário: só as atividades do período na tela, com a mesma regra de visibilidade
  // da lista (closer/sdr pela RPC crm_visible_activities). Paginado: um mês cheio pode
  // passar das 1000 linhas que o PostgREST devolve.
  const calRange = useMemo(() => {
    const { start, end } = calendarRange(calMode, calCursor);
    return {
      from: `${format(start, "yyyy-MM-dd")}T00:00:00-03:00`,
      to: `${format(end, "yyyy-MM-dd")}T23:59:59-03:00`,
    };
  }, [calMode, calCursor]);

  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const rows = await fetchAllRows<Activity>((from, to) => {
        const base = (!isAdmin && staffId)
          ? supabase.rpc("crm_visible_activities", { p_staff: staffId })
          : supabase.from("crm_activities");
        let q = base
          .select(ACTIVITY_SELECT)
          .gte("scheduled_at", calRange.from)
          .lte("scheduled_at", calRange.to)
          .order("scheduled_at", { ascending: true })
          .order("id", { ascending: true });
        if (filterStatus !== "all") q = q.eq("status", filterStatus);
        if (filterType !== "all") q = q.eq("type", filterType);
        return q.range(from, to);
      });
      setCalActivities(rows);
    } catch (error) {
      console.error("Error loading calendar activities:", error);
      toast.error("Erro ao carregar o calendário");
    } finally {
      setCalLoading(false);
    }
  }, [isAdmin, staffId, calRange, filterStatus, filterType]);

  useEffect(() => {
    if (viewMode === "calendar") loadCalendar();
  }, [viewMode, loadCalendar]);

  const reloadAll = () => {
    loadActivities();
    loadPendingCount();
    if (viewMode === "calendar") loadCalendar();
  };

  // Arrastar no calendário: reagenda e, se a atividade está no Google, move o evento junto.
  const moveActivity = async (activity: Activity, localDateTime: string) => {
    const newIso = new Date(`${localDateTime}:00-03:00`).toISOString();
    setCalActivities((prev) => prev.map((a) => (a.id === activity.id ? { ...a, scheduled_at: newIso } : a)));
    const { error } = await supabase
      .from("crm_activities")
      .update({ scheduled_at: newIso, notified_at: null })
      .eq("id", activity.id);
    if (error) {
      console.error("Error moving activity:", error);
      toast.error("Não consegui reagendar a atividade");
      loadCalendar();
      return;
    }
    const quando = format(new Date(`${localDateTime}:00`), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR });
    if (activity.google_calendar_event_id) {
      const res = await moveActivityEvent(activity.google_calendar_event_id, newIso, activity.google_calendar_user_id);
      if (!res.ok) {
        toast.error(`Reagendei aqui para ${quando}, mas o evento do Google não mudou${res.needsAuth ? ": reconecte o Google em CRM, Escritório" : ""}`);
        loadActivities();
        return;
      }
    }
    toast.success(`Atividade reagendada para ${quando}`);
    loadActivities();
  };

  const loadPendingCount = async () => {
    try {
      const base = (!isAdmin && staffId)
        ? supabase.rpc("crm_visible_activities", { p_staff: staffId }, { count: "exact", head: true })
        : supabase.from("crm_activities").select("id", { count: "exact", head: true });
      const { count, error } = await base.eq("status", "pending");
      if (error) throw error;
      setPendingCount(count ?? 0);
    } catch (e) {
      console.error("Error counting pending activities:", e);
      setPendingCount(null);
    }
  };

  const loadFilterOptions = async () => {
    const [originsRes, stagesRes, ownersRes] = await Promise.all([
      supabase.from("crm_origins").select("id, name").eq("is_active", true),
      supabase.from("crm_stages").select("id, name").order("sort_order"),
      supabase.from("onboarding_staff").select("id, name").eq("is_active", true)
        .in("role", ["master", "admin", "head_comercial", "closer", "sdr"]),
    ]);

    setOrigins(originsRes.data || []);
    setStages(stagesRes.data || []);
    setOwners(ownersRes.data || []);
  };

  useEffect(() => {
    loadActivities();
    loadPendingCount();
    loadFilterOptions();
  }, [filterStatus, filterType]);

  const handleComplete = async (activity: Activity) => {
    try {
      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activity.id);

      if (error) throw error;
      toast.success("Atividade concluída");
      reloadAll();
      // Lead FECHADO (ganho/perdido) não exige próxima tarefa
      const { data: leadStage } = await supabase
        .from("crm_leads")
        .select("stage:crm_stages(final_type)")
        .eq("id", activity.lead_id)
        .maybeSingle();
      if ((leadStage as any)?.stage?.final_type) return;

      // Abre a criação da próxima atividade — obrigatória se o lead ficou sem pendente
      const { count } = await supabase
        .from("crm_activities")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", activity.lead_id)
        .eq("status", "pending");
      setNextTask({
        leadId: activity.lead_id,
        leadName: activity.lead?.name || "este lead",
        mandatory: (count ?? 0) === 0,
      });
    } catch (error) {
      console.error("Error completing activity:", error);
      toast.error("Erro ao concluir atividade");
    }
  };

  const getActivityIcon = (type: string) => {
    const Icon = activityIcon(typeIconOf(type));
    return <Icon className="h-4 w-4" />;
  };

  const getActivityTypeName = (type: string) => typeLabelOf(type) || type;

  const getStatusBadge = (activity: Activity) => {
    if (activity.status === "completed") {
      return <Badge variant="secondary">Concluída</Badge>;
    }

    if (activity.scheduled_at && isPast(new Date(activity.scheduled_at)) && !isToday(new Date(activity.scheduled_at))) {
      return <Badge variant="destructive">Atrasado</Badge>;
    }

    return null;
  };

  const matchesFilters = useCallback((activity: Activity, useDateRange: boolean) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!activity.title.toLowerCase().includes(search) &&
          !activity.lead?.name.toLowerCase().includes(search)) {
        return false;
      }
    }

    // Date filter — um único dia (sem 'to') vira o dia inteiro; range usa início e fim inclusivos
    if (useDateRange && dateRange?.from) {
      if (!activity.scheduled_at) return false;
      const activityDate = new Date(activity.scheduled_at);
      const from = startOfDay(dateRange.from);
      const to = endOfDay(dateRange.to || dateRange.from);
      if (activityDate < from || activityDate > to) return false;
    }

    // Dono do negócio (responsável da atividade)
    if (filterOwner !== "all" && activity.responsible_staff_id !== filterOwner) {
      return false;
    }

    // Origem e Etapa (do lead)
    if (filterOrigin !== "all" && activity.lead?.origin_id !== filterOrigin) {
      return false;
    }
    if (filterStage !== "all" && activity.lead?.stage_id !== filterStage) {
      return false;
    }

    return true;
  }, [searchTerm, dateRange, filterOwner, filterOrigin, filterStage]);

  const filteredActivities = useMemo(
    () => activities.filter((a) => matchesFilters(a, true)),
    [activities, matchesFilters],
  );
  // no calendário o período é o que está na tela, então o filtro "Data" não entra
  const filteredCalActivities = useMemo(
    () => calActivities.filter((a) => matchesFilters(a, false)),
    [calActivities, matchesFilters],
  );

  const toggleSelectAll = () => {
    if (selectedActivities.length === filteredActivities.length) {
      setSelectedActivities([]);
    } else {
      setSelectedActivities(filteredActivities.map((a) => a.id));
    }
  };

  const toggleSelectActivity = (id: string) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const activityTypes = [
    { id: "all", name: "Todos Tipos" },
    ...configuredTypes.filter((t) => t.isActive !== false || t.value === filterType).map((t) => ({ id: t.value, name: t.label })),
  ];

  // Tela cheia de carregamento só na primeira carga da lista. Depois disso (e sempre no
  // calendário) a tela fica montada: recarregar não pode fechar diálogo nem piscar o calendário.
  if (loading && viewMode === "list" && activities.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Listagem de atividades da sua conta
        </p>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold">Atividades</h1>
          <div className="flex items-center gap-2">
            {/* Lista | Calendário */}
            <div className="flex items-center rounded-md border border-border/60 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => changeView("list")}
                title="Ver em lista"
                className={`h-8 px-2 flex items-center gap-1 text-xs ${viewMode === "list" ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-3.5 w-3.5" /><span className="hidden md:inline">Lista</span>
              </button>
              <button
                type="button"
                onClick={() => changeView("calendar")}
                title="Ver em calendário"
                className={`h-8 px-2 flex items-center gap-1 text-xs border-l border-border/60 ${viewMode === "calendar" ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                <CalendarDays className="h-3.5 w-3.5" /><span className="hidden md:inline">Calendário</span>
              </button>
            </div>
            <Button className="gap-2 shrink-0" size="sm" onClick={() => setCreating({})}>
              <span className="hidden sm:inline">Atividade</span> <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-border overflow-x-auto">
        {/* Search */}
        <div className="relative flex-1 min-w-[150px] sm:min-w-[200px] max-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 sm:h-9 text-sm"
          />
        </div>

        {/* Date Filter (no calendário o período é o que está na tela) */}
        {viewMode === "list" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 gap-1 sm:gap-2 text-xs sm:text-sm">
              <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Data</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              locale={ptBR}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
        )}

        {/* Activity Type Filter */}
        <div className="w-[120px] sm:w-[160px]">
          <SearchableSelect
            value={filterType}
            onValueChange={(v) => setFilterType(v || "all")}
            options={activityTypes.map((type) => ({ value: type.id, label: type.name }))}
            placeholder="Tipo"
            emptyMessage="Nenhum tipo com esse nome."
            className="h-8 sm:h-9 text-xs sm:text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="w-[110px] sm:w-[150px]">
          <SearchableSelect
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v || "pending")}
            options={[
              { value: "all", label: "Todas" },
              { value: "pending", label: "Pendentes" },
              { value: "completed", label: "Concluídas" },
            ]}
            placeholder="Status"
            emptyMessage="Nenhuma opção."
            className="h-8 sm:h-9 text-xs sm:text-sm"
          />
        </div>

        {/* Responsável: fora do bloco "mais filtros" porque o calendário é por pessoa */}
        <div className="w-[130px] sm:w-[180px]">
          <SearchableSelect
            value={filterOwner}
            onValueChange={(v) => setFilterOwner(v || "all")}
            options={[{ value: "all", label: "Todos os responsáveis" }, ...owners.map((o) => ({ value: o.id, label: o.name }))]}
            placeholder="Responsável"
            emptyMessage="Ninguém com esse nome."
            className="h-8 sm:h-9 text-xs sm:text-sm"
          />
        </div>

        {/* More Filters - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={`h-9 gap-2 ${filterOrigin !== "all" ? "border-primary text-primary" : ""}`}>
              {filterOrigin === "all" ? "Origem" : (origins.find((o) => o.id === filterOrigin)?.name || "Origem")}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              <button onClick={() => setFilterOrigin("all")} className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded ${filterOrigin === "all" ? "bg-muted font-medium" : ""}`}>Todas as origens</button>
              {origins.map((origin) => (
                <button
                  key={origin.id}
                  onClick={() => setFilterOrigin(origin.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded ${filterOrigin === origin.id ? "bg-muted font-medium" : ""}`}
                >
                  {origin.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Stage Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={`h-9 gap-2 ${filterStage !== "all" ? "border-primary text-primary" : ""}`}>
              {filterStage === "all" ? "Etapa" : (stages.find((s) => s.id === filterStage)?.name || "Etapa")}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              <button onClick={() => setFilterStage("all")} className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded ${filterStage === "all" ? "bg-muted font-medium" : ""}`}>Todas as etapas</button>
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setFilterStage(stage.id)}
                  className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded ${filterStage === stage.id ? "bg-muted font-medium" : ""}`}
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Tags Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              Tags
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <p className="text-sm text-muted-foreground py-2 px-2">Nenhuma tag</p>
          </PopoverContent>
        </Popover>

        {/* Status Badge */}
        <Badge variant="secondary" className="h-7" title="Atividades pendentes">
          {pendingCount === null ? "..." : `${pendingCount.toLocaleString("pt-BR")} pendente${pendingCount === 1 ? "" : "s"}`}
        </Badge>
        </div>

        {/* Refresh */}
        <Button variant="ghost" size="icon" className="h-8 sm:h-9 w-8 sm:w-9 ml-auto shrink-0" onClick={reloadAll}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendário: mês, semana ou dia */}
      {viewMode === "calendar" && (
        <div className="flex-1 min-h-0">
          <ActivitiesCalendar<Activity>
            activities={filteredCalActivities}
            mode={calMode}
            onModeChange={setCalMode}
            cursor={calCursor}
            onCursorChange={setCalCursor}
            loading={calLoading}
            colorOf={typeColorOf}
            labelOf={getActivityTypeName}
            onOpen={setEditing}
            onCreate={(date) => setCreating({ date })}
            onMove={moveActivity}
          />
        </div>
      )}

      {/* Results Count */}
      {viewMode === "list" && (
      <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground border-b border-border">
        <span className="font-medium text-foreground">{filteredActivities.length}</span> atividades de{" "}
        <span className="font-medium text-foreground">{activities.length}</span> negócios
      </div>
      )}

      {/* Table - Desktop / Card list - Mobile */}
      {viewMode === "list" && (
      <div className="flex-1 overflow-auto">
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Concluído</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data e hora</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Dono do negócio</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className={cn(
                    activity.status === "completed" && "bg-muted/30"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={activity.status === "completed"}
                      onCheckedChange={() => handleComplete(activity)}
                      disabled={activity.status === "completed"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {getActivityIcon(activity.type)}
                      </span>
                      <button type="button" className="font-medium text-left hover:underline" onClick={() => setEditing(activity)} title="Editar atividade">
                        {activity.title}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(activity)}</TableCell>
                  <TableCell>
                    {activity.scheduled_at && (
                      <span className="text-sm">
                        {format(new Date(activity.scheduled_at), "EEE, d 'de' MMM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {activity.lead && (
                      <Link
                        to={`/crm/leads/${activity.lead_id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {activity.lead.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{activity.lead.name}</span>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    {activity.lead?.origin?.name && (
                      <Badge variant="outline" className="text-xs">
                        {activity.lead.origin.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {activity.lead?.stage?.name && (
                      <span className="text-sm">{activity.lead.stage.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {activity.responsible && (
                      <Avatar className="h-6 w-6">
                        {activity.responsible.avatar_url && <AvatarImage src={activity.responsible.avatar_url} alt={activity.responsible.name} />}
                        <AvatarFallback className="text-[10px]">
                          {activity.responsible.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </TableCell>
                  <TableCell>
                    {activity.lead?.tags && activity.lead.tags.length > 0 && (
                      <div className="flex gap-1">
                        {activity.lead.tags.slice(0, 2).map((t) => (
                          <Badge
                            key={t.tag.id}
                            variant="outline"
                            className="text-[10px] px-1"
                            style={{ borderColor: t.tag.color, color: t.tag.color }}
                          >
                            {t.tag.name}
                          </Badge>
                        ))}
                        {activity.lead.tags.length > 2 && (
                          <Badge variant="secondary" className="text-[10px] px-1">
                            +{activity.lead.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {filteredActivities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma atividade encontrada</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-border">
          {filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                "px-3 py-3 flex items-start gap-3",
                activity.status === "completed" && "bg-muted/30"
              )}
            >
              <Checkbox
                checked={activity.status === "completed"}
                onCheckedChange={() => handleComplete(activity)}
                disabled={activity.status === "completed"}
                className="mt-1"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {getActivityIcon(activity.type)}
                  </span>
                  <span className="font-medium text-sm truncate">{activity.title}</span>
                </div>
                {activity.scheduled_at && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(activity.scheduled_at), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
                {activity.lead && (
                  <Link
                    to={`/crm/leads/${activity.lead_id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {activity.lead.name}
                  </Link>
                )}
              </div>
              <div className="shrink-0">
                {getStatusBadge(activity)}
              </div>
            </div>
          ))}

          {filteredActivities.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade encontrada</p>
            </div>
          )}
        </div>
      </div>

      )}

      {/* Editar (clique na atividade, na lista ou no calendário) */}
      <EditActivityDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        activity={editing}
        onSuccess={reloadAll}
      />

      {/* Criar: botão do topo (sem data) ou clique num dia/horário do calendário */}
      {creating && (
        <AddActivityDialog
          open
          onOpenChange={(o) => { if (!o) setCreating(null); }}
          dataPadrao={creating.date}
          onSuccess={() => { setCreating(null); reloadAll(); }}
        />
      )}

      {/* Próxima atividade do lead recém-concluído — sem opção de finalizar:
          quando o lead ficaria sem tarefa pendente, criar é obrigatório */}
      {nextTask && (
        <AddActivityDialog
          open={!!nextTask}
          onOpenChange={(o) => {
            if (o) return;
            if (nextTask.mandatory) {
              toast.error(
                `Crie a próxima tarefa de ${nextTask.leadName} — nenhum lead fica sem atividade pendente`
              );
              return;
            }
            setNextTask(null);
          }}
          leadId={nextTask.leadId}
          onSuccess={() => {
            setNextTask(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
};
