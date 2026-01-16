import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Users,
  DollarSign,
  Target,
  Calendar,
  MessageSquare,
  Save,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";

interface WeeklyReportData {
  bigNumbers: {
    mrr: number;
    mrrVariation: number;
    activeClients: number;
    clientsVariation: number;
    churnRate: number;
    churnVariation: number;
    nps: number;
    npsVariation: number;
  };
  mrrGained: number;
  mrrLost: number;
  churnedClients: { name: string; reason: string }[];
  atRiskClients: { name: string; healthScore: number; riskLevel: string }[];
  decisionsThisWeek: { title: string; area: string; status: string }[];
  decisionResults: { decision: string; result: string }[];
  criticalAlerts: { title: string; severity: string }[];
  aiRecommendations: { insight: string; category: string; status: string }[];
  nextWeekAgenda: { title: string; date: string }[];
}

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  report_data: WeeklyReportData;
  classification: 'good' | 'neutral' | 'critical';
  classification_reason: string;
  ceo_notes: string | null;
  generated_at: string;
}

export function CEOWeeklyReport() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedReport) {
      setNotes(selectedReport.ceo_notes || "");
    }
  }, [selectedReport]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('ceo_weekly_reports')
        .select('*')
        .order('week_start', { ascending: false });

      if (error) throw error;

      const typedReports = (data || []).map(r => ({
        ...r,
        report_data: r.report_data as unknown as WeeklyReportData,
        classification: r.classification as 'good' | 'neutral' | 'critical'
      }));

      setReports(typedReports);
      if (typedReports.length > 0 && !selectedReport) {
        setSelectedReport(typedReports[0]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

      const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
        body: {
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          weekEnd: format(weekEnd, 'yyyy-MM-dd')
        }
      });

      if (error) throw error;

      toast.success('Relatório gerado com sucesso!');
      await fetchReports();
      
      if (data?.report) {
        setSelectedReport({
          ...data.report,
          report_data: data.report.report_data as WeeklyReportData,
          classification: data.report.classification as 'good' | 'neutral' | 'critical'
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedReport) return;

    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('ceo_weekly_reports')
        .update({ ceo_notes: notes })
        .eq('id', selectedReport.id);

      if (error) throw error;

      toast.success('Anotações salvas!');
      setSelectedReport({ ...selectedReport, ceo_notes: notes });
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Erro ao salvar anotações');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const getClassificationStyle = (classification: string) => {
    switch (classification) {
      case 'good':
        return { bg: 'bg-green-500/10', text: 'text-green-500', icon: CheckCircle, label: 'Semana Boa' };
      case 'critical':
        return { bg: 'bg-red-500/10', text: 'text-red-500', icon: AlertCircle, label: 'Semana Crítica' };
      default:
        return { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: Clock, label: 'Semana Neutra' };
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const renderVariation = (value: number, isPercentage = false) => {
    if (value === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const Icon = value > 0 ? TrendingUp : TrendingDown;
    const color = value > 0 ? 'text-green-500' : 'text-red-500';
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        {isPercentage ? `${Math.abs(value).toFixed(1)}%` : Math.abs(value)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

  return (
    <div className="space-y-6">
      {/* Header with week selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Relatório Executivo Semanal
          </h2>
          <p className="text-muted-foreground">
            Visão consolidada da semana para o CEO
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="px-4 py-2 bg-muted rounded-lg text-center min-w-[200px]">
            <span className="font-medium">
              {format(weekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button onClick={generateReport} disabled={isGenerating}>
            {isGenerating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar Relatório
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report History Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {reports.map((report) => {
                  const style = getClassificationStyle(report.classification);
                  const Icon = style.icon;
                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedReport?.id === report.id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {format(new Date(report.week_start), "dd/MM", { locale: ptBR })} - {format(new Date(report.week_end), "dd/MM", { locale: ptBR })}
                        </span>
                        <Icon className={`h-4 w-4 ${style.text}`} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(report.generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </button>
                  );
                })}

                {reports.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum relatório gerado ainda
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Report Content */}
        <div className="lg:col-span-3 space-y-6">
          {selectedReport ? (
            <>
              {/* Classification Banner */}
              {(() => {
                const style = getClassificationStyle(selectedReport.classification);
                const Icon = style.icon;
                return (
                  <Card className={`${style.bg} border-none`}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-8 w-8 ${style.text}`} />
                        <div>
                          <h3 className={`text-lg font-bold ${style.text}`}>{style.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedReport.classification_reason}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Big Numbers */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      {renderVariation(selectedReport.report_data.bigNumbers.mrrVariation, true)}
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {formatCurrency(selectedReport.report_data.bigNumbers.mrr)}
                    </p>
                    <p className="text-xs text-muted-foreground">MRR</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      {renderVariation(selectedReport.report_data.bigNumbers.clientsVariation)}
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {selectedReport.report_data.bigNumbers.activeClients}
                    </p>
                    <p className="text-xs text-muted-foreground">Clientes Ativos</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      {renderVariation(-selectedReport.report_data.bigNumbers.churnVariation, true)}
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {selectedReport.report_data.bigNumbers.churnRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Churn Rate</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      {renderVariation(selectedReport.report_data.bigNumbers.npsVariation)}
                    </div>
                    <p className="text-2xl font-bold mt-2">
                      {selectedReport.report_data.bigNumbers.nps}
                    </p>
                    <p className="text-xs text-muted-foreground">NPS</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Churned Clients */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes que Saíram ({selectedReport.report_data.churnedClients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedReport.report_data.churnedClients.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedReport.report_data.churnedClients.map((client, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{client.name}</span>
                            <span className="text-muted-foreground"> - {client.reason}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum churn na semana 🎉</p>
                    )}
                  </CardContent>
                </Card>

                {/* At Risk Clients */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Clientes em Risco ({selectedReport.report_data.atRiskClients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedReport.report_data.atRiskClients.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedReport.report_data.atRiskClients.slice(0, 5).map((client, i) => (
                          <li key={i} className="flex items-center justify-between text-sm">
                            <span>{client.name}</span>
                            <Badge variant={client.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                              HS: {client.healthScore}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum cliente em risco crítico</p>
                    )}
                  </CardContent>
                </Card>

                {/* Decisions This Week */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Decisões da Semana ({selectedReport.report_data.decisionsThisWeek.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedReport.report_data.decisionsThisWeek.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedReport.report_data.decisionsThisWeek.map((decision, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{decision.title}</span>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">{decision.area}</Badge>
                              <Badge variant="secondary" className="text-xs">{decision.status}</Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma decisão registrada</p>
                    )}
                  </CardContent>
                </Card>

                {/* Critical Alerts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Alertas Críticos ({selectedReport.report_data.criticalAlerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedReport.report_data.criticalAlerts.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedReport.report_data.criticalAlerts.map((alert, i) => (
                          <li key={i} className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            {alert.title}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem alertas críticos</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* AI Recommendations */}
              {selectedReport.report_data.aiRecommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Recomendações da IA do CEO
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {selectedReport.report_data.aiRecommendations.slice(0, 5).map((rec, i) => (
                        <li key={i} className="text-sm p-3 bg-muted rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <span>{rec.insight}</span>
                            <Badge variant={rec.category === 'critical' ? 'destructive' : rec.category === 'important' ? 'default' : 'secondary'}>
                              {rec.category}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Next Week Agenda */}
              {selectedReport.report_data.nextWeekAgenda.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Agenda Estratégica Próxima Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {selectedReport.report_data.nextWeekAgenda.map((event, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span>{event.title}</span>
                          <span className="text-muted-foreground">
                            {format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* CEO Notes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Anotações do CEO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Adicione suas anotações sobre esta semana..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={saveNotes}
                    disabled={isSavingNotes || notes === selectedReport.ceo_notes}
                    size="sm"
                  >
                    {isSavingNotes ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Anotações
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum relatório selecionado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione uma semana e gere o relatório
                </p>
                <Button onClick={generateReport} disabled={isGenerating}>
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Gerar Primeiro Relatório
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
