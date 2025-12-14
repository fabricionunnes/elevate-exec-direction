import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormData {
  company_name: string;
  contact_name: string;
  whatsapp: string;
  email: string;
  revenue: string;
  team_size: string;
  main_pain: string;
  has_sales_process: boolean;
  biggest_challenge: string;
  urgency: string;
}

interface Recommendation {
  product: string;
  reason: string;
}

const revenueOptions = [
  { value: "menos-50k", label: "Menos de R$ 50k/mês" },
  { value: "50k-100k", label: "R$ 50k a R$ 100k/mês" },
  { value: "100k-200k", label: "R$ 100k a R$ 200k/mês" },
  { value: "200k-500k", label: "R$ 200k a R$ 500k/mês" },
  { value: "500k-1m", label: "R$ 500k a R$ 1M/mês" },
  { value: "acima-1m", label: "Acima de R$ 1M/mês" },
];

const teamSizeOptions = [
  { value: "sozinho", label: "Eu vendo sozinho" },
  { value: "1-2", label: "1 a 2 vendedores" },
  { value: "3-5", label: "3 a 5 vendedores" },
  { value: "6-10", label: "6 a 10 vendedores" },
  { value: "10+", label: "Mais de 10 vendedores" },
];

const painOptions = [
  { value: "sem-processo", label: "Não tenho processo de vendas definido" },
  { value: "inconsistencia", label: "Vendas inconsistentes mês a mês" },
  { value: "time-desalinhado", label: "Time comercial desalinhado" },
  { value: "poucos-leads", label: "Poucos leads qualificados" },
  { value: "conversao-baixa", label: "Taxa de conversão baixa" },
  { value: "escala", label: "Dificuldade para escalar" },
  { value: "autoridade", label: "Falta de autoridade no mercado" },
];

const urgencyOptions = [
  { value: "imediata", label: "Urgente — preciso resolver agora" },
  { value: "alta", label: "Alta — nos próximos 30 dias" },
  { value: "normal", label: "Normal — próximos 90 dias" },
  { value: "exploratoria", label: "Estou explorando opções" },
];

function getRecommendation(data: FormData): Recommendation {
  const { revenue, team_size, main_pain, has_sales_process } = data;
  
  // Lógica de recomendação baseada nas respostas
  if (revenue === "menos-50k" || revenue === "50k-100k") {
    return {
      product: "UNV Core",
      reason: "Para o estágio atual da sua empresa, o Core vai ajudar a estruturar sua base comercial com processo, scripts e metas claras."
    };
  }
  
  if (!has_sales_process && (main_pain === "sem-processo" || main_pain === "inconsistencia")) {
    return {
      product: "UNV Core",
      reason: "Como você ainda não tem um processo definido, começar pelo Core vai criar a fundação necessária antes de acelerar."
    };
  }
  
  if (main_pain === "poucos-leads") {
    return {
      product: "UNV Ads",
      reason: "Sua maior dor é geração de demanda. O Ads vai criar um fluxo consistente de leads qualificados para seu time comercial."
    };
  }
  
  if (main_pain === "autoridade") {
    return {
      product: "UNV Social",
      reason: "Construir autoridade no mercado é fundamental para vendas de confiança. O Social vai posicionar você como referência."
    };
  }
  
  if (team_size === "6-10" || team_size === "10+") {
    if (main_pain === "time-desalinhado") {
      return {
        product: "UNV Sales Ops",
        reason: "Com um time desse tamanho, você precisa de trilhas por cargo e padronização. O Sales Ops vai resolver isso."
      };
    }
    return {
      product: "UNV Sales Acceleration",
      reason: "Você tem estrutura para acelerar. O Sales Acceleration vai trazer direção, treinamento e cobrança integrados por 12 meses."
    };
  }
  
  if ((revenue === "200k-500k" || revenue === "500k-1m" || revenue === "acima-1m") && main_pain === "escala") {
    return {
      product: "UNV Partners",
      reason: "No seu nível de faturamento, você precisa de um parceiro estratégico de decisão, não apenas orientação. O Partners oferece isso."
    };
  }
  
  if (revenue === "acima-1m") {
    return {
      product: "UNV Mastermind",
      reason: "Empresários no seu patamar precisam de um conselho de decisão com pares à altura. O Mastermind é o próximo passo."
    };
  }
  
  if (main_pain === "inconsistencia" || main_pain === "conversao-baixa") {
    return {
      product: "UNV Control",
      reason: "Você precisa de disciplina e constância comercial. O Control oferece acompanhamento mensal para manter o ritmo."
    };
  }
  
  // Default
  return {
    product: "UNV Sales Acceleration",
    reason: "Baseado no seu perfil, o Sales Acceleration oferece a combinação ideal de direção, treinamento e cobrança."
  };
}

