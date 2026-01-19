import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInMonths, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CohortData {
  cohort: string;
  cohortLabel: string;
  totalCompanies: number;
  retentionByMonth: { [month: number]: { active: number; total: number; rate: number } };
}

interface Props {
  segmentFilter?: string;
  consultantFilter?: string;
  monthsToShow?: number;
}

export function CohortMatrix({ segmentFilter, consultantFilter, monthsToShow = 6 }: Props) {
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodMonths, setPeriodMonths] = useState(12);

  useEffect(() => {
    fetchCohortData();
  }, [segmentFilter, consultantFilter, periodMonths]);

  const fetchCohortData = async () => {
    setLoading(true);
    try {
      // Get all projects with their start dates and current status
      let query = supabase
        .from('onboarding_projects')
        .select(`
          id,
          status,
          start_date,
          end_date,
          created_at,
          onboarding_companies(
            id,
            name,
            segment
          ),
          onboarding_services!inner(name),
          onboarding_staff(name)
        `)
        .not('start_date', 'is', null);

      if (segmentFilter && segmentFilter !== 'all') {
        query = query.eq('onboarding_companies.segment', segmentFilter);
      }

      if (consultantFilter && consultantFilter !== 'all') {
        query = query.eq('consultant_id', consultantFilter);
      }

      const { data: projects, error } = await query;
      if (error) throw error;

      // Group projects by start month (cohort)
      const cohorts: { [key: string]: any[] } = {};
      const now = new Date();
      const startPeriod = subMonths(now, periodMonths);

      (projects || []).forEach((project: any) => {
        const startDate = project.start_date ? parseISO(project.start_date) : new Date(project.created_at);
        if (startDate < startPeriod) return;
        
        const cohortKey = format(startOfMonth(startDate), 'yyyy-MM');
        if (!cohorts[cohortKey]) {
          cohorts[cohortKey] = [];
        }
        cohorts[cohortKey].push(project);
      });

      // Calculate retention for each cohort
      const cohortResults: CohortData[] = [];

      Object.entries(cohorts)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 8) // Last 8 cohorts
        .forEach(([cohortKey, projects]) => {
          const cohortDate = parseISO(cohortKey + '-01');
          const retentionByMonth: CohortData['retentionByMonth'] = {};

          // For each month from cohort start to now
          for (let monthOffset = 0; monthOffset <= monthsToShow; monthOffset++) {
            const checkDate = new Date(cohortDate);
            checkDate.setMonth(checkDate.getMonth() + monthOffset);
            
            if (checkDate > now) break;

            // Count active projects at this point
            const activeCount = projects.filter((p: any) => {
              const startDate = p.start_date ? parseISO(p.start_date) : new Date(p.created_at);
              const endDate = p.end_date ? parseISO(p.end_date) : null;
              
              // Project was active if started before checkDate and (no end or end after checkDate)
              const wasActive = startDate <= checkDate && (!endDate || endDate > checkDate);
              // Or is currently active
              const isCurrentlyActive = p.status === 'active';
              
              return monthOffset === 0 ? true : (wasActive || (checkDate > now && isCurrentlyActive));
            }).length;

            retentionByMonth[monthOffset] = {
              active: monthOffset === 0 ? projects.length : activeCount,
              total: projects.length,
              rate: projects.length > 0 ? (activeCount / projects.length) * 100 : 0
            };
          }

          cohortResults.push({
            cohort: cohortKey,
            cohortLabel: format(cohortDate, 'MMM/yy', { locale: ptBR }),
            totalCompanies: projects.length,
            retentionByMonth
          });
        });

      setCohortData(cohortResults);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRetentionColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500 text-white';
    if (rate >= 60) return 'bg-green-400 text-white';
    if (rate >= 40) return 'bg-yellow-400 text-black';
    if (rate >= 20) return 'bg-orange-400 text-white';
    return 'bg-red-500 text-white';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Matriz de Cohort
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Retenção por mês de início
          </p>
        </div>
        <Select value={periodMonths.toString()} onValueChange={(v) => setPeriodMonths(parseInt(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
            <SelectItem value="24">Últimos 24 meses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {cohortData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Sem dados suficientes para exibir cohorts
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Cohort</TableHead>
                  <TableHead className="w-16 text-center">Início</TableHead>
                  {Array.from({ length: monthsToShow + 1 }, (_, i) => (
                    <TableHead key={i} className="w-14 text-center">
                      M{i}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortData.map((cohort) => (
                  <TableRow key={cohort.cohort}>
                    <TableCell className="font-medium">{cohort.cohortLabel}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {cohort.totalCompanies}
                    </TableCell>
                    {Array.from({ length: monthsToShow + 1 }, (_, monthOffset) => {
                      const data = cohort.retentionByMonth[monthOffset];
                      if (!data) {
                        return <TableCell key={monthOffset} className="text-center">-</TableCell>;
                      }
                      return (
                        <TableCell key={monthOffset} className="p-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className={`
                                    w-full h-10 flex items-center justify-center rounded text-sm font-medium
                                    ${getRetentionColor(data.rate)}
                                  `}
                                >
                                  {data.rate.toFixed(0)}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{data.active} de {data.total} empresas</p>
                                <p className="text-xs text-muted-foreground">
                                  Retenção: {data.rate.toFixed(1)}%
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span>&gt;80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-400 rounded" />
            <span>60-80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-400 rounded" />
            <span>40-60%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-orange-400 rounded" />
            <span>20-40%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span>&lt;20%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
