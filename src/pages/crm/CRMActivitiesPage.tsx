import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Calendar,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Video,
  FileText,
  CheckCircle,
  AlertTriangle,
  Filter
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  status: string;
  lead_id: string;
  lead?: { name: string; company: string | null };
  responsible?: { name: string };
  created_at: string;
}

export const CRMActivitiesPage = () => {
  const { isAdmin } = useOutletContext<{ staffRole: string; isAdmin: boolean }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");

  const loadActivities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("crm_activities")
        .select(`
          *,
          lead:crm_leads(name, company),
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

  useEffect(() => {
    loadActivities();
  }, [filterStatus, filterType]);

  const handleComplete = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("crm_activities")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
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
      case "call": return <Phone className="h-4 w-4" />;
      case "meeting": return <Video className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "proposal": return <FileText className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
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

  const groupActivities = () => {
    const today: Activity[] = [];
    const tomorrow: Activity[] = [];
    const thisWeek: Activity[] = [];
    const overdue: Activity[] = [];
    const later: Activity[] = [];

    activities.forEach(activity => {
      if (!activity.scheduled_at) {
        later.push(activity);
        return;
      }

      const date = new Date(activity.scheduled_at);
      const now = new Date();

      if (activity.status === "pending" && isPast(date) && !isToday(date)) {
        overdue.push(activity);
      } else if (isToday(date)) {
        today.push(activity);
      } else if (isTomorrow(date)) {
        tomorrow.push(activity);
      } else if (date <= addDays(now, 7)) {
        thisWeek.push(activity);
      } else {
        later.push(activity);
      }
    });

    return { today, tomorrow, thisWeek, overdue, later };
  };

  const grouped = groupActivities();

  const ActivityCard = ({ activity }: { activity: Activity }) => (
    <div className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="p-2 bg-muted rounded-lg">
        {getActivityIcon(activity.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{activity.title}</span>
          <Badge variant="outline" className="text-xs">
            {getActivityTypeName(activity.type)}
          </Badge>
        </div>
        {activity.lead && (
          <Link 
            to={`/crm/leads/${activity.lead_id}`}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {activity.lead.name} {activity.lead.company && `• ${activity.lead.company}`}
          </Link>
        )}
        {activity.scheduled_at && (
          <p className="text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3 inline mr-1" />
            {format(new Date(activity.scheduled_at), "HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>
      {activity.status === "pending" && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => handleComplete(activity.id)}
        >
          <CheckCircle className="h-5 w-5 text-green-500" />
        </Button>
      )}
      {activity.status === "completed" && (
        <Badge variant="secondary">Concluída</Badge>
      )}
    </div>
  );

  const ActivityGroup = ({ title, activities, icon, color }: { 
    title: string; 
    activities: Activity[]; 
    icon: React.ReactNode;
    color?: string;
  }) => {
    if (activities.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 ${color || "text-foreground"}`}>
          {icon}
          <h3 className="font-medium">{title}</h3>
          <Badge variant="secondary">{activities.length}</Badge>
        </div>
        <div className="space-y-2 pl-6">
          {activities.map(activity => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Atividades</h1>
          <p className="text-muted-foreground">
            Gerencie suas tarefas e compromissos
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="completed">Concluídas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              <SelectItem value="call">Ligações</SelectItem>
              <SelectItem value="meeting">Reuniões</SelectItem>
              <SelectItem value="email">E-mails</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="proposal">Propostas</SelectItem>
              <SelectItem value="followup">Follow-ups</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <ActivityGroup
            title="Atrasadas"
            activities={grouped.overdue}
            icon={<AlertTriangle className="h-5 w-5" />}
            color="text-red-500"
          />

          <ActivityGroup
            title="Hoje"
            activities={grouped.today}
            icon={<Calendar className="h-5 w-5" />}
            color="text-blue-500"
          />

          <ActivityGroup
            title="Amanhã"
            activities={grouped.tomorrow}
            icon={<Calendar className="h-5 w-5" />}
          />

          <ActivityGroup
            title="Esta Semana"
            activities={grouped.thisWeek}
            icon={<Calendar className="h-5 w-5" />}
          />

          <ActivityGroup
            title="Próximas"
            activities={grouped.later}
            icon={<Clock className="h-5 w-5" />}
          />

          {activities.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
