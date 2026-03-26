import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Target, TrendingUp, AlertTriangle, CheckCircle2, Clock, BarChart3, ListTodo, Users, Building2, CalendarDays } from "lucide-react";
import { ACTION_STATUSES, ACTION_CATEGORIES, type CommercialAction } from "./types";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { parseDateLocal } from "@/lib/dateUtils";
import MonthYearPicker from "@/components/onboarding-tasks/MonthYearPicker";

export const CommercialActionsDashboard = () => {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [consultants, setConsultants] = useState<{ id: string; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState("list");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [dateRange, setDateRange] = useState(() => ({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  }));

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: actionsData } = await supabase
      .from("commercial_actions")
      .select(`
        *,
        responsible_staff:onboarding_staff!commercial_actions_responsible_staff_id_fkey(id, name),
        project:onboarding_projects!commercial_actions_project_id_fkey(
          id, product_name,
          onboarding_company:onboarding_companies(id, name)
        )
      `)
      .order("created_at", { ascending: false });

    setActions((actionsData as any[]) || []);

    const { data: staffData } = await supabase
      .from("onboarding_staff")
      .select("id, name")
      .eq("is_active", true)
      .in("role", ["consultant", "cs", "admin", "master"])
      .order("name");
    setConsultants(staffData || []);

    const { data: companiesData } = await supabase
      .from("onboarding_companies")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    setCompanies(companiesData || []);

    setLoading(false);
  };

  const filtered = useMemo(() => {
    return actions.filter(a => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (consultantFilter !== "all" && a.responsible_staff_id !== consultantFilter) return false;
      if (companyFilter !== "all") {
        const companyId = a.project?.onboarding_company?.id;
        if (companyId !== companyFilter) return false;
      }
      // Date filter: check if action's deadline falls within selected period
      if (a.deadline) {
        try {
          const deadline = parseDateLocal(a.deadline);
          if (!isWithinInterval(deadline, { start: dateRange.start, end: dateRange.end })) return false;
        } catch { /* keep */ }
      }
      return true;
    });
  }, [actions, search, statusFilter, consultantFilter, companyFilter, dateRange]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, consultantFilter, companyFilter, dateRange]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedActions = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const planned = filtered.filter(a => a.status === "planned").length;
    const inProgress = filtered.filter(a => a.status === "in_progress").length;
    const completed = filtered.filter(a => a.status === "completed").length;
    const overdue = filtered.filter(a => a.status === "overdue").length;
    const withGoals = filtered.filter(a => a.goal).length;
    const goalsWithResult = filtered.filter(a => a.goal && a.result).length;
    const executionRate = total > 0 ? Math.round(((completed + inProgress) / total) * 100) : 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, planned, inProgress, completed, overdue, withGoals, goalsWithResult, executionRate, successRate };
  }, [filtered]);

  // Metrics by consultant
  const metricsByConsultant = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; overdue: number }>();
    filtered.forEach(a => {
      const staffId = a.responsible_staff_id;
      const staffName = a.responsible_staff?.name || "Sem responsável";
      if (!map.has(staffId || "none")) {
        map.set(staffId || "none", { name: staffName, total: 0, completed: 0, overdue: 0 });
      }
      const m = map.get(staffId || "none")!;
      m.total++;
      if (a.status === "completed") m.completed++;
      if (a.status === "overdue") m.overdue++;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Metrics by company
  const metricsByCompany = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; overdue: number }>();
    filtered.forEach(a => {
      const companyId = a.project?.onboarding_company?.id || "none";
      const companyName = a.project?.onboarding_company?.name || "Sem empresa";
      if (!map.has(companyId)) {
        map.set(companyId, { name: companyName, total: 0, completed: 0, overdue: 0 });
      }
      const m = map.get(companyId)!;
      m.total++;
      if (a.status === "completed") m.completed++;
      if (a.status === "overdue") m.overdue++;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const getStatusBadge = (status: string) => {
    const s = ACTION_STATUSES.find(st => st.value === status);
    return <Badge className={`text-xs ${s?.color || ""}`}>{s?.label || status}</Badge>;
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">{metrics.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{metrics.planned}</div>
          <div className="text-xs text-muted-foreground">Planejadas</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{metrics.inProgress}</div>
          <div className="text-xs text-muted-foreground">Em execução</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{metrics.completed}</div>
          <div className="text-xs text-muted-foreground">Concluídas</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{metrics.overdue}</div>
          <div className="text-xs text-muted-foreground">Atrasadas</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">{metrics.goalsWithResult}</div>
          <div className="text-xs text-muted-foreground">Metas c/ resultado</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-primary">{metrics.executionRate}%</div>
          <div className="text-xs text-muted-foreground">Taxa execução</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{metrics.successRate}%</div>
          <div className="text-xs text-muted-foreground">Taxa sucesso</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ação..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <MonthYearPicker
          value={dateRange.start}
          onChange={(range) => {
            setDateRange(range);
          }}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ACTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={consultantFilter} onValueChange={setConsultantFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Consultor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {consultants.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-1"><ListTodo className="h-4 w-4" /> Lista</TabsTrigger>
          <TabsTrigger value="by_consultant" className="gap-1"><Users className="h-4 w-4" /> Por Consultor</TabsTrigger>
          <TabsTrigger value="by_company" className="gap-1"><Building2 className="h-4 w-4" /> Por Empresa</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma ação encontrada</p>
              </div>
            ) : (
              <>
                {paginatedActions.map(action => (
                  <div key={action.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{action.title}</span>
                        {getStatusBadge(action.status)}
                        <Badge variant="outline" className="text-xs">{action.category}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {action.project?.onboarding_company?.name && (
                          <span className="font-medium">{action.project.onboarding_company.name}</span>
                        )}
                        {action.responsible_staff && <span>{action.responsible_staff.name}</span>}
                        {action.deadline && <span>Prazo: {format(parseDateLocal(action.deadline), "dd/MM/yyyy")}</span>}
                        {action.goal && <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {action.goal}</span>}
                        {action.result && <span className="flex items-center gap-1 text-green-600"><TrendingUp className="h-3 w-3" /> {action.result}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-muted-foreground">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentPage} / {totalPages}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="by_consultant">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricsByConsultant.map((m, i) => {
              const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {m.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold">{m.total}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{m.completed}</div>
                        <div className="text-xs text-muted-foreground">Concluídas</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600">{m.overdue}</div>
                        <div className="text-xs text-muted-foreground">Atrasadas</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Taxa de sucesso</span>
                      <span className="font-semibold text-primary">{rate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${rate}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {metricsByConsultant.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum dado encontrado</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="by_company">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricsByCompany.map((m, i) => {
              const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
              return (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {m.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold">{m.total}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{m.completed}</div>
                        <div className="text-xs text-muted-foreground">Concluídas</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600">{m.overdue}</div>
                        <div className="text-xs text-muted-foreground">Atrasadas</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Taxa de sucesso</span>
                      <span className="font-semibold text-primary">{rate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${rate}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {metricsByCompany.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum dado encontrado</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
