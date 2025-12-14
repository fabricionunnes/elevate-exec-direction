import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowRight, 
  ArrowLeft,
  CheckCircle, 
  Loader2,
  Building2,
  User,
  Phone,
  Mail,
  Target,
  TrendingUp,
  Users,
  Sparkles,
  Layers,
  RefreshCw,
  MapPin,
  Crown,
  Users2,
  Megaphone,
  MessageSquare,
  Star,
  Brain
} from "lucide-react";
import { toast } from "sonner";
import logoUnv from "@/assets/logo-unv.png";
import { cn } from "@/lib/utils";

interface FormData {
  companyName: string;
  contactName: string;
  whatsapp: string;
  email: string;
  revenue: string;
  teamSize: string;
  hasSalesProcess: boolean;
  pains: string[];
  biggestChallenge: string;
  urgency: string;
  goals: string;
  hasTraffic: string;
  trafficSatisfied: string;
  hasSocialMedia: string;
  socialSatisfied: string;
}

const revenueOptions = [
  { value: "menos-50k", label: "Menos de R$ 50k/mês" },
  { value: "50k-100k", label: "R$ 50k a R$ 100k/mês" },
  { value: "100k-200k", label: "R$ 100k a R$ 200k/mês" },
  { value: "200k-500k", label: "R$ 200k a R$ 500k/mês" },
  { value: "500k-1m", label: "R$ 500k a R$ 1M/mês" },
  { value: "acima-1m", label: "Acima de R$ 1M/mês" },
];

const teamOptions = [
  { value: "sozinho", label: "Vendo sozinho" },
  { value: "1-3", label: "1 a 3 vendedores" },
  { value: "4-10", label: "4 a 10 vendedores" },
  { value: "11-20", label: "11 a 20 vendedores" },
  { value: "20+", label: "Mais de 20 vendedores" },
];

const painOptions = [
  { value: "sem-processo", label: "Não tenho processo comercial definido", icon: Layers },
  { value: "inconsistencia", label: "Vendas inconsistentes mês a mês", icon: TrendingUp },
  { value: "time-desalinhado", label: "Time desalinhado ou sem padrão", icon: Users },
  { value: "poucos-leads", label: "Poucos leads qualificados", icon: Target },
  { value: "conversao-baixa", label: "Baixa conversão de propostas", icon: TrendingUp },
  { value: "escala", label: "Dificuldade em escalar vendas", icon: TrendingUp },
  { value: "lideranca-fraca", label: "Líderes não cobram ou desenvolvem", icon: Brain },
  { value: "autoridade", label: "Falta de autoridade no mercado", icon: Star },
];

const urgencyOptions = [
  { value: "imediata", label: "Preciso resolver isso agora", color: "text-destructive" },
  { value: "alta", label: "Nos próximos 30 dias", color: "text-orange-500" },
  { value: "normal", label: "Nos próximos 90 dias", color: "text-foreground" },
  { value: "exploratoria", label: "Estou apenas explorando", color: "text-muted-foreground" },
];

interface ProductRecommendation {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  price: string;
  priceType: string;
  description: string;
  deliverables: string[];
  bestFor: string;
  whyRecommended: string;
}

