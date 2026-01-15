import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, Medal, Award, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ConsultantRetention {
  id: string;
  name: string;
  avatar_url?: string;
  active: number;
  churned: number;
  total: number;
  retentionRate: number;
  rank: number;
}

export function ConsultantRetentionRanking() {
  const [consultants, setConsultants] = useState<ConsultantRetention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConsultantData();
  }, []);

  const fetchConsultantData = async () => {
    try {
      // Get all projects with their consultants
      const { data: projects, error } = await supabase
        .from('onboarding_projects')
        .select(`
          id,
          status,
          consultant_id,
          onboarding_staff!onboarding_projects_consultant_id_fkey(
            id,
            name,
            avatar_url
          )
        `)
        .not('consultant_id', 'is', null);

      if (error) throw error;

      // Group by consultant
      const consultantMap: { [key: string]: { 
        id: string;
        name: string;
        avatar_url?: string;
        active: number; 
        churned: number; 
        total: number 
      }} = {};

      (projects || []).forEach((project: any) => {
        const consultant = project.onboarding_staff;
        if (!consultant) return;

        if (!consultantMap[consultant.id]) {
          consultantMap[consultant.id] = { 
            id: consultant.id,
            name: consultant.name,
            avatar_url: consultant.avatar_url,
            active: 0, 
            churned: 0, 
            total: 0 
          };
        }
        
        consultantMap[consultant.id].total++;
        if (project.status === 'active') {
          consultantMap[consultant.id].active++;
        } else if (project.status === 'churned' || project.status === 'cancelled') {
          consultantMap[consultant.id].churned++;
        }
      });

      // Convert to array and calculate retention
      const consultantData: ConsultantRetention[] = Object.values(consultantMap)
        .filter(c => c.total >= 3) // Only consultants with at least 3 projects
        .map(c => ({
          ...c,
          retentionRate: c.total > 0 ? (c.active / c.total) * 100 : 0,
          rank: 0
        }))
        .sort((a, b) => b.retentionRate - a.retentionRate)
        .map((c, idx) => ({ ...c, rank: idx + 1 }));

      setConsultants(consultantData);
    } catch (error) {
      console.error('Error fetching consultant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-muted-foreground font-medium">{rank}</span>;
    }
  };

  const getRetentionBadge = (rate: number) => {
    if (rate >= 90) return { label: 'Excelente', variant: 'default' as const, className: 'bg-green-500' };
    if (rate >= 75) return { label: 'Bom', variant: 'default' as const, className: 'bg-green-400' };
    if (rate >= 60) return { label: 'Regular', variant: 'secondary' as const, className: '' };
    return { label: 'Atenção', variant: 'destructive' as const, className: '' };
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgRetention = consultants.length > 0
    ? consultants.reduce((acc, c) => acc + c.retentionRate, 0) / consultants.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking de Retenção por Consultor
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Consultores ordenados por taxa de retenção de clientes
        </p>
      </CardHeader>
      <CardContent>
        {consultants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Sem dados suficientes para ranking
          </div>
        ) : (
          <>
            {/* Average indicator */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
              <span className="text-sm text-muted-foreground">Média de Retenção</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{avgRetention.toFixed(1)}%</span>
                {avgRetention >= 75 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-3">
                {consultants.map((consultant) => {
                  const badge = getRetentionBadge(consultant.retentionRate);
                  
                  return (
                    <div
                      key={consultant.id}
                      className={`
                        flex items-center gap-4 p-3 rounded-lg border
                        ${consultant.rank <= 3 ? 'bg-muted/30' : ''}
                      `}
                    >
                      <div className="flex items-center justify-center w-8">
                        {getRankIcon(consultant.rank)}
                      </div>
                      
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={consultant.avatar_url} alt={consultant.name} />
                        <AvatarFallback>{getInitials(consultant.name)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{consultant.name}</h4>
                          <Badge className={badge.className} variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress 
                            value={consultant.retentionRate} 
                            className="flex-1 h-2"
                          />
                          <span className="text-sm font-medium w-12 text-right">
                            {consultant.retentionRate.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {consultant.active} ativo{consultant.active !== 1 ? 's' : ''} de {consultant.total} • 
                          {consultant.churned} churn{consultant.churned !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
