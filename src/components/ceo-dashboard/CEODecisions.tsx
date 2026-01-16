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
import { Plus, Lightbulb, Clock, CheckCircle, XCircle, Play } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Decision {
  id: string;
  title: string;
  description: string | null;
  decision_date: string;
  area: string;
  type: string;
  hypothesis: string | null;
  status: string;
  created_at: string;
}

const AREAS = [
  { value: "vendas", label: "Vendas" },
  { value: "financeiro", label: "Financeiro" },
  { value: "produto", label: "Produto" },
  { value: "pessoas", label: "Pessoas" },
  { value: "marketing", label: "Marketing" },
  { value: "operacoes", label: "Operações" },
];

const TYPES = [
  { value: "estrategica", label: "Estratégica" },
  { value: "tatica", label: "Tática" },
  { value: "operacional", label: "Operacional" },
];

const STATUSES = [
  { value: "planejada", label: "Planejada", icon: Clock, color: "bg-blue-500" },
  { value: "em_execucao", label: "Em Execução", icon: Play, color: "bg-yellow-500" },
  { value: "concluida", label: "Concluída", icon: CheckCircle, color: "bg-green-500" },
  { value: "cancelada", label: "Cancelada", icon: XCircle, color: "bg-red-500" },
];

export function CEODecisions() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    area: "",
    type: "",
    hypothesis: "",
  });

  const fetchDecisions = async () => {
    try {
      const { data, error } = await supabase
        .from("ceo_decisions")
        .select("*")
        .order("decision_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      setDecisions(data || []);
    } catch (error) {
      console.error("Error fetching decisions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

  const handleSubmit = async () => {
    if (!formData.title || !formData.area || !formData.type) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("ceo_decisions").insert({
        title: formData.title,
        description: formData.description || null,
        area: formData.area,
        type: formData.type,
        hypothesis: formData.hypothesis || null,
        status: "planejada",
      });

      if (error) throw error;

      toast.success("Decisão registrada com sucesso!");
      setIsDialogOpen(false);
      setFormData({ title: "", description: "", area: "", type: "", hypothesis: "" });
      fetchDecisions();
    } catch (error) {
      console.error("Error creating decision:", error);
      toast.error("Erro ao registrar decisão");
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("ceo_decisions")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status atualizado!");
      fetchDecisions();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUSES.find(s => s.value === status);
    if (!statusConfig) return null;
    const Icon = statusConfig.icon;
    return (
      <Badge variant="secondary" className={`${statusConfig.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  const getAreaLabel = (area: string) => AREAS.find(a => a.value === area)?.label || area;
  const getTypeLabel = (type: string) => TYPES.find(t => t.value === type)?.label || type;

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
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Decisões Estratégicas
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Decisão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Nova Decisão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Expansão para novos mercados"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a decisão em detalhes..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Área *</Label>
                  <Select value={formData.area} onValueChange={(v) => setFormData({ ...formData, area: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AREAS.map((area) => (
                        <SelectItem key={area.value} value={area.value}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Hipótese (opcional)</Label>
                <Textarea
                  value={formData.hypothesis}
                  onChange={(e) => setFormData({ ...formData, hypothesis: e.target.value })}
                  placeholder="Qual resultado você espera alcançar?"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Registrar Decisão
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {decisions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma decisão registrada ainda
            </p>
          ) : (
            decisions.map((decision) => (
              <div
                key={decision.id}
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold">{decision.title}</h4>
                    {decision.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {decision.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline">{getAreaLabel(decision.area)}</Badge>
                      <Badge variant="outline">{getTypeLabel(decision.type)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(decision.decision_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(decision.status)}
                    <Select
                      value={decision.status}
                      onValueChange={(v) => updateStatus(decision.id, v)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