const products: Record<string, ProductRecommendation> = {
  core: {
    id: "core",
    name: "UNV Core",
    tagline: "Fundação Comercial Inicial",
    icon: Layers,
    color: "bg-blue-500",
    price: "R$ 1.997",
    priceType: "único",
    description: "Produto de entrada para empresas que precisam estruturar sua base comercial do zero.",
    deliverables: [
      "Diagnóstico comercial direcional",
      "Estruturação básica de funil de vendas",
      "Scripts essenciais de abordagem",
      "Definição de metas básicas",
      "UNV AI Advisor nível básico",
      "Cobrança básica de execução"
    ],
    bestFor: "Empresas com faturamento até R$ 150k/mês que estão começando a organizar vendas",
    whyRecommended: "Você está no momento de estruturar a base. O Core vai te dar a fundação necessária para crescer com método."
  },
  control: {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    icon: RefreshCw,
    color: "bg-emerald-500",
    price: "R$ 5.997",
    priceType: "/ano",
    description: "Acompanhamento mensal recorrente para manter a disciplina comercial ativa.",
    deliverables: [
      "Direção estratégica mensal",
      "Acompanhamento via AI semanal",
      "Templates e scripts prontos",
      "Cobrança de execução contínua",
      "Acesso à comunidade UNV",
      "UNV AI Advisor nível execução"
    ],
    bestFor: "Empresas de R$ 100k a R$ 400k/mês que já vendem mas perdem ritmo sem cobrança externa",
    whyRecommended: "Você já tem vendas acontecendo, mas precisa de constância. O Control mantém a disciplina mês a mês."
  },
  "sales-acceleration": {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Aceleração Comercial Completa",
    icon: TrendingUp,
    color: "bg-accent",
    price: "R$ 24.000",
    priceType: "/ano",
    description: "Programa completo de 12 meses com direção, treinamento e cobrança integrados.",
    deliverables: [
      "Diagnóstico comercial completo",
      "Direção estratégica mensal + semanal",
      "Treinamento do time em 5 fases",
      "Estruturação completa de funil",
      "Scripts por fase do funil",
      "Metas e KPIs completos",
      "Avaliações por vendedor",
      "UNV AI Advisor nível máximo",
      "1 convite/ano Experiência Mansão"
    ],
    bestFor: "Empresas de R$ 150k a R$ 1M/mês com time comercial querendo acelerar resultados",
    whyRecommended: "Você tem time e está pronto para acelerar. O Sales Acceleration entrega direção + treinamento + cobrança em um só programa."
  },
  "growth-room": {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Imersão Presencial Estratégica",
    icon: MapPin,
    color: "bg-orange-500",
    price: "R$ 12.000",
    priceType: "por empresa",
    description: "Imersão presencial de 3 dias para clareza estratégica e plano de 90 dias.",
    deliverables: [
      "3 dias de imersão presencial",
      "Diagnóstico pré-imersão",
      "Direção estratégica intensiva",
      "Estruturação completa de funil",
      "Scripts e roteiros",
      "Plano de 90 dias",
      "Acompanhamento pós-imersão",
      "Treinamento intensivo"
    ],
    bestFor: "CEOs/donos de empresas R$ 150k a R$ 600k/mês que precisam parar e repensar a direção",
    whyRecommended: "Você precisa de clareza e direção. A Growth Room te tira do operacional para pensar estrategicamente."
  },
  partners: {
    id: "partners",
    name: "UNV Partners",
    tagline: "Direção Estratégica & Board Externo",
    icon: Crown,
    color: "bg-amber-500",
    price: "R$ 4.000",
    priceType: "/mês (12 meses)",
    description: "Fabrício como seu diretor comercial de fato, não como consultor.",
    deliverables: [
      "Board mensal de direção",
      "Acompanhamento semanal",
      "Cobrança de execução direta",
      "Direção individual recorrente",
      "Comunidade elite",
      "UNV AI Advisor estratégico",
      "Eventos exclusivos",
      "Experiência Mansão recorrente",
      "Benchmark com pares"
    ],
    bestFor: "Empresários de R$ 300k a R$ 2M/mês buscando parceria estratégica de decisão",
    whyRecommended: "Você já cresceu e precisa de um parceiro de decisão, não apenas orientação. O Partners te dá isso."
  },
  "sales-ops": {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Padronização & Treinamento de Times",
    icon: Users2,
    color: "bg-violet-500",
    price: "R$ 197",
    priceType: "/usuário/mês",
    description: "Trilhas por cargo, onboarding e padronização de discurso para times comerciais.",
    deliverables: [
      "Trilhas por cargo (SDR, Closer, Gestor)",
      "Avaliações e scorecards",
      "Scripts por cargo",
      "Metas e KPIs por cargo",
      "Cobrança via trilhas",
      "UNV AI Advisor por cargo"
    ],
    bestFor: "Empresas R$ 200k+/mês com 5+ vendedores que perdem padrão quando alguém sai",
    whyRecommended: "Você tem time grande e precisa de padrão. O Sales Ops garante que todos sigam o mesmo método."
  },
  ads: {
    id: "ads",
    name: "UNV Ads",
    tagline: "Tráfego & Geração de Demanda",
    icon: Megaphone,
    color: "bg-green-500",
    price: "R$ 1.500 a R$ 4.000",
    priceType: "/mês + mídia",
    description: "Campanhas de tráfego pago integradas com vendas para gerar demanda qualificada.",
    deliverables: [
      "Gestão completa de tráfego",
      "Diagnóstico de demanda",
      "Estruturação de funil de aquisição",
      "Copies otimizadas",
      "Métricas CPL/CAC",
      "Otimização semanal",
      "Integração marketing/vendas",
      "Geração de leads qualificados"
    ],
    bestFor: "Empresas R$ 100k a R$ 1M+/mês com time comercial ativo precisando de mais leads",
    whyRecommended: "Você precisa de mais demanda qualificada. O Ads gera os leads, seu time converte."
  },
  social: {
    id: "social",
    name: "UNV Social",
    tagline: "Social Media como Canal de Vendas",
    icon: MessageSquare,
    color: "bg-pink-500",
    price: "R$ 1.500 a R$ 3.500",
    priceType: "/mês",
    description: "Conteúdo estratégico para pré-venda, aquecimento e construção de autoridade.",
    deliverables: [
      "Estratégia de conteúdo completa",
      "Diagnóstico de posicionamento",
      "Conteúdo de pré-venda",
      "Construção de autoridade",
      "Integração marketing/vendas",
      "UNV AI Advisor Social"
    ],
    bestFor: "Empresas R$ 80k a R$ 1M+/mês onde a venda depende de confiança e autoridade do dono",
    whyRecommended: "Você precisa de autoridade no mercado. O Social constrói isso através de conteúdo estratégico."
  },
  leadership: {
    id: "leadership",
    name: "UNV Leadership",
    tagline: "Formação de Liderança",
    icon: Brain,
    color: "bg-cyan-500",
    price: "R$ 1.500",
    priceType: "/mês por líder ou R$ 15k/ano",
    description: "Programa de formação de líderes que sustentam pessoas, performance e crescimento.",
    deliverables: [
      "Diagnóstico de liderança",
      "PDI individual",
      "Formação em 4 dimensões",
      "Gestão de pessoas e performance",
      "Roteiros de feedback",
      "Rituais de cultura",
      "Avaliação contínua",
      "UNV AI Advisor Leadership",
      "Encontros híbridos"
    ],
    bestFor: "Empresas R$ 100k a R$ 2M+/mês com líderes intermediários que não cobram ou desenvolvem",
    whyRecommended: "Seu gargalo são os líderes. O Leadership forma gestores que sustentam crescimento sem depender de você."
  },
  mastermind: {
    id: "mastermind",
    name: "UNV Mastermind",
    tagline: "Inner Circle de Líderes",
    icon: Star,
    color: "bg-amber-500",
    price: "R$ 36.000",
    priceType: "/ano",
    description: "Grupo ultra seletivo com hot seats mensais e Mansão Empresarial.",
    deliverables: [
      "Sessões de hot seat mensais",
      "Mansão Empresarial mensal",
      "Board coletivo de decisão",
      "Direção individual 2x/ano",
      "Comunidade ultra seletiva",
      "UNV AI Advisor Mastermind"
    ],
    bestFor: "Empresários R$ 300k a R$ 3M/mês que já cresceram e querem decidir melhor com pares à altura",
    whyRecommended: "Você já passou da fase de execução. Agora precisa de um conselho de decisão com pares do seu nível."
  }
};

