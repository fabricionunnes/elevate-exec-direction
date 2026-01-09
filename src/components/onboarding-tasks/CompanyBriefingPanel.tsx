import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Target,
  Users,
  DollarSign,
  FileText,
  Briefcase,
  Pencil,
  X,
  Save,
  ClipboardList,
  Link2,
  Copy,
  Calculator,
  Instagram,
  ExternalLink,
  History,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KickoffFormDialog } from "./KickoffFormDialog";
import { formatPhone } from "@/lib/utils";
import { COMPANY_SEGMENTS } from "@/data/companySegments";
import { getPublicBaseUrl } from "@/lib/publicDomain";

const COMPANY_STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "cancellation_requested", label: "Solicitou cancelamento" },
  { value: "closed", label: "Encerrada" },
];

interface QuarterlyGoals {
  q1: { pessimista: string; realista: string; otimista: string };
  q2: { pessimista: string; realista: string; otimista: string };
  q3: { pessimista: string; realista: string; otimista: string };
  q4: { pessimista: string; realista: string; otimista: string };
}

interface CompanyData {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  instagram: string | null;
  company_description: string | null;
  main_challenges: string | null;
  goals_short_term: string | null;
  goals_long_term: string | null;
  target_audience: string | null;
  competitors: string | null;
  kickoff_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  billing_day: number | null;
  stakeholders: any[] | null;
  expected_timeline: any | null;
  status: string;
  notes: string | null;
  cs?: { id: string; name: string } | null;
  consultant?: { id: string; name: string } | null;
  // Kickoff fields
  sales_team_size: string | null;
  conversion_rate: string | null;
  average_ticket: string | null;
  acquisition_channels: string | null;
  has_structured_process: string | null;
  crm_usage: string | null;
  has_sales_goals: string | null;
  swot_strengths: string | null;
  swot_weaknesses: string | null;
  swot_opportunities: string | null;
  swot_threats: string | null;
  commercial_structure: string | null;
  growth_target: string | null;
  tools_used: string | null;
  objectives_with_unv: string | null;
  key_results: string | null;
  quarterly_goals: QuarterlyGoals | null;
  growth_expectation_3m: string | null;
  growth_expectation_6m: string | null;
  growth_expectation_12m: string | null;
}

interface CACFormData {
  id: string;
  company_name: string;
  form_title: string | null;
  facebook_ads_investment: number | null;
  google_ads_investment: number | null;
  linkedin_ads_investment: number | null;
  facebook_sales_quantity: number | null;
  facebook_sales_value: number | null;
  google_sales_quantity: number | null;
  google_sales_value: number | null;
  linkedin_sales_quantity: number | null;
  linkedin_sales_value: number | null;
  sales_quantity_3_months: number | null;
  sales_value_3_months: number | null;
  submitted_at: string;
}

interface SalesHistoryData {
  month_year: string;
  revenue: number;
  sales_count: number | null;
}

interface CompanyBriefingPanelProps {
  companyId: string;
  projectId?: string;
  userRole?: "admin" | "cs" | "consultant" | "client" | null;
  isStaffAdmin?: boolean;
}

