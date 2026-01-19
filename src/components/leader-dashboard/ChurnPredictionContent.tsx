import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
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

export default function ChurnPredictionContent() {
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
            consultant_id,
            cs_id,
            onboarding_companies!inner(name, consultant_id, cs_id)
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
      <div className="space-y-6">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-500" />
            Previsão de Churn com IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Análise preditiva de risco de cancelamento
          </p>
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
            placeholder="Buscar empresa, serviço..."
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
                        <CardTitle className="flex items-center gap-2 text-base">
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
                          {prediction.product_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Risco em {getRiskWindowLabel(prediction.estimated_risk_window)}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    {/* Risk Factors */}
                    {prediction.risk_factors && prediction.risk_factors.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Fatores de Risco</h4>
                        <div className="space-y-2">
                          {prediction.risk_factors.map((factor: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <Progress value={factor.weight * 100} className="h-2 flex-1" />
                              <span className="text-sm text-muted-foreground min-w-[80px]">
                                {factor.factor}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Analysis */}
                    {prediction.ai_analysis && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Análise da IA
                        </h4>
                        <div className="prose prose-sm max-w-none text-muted-foreground">
                          <ReactMarkdown>{prediction.ai_analysis}</ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {prediction.recommended_actions && prediction.recommended_actions.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Ações Recomendadas</h4>
                        <ul className="list-disc pl-4 space-y-1">
                          {prediction.recommended_actions.map((action: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Generate Playbook Button */}
                    {(prediction.risk_level === 'high' || prediction.risk_level === 'critical') && (
                      <div className="pt-2">
                        <GeneratePlaybookButton
                          projectId={prediction.project_id}
                          existingStatus={playbookStatuses[prediction.project_id]}
                          onGenerated={() => {
                            fetchPlaybookStatuses();
                            setSelectedPlaybookProjectId(prediction.project_id);
                            setSelectedPlaybookCompanyName(prediction.company_name || "");
                            setPlaybookDialogOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Playbook Dialog */}
      <RescuePlaybookDialog
        open={playbookDialogOpen}
        onOpenChange={setPlaybookDialogOpen}
        projectId={selectedPlaybookProjectId}
        companyName={selectedPlaybookCompanyName}
      />
    </div>
  );
}
