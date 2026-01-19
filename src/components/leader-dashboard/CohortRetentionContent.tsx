import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  TrendingUp,
  BarChart3,
  Trophy,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CohortMatrix } from '@/components/retention/CohortMatrix';
import { RetentionBySegmentChart } from '@/components/retention/RetentionBySegmentChart';
import { ConsultantRetentionRanking } from '@/components/retention/ConsultantRetentionRanking';

interface Segment {
  value: string;
  label: string;
}

interface Consultant {
  id: string;
  name: string;
}

export default function CohortRetentionContent() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [overallStats, setOverallStats] = useState({
    totalActive: 0,
    totalChurned: 0,
    totalProjects: 0,
    retentionRate: 0,
    avgLifetime: 0
  });

  useEffect(() => {
    fetchFilters();
    fetchOverallStats();
  }, []);

  const fetchFilters = async () => {
    try {
      // Fetch unique segments
      const { data: companies } = await supabase
        .from('onboarding_companies')
        .select('segment')
        .not('segment', 'is', null);

      const uniqueSegments = [...new Set((companies || []).map((c: any) => c.segment))]
        .filter(Boolean)
        .map(s => ({ value: s, label: s }));
      
      setSegments(uniqueSegments);

      // Fetch consultants
      const { data: staff } = await supabase
        .from('onboarding_staff')
        .select('id, name')
        .eq('role', 'consultant')
        .eq('is_active', true);

      setConsultants(staff || []);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const fetchOverallStats = async () => {
    try {
      let query = supabase
        .from('onboarding_projects')
        .select('status, start_date, end_date, consultant_id, cs_id, onboarding_company_id')
        .not('start_date', 'is', null);

      const { data: projects } = await query;

      if (!projects) return;

      const active = projects.filter((p: any) => p.status === 'active').length;
      const churned = projects.filter((p: any) => p.status === 'churned' || p.status === 'cancelled' || p.status === 'closed').length;
      const total = projects.length;

      // Calculate average lifetime in months
      const completedProjects = projects.filter((p: any) => p.end_date);
      let avgLifetime = 0;
      if (completedProjects.length > 0) {
        const totalMonths = completedProjects.reduce((acc: number, p: any) => {
          const start = new Date(p.start_date);
          const end = new Date(p.end_date);
          const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
          return acc + months;
        }, 0);
        avgLifetime = totalMonths / completedProjects.length;
      }

      setOverallStats({
        totalActive: active,
        totalChurned: churned,
        totalProjects: total,
        retentionRate: total > 0 ? (active / total) * 100 : 0,
        avgLifetime
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Análise de Cohort & Retenção
        </h2>
        <p className="text-sm text-muted-foreground">
          Visão estratégica de retenção por segmento, consultor e período
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Projetos</p>
                <p className="text-3xl font-bold">{overallStats.totalProjects}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-3xl font-bold text-green-500">{overallStats.totalActive}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Churned</p>
                <p className="text-3xl font-bold text-red-500">{overallStats.totalChurned}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Retenção</p>
                <p className="text-3xl font-bold text-primary">{overallStats.retentionRate.toFixed(1)}%</p>
              </div>
              <Trophy className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-3xl font-bold">{overallStats.avgLifetime.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">meses</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {segments.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={consultantFilter} onValueChange={setConsultantFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os consultores</SelectItem>
            {consultants.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="cohort" className="w-full">
        <TabsList>
          <TabsTrigger value="cohort" className="gap-2">
            <Users className="h-4 w-4" />
            Matriz de Cohort
          </TabsTrigger>
          <TabsTrigger value="segment" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Por Segmento
          </TabsTrigger>
          <TabsTrigger value="consultant" className="gap-2">
            <Trophy className="h-4 w-4" />
            Por Consultor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cohort" className="mt-6">
          <CohortMatrix 
            segmentFilter={segmentFilter !== 'all' ? segmentFilter : undefined}
            consultantFilter={consultantFilter !== 'all' ? consultantFilter : undefined}
          />
        </TabsContent>

        <TabsContent value="segment" className="mt-6">
          <RetentionBySegmentChart />
        </TabsContent>

        <TabsContent value="consultant" className="mt-6">
          <ConsultantRetentionRanking />
        </TabsContent>
      </Tabs>
    </div>
  );
}