export const CompanyBriefingPanel = ({ companyId, projectId, userRole, isStaffAdmin = false }: CompanyBriefingPanelProps) => {
  // Apenas admin e CS podem editar o briefing
  const canEdit = isStaffAdmin || userRole === "admin" || userRole === "cs";
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [cacForms, setCacForms] = useState<CACFormData[]>([]);
  const [salesHistory, setSalesHistory] = useState<SalesHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<CompanyData>>({});
  const [showKickoffForm, setShowKickoffForm] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
      fetchSalesHistory();
    } else {
      setLoading(false);
    }
    if (projectId) {
      fetchCACForms();
    }
  }, [companyId, projectId]);

  const fetchSalesHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("company_sales_history")
        .select("month_year, revenue, sales_count")
        .eq("company_id", companyId)
        .eq("is_pre_unv", true)
        .order("month_year", { ascending: false });

      if (error) throw error;
      setSalesHistory(data || []);
    } catch (error) {
      console.error("Error fetching sales history:", error);
    }
  };

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_companies")
        .select(`
          *,
          cs:onboarding_staff!onboarding_companies_cs_id_fkey(id, name),
          consultant:onboarding_staff!onboarding_companies_consultant_id_fkey(id, name)
        `)
        .eq("id", companyId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const rawQuarterlyGoals = data.quarterly_goals as unknown;
        const quarterlyGoals = rawQuarterlyGoals && typeof rawQuarterlyGoals === 'object' && 'q1' in rawQuarterlyGoals
          ? rawQuarterlyGoals as QuarterlyGoals
          : null;
          
        const companyData: CompanyData = {
          ...data,
          stakeholders: Array.isArray(data.stakeholders) ? data.stakeholders : null,
          expected_timeline: data.expected_timeline,
          quarterly_goals: quarterlyGoals,
        };
        setCompany(companyData);
        setFormData(companyData);
      }
    } catch (error: any) {
      console.error("Error fetching company:", error);
      toast.error("Erro ao carregar dados da empresa");
    } finally {
      setLoading(false);
    }
  };

  const fetchCACForms = async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from("onboarding_cac_forms")
        .select("*")
        .eq("project_id", projectId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setCacForms(data || []);
    } catch (error: any) {
      console.error("Error fetching CAC forms:", error);
    }
  };

  const handleSave = async () => {
    if (!company) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("onboarding_companies")
        .update({
          name: formData.name,
          cnpj: formData.cnpj,
          segment: formData.segment,
          status: formData.status,
          website: formData.website,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          company_description: formData.company_description,
          main_challenges: formData.main_challenges,
          goals_short_term: formData.goals_short_term,
          goals_long_term: formData.goals_long_term,
          target_audience: formData.target_audience,
          competitors: formData.competitors,
          kickoff_date: formData.kickoff_date,
          contract_start_date: formData.contract_start_date,
          contract_end_date: formData.contract_end_date,
          contract_value: formData.contract_value,
          billing_day: formData.billing_day,
          notes: formData.notes,
        })
        .eq("id", company.id);

      if (error) throw error;
      
      toast.success("Briefing atualizado com sucesso");
      setIsEditing(false);
      fetchCompanyData();
    } catch (error: any) {
      console.error("Error saving company:", error);
      toast.error("Erro ao salvar briefing");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(company || {});
    setIsEditing(false);
  };

  const updateField = (field: keyof CompanyData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma empresa vinculada a este projeto</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const renderField = (label: string, value: string | null, field: keyof CompanyData, type: "text" | "textarea" | "date" | "number" = "text") => {
    if (isEditing) {
      if (type === "textarea") {
        return (
          <div>
            <label className="text-sm text-muted-foreground">{label}</label>
            <Textarea
              value={(formData[field] as string) || ""}
              onChange={(e) => updateField(field, e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
        );
      }
      return (
        <div>
          <label className="text-sm text-muted-foreground">{label}</label>
          <Input
            type={type}
            value={(formData[field] as string | number) || ""}
            onChange={(e) => updateField(field, type === "number" ? parseFloat(e.target.value) || null : e.target.value)}
            className="mt-1"
          />
        </div>
      );
    }

    return (
      <div>
        <label className="text-sm text-muted-foreground">{label}</label>
        <p className="font-medium whitespace-pre-wrap">{value || "-"}</p>
      </div>
    );
  };

  const getStatusLabel = (status: string) => {
    const option = COMPANY_STATUS_OPTIONS.find(o => o.value === status);
    return option?.label || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "active":
        return "default";
      case "cancellation_requested":
        return "secondary";
      case "closed":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header com botões de ação */}
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving} className="h-8 sm:h-9 text-xs sm:text-sm">
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 sm:h-9 text-xs sm:text-sm">
                <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowKickoffForm(true)} className="h-8 sm:h-9 text-xs sm:text-sm">
                <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Formulário de Kickoff</span>
                <span className="sm:hidden ml-1.5">Kickoff</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 sm:h-9 text-xs sm:text-sm">
                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Editar Briefing</span>
                <span className="sm:hidden ml-1.5">Editar</span>
              </Button>
            </>
          )}
        </div>
      )}

      {/* Kickoff Form Dialog */}
      <KickoffFormDialog
        open={showKickoffForm}
        onOpenChange={setShowKickoffForm}
        companyId={companyId}
        onSuccess={fetchCompanyData}
      />

      {/* Informações Básicas */}
      <Card>
        <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {renderField("Nome da Empresa", company.name, "name")}
            {renderField("CNPJ", company.cnpj, "cnpj")}
            <div>
              <label className="text-sm text-muted-foreground">Segmento</label>
              {isEditing ? (
                <Select
                  value={formData.segment || ""}
                  onValueChange={(value) => updateField("segment", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SEGMENTS.map((seg) => (
                      <SelectItem key={seg} value={seg}>
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{company.segment || "-"}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Status</label>
              {isEditing ? (
                <Select
                  value={formData.status || "active"}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1">
                  <Badge variant={getStatusVariant(company.status)}>
                    {getStatusLabel(company.status)}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-3 sm:my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {renderField("Website", company.website, "website")}
            <div>
              <label className="text-xs sm:text-sm text-muted-foreground">Telefone</label>
              {isEditing ? (
                <Input
                  value={(formData.phone as string) || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="mt-1"
                  placeholder="(31) 99999-9999"
                />
              ) : (
                <p className="font-medium">{formatPhone(company.phone) || "-"}</p>
              )}
            </div>
            {renderField("Email", company.email, "email")}
            {renderField("Endereço", company.address, "address")}
            {renderField("Instagram", company.instagram, "instagram")}
          </div>

          {!isEditing && (
            <div className="flex flex-wrap gap-4 pt-2">
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Abrir site
                  </a>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${company.email}`} className="text-primary hover:underline">
                    Enviar email
                  </a>
                </div>
              )}
              {company.instagram && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    let url = company.instagram!;
                    // Handle both full URLs and just usernames
                    if (!url.startsWith("http")) {
                      // Remove @ if present
                      const username = url.replace(/^@/, "");
                      url = `https://instagram.com/${username}`;
                    }
                    window.open(url, "_blank");
                  }}
                  className="gap-2"
                >
                  <Instagram className="h-4 w-4" />
                  Abrir Instagram
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Descrição e Contexto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Descrição da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderField("Descrição", company.company_description, "company_description", "textarea")}
        </CardContent>
      </Card>

      {/* Objetivos e Desafios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objetivos e Desafios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Principais Desafios", company.main_challenges, "main_challenges", "textarea")}
          {renderField("Metas de Curto Prazo", company.goals_short_term, "goals_short_term", "textarea")}
          {renderField("Metas de Longo Prazo", company.goals_long_term, "goals_long_term", "textarea")}
        </CardContent>
      </Card>

      {/* Mercado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Mercado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderField("Público-Alvo", company.target_audience, "target_audience", "textarea")}
          {renderField("Concorrentes", company.competitors, "competitors", "textarea")}
        </CardContent>
      </Card>

      {/* Diagnóstico Comercial (Kickoff) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Diagnóstico Comercial (Kickoff)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!(
            company.main_challenges ||
            company.sales_team_size ||
            company.conversion_rate ||
            company.average_ticket ||
            company.acquisition_channels ||
            company.has_structured_process ||
            company.crm_usage ||
            company.has_sales_goals ||
            company.commercial_structure ||
            company.growth_target ||
            company.tools_used ||
            company.swot_strengths ||
            company.swot_weaknesses ||
            company.swot_opportunities ||
            company.swot_threats ||
            company.objectives_with_unv ||
            company.key_results ||
            company.quarterly_goals ||
            company.growth_expectation_3m ||
            company.growth_expectation_6m ||
            company.growth_expectation_12m
          ) && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              O cliente ainda não preencheu este diagnóstico (ou não foi salvo). Assim que ele enviar o formulário de kickoff, as respostas aparecerão aqui.
            </div>
          )}

          {/* Perguntas do Diagnóstico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Vendedores ativos na equipe</label>
              <p className="font-medium">{company.sales_team_size || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Taxa de conversão atual</label>
              <p className="font-medium">{company.conversion_rate || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Ticket médio de venda</label>
              <p className="font-medium">{company.average_ticket || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Canais de aquisição</label>
              <p className="font-medium">{company.acquisition_channels || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Processo estruturado</label>
              <p className="font-medium">{company.has_structured_process || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Uso do CRM</label>
              <p className="font-medium">{company.crm_usage || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Plano de metas</label>
              <p className="font-medium">{company.has_sales_goals || "-"}</p>
            </div>
          </div>

          {/* Checklist */}
          {(company.commercial_structure || company.growth_target || company.tools_used) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Checklist de Informações</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Estrutura atual da equipe comercial</label>
                    <p className="font-medium whitespace-pre-wrap">{company.commercial_structure || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Meta de crescimento</label>
                    <p className="font-medium whitespace-pre-wrap">{company.growth_target || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-muted-foreground">Ferramentas utilizadas (CRM, automação)</label>
                    <p className="font-medium whitespace-pre-wrap">{company.tools_used || "-"}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SWOT */}
          {(company.swot_strengths || company.swot_weaknesses || company.swot_opportunities || company.swot_threats) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Análise SWOT</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                    <label className="text-sm font-medium text-green-600">Forças</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.swot_strengths || "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                    <label className="text-sm font-medium text-red-600">Fraquezas</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.swot_weaknesses || "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <label className="text-sm font-medium text-blue-600">Oportunidades</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.swot_opportunities || "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                    <label className="text-sm font-medium text-orange-600">Ameaças</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.swot_threats || "-"}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* OKRs */}
          {(company.objectives_with_unv || company.key_results) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">OKRs</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Principais objetivos com a UNV</label>
                    <p className="font-medium whitespace-pre-wrap">{company.objectives_with_unv || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Resultados-chave esperados</label>
                    <p className="font-medium whitespace-pre-wrap">{company.key_results || "-"}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Metas Trimestrais */}
          {company.quarterly_goals && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Metas e Checkpoints Trimestrais</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium text-muted-foreground"></th>
                        <th className="text-center p-2 font-medium">1º Tri</th>
                        <th className="text-center p-2 font-medium">2º Tri</th>
                        <th className="text-center p-2 font-medium">3º Tri</th>
                        <th className="text-center p-2 font-medium">4º Tri</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2 font-medium text-red-600">Pessimista</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q1?.pessimista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q2?.pessimista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q3?.pessimista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q4?.pessimista || "-"}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2 font-medium text-yellow-600">Realista</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q1?.realista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q2?.realista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q3?.realista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q4?.realista || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-medium text-green-600">Otimista</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q1?.otimista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q2?.otimista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q3?.otimista || "-"}</td>
                        <td className="p-2 text-center">{company.quarterly_goals.q4?.otimista || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Expectativas de Crescimento */}
          {(company.growth_expectation_3m || company.growth_expectation_6m || company.growth_expectation_12m) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Alinhamento de Expectativas</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <label className="text-sm text-muted-foreground">Expectativa 3 meses</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.growth_expectation_3m || "-"}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <label className="text-sm text-muted-foreground">Expectativa 6 meses</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.growth_expectation_6m || "-"}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <label className="text-sm text-muted-foreground">Expectativa 12 meses</label>
                    <p className="font-medium whitespace-pre-wrap mt-1">{company.growth_expectation_12m || "-"}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Vendas (Pré-UNV) */}
      {salesHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Vendas (Pré-UNV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Mês/Ano</th>
                    <th className="text-right p-3 font-medium">Faturamento</th>
                    <th className="text-right p-3 font-medium">Qtd. Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.map((entry) => {
                    const date = new Date(entry.month_year + "T12:00:00");
                    const monthLabel = format(date, "MMM/yyyy", { locale: ptBR });
                    return (
                      <tr key={entry.month_year} className="border-b">
                        <td className="p-3 font-medium capitalize">{monthLabel}</td>
                        <td className="p-3 text-right">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(entry.revenue)}
                        </td>
                        <td className="p-3 text-right">{entry.sales_count || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td className="p-3 font-semibold">Total</td>
                    <td className="p-3 text-right font-semibold">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        salesHistory.reduce((sum, e) => sum + e.revenue, 0)
                      )}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {salesHistory.reduce((sum, e) => sum + (e.sales_count || 0), 0) || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-muted-foreground">Média Mensal</td>
                    <td className="p-3 text-right font-medium text-muted-foreground">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        salesHistory.reduce((sum, e) => sum + e.revenue, 0) / salesHistory.length
                      )}
                    </td>
                    <td className="p-3 text-right font-medium text-muted-foreground">
                      {Math.round(salesHistory.reduce((sum, e) => sum + (e.sales_count || 0), 0) / salesHistory.length) || "-"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações de Contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Informações de Contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isEditing ? (
              <>
                {renderField("Data de Kickoff", company.kickoff_date, "kickoff_date", "date")}
                {renderField("Início do Contrato", company.contract_start_date, "contract_start_date", "date")}
                {renderField("Fim do Contrato", company.contract_end_date, "contract_end_date", "date")}
                {renderField("Valor do Contrato", company.contract_value?.toString() || null, "contract_value", "number")}
                {renderField("Dia de Cobrança", company.billing_day?.toString() || null, "billing_day", "number")}
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Data de Kickoff</label>
                  <p className="font-medium">{formatDate(company.kickoff_date)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Início do Contrato</label>
                  <p className="font-medium">{formatDate(company.contract_start_date)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Fim do Contrato</label>
                  <p className="font-medium">{formatDate(company.contract_end_date)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Valor do Contrato</label>
                  <p className="font-medium">{formatCurrency(company.contract_value)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Dia de Cobrança</label>
                  <p className="font-medium">{company.billing_day || "-"}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Equipe Responsável */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Equipe Responsável
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">CS (Customer Success)</label>
              <p className="font-medium">{company.cs?.name || "-"}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Consultor</label>
              <p className="font-medium">{company.consultant?.name || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stakeholders */}
      {company.stakeholders && company.stakeholders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Stakeholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {company.stakeholders.map((stakeholder: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{stakeholder.name}</p>
                    <p className="text-sm text-muted-foreground">{stakeholder.role}</p>
                  </div>
                  {stakeholder.email && (
                    <a href={`mailto:${stakeholder.email}`} className="text-primary hover:underline text-sm">
                      {stakeholder.email}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário CAC */}
      {projectId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              CAC - Custo de Aquisição de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Link do formulário */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <code className="text-sm flex-1 truncate">
                {getPublicBaseUrl()}/#/cac-form/{projectId}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${getPublicBaseUrl()}/#/cac-form/${projectId}`);
                  toast.success("Link copiado!");
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
            </div>

            {/* Respostas do formulário */}
            {cacForms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum formulário CAC preenchido. Envie o link acima para o cliente.
              </p>
            ) : (
              <div className="space-y-6">
                {cacForms.map((cac) => {
                  const formatCurr = (val: number | null) => 
                    val ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val) : "R$ 0,00";
                  
                  // Calculate totals
                  const totalInvestment = 
                    (cac.facebook_ads_investment || 0) + 
                    (cac.google_ads_investment || 0) + 
                    (cac.linkedin_ads_investment || 0);
                  const totalInvestment3Months = totalInvestment * 3;
                  const totalSalesQty = cac.sales_quantity_3_months || 0;
                  const totalSalesValue = cac.sales_value_3_months || 0;
                  
                  // Core metrics
                  const cac_value = totalSalesQty > 0 ? totalInvestment3Months / totalSalesQty : null;
                  const ticketMedio = totalSalesQty > 0 && totalSalesValue > 0 ? totalSalesValue / totalSalesQty : null;
                  
                  // ROI = (Faturamento - Investimento) / Investimento * 100
                  const lucroLiquido = totalSalesValue - totalInvestment3Months;
                  const roi = totalInvestment3Months > 0 ? (lucroLiquido / totalInvestment3Months) * 100 : null;
                  
                  // Money Machine: for each R$1 invested, how much returns
                  const moneyMultiplier = totalInvestment3Months > 0 ? totalSalesValue / totalInvestment3Months : null;

                  return (
                    <div key={cac.id} className="p-4 rounded-lg border space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Levantamento CAC</p>
                          <p className="text-xs text-muted-foreground">
                            Enviado em {format(new Date(cac.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>

                      {/* Custo por Venda */}
                      <div className="p-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-green-500/10 to-emerald-500/10 border border-amber-500/20">
                        <p className="text-sm font-semibold text-center mb-4">💰 Economia do Tráfego</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Custo por venda */}
                          <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-card/50 border">
                            <p className="text-sm text-muted-foreground mb-2">Para cada venda de</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurr(ticketMedio)}</p>
                            <p className="text-sm text-muted-foreground my-2">você gasta</p>
                            <p className="text-2xl font-bold text-orange-600">{formatCurr(cac_value)}</p>
                          </div>

                          {/* Projeção 3x */}
                          <div className="text-center p-4 rounded-lg bg-white/50 dark:bg-card/50 border">
                            <p className="text-sm text-muted-foreground mb-2">Se quiser vender 3x mais</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurr(totalSalesValue * 3)}</p>
                            <p className="text-sm text-muted-foreground my-2">precisa investir</p>
                            <p className="text-2xl font-bold text-orange-600">{formatCurr(totalInvestment3Months * 3)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Métricas Principais */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Calculator className="h-4 w-4 text-primary" />
                            <label className="text-sm font-medium text-primary">CAC</label>
                          </div>
                          <p className="text-2xl font-bold text-primary">
                            {cac_value ? formatCurr(cac_value) : "-"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Custo por cliente
                          </p>
                        </div>
                        
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <label className="text-sm font-medium text-green-600">Ticket Médio</label>
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            {ticketMedio ? formatCurr(ticketMedio) : "-"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Valor por venda
                          </p>
                        </div>

                        <div className={`p-4 rounded-lg ${roi && roi > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4" />
                            <label className={`text-sm font-medium ${roi && roi > 0 ? 'text-emerald-600' : 'text-red-600'}`}>ROI do Tráfego</label>
                          </div>
                          <p className={`text-2xl font-bold ${roi && roi > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {roi ? `${roi.toFixed(0)}%` : "-"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Retorno sobre investimento
                          </p>
                        </div>

                        <div className={`p-4 rounded-lg ${lucroLiquido > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4" />
                            <label className={`text-sm font-medium ${lucroLiquido > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Lucro Líquido</label>
                          </div>
                          <p className={`text-2xl font-bold ${lucroLiquido > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurr(lucroLiquido)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Faturamento - Investimento
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Detalhes do Investimento */}
                      <div>
                        <p className="text-sm font-medium mb-3">Investimento Mensal por Canal</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                            <label className="text-muted-foreground text-xs">Facebook ADS</label>
                            <p className="font-medium">{formatCurr(cac.facebook_ads_investment)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                            <label className="text-muted-foreground text-xs">Google ADS</label>
                            <p className="font-medium">{formatCurr(cac.google_ads_investment)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20">
                            <label className="text-muted-foreground text-xs">LinkedIn ADS</label>
                            <p className="font-medium">{formatCurr(cac.linkedin_ads_investment)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                            <label className="text-muted-foreground text-xs">Total/mês</label>
                            <p className="font-semibold text-primary">{formatCurr(totalInvestment)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notas Internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderField("Notas", company.notes, "notes", "textarea")}
        </CardContent>
      </Card>
    </div>
  );
};
