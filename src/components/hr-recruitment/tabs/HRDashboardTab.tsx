import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  FunnelChart,
  Funnel,
  LabelList
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown,
  Clock,
  Target,
  Users,
  Briefcase,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { PIPELINE_STAGES, SOURCE_LABELS } from "../types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface HRDashboardTabProps {
  projectId: string;
}

interface PipelineData {
  stage: string;
  stageName: string;
  count: number;
  color: string;
}

interface SourceData {
  name: string;
  value: number;
  hired: number;
  conversionRate: number;
}

interface MonthlyData {
  month: string;
  received: number;
  hired: number;
  rejected: number;
}

export function HRDashboardTab({ projectId }: HRDashboardTabProps) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [kpis, setKpis] = useState({
    overallConversion: 0,
    avgTimeToHire: 0,
    jobsOverdue: 0,
    talentPoolCount: 0,
    activeJobs: 0,
    activeCandidates: 0,
    completedInterviews: 0,
    discCompleted: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, [projectId, period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(period));

    // First fetch active jobs to filter candidates
    const { data: jobs } = await supabase
      .from("job_openings")
      .select("id, status, created_at")
      .eq("project_id", projectId);

    const activeJobIds = (jobs || []).map(j => j.id);

    // Fetch candidates - only those with existing jobs OR in talent pool
    const { data: allCandidates } = await supabase
      .from("candidates")
      .select("id, current_stage, source, status, created_at, updated_at, job_opening_id")
      .eq("project_id", projectId);

    // Filter candidates: only include those with valid job_opening_id (job exists) 
    // OR those in talent pool (no job required)
    const candidates = (allCandidates || []).filter(c => 
      c.current_stage === 'talent_pool' || 
      c.job_opening_id === null || 
      activeJobIds.includes(c.job_opening_id)
    );

    // Fetch interviews - only for candidates with existing jobs
    const { data: allInterviews } = await supabase
      .from("interviews")
      .select("id, status, candidate_id, candidate:candidates!inner(project_id, job_opening_id)")
      .eq("candidate.project_id", projectId)
      .eq("status", "completed");

    const interviews = (allInterviews || []).filter(i => {
      const candidateJobId = (i.candidate as any)?.job_opening_id;
      return candidateJobId === null || activeJobIds.includes(candidateJobId);
    });

    // Fetch DISC results - only for candidates with existing jobs
    const { data: allDiscResults } = await supabase
      .from("candidate_disc_results")
      .select("id, status, candidate_id, candidate:candidates!inner(project_id, job_opening_id)")
      .eq("candidate.project_id", projectId)
      .eq("status", "completed");

    const discResults = (allDiscResults || []).filter(d => {
      const candidateJobId = (d.candidate as any)?.job_opening_id;
      return candidateJobId === null || activeJobIds.includes(candidateJobId);
    });

    // Calculate pipeline data
    const pipelineCounts: Record<string, number> = {};
    (candidates || []).forEach(c => {
      pipelineCounts[c.current_stage] = (pipelineCounts[c.current_stage] || 0) + 1;
    });

    const pipelineStats = PIPELINE_STAGES.map(stage => ({
      stage: stage.key,
      stageName: stage.name,
      count: pipelineCounts[stage.key] || 0,
      color: stage.color
    }));
    setPipelineData(pipelineStats);

    // Calculate source data
    const sourceCounts: Record<string, { total: number; hired: number }> = {};
    (candidates || []).forEach(c => {
      if (!sourceCounts[c.source]) {
        sourceCounts[c.source] = { total: 0, hired: 0 };
      }
      sourceCounts[c.source].total++;
      if (c.current_stage === 'hired') {
        sourceCounts[c.source].hired++;
      }
    });

    const sourceStats = Object.entries(sourceCounts).map(([key, val]) => ({
      name: SOURCE_LABELS[key as keyof typeof SOURCE_LABELS] || key,
      value: val.total,
      hired: val.hired,
      conversionRate: val.total > 0 ? Math.round((val.hired / val.total) * 100) : 0
    }));
    setSourceData(sourceStats);

    // Calculate monthly data (last 6 months)
    const monthlyStats: Record<string, { received: number; hired: number; rejected: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyStats[key] = { received: 0, hired: 0, rejected: 0 };
    }

    (candidates || []).forEach(c => {
      const created = new Date(c.created_at);
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyStats[key]) {
        monthlyStats[key].received++;
        if (c.current_stage === 'hired') monthlyStats[key].hired++;
        if (c.status === 'rejected') monthlyStats[key].rejected++;
      }
    });

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyArray = Object.entries(monthlyStats).map(([key, val]) => ({
      month: monthNames[parseInt(key.split('-')[1]) - 1],
      ...val
    }));
    setMonthlyData(monthlyArray);

    // Calculate KPIs
    const totalCandidates = candidates?.length || 0;
    const hiredCandidates = candidates?.filter(c => c.current_stage === 'hired').length || 0;
    const talentPool = candidates?.filter(c => c.current_stage === 'talent_pool').length || 0;
    const activeJobs = jobs?.filter((j: any) => j.status === 'open').length || 0;
    const activeCandidates = candidates?.filter(c => c.status === 'active').length || 0;

    // Jobs overdue (simplified - no deadline column)
    const overdueJobs = 0;

    // Calculate average time to hire
    const hiredWithDates = candidates?.filter(c => 
      c.current_stage === 'hired' && c.created_at && c.updated_at
    ) || [];
    
    let avgDays = 0;
    if (hiredWithDates.length > 0) {
      const totalDays = hiredWithDates.reduce((sum, c) => {
        const created = new Date(c.created_at);
        const updated = new Date(c.updated_at);
        return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDays = Math.round(totalDays / hiredWithDates.length);
    }

    setKpis({
      overallConversion: totalCandidates > 0 ? Math.round((hiredCandidates / totalCandidates) * 100) : 0,
      avgTimeToHire: avgDays,
      jobsOverdue: overdueJobs,
      talentPoolCount: talentPool,
      activeJobs,
      activeCandidates,
      completedInterviews: interviews?.length || 0,
      discCompleted: discResults?.length || 0
    });

    setLoading(false);
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

  const chartConfig = {
    received: { label: "Recebidos", color: "hsl(var(--primary))" },
    hired: { label: "Contratados", color: "hsl(142, 76%, 36%)" },
    rejected: { label: "Rejeitados", color: "hsl(var(--destructive))" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                <p className="text-3xl font-bold">{kpis.overallConversion}%</p>
              </div>
              <div className={`p-3 rounded-full ${kpis.overallConversion > 10 ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                {kpis.overallConversion > 10 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Candidatos contratados / total</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio de Contratação</p>
                <p className="text-3xl font-bold">{kpis.avgTimeToHire}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">dias em média</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vagas em Atraso</p>
                <p className="text-3xl font-bold">{kpis.jobsOverdue}</p>
              </div>
              <div className={`p-3 rounded-full ${kpis.jobsOverdue > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {kpis.jobsOverdue > 0 ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">SLA excedido</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Banco de Talentos</p>
                <p className="text-3xl font-bold">{kpis.talentPoolCount}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">candidatos guardados</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-lg font-semibold">{kpis.activeJobs}</p>
              <p className="text-xs text-muted-foreground">Vagas Abertas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-lg font-semibold">{kpis.activeCandidates}</p>
              <p className="text-xs text-muted-foreground">Candidatos Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-lg font-semibold">{kpis.completedInterviews}</p>
              <p className="text-xs text-muted-foreground">Entrevistas Realizadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-lg font-semibold">{kpis.discCompleted}</p>
              <p className="text-xs text-muted-foreground">DISC Completados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="stageName" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Candidatos']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Candidatos por Fonte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} candidatos (${props.payload.conversionRate}% conversão)`, 
                      'Total'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="received" 
                name="Recebidos"
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))" }}
              />
              <Line 
                type="monotone" 
                dataKey="hired" 
                name="Contratados"
                stroke="hsl(142, 76%, 36%)" 
                strokeWidth={2}
                dot={{ fill: "hsl(142, 76%, 36%)" }}
              />
              <Line 
                type="monotone" 
                dataKey="rejected" 
                name="Rejeitados"
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--destructive))" }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Conversion by Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxa de Conversão por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pipelineData.slice(0, -1).map((stage, index) => {
              const nextStage = pipelineData[index + 1];
              const conversionRate = stage.count > 0 
                ? Math.round((nextStage?.count / stage.count) * 100) 
                : 0;
              
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="flex-1 text-sm">{stage.stageName} → {nextStage?.stageName}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(conversionRate, 100)}%`,
                          backgroundColor: stage.color
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{conversionRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
