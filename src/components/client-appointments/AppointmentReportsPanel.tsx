import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface Props { projectId: string; }

export function AppointmentReportsPanel({ projectId }: Props) {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [stats, setStats] = useState({ total: 0, attended: 0, cancelled: 0, noShow: 0, revenue: 0, topServices: [] as { name: string; count: number }[], topProfessionals: [] as { name: string; count: number }[] });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: appointments } = await supabase
      .from("appointments")
      .select("*, service:appointment_services(name), professional:appointment_professionals(name)")
      .eq("project_id", projectId)
      .gte("start_time", `${dateFrom}T00:00:00`)
      .lte("start_time", `${dateTo}T23:59:59`);

    const apts = (appointments as any[]) || [];
    const total = apts.length;
    const attended = apts.filter(a => a.status === "attended").length;
    const cancelled = apts.filter(a => a.status === "cancelled").length;
    const noShow = apts.filter(a => a.status === "no_show").length;
    const revenue = apts.filter(a => a.status === "attended").reduce((s, a) => s + Number(a.price || 0), 0);

    // Top services
    const svcMap: Record<string, number> = {};
    apts.forEach(a => { const n = a.service?.name || "?"; svcMap[n] = (svcMap[n] || 0) + 1; });
    const topServices = Object.entries(svcMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Top professionals
    const profMap: Record<string, number> = {};
    apts.forEach(a => { const n = a.professional?.name; if (n) profMap[n] = (profMap[n] || 0) + 1; });
    const topProfessionals = Object.entries(profMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    setStats({ total, attended, cancelled, noShow, revenue, topServices, topProfessionals });
    setLoading(false);
  }, [projectId, dateFrom, dateTo]);

  useEffect(() => { fetch(); }, [fetch]);

  const noShowRate = stats.total > 0 ? ((stats.noShow / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><Label>De</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-blue-500" /></div>
              <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Agendamentos</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Users className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="text-2xl font-bold">{stats.attended}</p><p className="text-xs text-muted-foreground">Atendidos</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">R$ {stats.revenue.toFixed(0)}</p><p className="text-xs text-muted-foreground">Faturamento</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-amber-500" /></div>
              <div><p className="text-2xl font-bold">{noShowRate}%</p><p className="text-xs text-muted-foreground">Faltas</p></div>
            </CardContent></Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Serviços mais realizados</CardTitle></CardHeader>
              <CardContent>
                {stats.topServices.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : (
                  <div className="space-y-2">
                    {stats.topServices.map((s, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{s.name}</span><span className="font-medium">{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Profissionais mais ativos</CardTitle></CardHeader>
              <CardContent>
                {stats.topProfessionals.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados</p> : (
                  <div className="space-y-2">
                    {stats.topProfessionals.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{p.name}</span><span className="font-medium">{p.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
