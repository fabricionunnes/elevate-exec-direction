import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Map,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Sparkles,
  Target,
  DollarSign,
  Calendar,
  BarChart3,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar
} from "recharts";

const KPI_OPTIONS = [
  { value: "mrr", label: "MRR" },
  { value: "churn", label: "Churn Rate" },
  { value: "ebitda", label: "EBITDA" },
  { value: "conversion", label: "Conversão" },
  { value: "nps", label: "NPS" },
  { value: "cac", label: "CAC" },
  { value: "ltv", label: "LTV" },
  { value: "revenue", label: "Faturamento" },
  { value: "clients", label: "Clientes Ativos" },
  { value: "ticket", label: "Ticket Médio" },
];

const AREA_OPTIONS = [
  { value: "vendas", label: "Vendas" },
  { value: "marketing", label: "Marketing" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operacoes", label: "Operações" },
  { value: "produto", label: "Produto" },
  { value: "pessoas", label: "Pessoas" },
];

const TYPE_OPTIONS = [
  { value: "estrategica", label: "Estratégica" },
  { value: "operacional", label: "Operacional" },
  { value: "tatica", label: "Tática" },
];

interface Decision {
  id: string;
  title: string;
  description: string | null;
  decision_date: string;
  area: string;
  type: string;
  hypothesis: string | null;
  status: string;
  linked_kpis: string[];
  evaluation_period: number;
  estimated_impact: number;
  final_result: 'positive' | 'neutral' | 'negative' | null;
  evaluation_start_date: string | null;
  evaluation_end_date: string | null;
  actual_impact: number | null;
  ai_analysis: string | null;
  created_at: string;
  results?: DecisionResult[];
}

interface DecisionResult {
  id: string;
  decision_id: string;
  indicator_name: string;
  value_before: number | null;
  value_after: number | null;
  result: string | null;
  observations: string | null;
  recorded_at: string;
}

interface DecisionInsight {
  id: string;
  insight_type: 'pattern' | 'recommendation' | 'alert';
  area: string | null;
  insight: string;
  supporting_data: Record<string, unknown>;
  created_at: string;
}

export function CEODecisionMap() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [insights, setInsights] = useState<DecisionInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedResult, setSelectedResult] = useState<string>("all");
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    area: "",
    type: "estrategica",
    hypothesis: "",
    linked_kpis: [] as string[],
    evaluation_period: 30,
    estimated_impact: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [decisionsRes, resultsRes, insightsRes] = await Promise.all([
        supabase
          .from('ceo_decisions')
          .select('*')
          .order('decision_date', { ascending: false }),
        supabase
          .from('ceo_decision_results')
          .select('*'),
        supabase
          .from('ceo_decision_insights')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (decisionsRes.error) throw decisionsRes.error;

      // Map results to decisions
      const results = resultsRes.data || [];
      const decisionsWithResults = (decisionsRes.data || []).map(d => ({
        ...d,
        linked_kpis: (d.linked_kpis || []) as string[],
        final_result: d.final_result as 'positive' | 'neutral' | 'negative' | null,
        results: results.filter(r => r.decision_id === d.id)
      }));

      setDecisions(decisionsWithResults);
      setInsights((insightsRes.data || []) as DecisionInsight[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDecision = async () => {
    if (!formData.title || !formData.area) {
      toast.error('Preencha título e área');
      return;
    }

    try {
      const evaluationStartDate = new Date();
      const evaluationEndDate = addDays(evaluationStartDate, formData.evaluation_period);

      const { error } = await supabase
        .from('ceo_decisions')
        .insert({
          title: formData.title,
          description: formData.description || null,
          area: formData.area,
          type: formData.type,
          hypothesis: formData.hypothesis || null,
          linked_kpis: formData.linked_kpis,
          evaluation_period: formData.evaluation_period,
          estimated_impact: formData.estimated_impact,
          evaluation_start_date: evaluationStartDate.toISOString().split('T')[0],
          evaluation_end_date: evaluationEndDate.toISOString().split('T')[0],
          decision_date: new Date().toISOString().split('T')[0],
          status: 'em_execucao'
        });

      if (error) throw error;

      toast.success('Decisão cadastrada!');
      setIsDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        area: "",
        type: "estrategica",
        hypothesis: "",
        linked_kpis: [],
        evaluation_period: 30,
        estimated_impact: 0,
      });
      fetchData();
    } catch (error) {
      console.error('Error creating decision:', error);
      toast.error('Erro ao criar decisão');
    }
  };

  const updateDecisionResult = async (decisionId: string, result: 'positive' | 'neutral' | 'negative') => {
    try {
      const { error } = await supabase
        .from('ceo_decisions')
        .update({ final_result: result, status: 'concluida' })
        .eq('id', decisionId);

      if (error) throw error;

      toast.success('Resultado atualizado!');
      fetchData();
    } catch (error) {
      console.error('Error updating result:', error);
      toast.error('Erro ao atualizar resultado');
    }
  };

  const analyzePatterns = async () => {
    setIsAnalyzing(true);
    try {
      // Prepare data for AI analysis
      const analysisData = decisions.map(d => ({
        title: d.title,
        area: d.area,
        type: d.type,
        kpis: d.linked_kpis,
        estimated_impact: d.estimated_impact,
        actual_impact: d.actual_impact,
        result: d.final_result,
        evaluation_period: d.evaluation_period
      }));

      // Calculate statistics
      const areaStats: Record<string, { total: number; positive: number; negative: number; neutral: number; avgImpact: number }> = {};
      
      decisions.forEach(d => {
        if (!areaStats[d.area]) {
          areaStats[d.area] = { total: 0, positive: 0, negative: 0, neutral: 0, avgImpact: 0 };
        }
        areaStats[d.area].total++;
        if (d.final_result === 'positive') areaStats[d.area].positive++;
        if (d.final_result === 'negative') areaStats[d.area].negative++;
        if (d.final_result === 'neutral') areaStats[d.area].neutral++;
        areaStats[d.area].avgImpact += d.actual_impact || 0;
      });

      Object.keys(areaStats).forEach(area => {
        if (areaStats[area].total > 0) {
          areaStats[area].avgImpact /= areaStats[area].total;
        }
      });

      const prompt = `
Analise os seguintes dados de decisões do CEO e gere insights estratégicos:

DECISÕES:
${JSON.stringify(analysisData, null, 2)}

ESTATÍSTICAS POR ÁREA:
${JSON.stringify(areaStats, null, 2)}

Gere exatamente 5 insights no formato JSON array:
[
  {
    "insight_type": "pattern" | "recommendation" | "alert",
    "area": "nome da área ou null se geral",
    "insight": "Descrição do insight em português, direto e acionável"
  }
]

Foque em:
1. Padrões de sucesso/falha por área
2. ROI médio por tipo de decisão
3. Alertas sobre áreas problemáticas
4. Recomendações baseadas em dados
`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um CFO/COO experiente analisando decisões estratégicas.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.4,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const newInsights = JSON.parse(jsonMatch[0]);
          
          // Clear old insights and insert new ones
          await supabase.from('ceo_decision_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          
          for (const insight of newInsights) {
            await supabase.from('ceo_decision_insights').insert({
              insight_type: insight.insight_type,
              area: insight.area,
              insight: insight.insight,
              supporting_data: { generated_at: new Date().toISOString() }
            });
          }
          
          toast.success('Análise concluída!');
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      toast.error('Erro na análise');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getResultIcon = (result: string | null) => {
    switch (result) {
      case 'positive': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'negative': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'neutral': return <Minus className="h-4 w-4 text-yellow-500" />;
      default: return <Target className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResultBadge = (result: string | null) => {
    switch (result) {
      case 'positive': return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Positivo</Badge>;
      case 'negative': return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">Negativo</Badge>;
      case 'neutral': return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Neutro</Badge>;
      default: return <Badge variant="outline">Em Avaliação</Badge>;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4 text-green-500" />;
      case 'alert': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  // Filter decisions
  const filteredDecisions = decisions.filter(d => {
    if (selectedArea !== 'all' && d.area !== selectedArea) return false;
    if (selectedResult !== 'all' && d.final_result !== selectedResult) return false;
    return true;
  });

  // Prepare chart data
  const chartData = filteredDecisions
    .filter(d => d.final_result)
    .sort((a, b) => new Date(a.decision_date).getTime() - new Date(b.decision_date).getTime())
    .map(d => ({
      name: d.title.substring(0, 20) + (d.title.length > 20 ? '...' : ''),
      date: format(new Date(d.decision_date), 'dd/MM/yy'),
      estimated: d.estimated_impact,
      actual: d.actual_impact || 0,
      result: d.final_result === 'positive' ? 1 : d.final_result === 'negative' ? -1 : 0
    }));

  // Calculate summary stats
  const stats = {
    total: decisions.length,
    positive: decisions.filter(d => d.final_result === 'positive').length,
    negative: decisions.filter(d => d.final_result === 'negative').length,
    neutral: decisions.filter(d => d.final_result === 'neutral').length,
    pending: decisions.filter(d => !d.final_result).length,
    totalEstimated: decisions.reduce((sum, d) => sum + (d.estimated_impact || 0), 0),
    totalActual: decisions.reduce((sum, d) => sum + (d.actual_impact || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Map className="h-6 w-6" />
            Mapa de Decisões
          </h2>
          <p className="text-muted-foreground">
            Acompanhe o impacto financeiro e operacional das suas decisões
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={analyzePatterns} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analisar Padrões
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Decisão
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar Decisão</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Redução de custos operacionais"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Área</Label>
                    <Select value={formData.area} onValueChange={(v) => setFormData({ ...formData, area: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {AREA_OPTIONS.map(area => (
                          <SelectItem key={area.value} value={area.value}>{area.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Tipo</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva a decisão..."
                    rows={2}
                  />
                </div>
                
                <div>
                  <Label>Hipótese</Label>
                  <Input
                    value={formData.hypothesis}
                    onChange={(e) => setFormData({ ...formData, hypothesis: e.target.value })}
                    placeholder="Ex: Reduzir custos em 15% sem impactar qualidade"
                  />
                </div>
                
                <div>
                  <Label>KPIs Vinculados</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {KPI_OPTIONS.map(kpi => (
                      <Badge
                        key={kpi.value}
                        variant={formData.linked_kpis.includes(kpi.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const newKpis = formData.linked_kpis.includes(kpi.value)
                            ? formData.linked_kpis.filter(k => k !== kpi.value)
                            : [...formData.linked_kpis, kpi.value];
                          setFormData({ ...formData, linked_kpis: newKpis });
                        }}
                      >
                        {kpi.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Período de Avaliação (dias)</Label>
                    <Select
                      value={formData.evaluation_period.toString()}
                      onValueChange={(v) => setFormData({ ...formData, evaluation_period: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                        <SelectItem value="90">90 dias</SelectItem>
                        <SelectItem value="180">180 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Impacto Estimado (R$)</Label>
                    <Input
                      type="number"
                      value={formData.estimated_impact}
                      onChange={(e) => setFormData({ ...formData, estimated_impact: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <Button onClick={handleCreateDecision} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Decisão
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards - Premium Design */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
          <div className="absolute top-0 right-0 w-16 h-16 bg-slate-200/50 dark:bg-slate-700/30 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-slate-200/80 dark:bg-slate-700">
                <Target className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</span>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3">Total Decisões</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-200/50 dark:bg-emerald-800/30 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-emerald-200/80 dark:bg-emerald-800">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-300">{stats.positive}</span>
            </div>
            <p className="text-sm font-medium text-emerald-600/70 dark:text-emerald-400 mt-3">Positivas</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-200/50 dark:bg-red-800/30 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-red-200/80 dark:bg-red-800">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
              </div>
              <span className="text-3xl font-bold text-red-600 dark:text-red-300">{stats.negative}</span>
            </div>
            <p className="text-sm font-medium text-red-600/70 dark:text-red-400 mt-3">Negativas</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-indigo-800">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/50 dark:bg-indigo-800/30 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-blue-200/80 dark:bg-indigo-800">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-indigo-300" />
              </div>
              <span className="text-xl font-bold text-blue-700 dark:text-indigo-200">{formatCurrency(stats.totalEstimated)}</span>
            </div>
            <p className="text-sm font-medium text-blue-600/70 dark:text-indigo-400 mt-3">Impacto Estimado</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900 border-amber-200 dark:border-orange-800">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-200/50 dark:bg-orange-800/30 rounded-full -mr-8 -mt-8" />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-xl bg-amber-200/80 dark:bg-orange-800">
                <DollarSign className="h-5 w-5 text-amber-600 dark:text-orange-300" />
              </div>
              <span className="text-xl font-bold text-amber-700 dark:text-orange-200">{formatCurrency(stats.totalActual)}</span>
            </div>
            <p className="text-sm font-medium text-amber-600/70 dark:text-orange-400 mt-3">Impacto Real</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <TabsTrigger 
              value="table" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-4 py-2 font-medium transition-all"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Tabela
            </TabsTrigger>
            <TabsTrigger 
              value="timeline" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-4 py-2 font-medium transition-all"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Linha do Tempo
            </TabsTrigger>
            <TabsTrigger 
              value="insights" 
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm rounded-lg px-4 py-2 font-medium transition-all"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Insights IA
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger className="w-[140px] rounded-lg">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Áreas</SelectItem>
                {AREA_OPTIONS.map(area => (
                  <SelectItem key={area.value} value={area.value}>{area.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedResult} onValueChange={setSelectedResult}>
              <SelectTrigger className="w-[140px] rounded-lg">
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="positive">Positivo</SelectItem>
                <SelectItem value="neutral">Neutro</SelectItem>
                <SelectItem value="negative">Negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table View */}
        <TabsContent value="table">
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Decisão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>KPIs</TableHead>
                      <TableHead className="text-right">Impacto Est.</TableHead>
                      <TableHead className="text-right">Impacto Real</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDecisions.map((decision) => (
                      <TableRow key={decision.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{decision.title}</span>
                            {decision.hypothesis && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {decision.hypothesis}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(decision.decision_date), 'dd/MM/yy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{decision.area}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {decision.linked_kpis.slice(0, 3).map(kpi => (
                              <Badge key={kpi} variant="secondary" className="text-xs">
                                {KPI_OPTIONS.find(k => k.value === kpi)?.label || kpi}
                              </Badge>
                            ))}
                            {decision.linked_kpis.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{decision.linked_kpis.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(decision.estimated_impact || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {decision.actual_impact ? formatCurrency(decision.actual_impact) : '-'}
                        </TableCell>
                        <TableCell>
                          {getResultBadge(decision.final_result)}
                        </TableCell>
                        <TableCell>
                          {!decision.final_result && (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateDecisionResult(decision.id, 'positive')}
                              >
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateDecisionResult(decision.id, 'neutral')}
                              >
                                <Minus className="h-4 w-4 text-yellow-500" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => updateDecisionResult(decision.id, 'negative')}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {filteredDecisions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma decisão encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline View */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Linha do Tempo: Impacto Estimado vs Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'estimated' ? 'Estimado' : 'Real'
                      ]}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="estimated" name="Estimado" fill="hsl(var(--muted-foreground))" opacity={0.5} />
                    <Bar dataKey="actual" name="Real" fill="hsl(var(--primary))" />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Sem dados suficientes para exibir o gráfico
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights View */}
        <TabsContent value="insights">
          <div className="grid gap-4">
            {insights.length > 0 ? (
              insights.map((insight) => (
                <Card key={insight.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.insight_type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={
                            insight.insight_type === 'alert' ? 'destructive' :
                            insight.insight_type === 'recommendation' ? 'default' : 'secondary'
                          }>
                            {insight.insight_type === 'pattern' ? 'Padrão' :
                             insight.insight_type === 'recommendation' ? 'Recomendação' : 'Alerta'}
                          </Badge>
                          {insight.area && (
                            <Badge variant="outline">{insight.area}</Badge>
                          )}
                        </div>
                        <p className="text-sm">{insight.insight}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(insight.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Nenhum insight gerado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clique em "Analisar Padrões" para gerar insights
                  </p>
                  <Button onClick={analyzePatterns} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analisar Padrões
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
