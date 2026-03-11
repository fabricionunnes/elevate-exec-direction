import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, Route, ClipboardList, FileText, Award, Trophy, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DashboardStats {
  totalCohorts: number;
  activeCohorts: number;
  totalParticipants: number;
  activeParticipants: number;
  totalTracks: number;
  pendingApplications: number;
  totalTasks: number;
  totalSubmissions: number;
  totalCertificates: number;
  avgCompletion: number;
}

export default function PDIDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCohorts: 0, activeCohorts: 0, totalParticipants: 0, activeParticipants: 0,
    totalTracks: 0, pendingApplications: 0, totalTasks: 0, totalSubmissions: 0,
    totalCertificates: 0, avgCompletion: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [cohortsRes, participantsRes, tracksRes, applicationsRes, tasksRes, submissionsRes, certsRes] = await Promise.all([
        supabase.from("pdi_cohorts").select("id, status"),
        supabase.from("pdi_participants").select("id, status"),
        supabase.from("pdi_tracks").select("id").eq("is_active", true),
        supabase.from("pdi_applications").select("id").eq("status", "pending"),
        supabase.from("pdi_tasks").select("id").eq("is_active", true),
        supabase.from("pdi_task_submissions").select("id, status"),
        supabase.from("pdi_certificates").select("id"),
      ]);

      const cohorts = (cohortsRes.data as any[]) || [];
      const participants = (participantsRes.data as any[]) || [];
      const subs = (submissionsRes.data as any[]) || [];
      const totalTasks = (tasksRes.data as any[])?.length || 0;
      const reviewed = subs.filter((s) => s.status === "reviewed" || s.status === "completed").length;

      setStats({
        totalCohorts: cohorts.length,
        activeCohorts: cohorts.filter((c) => c.status === "active").length,
        totalParticipants: participants.length,
        activeParticipants: participants.filter((p) => p.status === "active").length,
        totalTracks: (tracksRes.data as any[])?.length || 0,
        pendingApplications: (applicationsRes.data as any[])?.length || 0,
        totalTasks,
        totalSubmissions: subs.length,
        totalCertificates: (certsRes.data as any[])?.length || 0,
        avgCompletion: totalTasks > 0 && participants.length > 0
          ? Math.round((reviewed / (totalTasks * participants.length)) * 100) : 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Turmas Ativas", value: stats.activeCohorts, subtitle: `${stats.totalCohorts} total`, icon: GraduationCap, color: "text-primary" },
    { title: "Participantes Ativos", value: stats.activeParticipants, subtitle: `${stats.totalParticipants} total`, icon: Users, color: "text-emerald-500" },
    { title: "Trilhas", value: stats.totalTracks, subtitle: "ativas", icon: Route, color: "text-blue-500" },
    { title: "Inscrições Pendentes", value: stats.pendingApplications, subtitle: "aguardando análise", icon: ClipboardList, color: "text-amber-500" },
    { title: "Tarefas Criadas", value: stats.totalTasks, subtitle: `${stats.totalSubmissions} envios`, icon: FileText, color: "text-violet-500" },
    { title: "Certificados", value: stats.totalCertificates, subtitle: "emitidos", icon: Award, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard PDI</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do Plano de Desenvolvimento Individual
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {loading ? "—" : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center ${card.color}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion rate */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Taxa de Conclusão Geral</p>
                <p className="text-xs text-muted-foreground">Progresso médio dos participantes nas tarefas</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">{loading ? "—" : `${stats.avgCompletion}%`}</span>
          </div>
          <Progress value={stats.avgCompletion} className="h-3" />
        </CardContent>
      </Card>
    </div>
  );
}
