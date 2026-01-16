import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Calculator, 
  Plus,
  Loader2, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Play,
  Archive,
  History,
  Target,
  DollarSign,
  Users,
  BarChart3,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface Simulation {
  id: string;
  title: string;
  description: string | null;
  decision_type: string;
  variables: Record<string, any>;
  base_data: Record<string, any>;
  conservative_revenue_impact: number | null;
  conservative_cash_impact: number | null;
  conservative_ebitda_impact: number | null;
  conservative_churn_impact: number | null;
  conservative_probability: number | null;
  conservative_analysis: string | null;
  realistic_revenue_impact: number | null;
  realistic_cash_impact: number | null;
  realistic_ebitda_impact: number | null;
  realistic_churn_impact: number | null;
  realistic_probability: number | null;
  realistic_analysis: string | null;
  aggressive_revenue_impact: number | null;
  aggressive_cash_impact: number | null;
  aggressive_ebitda_impact: number | null;
  aggressive_churn_impact: number | null;
  aggressive_probability: number | null;
  aggressive_analysis: string | null;
  risk_alerts: string[];
  timeline_projection: Record<string, string>;
  status: string;
  executed_decision_id: string | null;
  prediction_error: number | null;
  created_at: string;
  simulated_at: string | null;
  executed_at: string | null;
}

const DECISION_TYPES = [
  { value: 'financeira', label: 'Financeira', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'comercial', label: 'Comercial', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'operacional', label: 'Operacional', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'pessoas', label: 'Pessoas', icon: <Users className="h-4 w-4" /> },
  { value: 'estrategica', label: 'Estratégica', icon: <Target className="h-4 w-4" /> },
];

