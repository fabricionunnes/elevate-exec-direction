import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Users, 
  TrendingUp,
  BarChart3,
  Trophy,
  Calendar,
  DollarSign
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

export default function CohortRetentionPage() {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [overallStats, setOverallStats] = useState({
    totalActive: 0,
    totalChurned: 0,
    totalProjects: 0,
    retentionRate: 0,
    avgLifetime: 0,
    avgTicket: 0
  });
  
  // Staff state for consultant filtering
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isConsultant, setIsConsultant] = useState(false);

  useEffect(() => {
    checkUserPermissions();
  }, []);

  useEffect(() => {
    if (currentUserRole !== null) {
      fetchFilters();
      fetchOverallStats();
      
      // Auto-filter to consultant's own data
      if (isConsultant && currentStaffId) {
        setConsultantFilter(currentStaffId);
      }
    }
  }, [currentUserRole, currentStaffId, isConsultant]);

  const checkUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staffMember } = await supabase
          .from("onboarding_staff")
          .select("id, role")
          .eq("user_id", user.id)
          .single();

        if (staffMember) {
          const normalizedRole = (staffMember.role || "").trim().toLowerCase();
          setCurrentUserRole(normalizedRole);
          setCurrentStaffId(staffMember.id);
          setIsConsultant(normalizedRole === 'consultant');
        } else {
          setCurrentUserRole("");
        }
      } else {
        setCurrentUserRole("");
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
      setCurrentUserRole("");
    }
  };

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

      // Filter for consultants
      let filteredProjects = projects;
      let companyIds = new Set<string>();
      
      if (isConsultant && currentStaffId) {
        // Get companies linked to this consultant
        const { data: companies } = await supabase
          .from('onboarding_companies')
          .select('id')
          .or(`consultant_id.eq.${currentStaffId},cs_id.eq.${currentStaffId}`);
        
        companyIds = new Set((companies || []).map((c: any) => c.id));
        
        filteredProjects = projects.filter((p: any) => 
          p.consultant_id === currentStaffId ||
          p.cs_id === currentStaffId ||
          companyIds.has(p.onboarding_company_id)
        );
      }

      const active = filteredProjects.filter((p: any) => p.status === 'active').length;
      const churned = filteredProjects.filter((p: any) => p.status === 'churned' || p.status === 'cancelled' || p.status === 'closed').length;
      const total = filteredProjects.length;

      // Calculate average lifetime in months
      const completedProjects = filteredProjects.filter((p: any) => p.end_date);
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

      // Calculate average ticket from active companies
      let avgTicket = 0;
      const projectCompanyIds = [...new Set(filteredProjects.map((p: any) => p.onboarding_company_id).filter(Boolean))];
      
      if (projectCompanyIds.length > 0) {
        const { data: companiesData } = await supabase
          .from('onboarding_companies')
          .select('id, contract_value, payment_method, status')
          .in('id', projectCompanyIds)
          .eq('status', 'active');
        
        if (companiesData && companiesData.length > 0) {
          // Calculate MRR for each company
          let totalMRR = 0;
          companiesData.forEach((c: any) => {
            const value = Number(c.contract_value) || 0;
            const paymentMethod = (c.payment_method || "").toLowerCase();
            
            if (paymentMethod === "monthly" || paymentMethod === "mensal" || paymentMethod === "recorrente") {
              totalMRR += value;
            } else if (paymentMethod === "quarterly" || paymentMethod === "trimestral") {
              totalMRR += value / 3;
            } else if (paymentMethod === "semiannual" || paymentMethod === "semestral") {
              totalMRR += value / 6;
            } else if (paymentMethod === "annual" || paymentMethod === "anual" || paymentMethod === "card" || paymentMethod === "cartao" || paymentMethod === "cartão" || paymentMethod === "boleto" || paymentMethod === "pix") {
              totalMRR += value / 12;
            } else if (value > 1000) {
              totalMRR += value / 12;
            } else if (value > 0) {
              totalMRR += value;
            }
          });
          
          avgTicket = companiesData.length > 0 ? totalMRR / companiesData.length : 0;
        }
      }

      setOverallStats({
        totalActive: active,
        totalChurned: churned,
        totalProjects: total,
        retentionRate: total > 0 ? (active / total) * 100 : 0,
        avgLifetime,
        avgTicket
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/onboarding-tasks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Análise de Cohort & Retenção
            </h1>
            <p className="text-muted-foreground">
              Visão estratégica de retenção por segmento, consultor e período
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-3xl font-bold text-blue-500">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(overallStats.avgTicket)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-500 opacity-50" />
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
        {/* Hide consultant filter for consultants - they only see their own data */}
        {!isConsultant && (
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
        )}
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
