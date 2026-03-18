import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, DollarSign, ArrowRight, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface FormSection {
  title: string;
  description: string;
  fields: { key: string; label: string; type: "text" | "textarea" | "currency"; placeholder?: string; required: boolean }[];
}

const formatCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SECTIONS: FormSection[] = [
  {
    title: "💰 Receita e Faturamento",
    description: "Informações sobre as receitas da empresa",
    fields: [
      { key: "monthly_revenue", label: "Qual o faturamento médio mensal da empresa?", type: "currency", placeholder: "R$ 0,00", required: true },
      { key: "revenue_sources", label: "Quais são as principais fontes de receita?", type: "textarea", placeholder: "Ex: Vendas de produtos, prestação de serviços, assinaturas...", required: true },
      { key: "average_ticket", label: "Qual o ticket médio por venda/cliente?", type: "currency", placeholder: "R$ 0,00", required: true },
      { key: "payment_methods", label: "Quais meios de pagamento são aceitos?", type: "textarea", placeholder: "Ex: PIX, cartão de crédito/débito, boleto, dinheiro...", required: true },
      { key: "default_rate", label: "Qual a taxa de inadimplência atual?", type: "text", placeholder: "Ex: 5%, 10%, não sei...", required: true },
    ],
  },
  {
    title: "📉 Custos e Despesas",
    description: "Estrutura de custos da empresa",
    fields: [
      { key: "fixed_costs", label: "Quais são os principais custos fixos mensais?", type: "textarea", placeholder: "Ex: Aluguel R$ 3.000, Internet R$ 200, Software R$ 500...", required: true },
      { key: "variable_costs", label: "Quais são os principais custos variáveis?", type: "textarea", placeholder: "Ex: Matéria-prima, comissões, frete...", required: true },
      { key: "payroll_cost", label: "Qual o custo total mensal com folha de pagamento?", type: "currency", placeholder: "R$ 0,00", required: true },
      { key: "biggest_expense", label: "Qual a maior despesa da empresa atualmente?", type: "textarea", placeholder: "Descreva a maior despesa e se considera que pode ser otimizada", required: true },
      { key: "cost_reduction_attempts", label: "Já tentou reduzir custos? O que fez?", type: "textarea", placeholder: "Descreva tentativas anteriores de redução de custos", required: false },
    ],
  },
  {
    title: "📊 Fluxo de Caixa",
    description: "Gestão do dinheiro no dia a dia",
    fields: [
      { key: "cash_flow_control", label: "Como você controla o fluxo de caixa?", type: "textarea", placeholder: "Ex: Planilha, sistema ERP, caderno, não controlo...", required: true },
      { key: "cash_flow_tool", label: "Utiliza alguma ferramenta de gestão financeira?", type: "text", placeholder: "Ex: Bling, Nibo, ContaAzul, planilha Excel...", required: true },
      { key: "cash_reserve_months", label: "Quantos meses de reserva financeira a empresa possui?", type: "text", placeholder: "Ex: 3 meses, 6 meses, não possui reserva...", required: true },
      { key: "seasonal_variation", label: "Existe variação sazonal no faturamento? Quais meses são mais fortes/fracos?", type: "textarea", placeholder: "Descreva os períodos de alta e baixa", required: true },
    ],
  },
  {
    title: "📋 Planejamento Financeiro",
    description: "Metas e estratégias financeiras",
    fields: [
      { key: "has_budget", label: "A empresa possui orçamento anual/mensal definido?", type: "textarea", placeholder: "Descreva como é feito o planejamento orçamentário", required: true },
      { key: "profit_margin", label: "Qual a margem de lucro líquido atual (estimada)?", type: "text", placeholder: "Ex: 10%, 20%, não sei...", required: true },
      { key: "pricing_strategy", label: "Como é definido o preço dos produtos/serviços?", type: "textarea", placeholder: "Ex: Baseado em custos + margem, pelo mercado, pelo valor percebido...", required: true },
      { key: "financial_goals", label: "Quais são as metas financeiras para os próximos 12 meses?", type: "textarea", placeholder: "Ex: Aumentar faturamento em 30%, reduzir custos em 15%...", required: true },
    ],
  },
  {
    title: "🏛️ Tributação e Contabilidade",
    description: "Aspectos fiscais e contábeis",
    fields: [
      { key: "tax_regime", label: "Qual o regime tributário da empresa?", type: "text", placeholder: "Ex: Simples Nacional, Lucro Presumido, Lucro Real, MEI...", required: true },
      { key: "accountant_relationship", label: "Como é sua relação com o contador? Recebe orientação estratégica?", type: "textarea", placeholder: "Descreva como funciona o suporte contábil atual", required: true },
      { key: "tax_planning", label: "Já realizou algum planejamento tributário?", type: "textarea", placeholder: "Descreva se já buscou otimizar a carga tributária", required: false },
    ],
  },
  {
    title: "🚀 Desafios e Expectativas",
    description: "O que você espera alcançar com a consultoria financeira",
    fields: [
      { key: "financial_biggest_challenge", label: "Qual o maior desafio financeiro da empresa atualmente?", type: "textarea", placeholder: "Ex: Falta de capital de giro, inadimplência alta, custos descontrolados...", required: true },
      { key: "previous_consultant", label: "Já trabalhou com algum consultor financeiro antes? Como foi?", type: "textarea", placeholder: "Descreva a experiência anterior", required: false },
      { key: "expected_financial_results", label: "Quais resultados espera com a consultoria financeira?", type: "textarea", placeholder: "Ex: Organizar fluxo de caixa, aumentar margem de lucro, reduzir inadimplência...", required: true },
      { key: "financial_additional_info", label: "Alguma informação adicional relevante?", type: "textarea", placeholder: "Fique à vontade para compartilhar qualquer detalhe importante", required: false },
    ],
  },
];

