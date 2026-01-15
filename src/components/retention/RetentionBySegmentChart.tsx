import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { PieChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SegmentRetention {
  segment: string;
  active: number;
  churned: number;
  total: number;
  retentionRate: number;
}

export function RetentionBySegmentChart() {
  const [data, setData] = useState<SegmentRetention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegmentData();
  }, []);

  const fetchSegmentData = async () => {
    try {
      const { data: projects, error } = await supabase
        .from('onboarding_projects')
        .select(`
          id,
          status,
          onboarding_companies!inner(segment)
        `)
        .not('onboarding_companies.segment', 'is', null);

      if (error) throw error;

      // Group by segment
      const segmentMap: { [key: string]: { active: number; churned: number; total: number } } = {};

      (projects || []).forEach((project: any) => {
        const segment = project.onboarding_companies?.segment || 'Outros';
        
        if (!segmentMap[segment]) {
          segmentMap[segment] = { active: 0, churned: 0, total: 0 };
        }
        
        segmentMap[segment].total++;
        if (project.status === 'active') {
          segmentMap[segment].active++;
        } else if (project.status === 'churned' || project.status === 'cancelled') {
          segmentMap[segment].churned++;
        }
      });

      // Convert to array and calculate retention
      const segmentData: SegmentRetention[] = Object.entries(segmentMap)
        .filter(([_, data]) => data.total >= 2) // Only segments with at least 2 projects
        .map(([segment, data]) => ({
          segment: segment.length > 15 ? segment.substring(0, 15) + '...' : segment,
          active: data.active,
          churned: data.churned,
          total: data.total,
          retentionRate: data.total > 0 ? (data.active / data.total) * 100 : 0
        }))
        .sort((a, b) => b.retentionRate - a.retentionRate);

      setData(segmentData);
    } catch (error) {
      console.error('Error fetching segment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (rate: number) => {
    if (rate >= 80) return 'hsl(142, 76%, 36%)'; // green-600
    if (rate >= 60) return 'hsl(142, 71%, 45%)'; // green-500
    if (rate >= 40) return 'hsl(48, 96%, 53%)';  // yellow-400
    return 'hsl(0, 84%, 60%)';                    // red-500
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
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Retenção por Segmento
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Taxa de retenção de clientes por segmento de mercado
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Sem dados de segmentos disponíveis
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(250, data.length * 40)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                domain={[0, 100]} 
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis 
                type="category" 
                dataKey="segment" 
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  'Taxa de Retenção'
                ]}
                labelFormatter={(label) => `Segmento: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="retentionRate" 
                radius={[0, 4, 4, 0]}
                maxBarSize={30}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.retentionRate)} />
                ))}
                <LabelList 
                  dataKey="retentionRate" 
                  position="right" 
                  formatter={(v: number) => `${v.toFixed(0)}%`}
                  style={{ fontSize: 12, fontWeight: 500 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Summary */}
        {data.length > 0 && (
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-500">
                {data.filter(d => d.retentionRate >= 80).length}
              </div>
              <div className="text-xs text-muted-foreground">Excelente (&gt;80%)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">
                {data.filter(d => d.retentionRate >= 40 && d.retentionRate < 80).length}
              </div>
              <div className="text-xs text-muted-foreground">Atenção (40-80%)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">
                {data.filter(d => d.retentionRate < 40).length}
              </div>
              <div className="text-xs text-muted-foreground">Crítico (&lt;40%)</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
