import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  TrendingDown, 
  AlertTriangle, 
  Search,
  RefreshCw,
  Clock,
  Target,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { RescuePlaybookBadge } from "@/components/onboarding-tasks/rescue-playbook/RescuePlaybookBadge";
import { RescuePlaybookDialog } from "@/components/onboarding-tasks/rescue-playbook/RescuePlaybookDialog";
import { GeneratePlaybookButton } from "@/components/onboarding-tasks/rescue-playbook/GeneratePlaybookButton";

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
  consultant_name?: string;
}

export default function ChurnPredictionPage() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<ChurnPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Rescue playbook state
  const [playbookDialogOpen, setPlaybookDialogOpen] = useState(false);
  const [selectedPlaybookProjectId, setSelectedPlaybookProjectId] = useState<string | null>(null);
  const [selectedPlaybookCompanyName, setSelectedPlaybookCompanyName] = useState<string>("");
  const [playbookStatuses, setPlaybookStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPredictions();
    fetchPlaybookStatuses();
  }, []);
  
  const fetchPlaybookStatuses = async () => {
    try {
      const { data } = await supabase
        .from('rescue_playbooks')
        .select('project_id, status')
        .order('created_at', { ascending: false });
      
      const statusMap: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        if (!statusMap[p.project_id]) {
          statusMap[p.project_id] = p.status;
        }
      });
      setPlaybookStatuses(statusMap);
    } catch (error) {
      console.error('Error fetching playbook statuses:', error);
    }
  };

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
        .order('churn_probability', { ascending: false });

      if (error) throw error;

      const formattedPredictions = (data || []).map((p: any) => ({
        ...p,
        company_name: p.onboarding_projects?.onboarding_companies?.name,
        product_name: p.onboarding_projects?.product_name
      }));

      setPredictions(formattedPredictions);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast.error('Erro ao carregar previsões');
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

  const filteredPredictions = predictions.filter(p => {
    const matchesSearch = 
      p.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.consultant_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = riskFilter === 'all' || p.risk_level === riskFilter;
    
    return matchesSearch && matchesRisk;
  });

  const stats = {
    critical: predictions.filter(p => p.risk_level === 'critical').length,
    high: predictions.filter(p => p.risk_level === 'high').length,
    medium: predictions.filter(p => p.risk_level === 'medium').length,
    low: predictions.filter(p => p.risk_level === 'low').length,
    avgProbability: predictions.length > 0 
      ? predictions.reduce((acc, p) => acc + p.churn_probability, 0) / predictions.length 
      : 0
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

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
              <TrendingDown className="h-6 w-6 text-orange-500" />
              Previsão de Churn com IA
            </h1>
            <p className="text-muted-foreground">
              Análise preditiva de risco de cancelamento baseada em múltiplos indicadores
            </p>
          </div>
        </div>
        <Button onClick={calculateAllPredictions} disabled={calculating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Calculando...' : 'Recalcular Todos'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Crítico</p>
                <p className="text-3xl font-bold text-red-500">{stats.critical}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alto</p>
                <p className="text-3xl font-bold text-orange-500">{stats.high}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Médio</p>
                <p className="text-3xl font-bold text-yellow-500">{stats.medium}</p>
              </div>
              <Target className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Baixo</p>
                <p className="text-3xl font-bold text-green-500">{stats.low}</p>
              </div>
              <Target className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prob. Média</p>
                <p className="text-3xl font-bold">{stats.avgProbability.toFixed(0)}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa, serviço ou consultor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por risco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Predictions List */}
      {filteredPredictions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium">Nenhuma previsão encontrada</h3>
            <p className="text-muted-foreground mt-1">
              {predictions.length === 0 
                ? 'Clique em "Recalcular Todos" para gerar previsões'
                : 'Tente ajustar os filtros de busca'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPredictions.map((prediction) => {
            const config = getRiskLevelConfig(prediction.risk_level);
            const isExpanded = expandedId === prediction.id;

            return (
              <Card 
                key={prediction.id}
                className={`transition-all ${
                  prediction.risk_level === 'critical' ? 'border-red-500/50' :
                  prediction.risk_level === 'high' ? 'border-orange-500/50' :
                  ''
                }`}
              >
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : prediction.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${config.bgLight}`}>
                        <span className={`text-lg font-bold ${config.textColor}`}>
                          {prediction.churn_probability.toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {prediction.company_name}
                          <Badge className={`${config.bgLight} ${config.textColor} border-0`}>
                            {config.label}
                          </Badge>
                          <RescuePlaybookBadge 
                            status={playbookStatuses[prediction.project_id]}
                            onClick={() => {
                              setSelectedPlaybookProjectId(prediction.project_id);
                              setSelectedPlaybookCompanyName(prediction.company_name || "");
                              setPlaybookDialogOpen(true);
                            }}
                          />
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {prediction.product_name} • {prediction.consultant_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Risco em {getRiskWindowLabel(prediction.estimated_risk_window)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Atualizado: {format(new Date(prediction.prediction_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <Progress 
                    value={prediction.churn_probability} 
                    className="mt-3 h-2"
                  />
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <Tabs defaultValue="factors" className="w-full">
                      <TabsList className="mb-4">
                        <TabsTrigger value="factors">Fatores de Risco</TabsTrigger>
                        <TabsTrigger value="actions">Ações Recomendadas</TabsTrigger>
                        <TabsTrigger value="analysis">Análise IA</TabsTrigger>
                      </TabsList>

                      <TabsContent value="factors" className="mt-0">
                        <div className="space-y-3">
                          {(prediction.risk_factors as any[])
                            .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
                            .map((factor, idx) => (
                              <div key={idx} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">{factor.factor}</span>
                                    <span className={`text-sm font-medium ${
                                      factor.score >= 60 ? 'text-red-500' : 
                                      factor.score >= 30 ? 'text-yellow-500' : 
                                      'text-green-500'
                                    }`}>
                                      {factor.score}%
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{factor.details}</p>
                                  <Progress 
                                    value={factor.score} 
                                    className="mt-2 h-1.5"
                                  />
                                </div>
                              </div>
                            ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="actions" className="mt-0">
                        <div className="space-y-2">
                          {prediction.recommended_actions.map((action, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20"
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary">{idx + 1}</span>
                              </div>
                              <p className="text-sm">{action}</p>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="analysis" className="mt-0">
                        <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted/30 rounded-lg">
                          <ReactMarkdown>{prediction.ai_analysis || 'Análise não disponível'}</ReactMarkdown>
                        </div>
                        <div className="flex gap-4 mt-4 text-sm">
                          {prediction.health_score_at_prediction !== null && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                              <span className="text-muted-foreground">Health Score:</span>
                              <span className="font-medium">{prediction.health_score_at_prediction.toFixed(0)}</span>
                            </div>
                          )}
                          {prediction.nps_at_prediction !== null && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                              <span className="text-muted-foreground">NPS:</span>
                              <span className="font-medium">{prediction.nps_at_prediction.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex gap-2 mt-4 pt-4 border-t flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/onboarding-tasks/${prediction.project_id}`)}
                      >
                        Ver Projeto
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/onboarding-tasks/${prediction.project_id}/health-score`)}
                      >
                        Ver Health Score
                      </Button>
                      {(prediction.risk_level === 'high' || prediction.risk_level === 'critical') && 
                       !playbookStatuses[prediction.project_id] && (
                        <GeneratePlaybookButton
                          projectId={prediction.project_id}
                          churnPredictionId={prediction.id}
                          onSuccess={fetchPlaybookStatuses}
                        />
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
      
      <RescuePlaybookDialog
        open={playbookDialogOpen}
        onOpenChange={setPlaybookDialogOpen}
        projectId={selectedPlaybookProjectId || ""}
        companyName={selectedPlaybookCompanyName}
      />
    </div>
  );
}
