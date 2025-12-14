import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, CheckCircle, Copy, Layers, RefreshCw, TrendingUp, MapPin, Crown, Users2, Megaphone, Heart, ChevronRight, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormData {
  // Dados básicos
  clientName: string;
  company: string;
  role: string;
  segment: string;
  // Perfil comercial
  revenue: string;
  teamSize: string;
  avgTicket: string;
  salesCycle: string;
  leadVolume: string;
  leadSource: string[];
  conversion: string;
  // Dores e desafios
  mainPains: string[];
  biggestChallenge: string;
  whatTriedBefore: string;
  whyDidntWork: string;
  // Estrutura atual
  hasProcess: string;
  processDescription: string;
  hasMetrics: string;
  metricsUsed: string;
  hasCRM: string;
  crmName: string;
  hasTraining: string;
  trainingFrequency: string;
  // Desejos e metas
  mainDesire: string;
  goal90Days: string;
  goal12Months: string;
  idealScenario: string;
  // Urgência e contexto
  urgency: number[];
  budget: string;
  decisionMaker: string;
  timeline: string;
  // Observações
  additionalContext: string;
}

interface ProductRecommendation {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: "primary" | "secondary" | "complementary";
  reasons: string[];
  href: string;
}

interface Trail {
  phase: string;
  product: string;
  duration: string;
  objective: string;
  href: string;
}

interface Recommendation {
  products: ProductRecommendation[];
  trail: Trail[];
  summary: string;
  nextSteps: string[];
}

const revenueOptions = [
  { value: "under-50k", label: "Menos de R$ 50k/mês" },
  { value: "50k-100k", label: "R$ 50k–100k/mês" },
  { value: "100k-200k", label: "R$ 100k–200k/mês" },
  { value: "200k-400k", label: "R$ 200k–400k/mês" },
  { value: "400k-600k", label: "R$ 400k–600k/mês" },
  { value: "600k-1m", label: "R$ 600k–1M/mês" },
  { value: "1m-2m", label: "R$ 1M–2M/mês" },
  { value: "over-2m", label: "Acima de R$ 2M/mês" }
];

const teamSizeOptions = [
  { value: "0", label: "Sem time (só o dono)" },
  { value: "1", label: "1 vendedor" },
  { value: "2-3", label: "2–3 vendedores" },
  { value: "4-5", label: "4–5 vendedores" },
  { value: "6-10", label: "6–10 vendedores" },
  { value: "11-20", label: "11–20 vendedores" },
  { value: "over-20", label: "20+ vendedores" }
];

const ticketOptions = [
  { value: "under-500", label: "Menos de R$ 500" },
  { value: "500-2k", label: "R$ 500–2.000" },
  { value: "2k-5k", label: "R$ 2.000–5.000" },
  { value: "5k-10k", label: "R$ 5.000–10.000" },
  { value: "10k-50k", label: "R$ 10.000–50.000" },
  { value: "over-50k", label: "Acima de R$ 50.000" }
];

const salesCycleOptions = [
  { value: "immediate", label: "Imediato (mesmo dia)" },
  { value: "1-7days", label: "1–7 dias" },
  { value: "1-2weeks", label: "1–2 semanas" },
  { value: "2-4weeks", label: "2–4 semanas" },
  { value: "1-3months", label: "1–3 meses" },
  { value: "over-3months", label: "3+ meses" }
];

const leadVolumeOptions = [
  { value: "under-30", label: "Menos de 30 leads/mês" },
  { value: "30-50", label: "30–50 leads/mês" },
  { value: "50-100", label: "50–100 leads/mês" },
  { value: "100-200", label: "100–200 leads/mês" },
  { value: "200-500", label: "200–500 leads/mês" },
  { value: "over-500", label: "500+ leads/mês" }
];

const leadSourceOptions = [
  { value: "organic", label: "Orgânico (redes sociais)" },
  { value: "paid-traffic", label: "Tráfego pago" },
  { value: "referral", label: "Indicações" },
  { value: "inbound", label: "Inbound (conteúdo/SEO)" },
  { value: "outbound", label: "Outbound (prospecção ativa)" },
  { value: "events", label: "Eventos/Networking" },
  { value: "partners", label: "Parcerias" }
];

const conversionOptions = [
  { value: "unknown", label: "Não sei" },
  { value: "under-5", label: "Menos de 5%" },
  { value: "5-10", label: "5–10%" },
  { value: "10-15", label: "10–15%" },
  { value: "15-25", label: "15–25%" },
  { value: "25-40", label: "25–40%" },
  { value: "over-40", label: "Acima de 40%" }
];

