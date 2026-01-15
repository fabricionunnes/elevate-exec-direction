import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  TrendingDown, 
  RefreshCw, 
  ChevronRight,
  Clock,
  Target,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChurnPrediction {
  id: string;
  project_id: string;
  prediction_date: string;
  churn_probability: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: Array<{
    factor: string;
    weight: number;
    score: number;
    details: string;
  }>;
  recommended_actions: string[];
  estimated_risk_window: '30_days' | '60_days' | '90_days';
  ai_analysis: string;
  health_score_at_prediction: number | null;
  nps_at_prediction: number | null;
  company_name?: string;
  product_name?: string;
}

interface Props {
  onViewDetails?: (projectId: string) => void;
  limit?: number;
}

export function ChurnPredictionWidget({ onViewDetails, limit = 5 }: Props) {
  const [predictions, setPredictions] = useState<ChurnPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('churn_predictions')
        .select(`
          *,
          onboarding_projects!inner(
            status,
            product_name,
            onboarding_companies!inner(name)
          )
        `)
        .eq('prediction_date', today)
        .eq('onboarding_projects.status', 'active')
        .order('churn_probability', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formattedPredictions = (data || []).map((p: any) => ({
        ...p,
        company_name: p.onboarding_projects?.onboarding_companies?.name,
        product_name: p.onboarding_projects?.product_name
      }));

      setPredictions(formattedPredictions);
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllPredictions = async () => {
    setCalculating(true);
    try {
      // Batch processing to avoid function timeouts
      const pageSize = 20;
      let offset = 0;
      let totalCalculated = 0;
      let safety = 0;

      while (safety < 200) {
        safety++;
        const { data, error } = await supabase.functions.invoke('predict-churn', {
          body: { calculate_all: true, offset, limit: pageSize }
        });

        if (error) throw error;

        totalCalculated += data?.predictions?.length || 0;

        if (!data?.paging?.has_more) break;
        offset = data.paging.next_offset;
      }

      toast.success(`${totalCalculated} previsões calculadas`);
      fetchPredictions();
    } catch (error: any) {
      console.error('Error calculating predictions:', error);
      toast.error('Erro ao calcular previsões');
    } finally {
      setCalculating(false);
    }
  };

  const getRiskLevelConfig = (level: string) => {
    switch (level) {
      case 'critical':
        return { label: 'Crítico', color: 'bg-red-500', textColor: 'text-red-500', bgLight: 'bg-red-500/10' };
      case 'high':
        return { label: 'Alto', color: 'bg-orange-500', textColor: 'text-orange-500', bgLight: 'bg-orange-500/10' };
      case 'medium':
        return { label: 'Médio', color: 'bg-yellow-500', textColor: 'text-yellow-500', bgLight: 'bg-yellow-500/10' };
      default:
        return { label: 'Baixo', color: 'bg-green-500', textColor: 'text-green-500', bgLight: 'bg-green-500/10' };
    }
  };

  const getRiskWindowLabel = (window: string) => {
    switch (window) {
      case '30_days': return '30 dias';
      case '60_days': return '60 dias';
      case '90_days': return '90 dias';
      default: return window;
    }
  };

  const criticalCount = predictions.filter(p => p.risk_level === 'critical').length;
  const highCount = predictions.filter(p => p.risk_level === 'high').length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-500" />
            Previsão de Churn
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de risco baseada em IA
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={calculateAllPredictions}
          disabled={calculating}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Calculando...' : 'Atualizar'}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Summary badges */}
        <div className="flex gap-2 mb-4">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-orange-500 hover:bg-orange-600 gap-1">
              <AlertTriangle className="h-3 w-3" />
              {highCount} alto{highCount > 1 ? 's' : ''}
            </Badge>
          )}
          {criticalCount === 0 && highCount === 0 && (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Sem alertas críticos
            </Badge>
          )}
        </div>

        {predictions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma previsão calculada</p>
            <p className="text-sm">Clique em "Atualizar" para gerar previsões</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {predictions.map((prediction) => {
                const config = getRiskLevelConfig(prediction.risk_level);
                const isExpanded = expandedId === prediction.id;

                return (
                  <div
                    key={prediction.id}
                    className={`border rounded-lg p-3 transition-all ${
                      prediction.risk_level === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                      prediction.risk_level === 'high' ? 'border-orange-500/50 bg-orange-500/5' :
                      ''
                    }`}
                  >
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : prediction.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">
                            {prediction.company_name}
                          </h4>
                          <Badge className={`${config.bgLight} ${config.textColor} border-0 text-xs`}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {prediction.product_name}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-lg font-bold ${config.textColor}`}>
                            {prediction.churn_probability.toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getRiskWindowLabel(prediction.estimated_risk_window)}
                          </div>
                        </div>
                        <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>

                    <div className="mt-2">
                      <Progress 
                        value={prediction.churn_probability} 
                        className="h-2"
                      />
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {/* Risk Factors */}
                        <div>
                          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Fatores de Risco
                          </h5>
                          <div className="space-y-2">
                            {(prediction.risk_factors as any[])
                              .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
                              .slice(0, 4)
                              .map((factor, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{factor.factor}</span>
                                  <div className="flex items-center gap-2">
                                    <Progress 
                                      value={factor.score} 
                                      className="w-16 h-1.5"
                                    />
                                    <span className={`text-xs font-medium w-8 text-right ${
                                      factor.score >= 60 ? 'text-red-500' : 
                                      factor.score >= 30 ? 'text-yellow-500' : 
                                      'text-green-500'
                                    }`}>
                                      {factor.score}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Recommended Actions */}
                        <div>
                          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Ações Recomendadas
                          </h5>
                          <ul className="space-y-1">
                            {prediction.recommended_actions.map((action, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-primary">•</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Health Score & NPS at prediction */}
                        <div className="flex gap-4 text-sm">
                          {prediction.health_score_at_prediction !== null && (
                            <div>
                              <span className="text-muted-foreground">Health Score: </span>
                              <span className="font-medium">{prediction.health_score_at_prediction.toFixed(0)}</span>
                            </div>
                          )}
                          {prediction.nps_at_prediction !== null && (
                            <div>
                              <span className="text-muted-foreground">NPS: </span>
                              <span className="font-medium">{prediction.nps_at_prediction.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        {onViewDetails && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => onViewDetails(prediction.project_id)}
                          >
                            Ver Detalhes do Projeto
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