export default function FinancialConsultationPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_consultation_forms")
        .select("*, onboarding_projects!inner(onboarding_company_id)")
        .eq("access_token", token)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (data.submitted_at) {
        setSubmitted(true);
        setLoading(false);
        return;
      }

      setForm(data);

      const companyId = (data as any).onboarding_projects?.onboarding_company_id;
      if (companyId) {
        const { data: company } = await supabase
          .from("onboarding_companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle();
        setCompanyName(company?.name || null);
      }

      const initial: Record<string, string> = {};
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = (data as any)[field.key];
          if (val !== null && val !== undefined) {
            initial[field.key] = field.type === "currency" ? formatCurrency(String(val).replace(/\D/g, "") || "0") : String(val);
          }
        });
      });
      setFormData(initial);
    } catch (error) {
      console.error("Error loading form:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {};
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = formData[field.key];
          if (val !== undefined) {
            updateData[field.key] = val;
          }
        });
      });

      const { error } = await supabase
        .from("financial_consultation_forms")
        .update(updateData)
        .eq("id", form.id);

      if (error) throw error;
      toast.success("Progresso salvo!");
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const currentFields = SECTIONS[currentSection].fields;
    const missing = currentFields.filter((f) => f.required && !formData[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Preencha os campos obrigatórios`);
      return;
    }

    if (currentSection < SECTIONS.length - 1) {
      await saveProgress();
      setCurrentSection(currentSection + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const updateData: Record<string, any> = { submitted_at: new Date().toISOString(), status: "submitted" };
      SECTIONS.forEach((section) => {
        section.fields.forEach((field) => {
          const val = formData[field.key];
          if (val !== undefined) {
            updateData[field.key] = val;
          }
        });
      });

      const { error } = await supabase
        .from("financial_consultation_forms")
        .update(updateData)
        .eq("id", form.id);

      if (error) throw error;
      setSubmitted(true);
      toast.success("Formulário enviado com sucesso!");
    } catch (error) {
      toast.error("Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCurrencyInput = (key: string, rawValue: string) => {
    setFormData((prev) => ({ ...prev, [key]: formatCurrency(rawValue) }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-10">
            <h2 className="text-xl font-bold mb-2">Formulário não encontrado</h2>
            <p className="text-muted-foreground">O link pode estar incorreto ou expirado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
        <Card className="max-w-md w-full text-center shadow-xl border-emerald-200">
          <CardContent className="pt-12 pb-10">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Formulário Enviado!</h2>
            <p className="text-muted-foreground">
              Obrigado por preencher o diagnóstico financeiro. Nossa equipe analisará suas respostas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const section = SECTIONS[currentSection];
  const progress = ((currentSection + 1) / SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl border-emerald-200">
          <CardContent className="pt-8 pb-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-9 w-9 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Diagnóstico Financeiro</h1>
              {companyName && <p className="text-muted-foreground mt-1">{companyName}</p>}
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Etapa {currentSection + 1} de {SECTIONS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Separator className="mb-6" />

            {/* Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-1">{section.title}</h2>
              <p className="text-sm text-muted-foreground mb-4">{section.description}</p>

              <div className="space-y-5">
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {field.type === "currency" ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <Input
                          placeholder={field.placeholder}
                          value={formData[field.key] || ""}
                          onChange={(e) => handleCurrencyInput(field.key, e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    ) : field.type === "textarea" ? (
                      <Textarea
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        rows={3}
                        className="resize-none"
                      />
                    ) : (
                      <Input
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentSection(currentSection - 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={currentSection === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
              <Button variant="outline" onClick={saveProgress} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar rascunho"}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : currentSection === SECTIONS.length - 1 ? (
                  <><Send className="h-4 w-4 mr-2" /> Enviar</>
                ) : (
                  <><ArrowRight className="h-4 w-4 mr-2" /> Próximo</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
