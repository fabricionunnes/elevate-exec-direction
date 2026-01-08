import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  MessageSquare,
  Edit,
  User,
  Calendar,
  Target,
  Star,
  Headphones,
  Plus,
  Clock,
  Building2,
  Filter,
  RefreshCw,
  X,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "task_history" | "meeting" | "support" | "nps" | "goal";
  action: string;
  description: string;
  date: string;
  staffId: string | null;
  staffName: string | null;
  companyId: string | null;
  companyName: string | null;
  projectId: string | null;
  projectName: string | null;
  details?: Record<string, any>;
}

interface Company {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  name: string;
}

interface AdminActivityHistoryProps {
  className?: string;
}

export const AdminActivityHistory = ({ className }: AdminActivityHistoryProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  
  // Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [staffNameSearch, setStaffNameSearch] = useState<string>("");

  useEffect(() => {
    fetchFiltersData();
    fetchActivities();
  }, []);

  const fetchFiltersData = async () => {
    try {
      const [companiesRes, staffRes] = await Promise.all([
        supabase.from("onboarding_companies").select("id, name").order("name"),
        supabase.from("onboarding_staff").select("id, name").eq("is_active", true).order("name"),
      ]);

      if (companiesRes.data) setCompanies(companiesRes.data);
      if (staffRes.data) setStaffMembers(staffRes.data);
    } catch (error) {
      console.error("Error fetching filters data:", error);
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const allActivities: ActivityItem[] = [];

      // 1. Task History
      const { data: taskHistory } = await supabase
        .from("onboarding_task_history")
        .select(`
          *,
          staff:onboarding_staff(id, name),
          task:onboarding_tasks(
            id, title, 
            project:onboarding_projects(
              id, product_name,
              company:onboarding_companies(id, name)
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (taskHistory) {
        for (const item of taskHistory) {
          const task = item.task as any;
          const project = task?.project as any;
          const company = project?.company as any;
          
          allActivities.push({
            id: `task_history_${item.id}`,
            type: "task_history",
            action: item.action,
            description: getTaskHistoryDescription(item),
            date: item.created_at,
            staffId: item.staff_id,
            staffName: (item.staff as any)?.name || null,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              taskTitle: task?.title,
              fieldChanged: item.field_changed,
              oldValue: item.old_value,
              newValue: item.new_value,
            },
          });
        }
      }

      // 2. Meeting Notes
      const { data: meetings } = await supabase
        .from("onboarding_meeting_notes")
        .select(`
          *,
          staff:onboarding_staff(id, name),
          project:onboarding_projects(
            id, product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (meetings) {
        for (const item of meetings) {
          const project = item.project as any;
          const company = project?.company as any;
          
          allActivities.push({
            id: `meeting_${item.id}`,
            type: "meeting",
            action: "meeting_registered",
            description: `Registrou reunião: ${item.meeting_title}`,
            date: item.created_at,
            staffId: item.staff_id,
            staffName: (item.staff as any)?.name || null,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              meetingTitle: item.meeting_title,
              subject: item.subject,
              meetingDate: item.meeting_date,
              recordingLink: item.recording_link,
            },
          });
        }
      }

      // 3. Support Sessions
      const { data: supportSessions } = await supabase
        .from("support_room_sessions")
        .select(`
          *,
          staff:onboarding_staff!support_room_sessions_attended_by_fkey(id, name),
          project:onboarding_projects(
            id, product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (supportSessions) {
        for (const item of supportSessions) {
          const project = item.project as any;
          const company = project?.company as any;
          
          allActivities.push({
            id: `support_${item.id}`,
            type: "support",
            action: `support_${item.status}`,
            description: getSupportDescription(item),
            date: item.created_at,
            staffId: item.attended_by,
            staffName: (item.staff as any)?.name || null,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              clientName: item.client_name,
              status: item.status,
              startedAt: item.started_at,
              endedAt: item.ended_at,
              notes: item.notes,
            },
          });
        }
      }

      // 4. NPS Responses
      const { data: npsResponses } = await supabase
        .from("onboarding_nps_responses")
        .select(`
          *,
          project:onboarding_projects(
            id, product_name, consultant_id, cs_id,
            company:onboarding_companies(id, name),
            consultant:onboarding_staff!onboarding_projects_consultant_id_fkey(id, name),
            cs:onboarding_staff!onboarding_projects_cs_id_fkey(id, name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (npsResponses) {
        for (const item of npsResponses) {
          const project = item.project as any;
          const company = project?.company as any;
          const consultant = project?.consultant as any;
          const cs = project?.cs as any;
          
          // Associate NPS with both consultant and CS
          const staffName = consultant?.name || cs?.name || null;
          const staffId = project?.consultant_id || project?.cs_id || null;
          
          allActivities.push({
            id: `nps_${item.id}`,
            type: "nps",
            action: "nps_received",
            description: `NPS ${item.score} recebido${item.respondent_name ? ` de ${item.respondent_name}` : ""}`,
            date: item.created_at,
            staffId,
            staffName,
            companyId: company?.id || null,
            companyName: company?.name || null,
            projectId: project?.id || null,
            projectName: project?.product_name || null,
            details: {
              score: item.score,
              feedback: item.feedback,
              respondentName: item.respondent_name,
              respondentEmail: item.respondent_email,
              whatCanImprove: item.what_can_improve,
              wouldRecommendWhy: item.would_recommend_why,
            },
          });
        }
      }

      // 5. Monthly Goals Changes
      const { data: goals } = await supabase
        .from("onboarding_monthly_goals")
        .select(`
          *,
          targetSetBy:onboarding_staff!onboarding_monthly_goals_target_set_by_fkey(id, name),
          resultSetBy:onboarding_staff!onboarding_monthly_goals_result_set_by_fkey(id, name),
          project:onboarding_projects(
            id, product_name,
            company:onboarding_companies(id, name)
          )
        `)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (goals) {
        for (const item of goals) {
          const project = item.project as any;
          const company = project?.company as any;
          
          // Add target set event if exists
          if (item.target_set_at && item.sales_target) {
            allActivities.push({
              id: `goal_target_${item.id}`,
              type: "goal",
              action: "goal_target_set",
              description: `Definiu meta de ${formatCurrency(item.sales_target)} para ${getMonthName(item.month)}/${item.year}`,
              date: item.target_set_at,
              staffId: item.target_set_by,
              staffName: (item.targetSetBy as any)?.name || null,
              companyId: company?.id || null,
              companyName: company?.name || null,
              projectId: project?.id || null,
              projectName: project?.product_name || null,
              details: {
                month: item.month,
                year: item.year,
                salesTarget: item.sales_target,
              },
            });
          }
          
          // Add result set event if exists
          if (item.result_set_at && item.sales_result !== null) {
            allActivities.push({
              id: `goal_result_${item.id}`,
              type: "goal",
              action: "goal_result_set",
              description: `Registrou resultado de ${formatCurrency(item.sales_result)} para ${getMonthName(item.month)}/${item.year}`,
              date: item.result_set_at,
              staffId: item.result_set_by,
              staffName: (item.resultSetBy as any)?.name || null,
              companyId: company?.id || null,
              companyName: company?.name || null,
              projectId: project?.id || null,
              projectName: project?.product_name || null,
              details: {
                month: item.month,
                year: item.year,
                salesResult: item.sales_result,
                salesTarget: item.sales_target,
              },
            });
          }
        }
      }

      // Sort all activities by date descending
      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setActivities(allActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskHistoryDescription = (item: any): string => {
    switch (item.action) {
      case "status_change":
        return `Alterou status de "${item.old_value}" para "${item.new_value}"`;
      case "comment":
        return "Adicionou um comentário";
      case "edit":
        return `Editou ${item.field_changed || "tarefa"}`;
      case "assign":
        return `Atribuiu tarefa para ${item.new_value}`;
      case "create":
        return "Criou tarefa";
      default:
        return item.action;
    }
  };

  const getSupportDescription = (item: any): string => {
    switch (item.status) {
      case "waiting":
        return `Cliente ${item.client_name} entrou na sala de suporte`;
      case "active":
        return `Iniciou atendimento para ${item.client_name}`;
      case "completed":
        return `Finalizou suporte para ${item.client_name}`;
      case "cancelled":
        return `Suporte cancelado - ${item.client_name}`;
      default:
        return `Suporte para ${item.client_name}`;
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      // Date filter (date-only to avoid timezone issues)
      if (dateFrom || dateTo) {
        const activityDateOnly = activity.date?.substring(0, 10);
        if (!activityDateOnly) return false;

        if (dateFrom && activityDateOnly < dateFrom) return false;
        if (dateTo && activityDateOnly > dateTo) return false;
      }

      // Company filter
      if (selectedCompany !== "all" && activity.companyId !== selectedCompany) {
        return false;
      }

      // Staff filter (dropdown)
      if (selectedStaff !== "all" && activity.staffId !== selectedStaff) {
        return false;
      }

      // Staff name search filter (text search)
      if (staffNameSearch.trim()) {
        const searchLower = staffNameSearch.toLowerCase().trim();
        if (!activity.staffName?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== "all" && activity.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [activities, dateFrom, dateTo, selectedCompany, selectedStaff, selectedType, staffNameSearch]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedCompany("all");
    setSelectedStaff("all");
    setSelectedType("all");
    setStaffNameSearch("");
  };

  const getActivityIcon = (type: string, action: string) => {
    switch (type) {
      case "task_history":
        if (action === "status_change") return <CheckCircle className="h-4 w-4 text-green-500" />;
        if (action === "comment") return <MessageSquare className="h-4 w-4 text-blue-500" />;
        if (action === "create") return <Plus className="h-4 w-4 text-purple-500" />;
        return <Edit className="h-4 w-4 text-amber-500" />;
      case "meeting":
        return <Calendar className="h-4 w-4 text-indigo-500" />;
      case "support":
        return <Headphones className="h-4 w-4 text-pink-500" />;
      case "nps":
        return <Star className="h-4 w-4 text-yellow-500" />;
      case "goal":
        return <Target className="h-4 w-4 text-emerald-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "task_history":
        return <Badge variant="outline" className="text-xs">Tarefa</Badge>;
      case "meeting":
        return <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-200">Reunião</Badge>;
      case "support":
        return <Badge variant="outline" className="text-xs bg-pink-500/10 text-pink-600 border-pink-200">Suporte</Badge>;
      case "nps":
        return <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-200">NPS</Badge>;
      case "goal":
        return <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">Meta</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Outro</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Atividades
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{filteredActivities.length} registros</Badge>
            <Button variant="outline" size="sm" onClick={fetchActivities}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>
          
          <div className="flex flex-wrap gap-3 flex-1">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">De:</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Até:</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>

            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="h-8 w-[180px] text-sm">
                <Building2 className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Usuário:</Label>
              <Input
                type="text"
                placeholder="Buscar por nome..."
                value={staffNameSearch}
                onChange={(e) => setStaffNameSearch(e.target.value)}
                className="h-8 w-40 text-sm"
              />
            </div>

            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="h-8 w-[180px] text-sm">
                <User className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos usuários</SelectItem>
                {staffMembers.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-8 w-[150px] text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="task_history">Tarefas</SelectItem>
                <SelectItem value="meeting">Reuniões</SelectItem>
                <SelectItem value="support">Suporte</SelectItem>
                <SelectItem value="nps">NPS</SelectItem>
                <SelectItem value="goal">Metas</SelectItem>
              </SelectContent>
            </Select>

            {(dateFrom || dateTo || selectedCompany !== "all" || selectedStaff !== "all" || selectedType !== "all" || staffNameSearch.trim()) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Activity List */}
        <ScrollArea className="h-[600px]">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma atividade encontrada com os filtros selecionados
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity.type, activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTypeBadge(activity.type)}
                      {activity.staffName && (
                        <span className="text-sm font-medium">{activity.staffName}</span>
                      )}
                      {activity.companyName && (
                        <Badge variant="secondary" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          {activity.companyName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1">{activity.description}</p>
                    {activity.details?.taskTitle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Tarefa: {activity.details.taskTitle}
                      </p>
                    )}
                    {activity.type === "nps" && activity.details?.feedback && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{activity.details.feedback}"
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(activity.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getMonthName = (month: number): string => {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return months[month - 1] || "";
};
