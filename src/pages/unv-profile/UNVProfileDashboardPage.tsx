import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, UserPlus, UserMinus, TrendingDown, AlertCircle, Cake, Target, GraduationCap, Rocket } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

export default function UNVProfileDashboardPage() {
  const [stats, setStats] = useState<any>({ employees: 0, openJobs: 0, candidates: 0, hires: 0, terms: 0, turnover: 0, onboarding: 0, pdiPending: 0, evalPending: 0 });
  const [byDept, setByDept] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [emps, jobs, cands, pdis] = await Promise.all([
        supabase.from("profile_employees").select("id,status,hire_date,termination_date,department_id"),
        supabase.from("profile_jobs").select("id,status"),
        supabase.from("profile_candidates").select("id,stage"),
        supabase.from("profile_pdi").select("id,status"),
      ]);
      const employees = emps.data?.filter(e => e.status === "active").length || 0;
      const onboarding = emps.data?.filter(e => e.status === "onboarding").length || 0;
      const hires = emps.data?.filter(e => e.hire_date && new Date(e.hire_date).getMonth() === new Date().getMonth()).length || 0;
      const terms = emps.data?.filter(e => e.termination_date && new Date(e.termination_date).getMonth() === new Date().getMonth()).length || 0;
      const turnover = employees > 0 ? ((terms / employees) * 100).toFixed(1) : "0";
      const openJobs = jobs.data?.filter(j => j.status === "open").length || 0;
      const candidates = cands.data?.filter(c => c.stage !== "rejected" && c.stage !== "hired").length || 0;
      const pdiPending = pdis.data?.filter(p => p.status === "open").length || 0;

      setStats({ employees, openJobs, candidates, hires, terms, turnover, onboarding, pdiPending, evalPending: 0 });

      // group por status para o pie
      setByDept([
        { name: "Ativos", value: employees, fill: "hsl(var(--primary))" },
        { name: "Onboarding", value: onboarding, fill: "hsl(var(--accent))" },
        { name: "Inativos", value: emps.data?.filter(e => e.status === "inactive").length || 0, fill: "hsl(var(--muted))" },
      ]);
    };
    load();
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
        <h1 className="text-2xl font-bold">Dashboard UNV Profile</h1>
        <p className="text-sm text-muted-foreground">Indicadores estratégicos de gente</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPI icon={Users} label="Colaboradores" value={stats.employees} color="bg-blue-500" />
        <KPI icon={Briefcase} label="Vagas abertas" value={stats.openJobs} color="bg-violet-500" />
        <KPI icon={UserPlus} label="Candidatos ativos" value={stats.candidates} color="bg-emerald-500" />
        <KPI icon={UserPlus} label="Admissões (mês)" value={stats.hires} color="bg-cyan-500" />
        <KPI icon={UserMinus} label="Desligamentos" value={stats.terms} color="bg-rose-500" />
        <KPI icon={TrendingDown} label="Turnover %" value={stats.turnover + "%"} color="bg-orange-500" />
        <KPI icon={Rocket} label="Onboardings" value={stats.onboarding} color="bg-amber-500" />
        <KPI icon={Target} label="PDIs pendentes" value={stats.pdiPending} color="bg-pink-500" />
        <KPI icon={AlertCircle} label="Avaliações pendentes" value={stats.evalPending} color="bg-indigo-500" />
        <KPI icon={Cake} label="Aniversariantes" value="0" color="bg-fuchsia-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de colaboradores</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byDept} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {byDept.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Alertas críticos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
