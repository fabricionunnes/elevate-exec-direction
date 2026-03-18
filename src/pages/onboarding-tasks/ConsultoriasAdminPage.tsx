import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Copy,
  RefreshCw,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  Trash2,
  Instagram,
  BarChart3,
  DollarSign,
  Briefcase,
  Link2,
  Plus,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NexusHeader } from "@/components/onboarding-tasks/NexusHeader";
import { getPublicBaseUrl } from "@/lib/publicDomain";
import {
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ConsultationForm {
  id: string;
  project_id: string;
  access_token: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  company_name?: string;
  project_name?: string;
}

interface Project {
  id: string;
  product_name: string;
  onboarding_company_id: string;
  company_name?: string;
}

type ConsultationType = "marketing" | "traffic" | "financial";

const CONSULTATION_TABS = [
  { id: "marketing" as ConsultationType, label: "Marketing", icon: Instagram, color: "text-pink-500" },
  { id: "traffic" as ConsultationType, label: "Tráfego Pago", icon: BarChart3, color: "text-blue-500" },
  { id: "financial" as ConsultationType, label: "Financeiro", icon: DollarSign, color: "text-emerald-500" },
];

const TABLE_MAP: Record<ConsultationType, string> = {
  marketing: "marketing_consultation_forms",
  traffic: "traffic_analysis_forms",
  financial: "financial_consultation_forms",
};

const PUBLIC_ROUTE_MAP: Record<ConsultationType, string> = {
  marketing: "marketing-consultation",
  traffic: "traffic-analysis",
  financial: "financial-consultation",
};

// Marketing form answer fields
const MARKETING_FIELDS = [
  { key: "instagram_handle", label: "@ do Instagram" },
  { key: "instagram_followers", label: "Seguidores" },
  { key: "instagram_posting_frequency", label: "Frequência de postagem" },
  { key: "instagram_content_types", label: "Tipos de conteúdo" },
  { key: "instagram_engagement_rate", label: "Taxa de engajamento" },
  { key: "instagram_best_post", label: "Melhor post" },
  { key: "instagram_worst_post", label: "Pior post" },
  { key: "instagram_stories_usage", label: "Uso de Stories" },
  { key: "instagram_reels_usage", label: "Uso de Reels" },
  { key: "instagram_bio_optimized", label: "Bio otimizada?" },
  { key: "instagram_highlights", label: "Destaques" },
  { key: "instagram_hashtag_strategy", label: "Estratégia de hashtags" },
  { key: "instagram_competitor_profiles", label: "Perfis concorrentes" },
  { key: "brand_visual_identity", label: "Identidade visual" },
  { key: "brand_tone_of_voice", label: "Tom de voz" },
  { key: "brand_differentiator", label: "Diferencial" },
  { key: "brand_positioning", label: "Posicionamento" },
  { key: "content_planning", label: "Planejamento de conteúdo" },
  { key: "content_calendar", label: "Calendário editorial" },
  { key: "content_pillars", label: "Pilares de conteúdo" },
  { key: "content_production_team", label: "Equipe de produção" },
  { key: "marketing_main_goal", label: "Objetivo principal" },
  { key: "marketing_biggest_challenge", label: "Maior desafio" },
  { key: "marketing_expected_results", label: "Resultados esperados" },
  { key: "marketing_additional_info", label: "Informações adicionais" },
];

const TRAFFIC_FIELDS = [
  { key: "has_run_ads", label: "Já investiu em tráfego?" },
  { key: "platforms_used", label: "Plataformas utilizadas" },
  { key: "monthly_budget", label: "Investimento mensal" },
  { key: "budget_management", label: "Quem gerencia" },
  { key: "main_objective", label: "Objetivo principal" },
  { key: "target_audience_description", label: "Público-alvo" },
  { key: "geographic_targeting", label: "Segmentação geográfica" },
  { key: "current_campaigns_types", label: "Tipos de campanha" },
  { key: "best_performing_campaign", label: "Melhor campanha" },
  { key: "worst_performing_campaign", label: "Pior campanha" },
  { key: "average_cpl", label: "CPL médio" },
  { key: "average_cpa", label: "CPA médio" },
  { key: "average_roas", label: "ROAS atual" },
  { key: "conversion_tracking", label: "Acompanha conversões?" },
  { key: "pixel_installed", label: "Pixel instalado?" },
  { key: "landing_page_url", label: "URL da landing page" },
  { key: "landing_page_experience", label: "Experiência da LP" },
  { key: "creative_production", label: "Produção de criativos" },
  { key: "ad_frequency_issue", label: "Problema de frequência?" },
  { key: "retargeting_strategy", label: "Estratégia de retargeting" },
  { key: "lookalike_audiences", label: "Públicos lookalike" },
  { key: "ab_testing", label: "Testes A/B" },
  { key: "biggest_challenge", label: "Maior desafio" },
  { key: "previous_agency", label: "Agência anterior" },
  { key: "expected_results", label: "Resultados esperados" },
  { key: "additional_info", label: "Informações adicionais" },
];

const FINANCIAL_FIELDS = [
  { key: "monthly_revenue", label: "Faturamento mensal" },
  { key: "revenue_sources", label: "Fontes de receita" },
  { key: "average_ticket", label: "Ticket médio" },
  { key: "payment_methods", label: "Meios de pagamento" },
  { key: "default_rate", label: "Taxa de inadimplência" },
  { key: "fixed_costs", label: "Custos fixos" },
  { key: "variable_costs", label: "Custos variáveis" },
  { key: "payroll_cost", label: "Custo com folha" },
  { key: "biggest_expense", label: "Maior despesa" },
  { key: "cost_reduction_attempts", label: "Tentativas de redução" },
  { key: "cash_flow_control", label: "Controle de fluxo de caixa" },
  { key: "cash_flow_tool", label: "Ferramenta utilizada" },
  { key: "cash_reserve_months", label: "Reserva (meses)" },
  { key: "seasonal_variation", label: "Variação sazonal" },
  { key: "has_budget", label: "Possui orçamento?" },
  { key: "profit_margin", label: "Margem de lucro" },
  { key: "pricing_strategy", label: "Estratégia de precificação" },
  { key: "financial_goals", label: "Metas financeiras" },
  { key: "tax_regime", label: "Regime tributário" },
  { key: "accountant_relationship", label: "Relação com contador" },
  { key: "tax_planning", label: "Planejamento tributário" },
  { key: "financial_biggest_challenge", label: "Maior desafio" },
  { key: "previous_consultant", label: "Consultor anterior" },
  { key: "expected_financial_results", label: "Resultados esperados" },
  { key: "financial_additional_info", label: "Informações adicionais" },
];

const FIELDS_MAP: Record<ConsultationType, { key: string; label: string }[]> = {
  marketing: MARKETING_FIELDS,
  traffic: TRAFFIC_FIELDS,
  financial: FINANCIAL_FIELDS,
};

export default function ConsultoriasAdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ConsultationType>("marketing");
  const [forms, setForms] = useState<Record<ConsultationType, ConsultationForm[]>>({
    marketing: [],
    traffic: [],
    financial: [],
  });
  const [formDetails, setFormDetails] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [creating, setCreating] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const filteredProjects = projects.filter(
    (p) =>
      p.company_name?.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  useEffect(() => {
    fetchAllForms();
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("onboarding_projects")
      .select("id, product_name, onboarding_company_id, onboarding_companies(name)")
      .order("product_name");
    if (data) {
      setProjects(
        data.map((p: any) => ({
          id: p.id,
          product_name: p.product_name,
          onboarding_company_id: p.onboarding_company_id,
          company_name: p.onboarding_companies?.name || "",
        }))
      );
    }
  };

  const fetchAllForms = async () => {
    setLoading(true);
    try {
      const results: Record<ConsultationType, ConsultationForm[]> = {
        marketing: [],
        traffic: [],
        financial: [],
      };

      for (const type of ["marketing", "traffic", "financial"] as ConsultationType[]) {
        const table = TABLE_MAP[type];
        const { data } = await supabase
          .from(table as any)
          .select("*, onboarding_projects!inner(product_name, onboarding_companies(name))")
          .order("created_at", { ascending: false });

        if (data) {
          results[type] = data.map((d: any) => ({
            id: d.id,
            project_id: d.project_id,
            access_token: d.access_token,
            status: d.status,
            submitted_at: d.submitted_at,
            created_at: d.created_at,
            company_name: d.onboarding_projects?.onboarding_companies?.name || "",
            project_name: d.onboarding_projects?.product_name || "",
          }));

          // Store full details for answers display
          data.forEach((d: any) => {
            setFormDetails((prev) => ({ ...prev, [d.id]: d }));
          });
        }
      }

      setForms(results);
    } catch (error) {
      console.error("Error fetching forms:", error);
      toast.error("Erro ao carregar formulários");
    } finally {
      setLoading(false);
    }
  };

  const createForm = async () => {
    if (!selectedProjectId) {
      toast.error("Selecione um projeto");
      return;
    }
    setCreating(true);
    try {
      const table = TABLE_MAP[activeTab];
      const { error } = await supabase
        .from(table as any)
        .insert({ project_id: selectedProjectId } as any);

      if (error) throw error;
      toast.success("Formulário criado com sucesso!");
      setCreateDialogOpen(false);
      setSelectedProjectId("");
      fetchAllForms();
    } catch (error: any) {
      console.error("Error creating form:", error);
      toast.error(error.message || "Erro ao criar formulário");
    } finally {
      setCreating(false);
    }
  };

  const deleteForm = async (formId: string, type: ConsultationType) => {
    try {
      const table = TABLE_MAP[type];
      const { error } = await supabase
        .from(table as any)
        .delete()
        .eq("id", formId);

      if (error) throw error;
      toast.success("Formulário excluído");
      fetchAllForms();
    } catch (error) {
      console.error("Error deleting form:", error);
      toast.error("Erro ao excluir formulário");
    }
  };

  const getPublicLink = (form: ConsultationForm, type: ConsultationType) => {
    return `${getPublicBaseUrl()}?public=${PUBLIC_ROUTE_MAP[type]}&token=${form.access_token}`;
  };

  const copyLink = (form: ConsultationForm, type: ConsultationType) => {
    navigator.clipboard.writeText(getPublicLink(form, type));
    toast.success("Link copiado!");
  };

  const currentForms = forms[activeTab];
  const filteredForms = currentForms.filter(
    (f) =>
      f.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCount = currentForms.length;
  const submittedCount = currentForms.filter((f) => f.submitted_at).length;
  const pendingCount = totalCount - submittedCount;

  const renderAnswers = (formId: string, type: ConsultationType) => {
    const detail = formDetails[formId];
    if (!detail) return null;
    const fields = FIELDS_MAP[type];
    const answers = fields
      .map((f) => ({ label: f.label, value: detail[f.key] }))
      .filter((a) => a.value !== null && a.value !== undefined && a.value !== "");

    if (answers.length === 0) return null;

    return (
      <div className="mt-3 rounded-xl border border-border/60 overflow-hidden">
        <div className="bg-primary/5 border-b border-border/60 px-5 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">Respostas</h4>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {answers.length} respostas
          </Badge>
        </div>
        <div className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
          {answers.map((a, i) => (
            <div key={i} className="px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 hover:bg-muted/30 transition-colors">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap min-w-[160px] pt-0.5">
                {a.label}
              </span>
              <span className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {String(a.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/onboarding-tasks")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <NexusHeader showTitle={false} />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary" />
                  Consultorias
                </h1>
                <p className="text-sm text-muted-foreground hidden md:block">
                  Formulários de diagnóstico para consultorias
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Formulário</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  fetchAllForms();
                }}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConsultationType)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {CONSULTATION_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                  <Icon className={`h-4 w-4 ${tab.color}`} />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{totalCount}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">{submittedCount}</p>
                  <p className="text-sm text-muted-foreground">Respondidos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa ou projeto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Forms List */}
          {CONSULTATION_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredForms.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <tab.icon className={`h-12 w-12 mx-auto mb-4 ${tab.color} opacity-50`} />
                    <h3 className="font-medium mb-2">Nenhum formulário encontrado</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Crie um formulário de {tab.label} para enviar ao cliente.
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Formulário
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {filteredForms.map((form) => (
                    <AccordionItem key={form.id} value={form.id} className="border rounded-lg">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 w-full mr-4">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{form.company_name || "Sem empresa"}</p>
                            <p className="text-xs text-muted-foreground truncate">{form.project_name}</p>
                          </div>
                          <Badge variant={form.submitted_at ? "default" : "secondary"} className="flex-shrink-0">
                            {form.submitted_at ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Respondido</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" /> Pendente</>
                            )}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(form.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        {/* Link */}
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-3">
                          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <code className="text-xs flex-1 truncate">{getPublicLink(form, tab.id)}</code>
                          <Button variant="outline" size="sm" onClick={() => copyLink(form, tab.id)}>
                            <Copy className="h-4 w-4 mr-1" /> Copiar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getPublicLink(form, tab.id), "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteForm(form.id, tab.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        {/* Answers */}
                        {form.submitted_at && renderAnswers(form.id, tab.id)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              {(() => {
                const tab = CONSULTATION_TABS.find((t) => t.id === activeTab);
                const Icon = tab?.icon || Briefcase;
                return (
                  <div className={`p-2.5 rounded-xl bg-primary/10`}>
                    <Icon className={`h-5 w-5 ${tab?.color || "text-primary"}`} />
                  </div>
                );
              })()}
              <div>
                <DialogTitle className="text-lg">
                  Novo Formulário de {CONSULTATION_TABS.find((t) => t.id === activeTab)?.label}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Selecione o projeto para enviar o diagnóstico
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Projeto / Empresa</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Buscar empresa ou projeto..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="border rounded-lg max-h-[280px] overflow-y-auto">
              {filteredProjects.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum projeto encontrado
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b last:border-b-0 ${
                      selectedProjectId === p.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Building2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${selectedProjectId === p.id ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
                      <p className={`text-sm font-medium whitespace-normal break-words leading-5 ${selectedProjectId === p.id ? "text-primary" : "text-foreground"}`}>
                        {p.company_name || "Sem empresa"}
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-normal break-words leading-4">
                        {p.product_name}
                      </p>
                    </div>
                    {selectedProjectId === p.id && (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setProjectSearch(""); }}>
              Cancelar
            </Button>
            <Button onClick={createForm} disabled={creating || !selectedProjectId}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
