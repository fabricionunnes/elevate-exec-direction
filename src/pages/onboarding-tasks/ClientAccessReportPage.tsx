import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Activity,
  Building2,
  Search,
  RefreshCw,
  Users,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  PlusCircle,
  CalendarCheck,
  MessageSquare,
  Upload,
  Send,
  Star,
  MousePointer,
  Layers,
  FileText,
  TrendingUp,
  Timer,
  BarChart3,
  UserCheck,
  Briefcase,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AccessLog {
  id: string;
  user_id: string;
  project_id: string | null;
  company_id: string | null;
  user_email: string | null;
  user_name: string | null;
  login_at: string;
  logout_at: string | null;
  session_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

interface ActivityLog {
  id: string;
  access_log_id: string | null;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  page_path: string | null;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
  consultant_id: string | null;
  cs_id: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  page_view: <Eye className="h-3.5 w-3.5 text-blue-500" />,
  task_completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  task_created: <PlusCircle className="h-3.5 w-3.5 text-purple-500" />,
  task_updated: <FileText className="h-3.5 w-3.5 text-amber-500" />,
  meeting_scheduled: <CalendarCheck className="h-3.5 w-3.5 text-cyan-500" />,
  meeting_completed: <CalendarCheck className="h-3.5 w-3.5 text-green-500" />,
  ticket_created: <MessageSquare className="h-3.5 w-3.5 text-orange-500" />,
  ticket_replied: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
  file_uploaded: <Upload className="h-3.5 w-3.5 text-indigo-500" />,
  file_downloaded: <Upload className="h-3.5 w-3.5 text-green-500" />,
  note_added: <FileText className="h-3.5 w-3.5 text-yellow-500" />,
  form_submitted: <Send className="h-3.5 w-3.5 text-teal-500" />,
  nps_submitted: <Star className="h-3.5 w-3.5 text-yellow-500" />,
  button_clicked: <MousePointer className="h-3.5 w-3.5 text-gray-500" />,
  tab_changed: <Layers className="h-3.5 w-3.5 text-slate-500" />,
  export_generated: <FileText className="h-3.5 w-3.5 text-emerald-500" />,
  job_opening_created: <Briefcase className="h-3.5 w-3.5 text-violet-500" />,
  candidate_added: <UserCheck className="h-3.5 w-3.5 text-pink-500" />,
};

const ClientAccessReportPage = () => {
  const navigate = useNavigate();
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<Map<string, ActivityLog[]>>(new Map());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [consultants, setConsultants] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("30");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [loadingActivities, setLoadingActivities] = useState<Set<string>>(new Set());
  
  const [stats, setStats] = useState({
    totalSessions: 0,
    uniqueUsers: 0,
    avgDuration: 0,
    activeNow: 0,
    totalActivities: 0,
    totalTimeMinutes: 0,
    companiesWithAccess: 0,
    avgSessionsPerUser: 0,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchAccessData();
  }, [dateFilter, companyFilter, consultantFilter]);

  const fetchInitialData = async () => {
    try {
      // Fetch companies with consultant/cs info
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name, consultant_id, cs_id")
        .eq("status", "active")
        .order("name");

      setCompanies(companiesData || []);

      // Fetch consultants (both consultant and cs roles)
      const { data: staffData } = await supabase
        .from("onboarding_staff")
        .select("id, name, role")
        .in("role", ["consultant", "cs", "admin"])
        .eq("is_active", true)
        .order("name");

      setConsultants(staffData || []);
    } catch (error) {
      console.error("Error fetching initial data:", error);
    }
  };

  const fetchAccessData = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(dateFilter);
      const startDate = subDays(new Date(), daysAgo).toISOString();

      // Build query with filters
      let query = supabase
        .from("client_access_logs" as any)
        .select("*")
        .gte("login_at", startDate)
        .order("login_at", { ascending: false })
        .limit(1000);

      if (companyFilter !== "all") {
        query = query.eq("company_id", companyFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let logs = (data as unknown as AccessLog[]) || [];

      // Filter by consultant if needed
      if (consultantFilter !== "all") {
        const consultantCompanyIds = companies
          .filter(c => c.consultant_id === consultantFilter || c.cs_id === consultantFilter)
          .map(c => c.id);
        logs = logs.filter(log => log.company_id && consultantCompanyIds.includes(log.company_id));
      }

      setAccessLogs(logs);

      // Fetch activity count for the period
      let activityQuery = supabase
        .from("client_activity_logs" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", startDate);

      const { count: activityCount } = await activityQuery;

      // Calculate stats
      const uniqueUserIds = new Set(logs.map(l => l.user_id));
      const uniqueCompanyIds = new Set(logs.filter(l => l.company_id).map(l => l.company_id));
      
      // Calculate average duration only from sessions that have a duration
      const sessionsWithDuration = logs.filter(l => l.session_duration_minutes && l.session_duration_minutes > 0);
      const totalMinutes = sessionsWithDuration.reduce((acc, l) => acc + (l.session_duration_minutes || 0), 0);
      const avgDuration = sessionsWithDuration.length > 0
        ? Math.round(totalMinutes / sessionsWithDuration.length)
        : 0;
      
      const activeNow = logs.filter(l => l.is_active).length;
      const avgSessionsPerUser = uniqueUserIds.size > 0 
        ? Math.round((logs.length / uniqueUserIds.size) * 10) / 10 
        : 0;

      setStats({
        totalSessions: logs.length,
        uniqueUsers: uniqueUserIds.size,
        avgDuration,
        activeNow,
        totalActivities: activityCount || 0,
        totalTimeMinutes: totalMinutes,
        companiesWithAccess: uniqueCompanyIds.size,
        avgSessionsPerUser,
      });
    } catch (error) {
      console.error("Error fetching access data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivitiesForSession = async (
    accessLogId: string,
    userId: string,
    projectId: string | null,
    loginAt: string,
    logoutAt: string | null
  ) => {
    if (activityLogs.has(accessLogId)) return;

    setLoadingActivities(prev => new Set(prev).add(accessLogId));

    try {
      let query = supabase
        .from("client_activity_logs" as any)
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", loginAt)
        .order("created_at", { ascending: true });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      if (logoutAt) {
        query = query.lte("created_at", logoutAt);
      }

      const { data, error } = await query;
      if (error) throw error;

      setActivityLogs(prev => {
        const newMap = new Map(prev);
        newMap.set(accessLogId, (data as unknown as ActivityLog[]) || []);
        return newMap;
      });
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoadingActivities(prev => {
        const newSet = new Set(prev);
        newSet.delete(accessLogId);
        return newSet;
      });
    }
  };

  const toggleSession = (log: AccessLog) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(log.id)) {
      newExpanded.delete(log.id);
    } else {
      newExpanded.add(log.id);
      fetchActivitiesForSession(log.id, log.user_id, log.project_id, log.login_at, log.logout_at);
    }
    setExpandedSessions(newExpanded);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes || minutes === 0) return "-";
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const formatTotalTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}min`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const getActionIcon = (actionType: string) => {
    return actionTypeIcons[actionType] || <Activity className="h-3.5 w-3.5 text-gray-500" />;
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return "-";
    const company = companies.find(c => c.id === companyId);
    return company?.name || "-";
  };

  const filteredLogs = accessLogs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const companyName = getCompanyName(log.company_id);
    return (
      log.user_email?.toLowerCase().includes(search) ||
      log.user_name?.toLowerCase().includes(search) ||
      companyName.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/onboarding-tasks")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Eye className="h-6 w-6 text-primary" />
              Controle de Acesso dos Clientes
            </h1>
            <p className="text-muted-foreground text-sm">
              Monitore acessos e atividades dos clientes no portal
            </p>
          </div>
        </div>

        {/* Mini Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-primary" />
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
              </div>
              <p className="text-xs text-muted-foreground">Sessões</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="h-4 w-4 text-blue-500" />
                <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
              </div>
              <p className="text-xs text-muted-foreground">Usuários</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-purple-500" />
                <p className="text-2xl font-bold">{stats.companiesWithAccess}</p>
              </div>
              <p className="text-xs text-muted-foreground">Empresas</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Tempo Médio</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-teal-500" />
                <p className="text-2xl font-bold">{formatTotalTime(stats.totalTimeMinutes)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Tempo Total</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-indigo-500" />
                <p className="text-2xl font-bold">{stats.totalActivities}</p>
              </div>
              <p className="text-xs text-muted-foreground">Atividades</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <p className="text-2xl font-bold">{stats.avgSessionsPerUser}</p>
              </div>
              <p className="text-xs text-muted-foreground">Sessões/Usuário</p>
            </CardContent>
          </Card>
          
          <Card className={stats.activeNow > 0 ? "bg-green-50 dark:bg-green-950/20" : ""}>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                {stats.activeNow > 0 && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                )}
                <p className={`text-2xl font-bold ${stats.activeNow > 0 ? "text-green-600" : ""}`}>
                  {stats.activeNow}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Online Agora</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuário ou empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={consultantFilter} onValueChange={setConsultantFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Consultor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Consultores</SelectItem>
                  {consultants.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Empresas</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Últimas 24 horas</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon" onClick={fetchAccessData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Access Logs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Histórico de Acessos
              <Badge variant="secondary" className="ml-2">
                {filteredLogs.length} registros
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum registro encontrado
                  </p>
                ) : (
                  filteredLogs.map(log => {
                    const isExpanded = expandedSessions.has(log.id);
                    const activities = activityLogs.get(log.id) || [];
                    const isLoadingActivities = loadingActivities.has(log.id);

                    return (
                      <Collapsible
                        key={log.id}
                        open={isExpanded}
                        onOpenChange={() => toggleSession(log)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full p-3 h-auto flex items-center justify-between hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left">
                                  <p className="font-medium text-sm">
                                    {log.user_name || log.user_email || "Usuário"}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Building2 className="h-3 w-3" />
                                    {getCompanyName(log.company_id)}
                                    <span className="mx-1">•</span>
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(log.login_at), "dd/MM/yyyy 'às' HH:mm", {
                                      locale: ptBR,
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-sm">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span>{formatDuration(log.session_duration_minutes)}</span>
                                  </div>
                                  {activities.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {activities.length} atividade{activities.length !== 1 ? "s" : ""}
                                    </p>
                                  )}
                                </div>
                                {log.is_active ? (
                                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                    <span className="relative flex h-2 w-2 mr-1">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                    </span>
                                    Online
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Offline</Badge>
                                )}
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t bg-muted/20 p-3">
                              {isLoadingActivities ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    Carregando atividades...
                                  </span>
                                </div>
                              ) : activities.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">
                                  Nenhuma atividade registrada nesta sessão
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                    Atividades durante esta sessão:
                                  </p>
                                  {activities.map(activity => (
                                    <div
                                      key={activity.id}
                                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="mt-0.5">
                                        {getActionIcon(activity.action_type)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground">
                                          {activity.action_description}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {format(new Date(activity.created_at), "HH:mm:ss", {
                                            locale: ptBR,
                                          })}
                                          {activity.page_path && (
                                            <span className="ml-2 opacity-60">
                                              • {activity.page_path.split("#").pop()?.substring(0, 30)}...
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientAccessReportPage;
