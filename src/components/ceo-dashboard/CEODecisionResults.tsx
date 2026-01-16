import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface DecisionResult {
  id: string;
  decision_id: string;
  indicator_name: string;
  value_before: number | null;
  value_after: number | null;
  result: string | null;
  observations: string | null;
  recorded_at: string;
  decision?: {
    title: string;
  };
}

interface Decision {
  id: string;
  title: string;
}

export function CEODecisionResults() {
  const [results, setResults] = useState<DecisionResult[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    decision_id: "",
    indicator_name: "",
    value_before: "",
    value_after: "",
    result: "",
    observations: "",
  });

  const fetchData = async () => {
    try {
      // Fetch decisions for dropdown
      const { data: decisionsData } = await supabase
        .from("ceo_decisions")
        .select("id, title")
        .order("decision_date", { ascending: false });

      setDecisions(decisionsData || []);

      // Fetch results with decision info
      const { data: resultsData, error } = await supabase
        .from("ceo_decision_results")
        .select(`
          *,
          decision:ceo_decisions(title)
        `)
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setResults(resultsData || []);
    } catch (error) {
      console.error("Error fetching decision results:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.decision_id || !formData.indicator_name) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("ceo_decision_results").insert({
        decision_id: formData.decision_id,
        indicator_name: formData.indicator_name,
        value_before: formData.value_before ? Number(formData.value_before) : null,
        value_after: formData.value_after ? Number(formData.value_after) : null,
        result: formData.result || null,
        observations: formData.observations || null,
      });

      if (error) throw error;

      toast.success("Resultado registrado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        decision_id: "",
        indicator_name: "",
        value_before: "",
        value_after: "",
        result: "",
        observations: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating result:", error);
      toast.error("Erro ao registrar resultado");
    }
  };

  const getResultIcon = (result: string | null) => {
    switch (result) {
      case "positivo":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "negativo":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResultBadge = (result: string | null) => {
    switch (result) {
      case "positivo":
        return <Badge className="bg-green-500">Positivo</Badge>;
      case "negativo":
        return <Badge className="bg-red-500">Negativo</Badge>;
      case "neutro":
        return <Badge variant="secondary">Neutro</Badge>;
      default:
        return null;
    }
  };

  const calculateChange = (before: number | null, after: number | null) => {
    if (before === null || after === null || before === 0) return null;
    const change = ((after - before) / before) * 100;
    return change.toFixed(1);
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Resultados das Decisões
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Resultado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Resultado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Decisão *</Label>
                <Select
                  value={formData.decision_id}
                  onValueChange={(v) => setFormData({ ...formData, decision_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a decisão..." />
                  </SelectTrigger>
                  <SelectContent>
                    {decisions.map((decision) => (
                      <SelectItem key={decision.id} value={decision.id}>
                        {decision.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Indicador Impactado *</Label>
                <Input
                  value={formData.indicator_name}
                  onChange={(e) => setFormData({ ...formData, indicator_name: e.target.value })}
                  placeholder="Ex: MRR, Churn, Conversão..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Antes</Label>
                  <Input
                    type="number"
                    value={formData.value_before}
                    onChange={(e) => setFormData({ ...formData, value_before: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Valor Depois</Label>
                  <Input
                    type="number"
                    value={formData.value_after}
                    onChange={(e) => setFormData({ ...formData, value_after: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <Label>Resultado</Label>
                <Select
                  value={formData.result}
                  onValueChange={(v) => setFormData({ ...formData, result: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positivo">Positivo</SelectItem>
                    <SelectItem value="neutro">Neutro</SelectItem>
                    <SelectItem value="negativo">Negativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Aprendizados e observações..."
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Registrar Resultado
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum resultado registrado ainda
            </p>
          ) : (
            results.map((result) => {
              const change = calculateChange(result.value_before, result.value_after);
              return (
                <div
                  key={result.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        {result.decision?.title}
                      </p>
                      <h4 className="font-semibold mt-1">{result.indicator_name}</h4>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Antes: </span>
                          <span className="font-medium">{result.value_before ?? "-"}</span>
                        </div>
                        {getResultIcon(result.result)}
                        <div className="text-sm">
                          <span className="text-muted-foreground">Depois: </span>
                          <span className="font-medium">{result.value_after ?? "-"}</span>
                        </div>
                        {change && (
                          <span className={`text-sm font-medium ${Number(change) >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {Number(change) >= 0 ? "+" : ""}{change}%
                          </span>
                        )}
                      </div>
                      {result.observations && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {result.observations}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getResultBadge(result.result)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(result.recorded_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
