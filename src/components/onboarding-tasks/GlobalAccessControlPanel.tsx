import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  User,
  Activity,
  Building2,
  Search,
  RefreshCw,
  Users,
  TrendingUp,
  Eye,
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

interface Company {
  id: string;
  name: string;
}

interface GlobalAccessControlPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalAccessControlPanel({
  open,
  onOpenChange,
}: GlobalAccessControlPanelProps) {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [companies, setCompanies] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("7");
  const [stats, setStats] = useState({
    totalSessions: 0,
    uniqueUsers: 0,
    avgDuration: 0,
    activeNow: 0,
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch companies first
      const { data: companiesData } = await supabase
        .from("onboarding_companies")
        .select("id, name");

      const companiesMap = new Map<string, string>();
      (companiesData || []).forEach((c) => {
        companiesMap.set(c.id, c.name);
      });
      setCompanies(companiesMap);

      // Fetch access logs
      const daysAgo = parseInt(dateFilter);
      const startDate = subDays(new Date(), daysAgo).toISOString();

      const { data, error } = await supabase
        .from("client_access_logs" as any)
        .select("*")
        .gte("login_at", startDate)
        .order("login_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const logs = (data as unknown as AccessLog[]) || [];
      setAccessLogs(logs);

      // Calculate stats
      const uniqueUserIds = new Set(logs.map((l) => l.user_id));
      const completedSessions = logs.filter((l) => l.session_duration_minutes);
      const avgDuration =
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce(
                (acc, l) => acc + (l.session_duration_minutes || 0),
                0
              ) / completedSessions.length
            )
          : 0;
      const activeNow = logs.filter((l) => l.is_active).length;

      setStats({
        totalSessions: logs.length,
        uniqueUsers: uniqueUserIds.size,
        avgDuration,
        activeNow,
      });
    } catch (error) {
      console.error("Error fetching access data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const filteredLogs = accessLogs.filter((log) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const companyName = log.company_id ? companies.get(log.company_id) : "";
    return (
      log.user_email?.toLowerCase().includes(search) ||
      log.user_name?.toLowerCase().includes(search) ||
      companyName?.toLowerCase().includes(search)
    );
  });

  // Group by company for summary
  const companyStats = new Map<
    string,
    { sessions: number; avgDuration: number; lastAccess: string; activeNow: number }
  >();
  accessLogs.forEach((log) => {
    const companyId = log.company_id || "unknown";
    const existing = companyStats.get(companyId) || {
      sessions: 0,
      avgDuration: 0,
      lastAccess: "",
      activeNow: 0,
    };
    existing.sessions += 1;
    if (log.session_duration_minutes) {
      existing.avgDuration =
        (existing.avgDuration * (existing.sessions - 1) + log.session_duration_minutes) /
        existing.sessions;
    }
    if (!existing.lastAccess || log.login_at > existing.lastAccess) {
      existing.lastAccess = log.login_at;
    }
    if (log.is_active) {
      existing.activeNow += 1;
    }
    companyStats.set(companyId, existing);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Controle de Acesso - Todas as Empresas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-primary" />
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                </div>
                <p className="text-xs text-muted-foreground">Total de Sessões</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                </div>
                <p className="text-xs text-muted-foreground">Usuários Únicos</p>
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
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <p className="text-2xl font-bold text-green-600">{stats.activeNow}</p>
                </div>
                <p className="text-xs text-muted-foreground">Online Agora</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
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
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Access Logs Table */}
          <ScrollArea className="h-[400px] border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {log.user_name || "Usuário"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.user_email || "-"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {log.company_id ? companies.get(log.company_id) || "-" : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(log.login_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.login_at), "HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDuration(log.session_duration_minutes)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
