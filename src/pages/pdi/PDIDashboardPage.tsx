import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, Route, ClipboardList } from "lucide-react";

interface DashboardStats {
  totalCohorts: number;
  activeCohorts: number;
  totalParticipants: number;
  activeParticipants: number;
  totalTracks: number;
  pendingApplications: number;
}

export default function PDIDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCohorts: 0,
    activeCohorts: 0,
    totalParticipants: 0,
    activeParticipants: 0,
    totalTracks: 0,
    pendingApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [cohortsRes, participantsRes, tracksRes, applicationsRes] = await Promise.all([
        supabase.from("pdi_cohorts").select("id, status"),
        supabase.from("pdi_participants").select("id, status"),
        supabase.from("pdi_tracks").select("id").eq("is_active", true),
        supabase.from("pdi_applications").select("id").eq("status", "pending"),
      ]);

      const cohorts = (cohortsRes.data as any[]) || [];
      const participants = (participantsRes.data as any[]) || [];

      setStats({
        totalCohorts: cohorts.length,
        activeCohorts: cohorts.filter((c) => c.status === "active").length,
        totalParticipants: participants.length,
        activeParticipants: participants.filter((p) => p.status === "active").length,
        totalTracks: (tracksRes.data as any[])?.length || 0,
        pendingApplications: (applicationsRes.data as any[])?.length || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: "Turmas Ativas",
      value: stats.activeCohorts,
      subtitle: `${stats.totalCohorts} total`,
      icon: GraduationCap,
      color: "text-primary",
    },
    {
      title: "Participantes Ativos",
      value: stats.activeParticipants,
      subtitle: `${stats.totalParticipants} total`,
      icon: Users,
      color: "text-emerald-500",
    },
    {
      title: "Trilhas",
      value: stats.totalTracks,
      subtitle: "ativas",
      icon: Route,
      color: "text-blue-500",
    },
    {
      title: "Inscrições Pendentes",
      value: stats.pendingApplications,
      subtitle: "aguardando análise",
      icon: ClipboardList,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard PDI</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do Plano de Desenvolvimento Individual
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  );
}
