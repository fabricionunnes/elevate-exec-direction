import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Loader2, Send, Sparkles, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export function CFOInsightsPanel() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [question, setQuestion] = useState("");
  const [insights, setInsights] = useState<string[]>([
    "📊 Seu MRR atual está em crescimento estável",
    "⚠️ Atenção: 15% das contas a receber estão em atraso",
    "💡 Recomendação: Revisar contratos com baixa rentabilidade"
  ]);

  const handleAnalyze = async () => {
    if (!question.trim()) return;
    setIsAnalyzing(true);
    // Simulate AI analysis
    setTimeout(() => {
      setInsights([`Análise: ${question}`, ...insights]);
      setQuestion("");
      setIsAnalyzing(false);
      toast.success("Análise concluída!");
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          IA CFO
        </h2>
        <p className="text-muted-foreground">Inteligência financeira e alertas automáticos</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-sm text-muted-foreground">Saúde Financeira</p>
                <p className="text-xl font-bold text-emerald-600">Boa</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Alertas Ativos</p>
                <p className="text-xl font-bold text-amber-600">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Insights</p>
                <p className="text-xl font-bold text-blue-600">{insights.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Pergunte ao CFO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Como posso melhorar minha margem EBITDA?"
            rows={3}
          />
          <Button onClick={handleAnalyze} disabled={isAnalyzing || !question.trim()}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Analisar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insights Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className="p-3 bg-muted/50 rounded-lg text-sm">
                {insight}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