interface ClientDiagnosticFormProps {
  onClose?: () => void;
}

export function ClientDiagnosticForm({ onClose }: ClientDiagnosticFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    company_name: "",
    contact_name: "",
    whatsapp: "",
    email: "",
    revenue: "",
    team_size: "",
    main_pain: "",
    has_sales_process: false,
    biggest_challenge: "",
    urgency: "normal",
  });

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.company_name && formData.contact_name && formData.whatsapp;
      case 2:
        return formData.revenue && formData.team_size;
      case 3:
        return formData.main_pain && formData.urgency;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;
    
    setIsSubmitting(true);
    
    const rec = getRecommendation(formData);
    setRecommendation(rec);
    
    try {
      const { error } = await supabase
        .from("client_diagnostics")
        .insert({
          company_name: formData.company_name,
          contact_name: formData.contact_name,
          whatsapp: formData.whatsapp,
          email: formData.email || null,
          revenue: formData.revenue,
          team_size: formData.team_size,
          main_pain: formData.main_pain,
          has_sales_process: formData.has_sales_process,
          biggest_challenge: formData.biggest_challenge || null,
          urgency: formData.urgency,
          recommended_product: rec.product,
        });
      
      if (error) throw error;
      
      setSubmitted(true);
      toast.success("Diagnóstico enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar diagnóstico:", error);
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted && recommendation) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-accent" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-4">
          Recomendação: {recommendation.product}
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {recommendation.reason}
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Nossa equipe entrará em contato pelo WhatsApp em breve para explicar os próximos passos.
        </p>
        {onClose && (
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              s === step ? "bg-accent scale-125" : s < step ? "bg-accent/50" : "bg-border"
            )}
          />
        ))}
      </div>

      {/* Step 1: Dados de contato */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-foreground">Seus Dados</h3>
            <p className="text-sm text-muted-foreground">Para que possamos entrar em contato</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="contact_name">Seu Nome *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => updateField("contact_name", e.target.value)}
                placeholder="Como prefere ser chamado"
              />
            </div>
            
            <div>
              <Label htmlFor="company_name">Nome da Empresa *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="Nome da sua empresa"
              />
            </div>
            
            <div>
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => updateField("whatsapp", e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            
            <div>
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Perfil da empresa */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-foreground">Perfil da Empresa</h3>
            <p className="text-sm text-muted-foreground">Para entendermos seu momento</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Faturamento Mensal *</Label>
              <Select value={formData.revenue} onValueChange={(v) => updateField("revenue", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o faturamento" />
                </SelectTrigger>
                <SelectContent>
                  {revenueOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Tamanho do Time Comercial *</Label>
              <Select value={formData.team_size} onValueChange={(v) => updateField("team_size", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tamanho" />
                </SelectTrigger>
                <SelectContent>
                  {teamSizeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary">
              <input
                type="checkbox"
                id="has_process"
                checked={formData.has_sales_process}
                onChange={(e) => updateField("has_sales_process", e.target.checked)}
                className="w-5 h-5 accent-accent"
              />
              <Label htmlFor="has_process" className="cursor-pointer">
                Já tenho um processo de vendas estruturado
              </Label>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Dores e urgência */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-foreground">Suas Necessidades</h3>
            <p className="text-sm text-muted-foreground">Para recomendar o melhor produto</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Principal Dor Hoje *</Label>
              <Select value={formData.main_pain} onValueChange={(v) => updateField("main_pain", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qual sua maior dor?" />
                </SelectTrigger>
                <SelectContent>
                  {painOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Nível de Urgência *</Label>
              <Select value={formData.urgency} onValueChange={(v) => updateField("urgency", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qual a urgência?" />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="biggest_challenge">
                Conte mais sobre seu maior desafio (opcional)
              </Label>
              <Textarea
                id="biggest_challenge"
                value={formData.biggest_challenge}
                onChange={(e) => updateField("biggest_challenge", e.target.value)}
                placeholder="Descreva brevemente o que está te impedindo de crescer..."
                rows={3}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        ) : (
          <div />
        )}
        
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Continuar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                Ver Recomendação
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