function getRecommendations(data: FormData): ProductRecommendation[] {
  const revenue = data.revenue;
  const pains = data.pains;
  const teamSize = data.teamSize;
  const recommendations: ProductRecommendation[] = [];
  const addedProducts = new Set<string>();

  const addProduct = (productId: string) => {
    if (!addedProducts.has(productId) && products[productId]) {
      addedProducts.add(productId);
      recommendations.push(products[productId]);
    }
  };

  // Social Media - não tem ou não está satisfeito
  if (data.hasSocialMedia === "nao" || data.socialSatisfied === "nao") {
    addProduct("social");
  }

  // Tráfego Pago - não tem ou não está satisfeito
  if (data.hasTraffic === "nao" || data.trafficSatisfied === "nao") {
    addProduct("ads");
  }

  // Leadership - liderança fraca
  if (pains.includes("lideranca-fraca")) {
    addProduct("leadership");
  }

  // Autoridade - falta de autoridade
  if (pains.includes("autoridade")) {
    addProduct("social");
  }

  // Poucos leads
  if (pains.includes("poucos-leads")) {
    addProduct("ads");
  }

  // Empresas grandes com time desalinhado
  if (pains.includes("time-desalinhado") && (teamSize === "11-20" || teamSize === "20+")) {
    addProduct("sales-ops");
  }

  // Alto faturamento
  if (revenue === "acima-1m" || revenue === "500k-1m") {
    if (pains.includes("escala") || teamSize === "20+") {
      addProduct("partners");
    }
    if (teamSize === "4-10" || teamSize === "11-20") {
      addProduct("sales-acceleration");
    }
    if (recommendations.length === 0 || (revenue === "acima-1m" && teamSize !== "sozinho")) {
      addProduct("mastermind");
    }
  }

  // Médio faturamento
  if (revenue === "200k-500k") {
    if (!data.hasSalesProcess || pains.includes("sem-processo")) {
      addProduct("growth-room");
    }
    if (teamSize === "4-10" || teamSize === "11-20") {
      addProduct("sales-acceleration");
    }
    if (pains.includes("inconsistencia")) {
      addProduct("control");
    }
  }

  // Faturamento intermediário
  if (revenue === "100k-200k") {
    if (pains.includes("inconsistencia")) {
      addProduct("control");
    }
    if (teamSize !== "sozinho" && teamSize !== "1-3") {
      addProduct("sales-acceleration");
    }
    if (pains.includes("sem-processo")) {
      addProduct("core");
    }
  }

  // Baixo faturamento
  if (revenue === "menos-50k" || revenue === "50k-100k") {
    addProduct("core");
  }

  // Se não tem nenhuma recomendação, adicionar Core como padrão
  if (recommendations.length === 0) {
    addProduct("core");
  }

  return recommendations;
}

