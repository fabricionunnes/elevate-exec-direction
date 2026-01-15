import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Trophy, 
  RefreshCw, 
  TrendingUp,
  Users,
  Star,
  Video,
  CheckCircle2,
  MessageSquare
} from "lucide-react";
import { EngagementScoreCard } from "@/components/onboarding-tasks/engagement/EngagementScoreCard";

interface EngagementScore {
  id: string;
  staff_id: string;
  staff_name?: string;
  total_score: number;
  meeting_score: number;
  task_score: number;
  response_score: number;
  retention_score: number;
  nps_score: number;
  rank_position: number;
  calculation_date: string;
  metrics_breakdown?: any;
}

export default function ConsultantEngagementPage() {
  const navigate = useNavigate();
  const [scores, setScores] = useState<EngagementScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [periodDays, setPeriodDays] = useState("30");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from("consultant_engagement_scores")
        .select(`
          *,
          onboarding_staff!inner(name, role)
        `)
        .in("onboarding_staff.role", ["cs", "consultant"])
        .order("total_score", { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        staff_name: item.onboarding_staff?.name || 'Consultor',
      }));

      setScores(formattedData);
    } catch (error) {
      console.error("Error fetching scores:", error);
      toast.error("Erro ao carregar scores");
    } finally {
      setLoading(false);
    }
  };

  const calculateAllScores = async () => {
    setCalculating(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-engagement-score", {
        body: { calculateAll: true, periodDays: parseInt(periodDays) },
      });

      if (error) throw error;
      
      toast.success("Scores recalculados com sucesso!");
      await fetchScores();
    } catch (error: any) {
      console.error("Error calculating scores:", error);
      toast.error(error.message || "Erro ao calcular scores");
    } finally {
      setCalculating(false);
    }
  };

  const getAverageScore = () => {
    if (scores.length === 0) return 0;
    return scores.reduce((acc, s) => acc + s.total_score, 0) / scores.length;
  };

  const getTopScorer = () => {
    return scores.find(s => s.rank_position === 1);
  };

  const getAverageByMetric = (metric: 'meeting_score' | 'task_score' | 'response_score' | 'retention_score' | 'nps_score') => {
    if (scores.length === 0) return 0;
    return scores.reduce((acc, s) => acc + (s[metric] || 0), 0) / scores.length;
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
              <Trophy className="h-6 w-6 text-yellow-500" />
              Score de Engajamento
            </h1>
            <p className="text-muted-foreground">
              Ranking e métricas de desempenho dos consultores
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={calculateAllScores} disabled={calculating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculando...' : 'Recalcular'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Consultores</p>
                <p className="text-3xl font-bold">{scores.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Médio</p>
                <p className="text-3xl font-bold">{getAverageScore().toFixed(0)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Melhor Score</p>
                <p className="text-3xl font-bold text-yellow-500">
                  {getTopScorer()?.total_score.toFixed(0) || '-'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {getTopScorer()?.staff_name || '-'}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média Reuniões</p>
                <p className="text-3xl font-bold">{getAverageByMetric('meeting_score').toFixed(0)}</p>
              </div>
              <Video className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média NPS</p>
                <p className="text-3xl font-bold">{getAverageByMetric('nps_score').toFixed(0)}</p>
              </div>
              <Star className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Como o score é calculado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-blue-500" />
              <span><strong>Reuniões:</strong> Frequência e conclusão</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span><strong>Tarefas:</strong> Taxa de conclusão no prazo</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              <span><strong>Resposta:</strong> Tempo de primeiro contato</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span><strong>Retenção:</strong> Clientes ativos vs churn</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span><strong>NPS:</strong> Média de satisfação</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking List */}
      {scores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium">Nenhum score calculado</h3>
            <p className="text-muted-foreground mt-1">
              Clique em "Recalcular" para gerar os scores de engajamento
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scores.map((score) => (
            <div 
              key={score.id} 
              onClick={() => setExpandedId(expandedId === score.id ? null : score.id)}
              className="cursor-pointer"
            >
              <EngagementScoreCard 
                score={score} 
                expanded={expandedId === score.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
