import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Building2, Users, Briefcase, AlertTriangle } from "lucide-react";

export default function UNVProfileAdminPage() {
  const [stats, setStats] = useState<any>({ companies: 0, employees: 0, jobs: 0, alerts: 0 });

  useEffect(() => {
    (async () => {
      const [c, e, j] = await Promise.all([
        supabase.from("profile_companies").select("id", { count: "exact", head: true }),
        supabase.from("profile_employees").select("id", { count: "exact", head: true }),
        supabase.from("profile_jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      setStats({ companies: c.count || 0, employees: e.count || 0, jobs: j.count || 0, alerts: 0 });
    })();
  }, []);

  const KPI = ({ icon: Icon, label, value, color }: any) => (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Admin UNV</h1>
        <p className="text-sm text-muted-foreground">Visão global de todas empresas e indicadores estratégicos</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Building2} label="Empresas" value={stats.companies} color="bg-blue-500" />
        <KPI icon={Users} label="Colaboradores" value={stats.employees} color="bg-emerald-500" />
        <KPI icon={Briefcase} label="Vagas abertas" value={stats.jobs} color="bg-violet-500" />
        <KPI icon={AlertTriangle} label="Alertas" value={stats.alerts} color="bg-amber-500" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Uso do sistema</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Métricas detalhadas em breve.</p></CardContent>
      </Card>
    </div>
  );
}