export function CEODecisionSimulator() {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [currentSimulation, setCurrentSimulation] = useState<Simulation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [decisionType, setDecisionType] = useState('');
  const [priceChange, setPriceChange] = useState([0]);
  const [hiringChange, setHiringChange] = useState([0]);
  const [costCut, setCostCut] = useState([0]);
  const [goalChange, setGoalChange] = useState([0]);

  useEffect(() => {
    fetchSimulations();
  }, []);

  const fetchSimulations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ceo_simulations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSimulations((data as Simulation[]) || []);
    } catch (error) {
      console.error('Error fetching simulations:', error);
      toast.error('Erro ao carregar simulações');
    } finally {
      setIsLoading(false);
    }
  };

  const createSimulation = async () => {
    if (!title.trim() || !decisionType) {
      toast.error('Preencha o título e tipo da decisão');
      return;
    }

    try {
      const variables = {
        price_change: priceChange[0],
        hiring_change: hiringChange[0],
        cost_cut: costCut[0],
        goal_change: goalChange[0]
      };

      const { data, error } = await supabase
        .from('ceo_simulations')
        .insert({
          title,
          description,
          decision_type: decisionType,
          variables,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Simulação criada! Clique em "Simular" para gerar cenários.');
      setSimulations(prev => [data as Simulation, ...prev]);
      setCurrentSimulation(data as Simulation);
      
      // Reset form
      setTitle('');
      setDescription('');
      setDecisionType('');
      setPriceChange([0]);
      setHiringChange([0]);
      setCostCut([0]);
      setGoalChange([0]);

    } catch (error) {
      console.error('Error creating simulation:', error);
      toast.error('Erro ao criar simulação');
    }
  };

  const runSimulation = async () => {
    if (!currentSimulation) return;

    setIsSimulating(true);
    try {
      toast.info('Executando simulação com IA...');

      const { data, error } = await supabase.functions.invoke('ceo-decision-simulator', {
        body: { simulationId: currentSimulation.id }
      });

      if (error) throw error;

      toast.success('Simulação concluída!');
      
      // Refresh simulation data
      const { data: updated } = await supabase
        .from('ceo_simulations')
        .select('*')
        .eq('id', currentSimulation.id)
        .single();

      if (updated) {
        setCurrentSimulation(updated as Simulation);
        setSimulations(prev => prev.map(s => s.id === updated.id ? updated as Simulation : s));
      }

    } catch (error) {
      console.error('Error running simulation:', error);
      toast.error('Erro ao executar simulação');
    } finally {
      setIsSimulating(false);
    }
  };

  const executeDecision = async () => {
    if (!currentSimulation) return;

    try {
      // Create real decision from simulation
      const { data: decision, error: decisionError } = await supabase
        .from('ceo_decisions')
        .insert({
          title: currentSimulation.title,
          description: currentSimulation.description,
          type: currentSimulation.decision_type,
          area: currentSimulation.decision_type,
          hypothesis: `Simulação: ${currentSimulation.realistic_analysis || ''}`,
          estimated_impact: currentSimulation.realistic_revenue_impact,
          status: 'em_andamento'
        })
        .select()
        .single();

      if (decisionError) throw decisionError;

      // Update simulation
      const { error: updateError } = await supabase
        .from('ceo_simulations')
        .update({
          status: 'executed',
          executed_decision_id: decision.id,
          executed_at: new Date().toISOString()
        })
        .eq('id', currentSimulation.id);

      if (updateError) throw updateError;

      toast.success('Decisão executada e vinculada ao Mapa de Decisões!');
      await fetchSimulations();

      // Update current simulation
      const { data: updated } = await supabase
        .from('ceo_simulations')
        .select('*')
        .eq('id', currentSimulation.id)
        .single();

      if (updated) {
        setCurrentSimulation(updated as Simulation);
      }

    } catch (error) {
      console.error('Error executing decision:', error);
      toast.error('Erro ao executar decisão');
    }
  };

  const archiveSimulation = async () => {
    if (!currentSimulation) return;

    try {
      const { error } = await supabase
        .from('ceo_simulations')
        .update({ status: 'archived' })
        .eq('id', currentSimulation.id);

      if (error) throw error;

      toast.success('Simulação arquivada');
      setCurrentSimulation(null);
      await fetchSimulations();

    } catch (error) {
      console.error('Error archiving simulation:', error);
      toast.error('Erro ao arquivar simulação');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'R$ 0';
    return `R$ ${value.toLocaleString('pt-BR')}`;
  };

  const getScenarioColor = (type: string) => {
    switch (type) {
      case 'conservative': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'realistic': return 'text-green-600 bg-green-50 border-green-200';
      case 'aggressive': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case 'simulated':
        return <Badge className="bg-blue-500"><BarChart3 className="h-3 w-3 mr-1" /> Simulado</Badge>;
      case 'executed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Executado</Badge>;
      case 'archived':
        return <Badge variant="secondary"><Archive className="h-3 w-3 mr-1" /> Arquivado</Badge>;
      default:
        return null;
    }
  };

  // Prepare chart data
  const getComparisonData = () => {
    if (!currentSimulation || currentSimulation.status !== 'simulated') return [];
    
    return [
      {
        name: 'Receita',
        conservador: currentSimulation.conservative_revenue_impact || 0,
        realista: currentSimulation.realistic_revenue_impact || 0,
        agressivo: currentSimulation.aggressive_revenue_impact || 0,
      },
      {
        name: 'Caixa',
        conservador: currentSimulation.conservative_cash_impact || 0,
        realista: currentSimulation.realistic_cash_impact || 0,
        agressivo: currentSimulation.aggressive_cash_impact || 0,
      },
      {
        name: 'EBITDA',
        conservador: currentSimulation.conservative_ebitda_impact || 0,
        realista: currentSimulation.realistic_ebitda_impact || 0,
        agressivo: currentSimulation.aggressive_ebitda_impact || 0,
      },
    ];
  };

  const getTimelineData = () => {
    if (!currentSimulation?.base_data) return [];
    const baseRevenue = (currentSimulation.base_data as any)?.currentMRR || 100000;
    const realisticImpact = currentSimulation.realistic_revenue_impact || 0;
    
    return [
      { period: 'Atual', valor: baseRevenue },
      { period: '30 dias', valor: baseRevenue + (realisticImpact * 0.3) },
      { period: '60 dias', valor: baseRevenue + (realisticImpact * 0.6) },
      { period: '90 dias', valor: baseRevenue + realisticImpact },
    ];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Simulador de Decisões
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Simule decisões estratégicas antes de executá-las
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="new" className="space-y-4">
            <TabsList>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova Simulação
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Resultados
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            {/* New Simulation */}
            <TabsContent value="new" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nome da Decisão</label>
                    <Input
                      placeholder="Ex: Aumento de preços em 10%"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de Decisão</label>
                    <Select value={decisionType} onValueChange={setDecisionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              {type.icon}
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Descrição</label>
                    <Textarea
                      placeholder="Descreva a decisão em detalhes..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Variáveis Ajustáveis</h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm">Alteração de Preço</label>
                      <span className="text-sm font-medium">{priceChange[0]}%</span>
                    </div>
                    <Slider
                      value={priceChange}
                      onValueChange={setPriceChange}
                      min={-50}
                      max={50}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm">Contratações/Demissões</label>
                      <span className="text-sm font-medium">{hiringChange[0] > 0 ? '+' : ''}{hiringChange[0]} pessoas</span>
                    </div>
                    <Slider
                      value={hiringChange}
                      onValueChange={setHiringChange}
                      min={-10}
                      max={10}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm">Corte de Custos</label>
                      <span className="text-sm font-medium">{costCut[0]}%</span>
                    </div>
                    <Slider
                      value={costCut}
                      onValueChange={setCostCut}
                      min={0}
                      max={50}
                      step={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-sm">Alteração de Meta</label>
                      <span className="text-sm font-medium">{goalChange[0] > 0 ? '+' : ''}{goalChange[0]}%</span>
                    </div>
                    <Slider
                      value={goalChange}
                      onValueChange={setGoalChange}
                      min={-50}
                      max={50}
                      step={5}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={createSimulation} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar Simulação
              </Button>
            </TabsContent>

            {/* Results */}
            <TabsContent value="results" className="space-y-6">
              {currentSimulation ? (
                <div className="space-y-6">
                  {/* Header */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{currentSimulation.title}</h3>
                          <p className="text-sm text-muted-foreground">{currentSimulation.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{currentSimulation.decision_type}</Badge>
                            {getStatusBadge(currentSimulation.status)}
                          </div>
                        </div>
                        {currentSimulation.status === 'pending' && (
                          <Button onClick={runSimulation} disabled={isSimulating}>
                            {isSimulating ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-2" />
                            )}
                            Simular
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {currentSimulation.status === 'simulated' && (
                    <>
                      {/* Scenario Cards */}
                      <div className="grid gap-4 md:grid-cols-3">
                        {/* Conservative */}
                        <Card className={`border-2 ${getScenarioColor('conservative')}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span>Cenário Conservador</span>
                              <Badge variant="outline">{currentSimulation.conservative_probability}%</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Receita:</span>
                              <span className={currentSimulation.conservative_revenue_impact! >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(currentSimulation.conservative_revenue_impact)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Caixa:</span>
                              <span>{formatCurrency(currentSimulation.conservative_cash_impact)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>EBITDA:</span>
                              <span>{formatCurrency(currentSimulation.conservative_ebitda_impact)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Churn:</span>
                              <span>{currentSimulation.conservative_churn_impact}pp</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {currentSimulation.conservative_analysis}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Realistic */}
                        <Card className={`border-2 ${getScenarioColor('realistic')}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span>Cenário Realista</span>
                              <Badge variant="outline">{currentSimulation.realistic_probability}%</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Receita:</span>
                              <span className={currentSimulation.realistic_revenue_impact! >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(currentSimulation.realistic_revenue_impact)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Caixa:</span>
                              <span>{formatCurrency(currentSimulation.realistic_cash_impact)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>EBITDA:</span>
                              <span>{formatCurrency(currentSimulation.realistic_ebitda_impact)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Churn:</span>
                              <span>{currentSimulation.realistic_churn_impact}pp</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {currentSimulation.realistic_analysis}
                            </p>
                          </CardContent>
                        </Card>

                        {/* Aggressive */}
                        <Card className={`border-2 ${getScenarioColor('aggressive')}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span>Cenário Agressivo</span>
                              <Badge variant="outline">{currentSimulation.aggressive_probability}%</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Receita:</span>
                              <span className={currentSimulation.aggressive_revenue_impact! >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(currentSimulation.aggressive_revenue_impact)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Caixa:</span>
                              <span>{formatCurrency(currentSimulation.aggressive_cash_impact)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>EBITDA:</span>
                              <span>{formatCurrency(currentSimulation.aggressive_ebitda_impact)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Churn:</span>
                              <span>{currentSimulation.aggressive_churn_impact}pp</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {currentSimulation.aggressive_analysis}
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Charts */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Comparativo de Cenários</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                              <BarChart data={getComparisonData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="conservador" fill="#3B82F6" name="Conservador" />
                                <Bar dataKey="realista" fill="#22C55E" name="Realista" />
                                <Bar dataKey="agressivo" fill="#F97316" name="Agressivo" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Projeção de Timeline (Cenário Realista)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={getTimelineData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" />
                                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Line type="monotone" dataKey="valor" stroke="#22C55E" strokeWidth={2} name="Receita" />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Risk Alerts */}
                      {currentSimulation.risk_alerts && currentSimulation.risk_alerts.length > 0 && (
                        <Card className="border-red-200 bg-red-50">
                          <CardHeader>
                            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              Alertas de Risco
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {currentSimulation.risk_alerts.map((alert, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                  {alert}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      {/* Timeline Projection */}
                      {currentSimulation.timeline_projection && Object.keys(currentSimulation.timeline_projection).length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Projeção Detalhada
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="p-3 bg-muted rounded-lg">
                                <span className="text-xs text-muted-foreground">30 dias</span>
                                <p className="text-sm mt-1">{currentSimulation.timeline_projection['30_days'] || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-muted rounded-lg">
                                <span className="text-xs text-muted-foreground">60 dias</span>
                                <p className="text-sm mt-1">{currentSimulation.timeline_projection['60_days'] || 'N/A'}</p>
                              </div>
                              <div className="p-3 bg-muted rounded-lg">
                                <span className="text-xs text-muted-foreground">90 dias</span>
                                <p className="text-sm mt-1">{currentSimulation.timeline_projection['90_days'] || 'N/A'}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Action Buttons */}
                      {currentSimulation.status === 'simulated' && (
                        <div className="flex gap-3">
                          <Button onClick={executeDecision} className="flex-1 bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Executar Decisão
                          </Button>
                          <Button onClick={archiveSimulation} variant="outline" className="flex-1">
                            <Archive className="h-4 w-4 mr-2" />
                            Arquivar Simulação
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {currentSimulation.status === 'executed' && (
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-8 w-8 text-green-600" />
                          <div>
                            <h4 className="font-medium">Decisão Executada</h4>
                            <p className="text-sm text-muted-foreground">
                              Esta simulação foi convertida em uma decisão real e está sendo acompanhada no Mapa de Decisões.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Crie uma nova simulação ou selecione uma do histórico</p>
                </div>
              )}
            </TabsContent>

            {/* History */}
            <TabsContent value="history">
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {simulations.map((sim) => (
                    <Card 
                      key={sim.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        currentSimulation?.id === sim.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setCurrentSimulation(sim)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">{sim.title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {sim.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{sim.decision_type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(sim.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(sim.status)}
                            {sim.prediction_error !== null && (
                              <span className="text-xs text-muted-foreground">
                                Erro: {sim.prediction_error?.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {simulations.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma simulação ainda</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