export default function ClientDiagnosticPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    contactName: "",
    whatsapp: "",
    email: "",
    revenue: "",
    teamSize: "",
    hasSalesProcess: false,
    pains: [],
    biggestChallenge: "",
    urgency: "normal",
    goals: "",
    hasTraffic: "",
    trafficSatisfied: "",
    hasSocialMedia: "",
    socialSatisfied: ""
  });

  const totalSteps = 5;

  const updateField = (field: keyof FormData, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const togglePain = (painValue: string) => {
    setFormData(prev => ({
      ...prev,
      pains: prev.pains.includes(painValue)
        ? prev.pains.filter(p => p !== painValue)
        : [...prev.pains, painValue]
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.companyName && formData.contactName && formData.whatsapp;
      case 2:
        return formData.revenue && formData.teamSize;
      case 3:
        return formData.pains.length > 0;
      case 4:
        return formData.hasTraffic && formData.hasSocialMedia;
      case 5:
        return formData.urgency;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const recs = getRecommendations(formData);
      const productNames = recs.map(r => r.name).join(", ");
      
      const { error } = await supabase.from("client_diagnostics").insert({
        company_name: formData.companyName,
        contact_name: formData.contactName,
        whatsapp: formData.whatsapp,
        email: formData.email || null,
        revenue: formData.revenue,
        team_size: formData.teamSize,
        has_sales_process: formData.hasSalesProcess,
        main_pain: formData.pains.join(", "),
        biggest_challenge: formData.biggestChallenge || null,
        urgency: formData.urgency,
        recommended_product: productNames,
        notes: `Tráfego: ${formData.hasTraffic === "sim" ? (formData.trafficSatisfied === "sim" ? "Sim, satisfeito" : "Sim, insatisfeito") : "Não"}. Social: ${formData.hasSocialMedia === "sim" ? (formData.socialSatisfied === "sim" ? "Sim, satisfeito" : "Sim, insatisfeito") : "Não"}. ${formData.goals ? "Objetivos: " + formData.goals : ""}`,
        status: "pending"
      });

      if (error) throw error;

      setRecommendations(recs);
      setCompleted(true);
    } catch (error) {
      console.error("Erro ao enviar:", error);
      toast.error("Erro ao enviar diagnóstico. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (completed && recommendations.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header simples */}
        <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-center">
            <img 
              src={logoUnv} 
              alt="UNV" 
              className="h-10 brightness-0 invert" 
            />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12 animate-fade-up">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Diagnóstico Concluído!
            </h1>
            <p className="text-xl text-muted-foreground">
              {formData.contactName}, analisamos suas respostas e identificamos {recommendations.length === 1 ? "o produto ideal" : "os produtos ideais"} para você.
            </p>
          </div>

          {/* Recommendations */}
          <div className="space-y-6">
            {recommendations.map((rec, index) => {
              const Icon = rec.icon;
              return (
                <div 
                  key={rec.id} 
                  className={cn(
                    "bg-card border-2 rounded-2xl p-6 md:p-8 animate-fade-up",
                    index === 0 ? "border-accent" : "border-border"
                  )} 
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    {index === 0 && (
                      <span className="absolute -top-3 left-4 px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full">
                        PRINCIPAL
                      </span>
                    )}
                    <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", rec.color)}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-foreground">{rec.name}</h2>
                      <p className="text-muted-foreground">{rec.tagline}</p>
                    </div>
                  </div>

                  <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6">
                    <p className="text-foreground">
                      <span className="font-semibold">Por que este produto?</span>
                      <br />
                      <span className="text-muted-foreground text-sm">{rec.whyRecommended}</span>
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">O que você recebe:</h3>
                      <ul className="space-y-2">
                        {rec.deliverables.slice(0, 5).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                        {rec.deliverables.length > 5 && (
                          <li className="text-sm text-accent">+{rec.deliverables.length - 5} mais...</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">Ideal para:</h3>
                      <p className="text-sm text-muted-foreground">{rec.bestFor}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Steps */}
          <div className="bg-card border border-border rounded-2xl p-8 text-center mt-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Sparkles className="h-10 w-10 text-accent mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-3">Próximos Passos</h3>
            <p className="text-muted-foreground mb-6">
              Em breve nossa equipe entrará em contato pelo WhatsApp para agendar sua reunião de diagnóstico aprofundado.
              Nessa conversa, vamos entender melhor seu cenário e definir juntos o melhor caminho.
            </p>
            <p className="text-sm text-muted-foreground">
              Obrigado por confiar na UNV. Até breve!
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header simples */}
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-center">
          <img 
            src={logoUnv} 
            alt="UNV" 
            className="h-10 brightness-0 invert" 
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Passo {step} de {totalSteps}</span>
            <span className="text-sm text-muted-foreground">{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          {/* Step 1: Contact Info */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Vamos descobrir o produto ideal para você
                </h1>
                <p className="text-muted-foreground">
                  Responda algumas perguntas rápidas para identificarmos a melhor solução.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-accent" />
                    Nome da empresa *
                  </Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    placeholder="Ex: Empresa ABC"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-accent" />
                    Seu nome *
                  </Label>
                  <Input
                    value={formData.contactName}
                    onChange={(e) => updateField("contactName", e.target.value)}
                    placeholder="Como você se chama?"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-accent" />
                    WhatsApp *
                  </Label>
                  <Input
                    value={formData.whatsapp}
                    onChange={(e) => updateField("whatsapp", e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-accent" />
                    E-mail (opcional)
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Company Profile */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Sobre sua empresa
                </h2>
                <p className="text-muted-foreground">
                  Isso nos ajuda a entender seu momento atual.
                </p>
              </div>

              <div>
                <Label className="mb-3 block">Faturamento mensal *</Label>
                <RadioGroup
                  value={formData.revenue}
                  onValueChange={(v) => updateField("revenue", v)}
                  className="grid gap-3"
                >
                  {revenueOptions.map((option) => (
                    <div key={option.value} className="flex items-center">
                      <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                      <Label
                        htmlFor={option.value}
                        className={cn(
                          "flex-1 p-4 rounded-lg border cursor-pointer transition-all",
                          formData.revenue === option.value
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                        )}
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-3 block">Tamanho do time comercial *</Label>
                <RadioGroup
                  value={formData.teamSize}
                  onValueChange={(v) => updateField("teamSize", v)}
                  className="grid gap-3"
                >
                  {teamOptions.map((option) => (
                    <div key={option.value} className="flex items-center">
                      <RadioGroupItem value={option.value} id={`team-${option.value}`} className="sr-only" />
                      <Label
                        htmlFor={`team-${option.value}`}
                        className={cn(
                          "flex-1 p-4 rounded-lg border cursor-pointer transition-all",
                          formData.teamSize === option.value
                            ? "border-accent bg-accent/10"
                            : "border-border hover:border-accent/50"
                        )}
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
                <Checkbox
                  id="hasSalesProcess"
                  checked={formData.hasSalesProcess}
                  onCheckedChange={(checked) => updateField("hasSalesProcess", !!checked)}
                />
                <Label htmlFor="hasSalesProcess" className="cursor-pointer">
                  Já tenho um processo comercial estruturado
                </Label>
              </div>
            </div>
          )}

          {/* Step 3: Pain Points (Multiple Selection) */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Quais são suas maiores dores hoje?
                </h2>
                <p className="text-muted-foreground">
                  Selecione todas que se aplicam ao seu negócio.
                </p>
              </div>

              <div className="grid gap-3">
                {painOptions.map((option) => {
                  const PainIcon = option.icon;
                  const isSelected = formData.pains.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      onClick={() => togglePain(option.value)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePain(option.value)}
                        className="pointer-events-none"
                      />
                      <PainIcon className={cn(
                        "h-5 w-5 shrink-0",
                        isSelected ? "text-accent" : "text-muted-foreground"
                      )} />
                      <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>
                        {option.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div>
                <Label className="mb-2 block">Descreva brevemente seu maior desafio (opcional)</Label>
                <Textarea
                  value={formData.biggestChallenge}
                  onChange={(e) => updateField("biggestChallenge", e.target.value)}
                  placeholder="O que você gostaria de resolver nos próximos 90 dias?"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 4: Traffic & Social Media */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Sobre marketing e aquisição
                </h2>
                <p className="text-muted-foreground">
                  Nos ajude a entender sua situação atual.
                </p>
              </div>

              {/* Tráfego Pago */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-accent" />
                  Você investe em tráfego pago? *
                </Label>
                <RadioGroup
                  value={formData.hasTraffic}
                  onValueChange={(v) => updateField("hasTraffic", v)}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center">
                    <RadioGroupItem value="sim" id="traffic-sim" className="sr-only" />
                    <Label
                      htmlFor="traffic-sim"
                      className={cn(
                        "flex-1 p-4 rounded-lg border cursor-pointer transition-all text-center",
                        formData.hasTraffic === "sim"
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      Sim
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="nao" id="traffic-nao" className="sr-only" />
                    <Label
                      htmlFor="traffic-nao"
                      className={cn(
                        "flex-1 p-4 rounded-lg border cursor-pointer transition-all text-center",
                        formData.hasTraffic === "nao"
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      Não
                    </Label>
                  </div>
                </RadioGroup>
                
                {formData.hasTraffic === "sim" && (
                  <div className="pl-4 border-l-2 border-accent/30 mt-3">
                    <Label className="mb-2 block text-sm">Está satisfeito com os resultados?</Label>
                    <RadioGroup
                      value={formData.trafficSatisfied}
                      onValueChange={(v) => updateField("trafficSatisfied", v)}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="flex items-center">
                        <RadioGroupItem value="sim" id="traffic-sat-sim" className="sr-only" />
                        <Label
                          htmlFor="traffic-sat-sim"
                          className={cn(
                            "flex-1 p-3 rounded-lg border cursor-pointer transition-all text-center text-sm",
                            formData.trafficSatisfied === "sim"
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          Sim, satisfeito
                        </Label>
                      </div>
                      <div className="flex items-center">
                        <RadioGroupItem value="nao" id="traffic-sat-nao" className="sr-only" />
                        <Label
                          htmlFor="traffic-sat-nao"
                          className={cn(
                            "flex-1 p-3 rounded-lg border cursor-pointer transition-all text-center text-sm",
                            formData.trafficSatisfied === "nao"
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          Não, quero melhorar
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>

              {/* Social Media */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  Você tem presença ativa em redes sociais? *
                </Label>
                <RadioGroup
                  value={formData.hasSocialMedia}
                  onValueChange={(v) => updateField("hasSocialMedia", v)}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center">
                    <RadioGroupItem value="sim" id="social-sim" className="sr-only" />
                    <Label
                      htmlFor="social-sim"
                      className={cn(
                        "flex-1 p-4 rounded-lg border cursor-pointer transition-all text-center",
                        formData.hasSocialMedia === "sim"
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      Sim
                    </Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="nao" id="social-nao" className="sr-only" />
                    <Label
                      htmlFor="social-nao"
                      className={cn(
                        "flex-1 p-4 rounded-lg border cursor-pointer transition-all text-center",
                        formData.hasSocialMedia === "nao"
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      Não
                    </Label>
                  </div>
                </RadioGroup>
                
                {formData.hasSocialMedia === "sim" && (
                  <div className="pl-4 border-l-2 border-accent/30 mt-3">
                    <Label className="mb-2 block text-sm">Está satisfeito com os resultados?</Label>
                    <RadioGroup
                      value={formData.socialSatisfied}
                      onValueChange={(v) => updateField("socialSatisfied", v)}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="flex items-center">
                        <RadioGroupItem value="sim" id="social-sat-sim" className="sr-only" />
                        <Label
                          htmlFor="social-sat-sim"
                          className={cn(
                            "flex-1 p-3 rounded-lg border cursor-pointer transition-all text-center text-sm",
                            formData.socialSatisfied === "sim"
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          Sim, satisfeito
                        </Label>
                      </div>
                      <div className="flex items-center">
                        <RadioGroupItem value="nao" id="social-sat-nao" className="sr-only" />
                        <Label
                          htmlFor="social-sat-nao"
                          className={cn(
                            "flex-1 p-3 rounded-lg border cursor-pointer transition-all text-center text-sm",
                            formData.socialSatisfied === "nao"
                              ? "border-accent bg-accent/10"
                              : "border-border hover:border-accent/50"
                          )}
                        >
                          Não, quero melhorar
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Urgency & Goals */}
          {step === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Qual sua urgência?
                </h2>
                <p className="text-muted-foreground">
                  Quando você precisa resolver isso?
                </p>
              </div>

              <RadioGroup
                value={formData.urgency}
                onValueChange={(v) => updateField("urgency", v)}
                className="grid gap-3"
              >
                {urgencyOptions.map((option) => (
                  <div key={option.value} className="flex items-center">
                    <RadioGroupItem value={option.value} id={`urgency-${option.value}`} className="sr-only" />
                    <Label
                      htmlFor={`urgency-${option.value}`}
                      className={cn(
                        "flex-1 p-4 rounded-lg border cursor-pointer transition-all",
                        formData.urgency === option.value
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-accent/50"
                      )}
                    >
                      <span className={option.color}>{option.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div>
                <Label className="mb-2 block">O que você espera alcançar nos próximos 90 dias? (opcional)</Label>
                <Textarea
                  value={formData.goals}
                  onChange={(e) => updateField("goals", e.target.value)}
                  placeholder="Ex: Aumentar vendas em 30%, estruturar processo, treinar time..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
              >
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || !canProceed()}
                className="bg-accent hover:bg-accent/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    Ver Meu Diagnóstico
                    <Sparkles className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}