const painOptions = [
  { value: "no-process", label: "Sem processo de vendas definido" },
  { value: "inconsistent-execution", label: "Execução inconsistente do time" },
  { value: "low-conversion", label: "Baixa taxa de conversão" },
  { value: "owner-dependent", label: "Dependência do dono nas vendas" },
  { value: "team-scaling", label: "Dificuldade de escalar o time" },
  { value: "no-direction", label: "Falta de direção comercial" },
  { value: "high-turnover", label: "Alta rotatividade de vendedores" },
  { value: "slow-onboarding", label: "Onboarding lento de novos vendedores" },
  { value: "no-leads", label: "Falta de leads qualificados" },
  { value: "no-authority", label: "Falta de autoridade/posicionamento" },
  { value: "no-metrics", label: "Sem métricas claras" },
  { value: "long-cycle", label: "Ciclo de vendas muito longo" }
];

const processOptions = [
  { value: "none", label: "Não existe processo definido" },
  { value: "informal", label: "Existe mas é informal/na cabeça" },
  { value: "documented", label: "Documentado mas não seguido" },
  { value: "implemented", label: "Documentado e parcialmente seguido" },
  { value: "optimized", label: "Bem implementado e otimizado" }
];

const budgetOptions = [
  { value: "under-1k", label: "Menos de R$ 1.000/mês" },
  { value: "1k-3k", label: "R$ 1.000–3.000/mês" },
  { value: "3k-5k", label: "R$ 3.000–5.000/mês" },
  { value: "5k-10k", label: "R$ 5.000–10.000/mês" },
  { value: "10k-20k", label: "R$ 10.000–20.000/mês" },
  { value: "over-20k", label: "Acima de R$ 20.000/mês" },
  { value: "investment", label: "Depende do retorno esperado" }
];

const timelineOptions = [
  { value: "immediate", label: "Imediato (esta semana)" },
  { value: "15days", label: "Próximos 15 dias" },
  { value: "30days", label: "Próximo mês" },
  { value: "60days", label: "Próximos 2 meses" },
  { value: "planning", label: "Ainda estou planejando" }
];

const productIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "UNV Core": Layers,
  "UNV Control": RefreshCw,
  "UNV Sales Acceleration": TrendingUp,
  "UNV Growth Room": MapPin,
  "UNV Partners": Crown,
  "UNV Sales Ops": Users2,
  "UNV Ads": Megaphone,
  "UNV Social": Heart,
  "UNV Mastermind": Star
};

