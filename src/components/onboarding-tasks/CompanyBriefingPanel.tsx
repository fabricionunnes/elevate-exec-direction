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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KickoffFormDialog } from "./KickoffFormDialog";
import { formatPhone } from "@/lib/utils";
import { COMPANY_SEGMENTS } from "@/data/companySegments";

const COMPANY_STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "cancellation_requested", label: "Solicitou cancelamento" },
  { value: "closed", label: "Encerrada" },
];

interface CompanyData {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
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
}

interface CACFormData {
  id: string;
  company_name: string;
  form_title: string | null;
  facebook_ads_investment: number | null;
  google_ads_investment: number | null;
  linkedin_ads_investment: number | null;
  sales_quantity_3_months: number | null;
  sales_value_3_months: number | null;
  submitted_at: string;
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
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<CompanyData>>({});
  const [showKickoffForm, setShowKickoffForm] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchCompanyData();
    } else {
      setLoading(false);
    }
    if (projectId) {
      fetchCACForms();
    }
  }, [companyId, projectId]);

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
        const companyData: CompanyData = {
          ...data,
          stakeholders: Array.isArray(data.stakeholders) ? data.stakeholders : null,
          expected_timeline: data.expected_timeline,
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
    <div className="space-y-6">
      {/* Header com botões de ação */}
      {canEdit && (
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowKickoffForm(true)}>
                <ClipboardList className="h-4 w-4 mr-2" />
                Formulário de Kickoff
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Briefing
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderField("Website", company.website, "website")}
            <div>
              <label className="text-sm text-muted-foreground">Telefone</label>
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
                {window.location.origin}/cac-form/{projectId}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/cac-form/${projectId}`);
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
              <div className="space-y-4">
                {cacForms.map((cac) => {
                  const totalAdsInvestment = 
                    (cac.facebook_ads_investment || 0) + 
                    (cac.google_ads_investment || 0) + 
                    (cac.linkedin_ads_investment || 0);
                  const totalAds3Months = totalAdsInvestment * 3;
                  const calculatedCAC = cac.sales_quantity_3_months && cac.sales_quantity_3_months > 0 
                    ? totalAds3Months / cac.sales_quantity_3_months 
                    : null;

                  return (
                    <div key={cac.id} className="p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{cac.form_title || "Levantamento CAC"}</p>
                          <p className="text-xs text-muted-foreground">
                            Enviado em {format(new Date(cac.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {calculatedCAC && (
                          <Badge variant="secondary" className="text-lg">
                            CAC: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(calculatedCAC)}
                          </Badge>
                        )}
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="text-muted-foreground">Facebook ADS/mês</label>
                          <p className="font-medium">
                            {cac.facebook_ads_investment 
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cac.facebook_ads_investment)
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">Google ADS/mês</label>
                          <p className="font-medium">
                            {cac.google_ads_investment 
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cac.google_ads_investment)
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">LinkedIn ADS/mês</label>
                          <p className="font-medium">
                            {cac.linkedin_ads_investment 
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cac.linkedin_ads_investment)
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="text-muted-foreground">Total investido/mês</label>
                          <p className="font-medium">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalAdsInvestment)}
                          </p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">Vendas (últimos 3 meses)</label>
                          <p className="font-medium">{cac.sales_quantity_3_months || "-"} vendas</p>
                        </div>
                        <div>
                          <label className="text-muted-foreground">Faturamento (últimos 3 meses)</label>
                          <p className="font-medium">
                            {cac.sales_value_3_months 
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cac.sales_value_3_months)
                              : "-"}
                          </p>
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
