import { useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Plus, 
  Lightbulb,
  Target,
  Calendar,
  User,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  MoreVertical
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
}

interface Strategy {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  responsible: string | null;
  expected_impact: string | null;
  resources_needed: string | null;
  success_metrics: string | null;
  notes: string | null;
  created_at: string;
}

interface PlanData {
  id: string;
  year: number;
  version: number;
  theme: string | null;
  portal_companies: {
    name: string;
  };
}

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "vendas", label: "Vendas" },
  { value: "marketing", label: "Marketing" },
  { value: "operacoes", label: "Operações" },
  { value: "produto", label: "Produto" },
  { value: "pessoas", label: "Pessoas" },
  { value: "financeiro", label: "Financeiro" },
  { value: "tecnologia", label: "Tecnologia" },
];

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: PlayCircle },
  completed: { label: "Concluída", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
};

const PortalStrategiesPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext<{ user: PortalUser }>();

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [viewingStrategy, setViewingStrategy] = useState<Strategy | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "geral",
    priority: 1,
    responsible: "",
    start_date: "",
    end_date: "",
    expected_impact: "",
    resources_needed: "",
    success_metrics: "",
    notes: "",
  });

  useEffect(() => {
    if (planId) {
      fetchData();
    }
  }, [planId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch plan info
      const { data: planData, error: planError } = await supabase
        .from("portal_plans")
        .select("id, year, version, theme, portal_companies(name)")
        .eq("id", planId)
        .single();

      if (planError) throw planError;
      setPlan(planData);

      // Fetch strategies
      const { data: strategiesData, error: strategiesError } = await supabase
        .from("portal_strategies")
        .select("*")
        .eq("plan_id", planId)
        .order("priority", { ascending: true });

      if (strategiesError) throw strategiesError;
      setStrategies(strategiesData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
      navigate("/portal/app");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "geral",
      priority: 1,
      responsible: "",
      start_date: "",
      end_date: "",
      expected_impact: "",
      resources_needed: "",
      success_metrics: "",
      notes: "",
    });
    setEditingStrategy(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setFormData({
      title: strategy.title,
      description: strategy.description || "",
      category: strategy.category || "geral",
      priority: strategy.priority,
      responsible: strategy.responsible || "",
      start_date: strategy.start_date || "",
      end_date: strategy.end_date || "",
      expected_impact: strategy.expected_impact || "",
      resources_needed: strategy.resources_needed || "",
      success_metrics: strategy.success_metrics || "",
      notes: strategy.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Digite um título para a estratégia");
      return;
    }

    try {
      if (editingStrategy) {
        const { error } = await supabase
          .from("portal_strategies")
          .update({
            ...formData,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
          })
          .eq("id", editingStrategy.id);

        if (error) throw error;
        toast.success("Estratégia atualizada!");
      } else {
        const { error } = await supabase
          .from("portal_strategies")
          .insert({
            plan_id: planId,
            ...formData,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
          });

        if (error) throw error;
        toast.success("Estratégia adicionada!");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving strategy:", error);
      toast.error("Erro ao salvar estratégia");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta estratégia?")) return;

    try {
      const { error } = await supabase
        .from("portal_strategies")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Estratégia excluída!");
      fetchData();
    } catch (error) {
      console.error("Error deleting strategy:", error);
      toast.error("Erro ao excluir estratégia");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("portal_strategies")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status atualizado!");
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const filteredStrategies = strategies.filter(s => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/portal/app/planejamento/${planId}`)}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-400" />
              Estratégias
            </h1>
            <p className="text-slate-400 text-sm">
              {plan?.portal_companies?.name} • Plano {plan?.year} v{plan?.version}
            </p>
          </div>
        </div>

        <Button 
          onClick={openNewDialog}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Estratégia
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-amber-500 text-slate-950" : "border-slate-700 text-slate-300"}
        >
          Todas ({strategies.length})
        </Button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = strategies.filter(s => s.status === key).length;
          return (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
              className={filter === key ? "bg-amber-500 text-slate-950" : "border-slate-700 text-slate-300"}
            >
              {config.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Strategies List */}
      {filteredStrategies.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800 border-dashed">
          <CardContent className="p-12 text-center">
            <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {strategies.length === 0 ? "Nenhuma estratégia ainda" : "Nenhuma estratégia com este filtro"}
            </h3>
            <p className="text-slate-400 mb-4">
              {strategies.length === 0 
                ? "Adicione estratégias para executar seu planejamento" 
                : "Tente outro filtro ou adicione novas estratégias"}
            </p>
            {strategies.length === 0 && (
              <Button onClick={openNewDialog} className="bg-amber-500 hover:bg-amber-600 text-slate-950">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeira Estratégia
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredStrategies.map((strategy) => {
            const StatusIcon = STATUS_CONFIG[strategy.status as keyof typeof STATUS_CONFIG]?.icon || Clock;
            const statusConfig = STATUS_CONFIG[strategy.status as keyof typeof STATUS_CONFIG];

            return (
              <Card 
                key={strategy.id} 
                className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                onClick={() => setViewingStrategy(strategy)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={statusConfig?.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig?.label}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">
                          {getCategoryLabel(strategy.category || "geral")}
                        </Badge>
                        {strategy.priority <= 3 && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                            Prioridade {strategy.priority}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-1">
                        {strategy.title}
                      </h3>

                      {strategy.description && (
                        <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                          {strategy.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {strategy.responsible && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {strategy.responsible}
                          </span>
                        )}
                        {(strategy.start_date || strategy.end_date) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {strategy.start_date && new Date(strategy.start_date).toLocaleDateString("pt-BR")}
                            {strategy.start_date && strategy.end_date && " → "}
                            {strategy.end_date && new Date(strategy.end_date).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {strategy.expected_impact && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {strategy.expected_impact}
                          </span>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-400 hover:text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                        <DropdownMenuItem onClick={() => openEditDialog(strategy)} className="text-slate-300 hover:text-white">
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {strategy.status !== "in_progress" && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(strategy.id, "in_progress")}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Iniciar
                          </DropdownMenuItem>
                        )}
                        {strategy.status !== "completed" && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(strategy.id, "completed")}
                            className="text-green-400 hover:text-green-300"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Concluir
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => handleDelete(strategy.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingStrategy ? "Editar Estratégia" : "Nova Estratégia"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Defina os detalhes da estratégia para seu planejamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Expandir para novos mercados"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a estratégia em detalhes..."
                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="text-slate-300">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Prioridade</Label>
                <Select
                  value={formData.priority.toString()}
                  onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {[1, 2, 3, 4, 5].map((p) => (
                      <SelectItem key={p} value={p.toString()} className="text-slate-300">
                        {p} - {p === 1 ? "Crítica" : p === 2 ? "Alta" : p === 3 ? "Média" : p === 4 ? "Baixa" : "Opcional"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Responsável</Label>
              <Input
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                placeholder="Nome do responsável"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Data Início</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Data Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Impacto Esperado</Label>
              <Input
                value={formData.expected_impact}
                onChange={(e) => setFormData({ ...formData, expected_impact: e.target.value })}
                placeholder="Ex: Aumento de 20% no faturamento"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Recursos Necessários</Label>
              <Textarea
                value={formData.resources_needed}
                onChange={(e) => setFormData({ ...formData, resources_needed: e.target.value })}
                placeholder="Liste os recursos necessários..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Métricas de Sucesso</Label>
              <Input
                value={formData.success_metrics}
                onChange={(e) => setFormData({ ...formData, success_metrics: e.target.value })}
                placeholder="Como medir o sucesso desta estratégia"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Notas Adicionais</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações ou notas..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950"
            >
              {editingStrategy ? "Salvar Alterações" : "Adicionar Estratégia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Strategy Detail Dialog */}
      <Dialog open={!!viewingStrategy} onOpenChange={(open) => !open && setViewingStrategy(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingStrategy && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={STATUS_CONFIG[viewingStrategy.status as keyof typeof STATUS_CONFIG]?.color}>
                    {(() => {
                      const StatusIcon = STATUS_CONFIG[viewingStrategy.status as keyof typeof STATUS_CONFIG]?.icon || Clock;
                      return <StatusIcon className="w-3 h-3 mr-1" />;
                    })()}
                    {STATUS_CONFIG[viewingStrategy.status as keyof typeof STATUS_CONFIG]?.label}
                  </Badge>
                  <Badge variant="outline" className="border-slate-700 text-slate-400">
                    {getCategoryLabel(viewingStrategy.category || "geral")}
                  </Badge>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Prioridade {viewingStrategy.priority}
                  </Badge>
                </div>
                <DialogTitle className="text-xl text-white">
                  {viewingStrategy.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {viewingStrategy.description && (
                  <div className="space-y-1">
                    <Label className="text-slate-500 text-xs uppercase">Descrição</Label>
                    <p className="text-slate-300">{viewingStrategy.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {viewingStrategy.responsible && (
                    <div className="space-y-1">
                      <Label className="text-slate-500 text-xs uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Responsável
                      </Label>
                      <p className="text-white">{viewingStrategy.responsible}</p>
                    </div>
                  )}

                  {(viewingStrategy.start_date || viewingStrategy.end_date) && (
                    <div className="space-y-1">
                      <Label className="text-slate-500 text-xs uppercase flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Período
                      </Label>
                      <p className="text-white">
                        {viewingStrategy.start_date && new Date(viewingStrategy.start_date).toLocaleDateString("pt-BR")}
                        {viewingStrategy.start_date && viewingStrategy.end_date && " → "}
                        {viewingStrategy.end_date && new Date(viewingStrategy.end_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>

                {viewingStrategy.expected_impact && (
                  <div className="space-y-1">
                    <Label className="text-slate-500 text-xs uppercase flex items-center gap-1">
                      <Target className="w-3 h-3" /> Impacto Esperado
                    </Label>
                    <p className="text-slate-300">{viewingStrategy.expected_impact}</p>
                  </div>
                )}

                {viewingStrategy.resources_needed && (
                  <div className="space-y-1">
                    <Label className="text-slate-500 text-xs uppercase">Recursos Necessários</Label>
                    <p className="text-slate-300 whitespace-pre-wrap">{viewingStrategy.resources_needed}</p>
                  </div>
                )}

                {viewingStrategy.success_metrics && (
                  <div className="space-y-1">
                    <Label className="text-slate-500 text-xs uppercase">Métricas de Sucesso</Label>
                    <p className="text-slate-300">{viewingStrategy.success_metrics}</p>
                  </div>
                )}

                {viewingStrategy.notes && (
                  <div className="space-y-1">
                    <Label className="text-slate-500 text-xs uppercase">Notas</Label>
                    <p className="text-slate-300 whitespace-pre-wrap">{viewingStrategy.notes}</p>
                  </div>
                )}

                <div className="text-xs text-slate-600 pt-2 border-t border-slate-800">
                  Criado em {new Date(viewingStrategy.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                  })}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setViewingStrategy(null)}
                  className="border-slate-700 text-slate-300"
                >
                  Fechar
                </Button>
                <Button 
                  onClick={() => {
                    openEditDialog(viewingStrategy);
                    setViewingStrategy(null);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Estratégia
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalStrategiesPage;