function getRecommendation(data: FormData): Recommendation {
  const products: ProductRecommendation[] = [];
  const trail: Trail[] = [];
  
  const { revenue, teamSize, mainPains, hasProcess, leadVolume, leadSource } = data;
  
  // Lógica de recomendação baseada em múltiplos fatores
  
  // Core - Para quem está começando ou sem processo
  if (hasProcess === "none" || hasProcess === "informal" || 
      (mainPains.includes("no-process") && ["under-50k", "50k-100k", "100k-200k"].includes(revenue))) {
    products.push({
      id: "core",
      name: "UNV Core",
      icon: productIcons["UNV Core"],
      priority: products.length === 0 ? "primary" : "secondary",
      reasons: [
        "Você precisa estruturar a fundação comercial",
        "Processo definido é pré-requisito para escalar",
        "Investimento acessível para começar certo"
      ],
      href: "/core"
    });
  }
  
  // Control - Para quem tem processo mas falta consistência
  if ((hasProcess === "documented" || hasProcess === "implemented") && 
      (mainPains.includes("inconsistent-execution") || mainPains.includes("no-direction"))) {
    products.push({
      id: "control",
      name: "UNV Control",
      icon: productIcons["UNV Control"],
      priority: products.length === 0 ? "primary" : "secondary",
      reasons: [
        "Você tem estrutura mas falta disciplina de execução",
        "Direção recorrente vai manter o momentum",
        "Comunidade de empresários acelera aprendizado"
      ],
      href: "/control"
    });
  }
  
  // Sales Acceleration - Para quem está pronto para acelerar
  if (["200k-400k", "400k-600k", "600k-1m", "1m-2m"].includes(revenue) && 
      ["2-3", "4-5", "6-10"].includes(teamSize)) {
    const isMainProduct = products.length === 0 || 
      (mainPains.includes("low-conversion") || mainPains.includes("owner-dependent"));
    products.push({
      id: "sales-acceleration",
      name: "UNV Sales Acceleration",
      icon: productIcons["UNV Sales Acceleration"],
      priority: isMainProduct ? "primary" : "secondary",
      reasons: [
        "Seu faturamento e time estão no ponto ideal",
        "Programa completo de direção comercial anual",
        "De quick wins a crescimento sustentável"
      ],
      href: "/sales-acceleration"
    });
  }
  
  // Growth Room - Para quem precisa de clareza estratégica
  if ((mainPains.includes("no-direction") || mainPains.includes("owner-dependent")) &&
      ["100k-200k", "200k-400k", "400k-600k", "600k-1m"].includes(revenue)) {
    products.push({
      id: "growth-room",
      name: "UNV Growth Room",
      icon: productIcons["UNV Growth Room"],
      priority: products.length === 0 ? "primary" : "complementary",
      reasons: [
        "Você precisa de clareza antes de agir",
        "Imersão de 3 dias para redesenhar a rota",
        "Sairá com plano de 90 dias definido"
      ],
      href: "/growth-room"
    });
  }
  
  // Partners - Para empresas maiores que querem mentoria estratégica
  if (["600k-1m", "1m-2m", "over-2m"].includes(revenue) && 
      (mainPains.includes("no-direction") || mainPains.includes("owner-dependent"))) {
    products.push({
      id: "partners",
      name: "UNV Partners",
      icon: productIcons["UNV Partners"],
      priority: products.length === 0 ? "primary" : "secondary",
      reasons: [
        "Você precisa de mentoria no nível de board",
        "Rede de empresários de elite acelera decisões",
        "Experiência Mansão para networking premium"
      ],
      href: "/partners"
    });
  }
  
  // Sales Ops - Para times maiores que precisam padronizar
  if (["6-10", "11-20", "over-20"].includes(teamSize) && 
      (mainPains.includes("team-scaling") || mainPains.includes("inconsistent-execution") || 
       mainPains.includes("high-turnover") || mainPains.includes("slow-onboarding"))) {
    products.push({
      id: "sales-ops",
      name: "UNV Sales Ops",
      icon: productIcons["UNV Sales Ops"],
      priority: products.length === 0 ? "primary" : "secondary",
      reasons: [
        "Seu time precisa de padronização",
        "Trilhas por cargo vão unificar performance",
        "Reduza dependência do dono/gestor"
      ],
      href: "/sales-ops"
    });
  }
  
  // Ads - Para quem precisa gerar demanda
  if (mainPains.includes("no-leads") || 
      (["under-30", "30-50"].includes(leadVolume) && !leadSource.includes("paid-traffic"))) {
    products.push({
      id: "ads",
      name: "UNV Ads",
      icon: productIcons["UNV Ads"],
      priority: mainPains.includes("no-leads") && products.length === 0 ? "primary" : "complementary",
      reasons: [
        "Você precisa de demanda qualificada",
        "Tráfego integrado ao comercial, não isolado",
        "Leads no volume certo para o time"
      ],
      href: "/ads"
    });
  }
  
  // Social - Para quem precisa de autoridade
  if (mainPains.includes("no-authority") || mainPains.includes("long-cycle") ||
      (!leadSource.includes("organic") && !leadSource.includes("inbound"))) {
    products.push({
      id: "social",
      name: "UNV Social",
      icon: productIcons["UNV Social"],
      priority: mainPains.includes("no-authority") && products.length === 0 ? "primary" : "complementary",
      reasons: [
        "Você precisa construir autoridade",
        "Conteúdo que prepara o lead para comprar",
        "Encurta ciclo de vendas e reduz objeções"
      ],
      href: "/social"
    });
  }
  
  // Mastermind - Para empresários avançados que buscam pares à altura
  if (["600k-1m", "1m-2m", "over-2m"].includes(revenue) && 
      data.budget && ["10k-20k", "over-20k", "investment"].includes(data.budget)) {
    products.push({
      id: "mastermind",
      name: "UNV Mastermind",
      icon: productIcons["UNV Mastermind"],
      priority: ["1m-2m", "over-2m"].includes(revenue) ? "primary" : "secondary",
      reasons: [
        "Você está no nível de empresário avançado",
        "Decisões melhores com conselho de pares",
        "Ambiente de elite para crescer certo"
      ],
      href: "/mastermind"
    });
  }
  
  // Se não tiver nenhum produto, recomendar Sales Acceleration como padrão
  if (products.length === 0) {
    products.push({
      id: "sales-acceleration",
      name: "UNV Sales Acceleration",
      icon: productIcons["UNV Sales Acceleration"],
      priority: "primary",
      reasons: [
        "Seu perfil se encaixa no programa completo",
        "Direção comercial estruturada por 12 meses",
        "Melhor custo-benefício para transformação"
      ],
      href: "/sales-acceleration"
    });
  }
  
  // Ordenar por prioridade
  products.sort((a, b) => {
    const order = { primary: 0, secondary: 1, complementary: 2 };
    return order[a.priority] - order[b.priority];
  });
  
  // Construir trilha de evolução
  const primaryProduct = products.find(p => p.priority === "primary") || products[0];
  
  // Trilha baseada no produto primário
  if (primaryProduct.id === "core") {
    trail.push(
      { phase: "Agora", product: "UNV Core", duration: "Único", objective: "Estruturar fundação comercial", href: "/core" },
      { phase: "Mês 2-3", product: "UNV Control", duration: "Mensal", objective: "Manter consistência", href: "/control" },
      { phase: "Mês 6+", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Acelerar crescimento", href: "/sales-acceleration" }
    );
  } else if (primaryProduct.id === "control") {
    trail.push(
      { phase: "Agora", product: "UNV Control", duration: "Mensal", objective: "Disciplina de execução", href: "/control" },
      { phase: "Mês 3-6", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Acelerar vendas", href: "/sales-acceleration" },
      { phase: "Quando escalar", product: "UNV Sales Ops", duration: "Por usuário", objective: "Padronizar time", href: "/sales-ops" }
    );
  } else if (primaryProduct.id === "sales-acceleration") {
    trail.push(
      { phase: "Agora", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Transformação comercial", href: "/sales-acceleration" },
      { phase: "Em paralelo", product: "UNV Ads", duration: "Mensal", objective: "Gerar demanda", href: "/ads" },
      { phase: "Quando escalar", product: "UNV Sales Ops", duration: "Por usuário", objective: "Padronizar time", href: "/sales-ops" }
    );
  } else if (primaryProduct.id === "growth-room") {
    trail.push(
      { phase: "Agora", product: "UNV Growth Room", duration: "3 dias", objective: "Clareza estratégica", href: "/growth-room" },
      { phase: "Pós-imersão", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Executar plano", href: "/sales-acceleration" },
      { phase: "Em paralelo", product: "UNV Social", duration: "Mensal", objective: "Construir autoridade", href: "/social" }
    );
  } else if (primaryProduct.id === "partners") {
    trail.push(
      { phase: "Agora", product: "UNV Partners", duration: "12 meses", objective: "Mentoria estratégica", href: "/partners" },
      { phase: "Em paralelo", product: "UNV Sales Ops", duration: "Por usuário", objective: "Padronizar operação", href: "/sales-ops" },
      { phase: "Em paralelo", product: "UNV Ads", duration: "Mensal", objective: "Escalar demanda", href: "/ads" }
    );
  } else if (primaryProduct.id === "sales-ops") {
    trail.push(
      { phase: "Agora", product: "UNV Sales Ops", duration: "Por usuário", objective: "Padronizar time", href: "/sales-ops" },
      { phase: "Em paralelo", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Direção comercial", href: "/sales-acceleration" },
      { phase: "Em paralelo", product: "UNV Ads", duration: "Mensal", objective: "Gerar demanda", href: "/ads" }
    );
  } else if (primaryProduct.id === "ads") {
    trail.push(
      { phase: "Agora", product: "UNV Ads", duration: "Mensal", objective: "Gerar leads qualificados", href: "/ads" },
      { phase: "Em paralelo", product: "UNV Social", duration: "Mensal", objective: "Construir autoridade", href: "/social" },
      { phase: "Quando estruturar", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Converter melhor", href: "/sales-acceleration" }
    );
  } else if (primaryProduct.id === "mastermind") {
    trail.push(
      { phase: "Agora", product: "UNV Mastermind", duration: "12 meses", objective: "Conselho de empresários", href: "/mastermind" },
      { phase: "Em paralelo", product: "UNV Sales Ops", duration: "Por usuário", objective: "Padronizar operação", href: "/sales-ops" },
      { phase: "Em paralelo", product: "UNV Ads", duration: "Mensal", objective: "Escalar demanda", href: "/ads" }
    );
  } else {
    trail.push(
      { phase: "Agora", product: "UNV Social", duration: "Mensal", objective: "Construir autoridade", href: "/social" },
      { phase: "Em paralelo", product: "UNV Ads", duration: "Mensal", objective: "Gerar demanda", href: "/ads" },
      { phase: "Quando estruturar", product: "UNV Sales Acceleration", duration: "12 meses", objective: "Transformação comercial", href: "/sales-acceleration" }
    );
  }
  
  const summary = `Baseado no perfil apresentado (faturamento ${revenueOptions.find(o => o.value === revenue)?.label || "N/I"}, ` +
    `time de ${teamSizeOptions.find(o => o.value === teamSize)?.label || "N/I"}), ` +
    `recomendamos ${products.length === 1 ? "o produto" : "a combinação de produtos"} listado${products.length > 1 ? "s" : ""} acima. ` +
    `A trilha sugerida considera a evolução natural do seu negócio.`;
  
  const nextSteps = [
    "Aplicar para diagnóstico aprofundado",
    "Conversar com consultor UNV",
    "Receber proposta personalizada",
    "Iniciar onboarding estruturado"
  ];
  
  return { products, trail, summary, nextSteps };
}

const steps = [
  { id: 1, title: "Dados Básicos" },
  { id: 2, title: "Perfil Comercial" },
  { id: 3, title: "Dores & Desafios" },
  { id: 4, title: "Estrutura Atual" },
  { id: 5, title: "Metas & Desejos" },
  { id: 6, title: "Urgência & Contexto" }
];

export default function ForClosersPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    clientName: "", company: "", role: "", segment: "",
    revenue: "", teamSize: "", avgTicket: "", salesCycle: "", leadVolume: "", leadSource: [], conversion: "",
    mainPains: [], biggestChallenge: "", whatTriedBefore: "", whyDidntWork: "",
    hasProcess: "", processDescription: "", hasMetrics: "", metricsUsed: "", hasCRM: "", crmName: "", hasTraining: "", trainingFrequency: "",
    mainDesire: "", goal90Days: "", goal12Months: "", idealScenario: "",
    urgency: [3], budget: "", decisionMaker: "", timeline: "",
    additionalContext: ""
  });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleNext = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
    else handleSubmit();
  };
  
  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    setRecommendation(getRecommendation(formData));
    setIsSubmitted(true);
  };

  const toggleLeadSource = (value: string) => {
    setFormData({
      ...formData,
      leadSource: formData.leadSource.includes(value)
        ? formData.leadSource.filter(s => s !== value)
        : [...formData.leadSource, value]
    });
  };

  const togglePain = (value: string) => {
    setFormData({
      ...formData,
      mainPains: formData.mainPains.includes(value)
        ? formData.mainPains.filter(p => p !== value)
        : [...formData.mainPains, value]
    });
  };

  const generateWhatsAppSummary = () => {
    if (!recommendation) return "";
    
    const painsText = formData.mainPains.map(p => painOptions.find(o => o.value === p)?.label || p).join(", ");
    const productsText = recommendation.products.map(p => `• ${p.name} (${p.priority === "primary" ? "Principal" : p.priority === "secondary" ? "Secundário" : "Complementar"})`).join("\n");
    const trailText = recommendation.trail.map(t => `${t.phase}: ${t.product} - ${t.objective}`).join("\n");
    
    return `*Diagnóstico UNV - Resumo*\n\n` +
      `*Cliente:* ${formData.clientName}\n` +
      `*Empresa:* ${formData.company}\n` +
      `*Segmento:* ${formData.segment || "N/I"}\n\n` +
      `*Perfil Comercial:*\n` +
      `• Faturamento: ${revenueOptions.find(o => o.value === formData.revenue)?.label || "N/I"}\n` +
      `• Time: ${teamSizeOptions.find(o => o.value === formData.teamSize)?.label || "N/I"}\n` +
      `• Ticket médio: ${ticketOptions.find(o => o.value === formData.avgTicket)?.label || "N/I"}\n` +
      `• Volume de leads: ${leadVolumeOptions.find(o => o.value === formData.leadVolume)?.label || "N/I"}\n` +
      `• Conversão: ${conversionOptions.find(o => o.value === formData.conversion)?.label || "N/I"}\n\n` +
      `*Dores Identificadas:*\n${painsText}\n\n` +
      `*Maior Desafio:*\n${formData.biggestChallenge || "N/I"}\n\n` +
      `*Meta 90 dias:*\n${formData.goal90Days || "N/I"}\n\n` +
      `*Urgência:* ${formData.urgency[0]}/5\n\n` +
      `---\n\n` +
      `*PRODUTOS RECOMENDADOS:*\n${productsText}\n\n` +
      `*TRILHA DE EVOLUÇÃO:*\n${trailText}\n\n` +
      `---\n\n` +
      `${recommendation.summary}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateWhatsAppSummary());
    toast({ title: "Copiado!", description: "Resumo pronto para colar no WhatsApp" });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <h2 className="heading-card text-foreground">Dados Básicos</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nome do Cliente *</Label>
                <Input 
                  value={formData.clientName} 
                  onChange={e => setFormData({...formData, clientName: e.target.value})} 
                  placeholder="Nome completo"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Input 
                  value={formData.company} 
                  onChange={e => setFormData({...formData, company: e.target.value})} 
                  placeholder="Nome da empresa"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo/Função</Label>
                <Input 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value})} 
                  placeholder="Ex: CEO, Diretor Comercial"
                />
              </div>
              <div className="space-y-2">
                <Label>Segmento de Atuação</Label>
                <Input 
                  value={formData.segment} 
                  onChange={e => setFormData({...formData, segment: e.target.value})} 
                  placeholder="Ex: SaaS, Consultoria, E-commerce"
                />
              </div>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <h2 className="heading-card text-foreground">Perfil Comercial</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Faturamento Mensal *</Label>
                <Select value={formData.revenue} onValueChange={v => setFormData({...formData, revenue: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{revenueOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamanho do Time Comercial *</Label>
                <Select value={formData.teamSize} onValueChange={v => setFormData({...formData, teamSize: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{teamSizeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ticket Médio</Label>
                <Select value={formData.avgTicket} onValueChange={v => setFormData({...formData, avgTicket: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{ticketOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ciclo de Vendas</Label>
                <Select value={formData.salesCycle} onValueChange={v => setFormData({...formData, salesCycle: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{salesCycleOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Volume de Leads/Mês</Label>
                <Select value={formData.leadVolume} onValueChange={v => setFormData({...formData, leadVolume: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{leadVolumeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taxa de Conversão</Label>
                <Select value={formData.conversion} onValueChange={v => setFormData({...formData, conversion: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{conversionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Fontes de Leads (selecione todas que se aplicam)</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {leadSourceOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
                    <Checkbox 
                      checked={formData.leadSource.includes(option.value)}
                      onCheckedChange={() => toggleLeadSource(option.value)}
                    />
                    <span className="text-sm text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <h2 className="heading-card text-foreground">Dores & Desafios</h2>
            <div className="space-y-3">
              <Label>Principais Dores (selecione todas que se aplicam) *</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {painOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
                    <Checkbox 
                      checked={formData.mainPains.includes(option.value)}
                      onCheckedChange={() => togglePain(option.value)}
                    />
                    <span className="text-sm text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qual é o MAIOR desafio comercial hoje? *</Label>
              <Textarea 
                value={formData.biggestChallenge} 
                onChange={e => setFormData({...formData, biggestChallenge: e.target.value})} 
                placeholder="Descreva com suas palavras o principal problema que está enfrentando nas vendas..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>O que já tentou fazer para resolver?</Label>
              <Textarea 
                value={formData.whatTriedBefore} 
                onChange={e => setFormData({...formData, whatTriedBefore: e.target.value})} 
                placeholder="Treinamentos, consultorias, contratações, ferramentas..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Por que não funcionou?</Label>
              <Textarea 
                value={formData.whyDidntWork} 
                onChange={e => setFormData({...formData, whyDidntWork: e.target.value})} 
                placeholder="O que faltou nas tentativas anteriores?"
                rows={2}
              />
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <h2 className="heading-card text-foreground">Estrutura Atual</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Existe processo de vendas? *</Label>
                <Select value={formData.hasProcess} onValueChange={v => setFormData({...formData, hasProcess: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{processOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Usa CRM?</Label>
                <Select value={formData.hasCRM} onValueChange={v => setFormData({...formData, hasCRM: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="yes">Sim</SelectItem>
                    <SelectItem value="no">Não</SelectItem>
                    <SelectItem value="partially">Parcialmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.hasProcess && formData.hasProcess !== "none" && (
              <div className="space-y-2">
                <Label>Descreva brevemente o processo atual</Label>
                <Textarea 
                  value={formData.processDescription} 
                  onChange={e => setFormData({...formData, processDescription: e.target.value})} 
                  placeholder="Como funciona o processo de vendas hoje? Quais são as etapas?"
                  rows={2}
                />
              </div>
            )}
            {formData.hasCRM === "yes" && (
              <div className="space-y-2">
                <Label>Qual CRM usa?</Label>
                <Input 
                  value={formData.crmName} 
                  onChange={e => setFormData({...formData, crmName: e.target.value})} 
                  placeholder="Ex: Pipedrive, HubSpot, RD Station"
                />
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Acompanha métricas de vendas?</Label>
                <Select value={formData.hasMetrics} onValueChange={v => setFormData({...formData, hasMetrics: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="yes">Sim, regularmente</SelectItem>
                    <SelectItem value="sometimes">Às vezes</SelectItem>
                    <SelectItem value="no">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Faz treinamento do time?</Label>
                <Select value={formData.hasTraining} onValueChange={v => setFormData({...formData, hasTraining: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="regular">Sim, regularmente</SelectItem>
                    <SelectItem value="occasional">Ocasionalmente</SelectItem>
                    <SelectItem value="onboarding">Só no onboarding</SelectItem>
                    <SelectItem value="no">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.hasMetrics === "yes" && (
              <div className="space-y-2">
                <Label>Quais métricas acompanha?</Label>
                <Input 
                  value={formData.metricsUsed} 
                  onChange={e => setFormData({...formData, metricsUsed: e.target.value})} 
                  placeholder="Ex: taxa de conversão, ticket médio, ciclo de vendas..."
                />
              </div>
            )}
          </div>
        );
      
      case 5:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <h2 className="heading-card text-foreground">Metas & Desejos</h2>
            <div className="space-y-2">
              <Label>Qual é o maior DESEJO para o comercial? *</Label>
              <Textarea 
                value={formData.mainDesire} 
                onChange={e => setFormData({...formData, mainDesire: e.target.value})} 
                placeholder="Se pudesse mudar uma coisa no seu comercial, o que seria? O que sonha alcançar?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta para os próximos 90 dias *</Label>
              <Textarea 
                value={formData.goal90Days} 
                onChange={e => setFormData({...formData, goal90Days: e.target.value})} 
                placeholder="O que quer ter alcançado daqui a 3 meses? Seja específico."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta para os próximos 12 meses</Label>
              <Textarea 
                value={formData.goal12Months} 
                onChange={e => setFormData({...formData, goal12Months: e.target.value})} 
                placeholder="Onde quer estar daqui a 1 ano? Faturamento, time, estrutura..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Descreva o cenário ideal</Label>
              <Textarea 
                value={formData.idealScenario} 
                onChange={e => setFormData({...formData, idealScenario: e.target.value})} 
                placeholder="Como seria o comercial perfeito para sua empresa? Imagine o cenário dos sonhos."
                rows={3}
              />
            </div>
          </div>
        );
      
      case 6:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <h2 className="heading-card text-foreground">Urgência & Contexto</h2>
            <div className="space-y-4">
              <Label>Nível de Urgência (1–5) *</Label>
              <div className="flex items-center gap-4">
                <span className="text-small text-muted-foreground">Baixa</span>
                <Slider 
                  value={formData.urgency} 
                  onValueChange={v => setFormData({...formData, urgency: v})} 
                  min={1} 
                  max={5} 
                  step={1} 
                  className="flex-1" 
                />
                <span className="text-small text-muted-foreground">Alta</span>
                <span className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center">{formData.urgency[0]}</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Orçamento Disponível</Label>
                <Select value={formData.budget} onValueChange={v => setFormData({...formData, budget: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{budgetOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo para Decisão</Label>
                <Select value={formData.timeline} onValueChange={v => setFormData({...formData, timeline: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{timelineOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quem toma a decisão?</Label>
              <Select value={formData.decisionMaker} onValueChange={v => setFormData({...formData, decisionMaker: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="self">Eu mesmo</SelectItem>
                  <SelectItem value="partner">Eu + sócio(s)</SelectItem>
                  <SelectItem value="board">Conselho/Diretoria</SelectItem>
                  <SelectItem value="other">Outra pessoa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações Adicionais</Label>
              <Textarea 
                value={formData.additionalContext} 
                onChange={e => setFormData({...formData, additionalContext: e.target.value})} 
                placeholder="Algo mais que devemos saber? Contexto importante, restrições, preferências..."
                rows={3}
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Layout>
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-block px-4 py-1.5 bg-accent/10 text-accent text-sm font-medium rounded-full mb-6">
              Diagnóstico Completo
            </div>
            <h1 className="heading-display text-foreground mb-6">
              Qual Produto é Ideal para Você?
            </h1>
            <p className="text-body text-lg">
              Responda às perguntas para receber uma recomendação personalizada com trilha de evolução.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-background">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto">
            {!isSubmitted ? (
              <>
                {/* Progress Steps */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    {steps.map((step, index) => (
                      <div key={step.id} className="flex items-center">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                          currentStep >= step.id 
                            ? "bg-accent text-accent-foreground" 
                            : "bg-secondary text-muted-foreground"
                        )}>
                          {currentStep > step.id ? <CheckCircle className="h-5 w-5" /> : step.id}
                        </div>
                        {index < steps.length - 1 && (
                          <div className={cn(
                            "h-1 w-8 md:w-16 mx-1 transition-all",
                            currentStep > step.id ? "bg-accent" : "bg-secondary"
                          )} />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Etapa {currentStep} de {steps.length}: {steps[currentStep - 1].title}
                  </p>
                </div>

                {/* Current Step Form */}
                {renderStep()}

                {/* Navigation Buttons */}
                <div className="flex gap-4 mt-8">
                  {currentStep > 1 && (
                    <Button variant="outline" size="lg" onClick={handleBack} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar
                    </Button>
                  )}
                  <Button 
                    variant="premium" 
                    size="lg" 
                    onClick={handleNext} 
                    className="flex-1"
                  >
                    {currentStep === 6 ? "Gerar Recomendação" : "Próximo"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-8">
                {/* Products Recommendation */}
                <div className="card-highlight p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6 text-center">Produtos Recomendados</h2>
                  <div className="space-y-4">
                    {recommendation?.products.map((product, index) => {
                      const Icon = product.icon;
                      return (
                        <div 
                          key={product.id}
                          className={cn(
                            "p-6 rounded-xl border transition-all",
                            product.priority === "primary" 
                              ? "bg-accent/10 border-accent" 
                              : product.priority === "secondary"
                              ? "bg-secondary border-border"
                              : "bg-background border-border/50"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                              product.priority === "primary" ? "bg-accent" : "bg-secondary"
                            )}>
                              <Icon className={cn("h-6 w-6", product.priority === "primary" ? "text-accent-foreground" : "text-foreground")} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-foreground">{product.name}</h3>
                                <span className={cn(
                                  "px-2 py-0.5 text-xs font-medium rounded-full",
                                  product.priority === "primary" 
                                    ? "bg-accent text-accent-foreground" 
                                    : product.priority === "secondary"
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {product.priority === "primary" ? "Recomendação Principal" : product.priority === "secondary" ? "Secundário" : "Complementar"}
                                </span>
                              </div>
                              <ul className="space-y-1.5">
                                {product.reasons.map((reason, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                              <Link to={product.href} className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-3 hover:underline">
                                Ver detalhes <ChevronRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evolution Trail */}
                <div className="card-premium p-6 md:p-8">
                  <h2 className="heading-card text-foreground mb-6 text-center">Trilha de Evolução Sugerida</h2>
                  <div className="space-y-4">
                    {recommendation?.trail.map((step, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center">
                            {index + 1}
                          </div>
                          {index < (recommendation?.trail.length || 0) - 1 && (
                            <div className="w-0.5 h-12 bg-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm text-primary font-medium mb-1">{step.phase}</p>
                          <Link to={step.href} className="text-lg font-bold text-foreground hover:text-primary transition-colors">
                            {step.product}
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1">{step.objective}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Duração: {step.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="card-premium p-6 md:p-8">
                  <h3 className="font-semibold text-foreground mb-4">Resumo</h3>
                  <p className="text-body mb-6">{recommendation?.summary}</p>
                  <h4 className="font-semibold text-foreground mb-3">Próximos Passos</h4>
                  <ol className="space-y-2">
                    {recommendation?.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-center gap-3 text-muted-foreground">
                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-sm font-medium flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button variant="gold" size="lg" onClick={copyToClipboard} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar Resumo para WhatsApp
                  </Button>
                  <Link to="/apply" className="flex-1">
                    <Button variant="premium" size="lg" className="w-full">
                      Aplicar para Diagnóstico
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => { setIsSubmitted(false); setRecommendation(null); setCurrentStep(1); }} 
                  className="w-full"
                >
                  Fazer Novo Diagnóstico
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
