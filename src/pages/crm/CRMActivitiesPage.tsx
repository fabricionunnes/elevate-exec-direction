import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  MessageSquare,
  Video,
  FileText,
  CheckCircle,
  ChevronDown,
  Plus,
  RefreshCw,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCRMContext } from "./CRMLayout";
import { DateRange } from "react-day-picker";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  lead_id: string;
  lead?: { 
    name: string; 
    company: string | null;
    origin?: { name: string } | null;
    stage?: { name: string } | null;
    tags?: { tag: { id: string; name: string; color: string } }[];
  } | null;
  responsible?: { name: string } | null;
  created_at: string;
}

export const CRMActivitiesPage = () => {
  const { isAdmin, staffId } = useCRMContext();
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

  // Filter options
  const [origins, setOrigins] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("crm_activities")
        .select(`
          *,
          lead:crm_leads(
            name, 
            company,
            origin:crm_origins(name),
            stage:crm_stages(name),
            tags:crm_lead_tags(tag:crm_tags(id, name, color))
          ),
          responsible:onboarding_staff!crm_activities_responsible_staff_id_fkey(name)
        `)
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
    loadFilterOptions();
  }, [filterStatus, filterType]);

  const handleComplete = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("crm_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activityId);

      if (error) throw error;
      toast.success("Atividade concluída");
      loadActivities();
    } catch (error) {
      console.error("Error completing activity:", error);
      toast.error("Erro ao concluir atividade");
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "meeting":
        return <Video className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      case "proposal":
        return <FileText className="h-4 w-4" />;
      default:
        return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const getActivityTypeName = (type: string) => {
    const types: Record<string, string> = {
      call: "Ligação",
      meeting: "Reunião",
      email: "E-mail",
      whatsapp: "WhatsApp",
      proposal: "Proposta",
      followup: "Follow-up",
      other: "Outro",
    };
    return types[type] || type;
  };

  const getStatusBadge = (activity: Activity) => {
    if (activity.status === "completed") {
      return <Badge variant="secondary">Concluída</Badge>;
    }

    if (activity.scheduled_at && isPast(new Date(activity.scheduled_at)) && !isToday(new Date(activity.scheduled_at))) {
      return <Badge variant="destructive">Atrasado</Badge>;
    }

    return null;
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!activity.title.toLowerCase().includes(search) &&
            !activity.lead?.name.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Date filter
      if (dateRange?.from && activity.scheduled_at) {
        const activityDate = new Date(activity.scheduled_at);
        if (activityDate < dateRange.from) return false;
        if (dateRange.to && activityDate > dateRange.to) return false;
      }

      return true;
    });
  }, [activities, searchTerm, dateRange]);

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
    { id: "call", name: "Ligação" },
    { id: "meeting", name: "Reunião" },
    { id: "email", name: "E-mail" },
    { id: "whatsapp", name: "WhatsApp" },
    { id: "proposal", name: "Proposta" },
    { id: "followup", name: "Follow-up" },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Listagem de atividades da sua conta
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Atividades</h1>
          <Button className="gap-2">
            Atividade <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Date Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <CalendarIcon className="h-4 w-4" />
              Data
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              locale={ptBR}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Activity Type Filter */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {activityTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
          </SelectContent>
        </Select>

        {/* Origin Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              Origem
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {origins.map((origin) => (
                <button
                  key={origin.id}
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded"
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
            <Button variant="outline" size="sm" className="h-9 gap-2">
              Etapa
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded"
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

        {/* Owner Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              Dono do negócio
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="start">
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {owners.map((owner) => (
                <button
                  key={owner.id}
                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded"
                >
                  {owner.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Badge */}
        <Badge variant="secondary" className="h-7">{filterStatus === "pending" ? "2" : "0"}</Badge>

        {/* Refresh */}
        <Button variant="ghost" size="icon" className="h-9 w-9 ml-auto" onClick={loadActivities}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Results Count */}
      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
        <span className="font-medium text-foreground">{filteredActivities.length}</span> atividades de{" "}
        <span className="font-medium text-foreground">{activities.length}</span> negócios
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
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
                    onCheckedChange={() => handleComplete(activity.id)}
                    disabled={activity.status === "completed"}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {getActivityIcon(activity.type)}
                    </span>
                    <span className="font-medium">{activity.title}</span>
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
    </div>
  );
};
