import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, CheckCircle, Copy, Layers, RefreshCw, TrendingUp, MapPin, Crown, Users2, Megaphone, Heart, ChevronRight, Star, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormData {
  // Fase 1 - Rapport
  clientName: string;
  company: string;
  role: string;
  segment: string;
  rapportNotes: string;
  connectionPoint: string;
  
  // Fase 2 - Expectativas
  expectationsAligned: string;
  clientAgreed: string;
  
  // Fase 3 - Tomadores de Decisão
  decisionMaker: string;
  partnerName: string;
  partnerPresent: string;
  decisionProcess: string;
  
  // Fase 4 - A Razão (Por que marcou a ligação)
  whyScheduled: string;
  specificHelp: string;
  whatSawAboutUs: string;
  whyNow: string;
  
  // Fase 5 - Cavar a Dor
  mainPains: string[];
  painDetails: string;
  howLongProblem: string;
  howAffectsLife: string;
  emotionalImpact: string;
  
  // Fase 6 - Tentou
  whatTriedBefore: string;
  whyDidntWork: string;
  
  // Fase 7 - Situação Atual e Desejada
  revenue: string;
  teamSize: string;
  avgTicket: string;
  salesCycle: string;
  leadVolume: string;
  leadSource: string[];
  conversion: string;
  hasProcess: string;
  hasCRM: string;
  crmName: string;
  goal12Months: string;
  idealScenario: string;
  realisticExpectation: string;
  
  // Fase 8 - Porquê (Amor ou Status)
  deeperWhy: string;
  whatWouldChange: string;
  loveOrStatus: string;
  
  // Fase 9 - Admissão
  admissionStatement: string;
  whyCantAlone: string;
  
  // Fase 10 - Compromisso
  whenToFix: string;
  commitmentLevel: number[];
  isCoachable: string;
  
  // Fase 11 - Fechamento
  budget: string;
  timeline: string;
  
  // Fase 12 - Preço / Observações
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

// 12 Fases do Script Comercial
const steps = [
  { id: 1, title: "Rapport", subtitle: "Conexão" },
  { id: 2, title: "Expectativas", subtitle: "Alinhamento" },
  { id: 3, title: "Decisores", subtitle: "Quem decide" },
  { id: 4, title: "A Razão", subtitle: "Por que marcou" },
  { id: 5, title: "Cavar", subtitle: "Aprofundar dor" },
  { id: 6, title: "Tentou", subtitle: "O que fez" },
  { id: 7, title: "Situação", subtitle: "Atual x Desejada" },
  { id: 8, title: "Porquê", subtitle: "Amor ou Status" },
  { id: 9, title: "Admissão", subtitle: "Precisa de ajuda" },
  { id: 10, title: "Compromisso", subtitle: "Quando resolver" },
  { id: 11, title: "Fechamento", subtitle: "Investimento" },
  { id: 12, title: "Recomendação", subtitle: "Resultado" }
];

export default function ForClosersPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    // Fase 1
    clientName: "", company: "", role: "", segment: "", rapportNotes: "", connectionPoint: "",
    // Fase 2
    expectationsAligned: "", clientAgreed: "",
    // Fase 3
    decisionMaker: "", partnerName: "", partnerPresent: "", decisionProcess: "",
    // Fase 4
    whyScheduled: "", specificHelp: "", whatSawAboutUs: "", whyNow: "",
    // Fase 5
    mainPains: [], painDetails: "", howLongProblem: "", howAffectsLife: "", emotionalImpact: "",
    // Fase 6
    whatTriedBefore: "", whyDidntWork: "",
    // Fase 7
    revenue: "", teamSize: "", avgTicket: "", salesCycle: "", leadVolume: "", leadSource: [], conversion: "",
    hasProcess: "", hasCRM: "", crmName: "", goal12Months: "", idealScenario: "", realisticExpectation: "",
    // Fase 8
    deeperWhy: "", whatWouldChange: "", loveOrStatus: "",
    // Fase 9
    admissionStatement: "", whyCantAlone: "",
    // Fase 10
    whenToFix: "", commitmentLevel: [3], isCoachable: "",
    // Fase 11
    budget: "", timeline: "",
    // Fase 12
    additionalContext: ""
  });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleNext = () => {
    if (currentStep < 12) setCurrentStep(currentStep + 1);
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
      `*Segmento:* ${formData.segment || "N/I"}\n` +
      `*Cargo:* ${formData.role || "N/I"}\n\n` +
      `*Por que marcou:*\n${formData.whyScheduled || "N/I"}\n\n` +
      `*Por que agora:*\n${formData.whyNow || "N/I"}\n\n` +
      `*Perfil Comercial:*\n` +
      `• Faturamento: ${revenueOptions.find(o => o.value === formData.revenue)?.label || "N/I"}\n` +
      `• Time: ${teamSizeOptions.find(o => o.value === formData.teamSize)?.label || "N/I"}\n` +
      `• Ticket médio: ${ticketOptions.find(o => o.value === formData.avgTicket)?.label || "N/I"}\n` +
      `• Volume de leads: ${leadVolumeOptions.find(o => o.value === formData.leadVolume)?.label || "N/I"}\n` +
      `• Conversão: ${conversionOptions.find(o => o.value === formData.conversion)?.label || "N/I"}\n\n` +
      `*Dores Identificadas:*\n${painsText || "N/I"}\n\n` +
      `*Detalhes da Dor:*\n${formData.painDetails || "N/I"}\n\n` +
      `*O que já tentou:*\n${formData.whatTriedBefore || "N/I"}\n\n` +
      `*Por que não funcionou:*\n${formData.whyDidntWork || "N/I"}\n\n` +
      `*Meta 12 meses:*\n${formData.goal12Months || "N/I"}\n\n` +
      `*Porquê profundo (Amor/Status):*\n${formData.deeperWhy || "N/I"}\n\n` +
      `*Admissão:*\n${formData.admissionStatement || "N/I"}\n\n` +
      `*Nível de Compromisso:* ${formData.commitmentLevel[0]}/5\n` +
      `*Quando quer resolver:* ${formData.whenToFix || "N/I"}\n\n` +
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
      // FASE 1 - RAPPORT
      case 1:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">1</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 1: Rapport</h2>
                <p className="text-sm text-muted-foreground">Gerar conexão. Deixe a pessoa falar sobre ela. Encontre pontos em comum.</p>
              </div>
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Regra de Ouro:</strong> Se o prospect já estiver pronto para comprar, deixe comprar. Não cometa o erro de fazer passar por todas as fases se já está decidido.
                </div>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nome do Cliente *</Label>
                <Input 
                  value={formData.clientName} 
                  onChange={e => setFormData({...formData, clientName: e.target.value})} 
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Input 
                  value={formData.company} 
                  onChange={e => setFormData({...formData, company: e.target.value})} 
                  placeholder="Nome da empresa"
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
            
            <div className="space-y-2">
              <Label>Ponto de conexão encontrado</Label>
              <Textarea 
                value={formData.connectionPoint} 
                onChange={e => setFormData({...formData, connectionPoint: e.target.value})} 
                placeholder="Ex: Vi nos stories que foi na academia, viagem, hobby em comum, experiência similar..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Anotações de Rapport</Label>
              <Textarea 
                value={formData.rapportNotes} 
                onChange={e => setFormData({...formData, rapportNotes: e.target.value})} 
                placeholder="Observações sobre a conexão, energia do prospect, pontos importantes para usar depois..."
                rows={2}
              />
            </div>
          </div>
        );
      
      // FASE 2 - EXPECTATIVAS
      case 2:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">2</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 2: Expectativas</h2>
                <p className="text-sm text-muted-foreground">Alinhar como a conversa vai acontecer. Estabelecer controle.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "Você está pronto para começar, [NOME]? Então é assim que essas ligações geralmente acontecem... 
                É como ir ao médico: vou fazer algumas perguntas sobre o seu negócio, descobrir qual é o problema, 
                dar um diagnóstico. Se a solução é algo que podemos oferecer, vou falar sobre o que temos. Parece bom?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>O cliente concordou com o formato?</Label>
              <Select value={formData.clientAgreed} onValueChange={v => setFormData({...formData, clientAgreed: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="yes">Sim, concordou</SelectItem>
                  <SelectItem value="partial">Parcialmente</SelectItem>
                  <SelectItem value="no">Não concordou</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Anotações sobre expectativas</Label>
              <Textarea 
                value={formData.expectationsAligned} 
                onChange={e => setFormData({...formData, expectationsAligned: e.target.value})} 
                placeholder="Como o prospect reagiu? Alguma resistência? Observações..."
                rows={2}
              />
            </div>
          </div>
        );
      
      // FASE 3 - TOMADORES DE DECISÃO
      case 3:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">3</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 3: Tomadores de Decisão</h2>
                <p className="text-sm text-muted-foreground">Identificar quem decide. Se tem sócio/cônjuge, precisa estar na ligação.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "Ah! Esqueci de perguntar, você toca o negócio sozinho, ou tem mais alguém que te ajuda, sócio, marido/esposa?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Quem toma a decisão?</Label>
              <Select value={formData.decisionMaker} onValueChange={v => setFormData({...formData, decisionMaker: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="self">O próprio cliente (sozinho)</SelectItem>
                  <SelectItem value="partner">Com sócio(s)</SelectItem>
                  <SelectItem value="spouse">Com cônjuge</SelectItem>
                  <SelectItem value="board">Conselho/Diretoria</SelectItem>
                  <SelectItem value="other">Outra pessoa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(formData.decisionMaker === "partner" || formData.decisionMaker === "spouse") && (
              <>
                <div className="space-y-2">
                  <Label>Nome do sócio/cônjuge</Label>
                  <Input 
                    value={formData.partnerName} 
                    onChange={e => setFormData({...formData, partnerName: e.target.value})} 
                    placeholder="Nome para mencionar na conversa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>O outro decisor está presente?</Label>
                  <Select value={formData.partnerPresent} onValueChange={v => setFormData({...formData, partnerPresent: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="yes">Sim, está na ligação</SelectItem>
                      <SelectItem value="no">Não está</SelectItem>
                      <SelectItem value="will-join">Vai entrar agora</SelectItem>
                      <SelectItem value="reschedule">Vamos reagendar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label>Como é o processo de decisão entre eles?</Label>
              <Textarea 
                value={formData.decisionProcess} 
                onChange={e => setFormData({...formData, decisionProcess: e.target.value})} 
                placeholder="Como funciona a tomada de decisão? Um decide sozinho? Precisam conversar?"
                rows={2}
              />
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Atenção:</strong> NUNCA deixe o prospect passar informações sozinho para o outro decisor. Ele não vai fazer um bom trabalho como você que é treinado para vender.
                </p>
              </div>
            </div>
          </div>
        );
      
      // FASE 4 - A RAZÃO
      case 4:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">4</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 4: A Razão</h2>
                <p className="text-sm text-muted-foreground">O prospect precisa DIZER o motivo da ligação. Identificar a dor e urgência.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "Vamos lá, [NOME]! Por que marcou uma ligação para falar comigo hoje? Em que você precisa da minha ajuda especificamente?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Por que marcou a ligação? *</Label>
              <Textarea 
                value={formData.whyScheduled} 
                onChange={e => setFormData({...formData, whyScheduled: e.target.value})} 
                placeholder="O que o prospect disse sobre o motivo de ter marcado..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Em que precisa de ajuda especificamente?</Label>
              <Textarea 
                value={formData.specificHelp} 
                onChange={e => setFormData({...formData, specificHelp: e.target.value})} 
                placeholder="Qual ajuda específica ele mencionou..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>O que viu sobre a UNV que acredita ser solução?</Label>
              <Textarea 
                value={formData.whatSawAboutUs} 
                onChange={e => setFormData({...formData, whatSawAboutUs: e.target.value})} 
                placeholder="O que ele viu que fez pensar que podemos ajudar? (Isso valida nossa autoridade)"
                rows={2}
              />
            </div>
            
            <div className="bg-accent/10 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium text-foreground">Pergunte: "Mas por que AGORA? Por que é tão importante resolver isso agora?"</p>
            </div>
            
            <div className="space-y-2">
              <Label>Por que agora? *</Label>
              <Textarea 
                value={formData.whyNow} 
                onChange={e => setFormData({...formData, whyNow: e.target.value})} 
                placeholder="O que faz essa dor ser urgente? Qual a pressão do momento?"
                rows={3}
              />
            </div>
          </div>
        );
      
      // FASE 5 - CAVAR A DOR
      case 5:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">5</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 5: Cavar a Dor</h2>
                <p className="text-sm text-muted-foreground">Aprofundar na dor. O prospect precisa SENTIR como é horrível continuar assim.</p>
              </div>
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Dica:</strong> Use "então" e "parece que" para mostrar que está atento. Nunca use "por quê?" - substitua por "O que te faz dizer isso?" ou "Como você chegou a essa conclusão?"
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <Label>Dores identificadas (selecione todas) *</Label>
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
            
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground italic">
                Pergutas para cavar: "O que está acontecendo que leva você a achar que esse problema existe?", 
                "Há quanto tempo isso é um problema?", "Esse problema está afetando sua vida de outras maneiras? Como?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Detalhes da dor *</Label>
              <Textarea 
                value={formData.painDetails} 
                onChange={e => setFormData({...formData, painDetails: e.target.value})} 
                placeholder="Descreva com detalhes o que o prospect contou sobre a dor..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Há quanto tempo é um problema?</Label>
              <Input 
                value={formData.howLongProblem} 
                onChange={e => setFormData({...formData, howLongProblem: e.target.value})} 
                placeholder="Ex: 6 meses, 1 ano, desde que começou..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>Como afeta outras áreas da vida?</Label>
              <Textarea 
                value={formData.howAffectsLife} 
                onChange={e => setFormData({...formData, howAffectsLife: e.target.value})} 
                placeholder="Família, saúde, relacionamentos, finanças pessoais..."
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Emoção/reação do prospect</Label>
              <Textarea 
                value={formData.emotionalImpact} 
                onChange={e => setFormData({...formData, emotionalImpact: e.target.value})} 
                placeholder="O prospect ficou levemente incomodado? Qual emoção surgiu?"
                rows={2}
              />
            </div>
          </div>
        );
      
      // FASE 6 - TENTOU
      case 6:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">6</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 6: Tentou</h2>
                <p className="text-sm text-muted-foreground">O que já tentou para resolver? Descobrir e contornar objeções antes que apareçam.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "E o que você já tentou até agora para resolver isso?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>O que já tentou? *</Label>
              <Textarea 
                value={formData.whatTriedBefore} 
                onChange={e => setFormData({...formData, whatTriedBefore: e.target.value})} 
                placeholder="Treinamentos, consultorias, contratações, ferramentas, cursos..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Por que não funcionou? *</Label>
              <Textarea 
                value={formData.whyDidntWork} 
                onChange={e => setFormData({...formData, whyDidntWork: e.target.value})} 
                placeholder="O que faltou? Por que não deu resultado?"
                rows={3}
              />
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Importante:</strong> Se ele mencionar algo similar ao que oferecemos, diferencie! 
                Ex: "Alguns dos nossos clientes tiveram essa mesma experiência antes de nos contratar. Mas mostramos pra eles nosso sistema único de [diferencial]."
              </p>
            </div>
          </div>
        );
      
      // FASE 7 - SITUAÇÃO ATUAL E DESEJADA
      case 7:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">7</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 7: Situação Atual x Desejada</h2>
                <p className="text-sm text-muted-foreground">Identificar onde está e onde quer chegar. Alinhar expectativas realistas.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground italic">
                "[NOME], agora eu gostaria de saber mais sobre a situação atual para entender melhor para onde vamos. 
                Tem algum problema você compartilhar um pouco dos seus resultados até aqui?"
              </p>
            </div>
            
            <h3 className="font-semibold text-foreground mt-6 mb-4">Situação Atual</h3>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Faturamento Mensal *</Label>
                <Select value={formData.revenue} onValueChange={v => setFormData({...formData, revenue: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{revenueOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamanho do Time *</Label>
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
                <Label>Volume de Leads</Label>
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
              <Label>Fontes de Leads</Label>
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
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Processo de Vendas</Label>
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
            
            <h3 className="font-semibold text-foreground mt-6 mb-4">Situação Desejada</h3>
            
            <div className="bg-secondary p-4 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground italic">
                "Se você trabalhasse conosco, onde você gostaria de estar daqui a 12 meses para sentir que o investimento valeu a pena?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Onde quer estar em 12 meses? *</Label>
              <Textarea 
                value={formData.goal12Months} 
                onChange={e => setFormData({...formData, goal12Months: e.target.value})} 
                placeholder="Faturamento, time, estrutura... O que deixaria feliz?"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Cenário ideal (sonho)</Label>
              <Textarea 
                value={formData.idealScenario} 
                onChange={e => setFormData({...formData, idealScenario: e.target.value})} 
                placeholder="O comercial perfeito seria como?"
                rows={2}
              />
            </div>
            
            <div className="bg-accent/10 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Alinhe expectativas:</strong> "E se nesse período eu te ajudar a alcançar pelo menos [EXPECTATIVA REALISTA], você já ficaria feliz?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Expectativa realista acordada</Label>
              <Input 
                value={formData.realisticExpectation} 
                onChange={e => setFormData({...formData, realisticExpectation: e.target.value})} 
                placeholder="O que acordaram como expectativa realista?"
              />
            </div>
          </div>
        );
      
      // FASE 8 - PORQUÊ (AMOR OU STATUS)
      case 8:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">8</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 8: O Porquê Profundo</h2>
                <p className="text-sm text-muted-foreground">Toda decisão se resume a AMOR ou STATUS. Descobrir o motivo real por trás do desejo.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "O que está levando você a querer [RESULTADO]? Como sua vida seria diferente se tivesse [XYZ]? Como seria isso?"
              </p>
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Dica Pro:</strong> A razão sempre se resume a AMOR (viver mais, estar presente para família, não perder relacionamento) 
                ou STATUS (ser visto como sucesso, reconhecimento, provar que é capaz).
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>O que está por trás do desejo? *</Label>
              <Textarea 
                value={formData.deeperWhy} 
                onChange={e => setFormData({...formData, deeperWhy: e.target.value})} 
                placeholder="Qual é o REAL motivo? O que ele quer alcançar além do dinheiro?"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>O que mudaria na vida dele?</Label>
              <Textarea 
                value={formData.whatWouldChange} 
                onChange={e => setFormData({...formData, whatWouldChange: e.target.value})} 
                placeholder="Como a vida seria diferente com o resultado alcançado?"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>É Amor ou Status?</Label>
              <Select value={formData.loveOrStatus} onValueChange={v => setFormData({...formData, loveOrStatus: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="love">Amor (família, saúde, relacionamentos, presença)</SelectItem>
                  <SelectItem value="status">Status (reconhecimento, sucesso, provar valor)</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      // FASE 9 - ADMISSÃO
      case 9:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">9</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 9: Admissão</h2>
                <p className="text-sm text-muted-foreground">O prospect precisa ADMITIR que precisa de ajuda. Sem isso, não consegue vender.</p>
              </div>
            </div>
            
            <div className="bg-accent/10 p-4 rounded-lg">
              <p className="text-sm font-medium text-foreground">
                Esta talvez seja a fase MAIS IMPORTANTE. Não pule! O prospect precisa dizer em voz alta que precisa de ajuda.
              </p>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "O que está impedindo você de alcançar tudo isso sozinho, sem qualquer ajuda?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>O que ele admitiu? *</Label>
              <Textarea 
                value={formData.admissionStatement} 
                onChange={e => setFormData({...formData, admissionStatement: e.target.value})} 
                placeholder="O que o prospect disse que o impede? (não sabe como fazer, quer processo comprovado, quer chegar mais rápido...)"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Por que não consegue sozinho?</Label>
              <Textarea 
                value={formData.whyCantAlone} 
                onChange={e => setFormData({...formData, whyCantAlone: e.target.value})} 
                placeholder="Detalhes sobre o que falta para ele fazer sozinho..."
                rows={2}
              />
            </div>
          </div>
        );
      
      // FASE 10 - COMPROMISSO
      case 10:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">10</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 10: Compromisso</h2>
                <p className="text-sm text-muted-foreground">Quando quer resolver? Buscar compromisso IMEDIATO. Antecipar objeção de tempo.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "Quando você quer consertar isso?"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Quando quer resolver?</Label>
              <Select value={formData.whenToFix} onValueChange={v => setFormData({...formData, whenToFix: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="now">Agora</SelectItem>
                  <SelectItem value="this-week">Esta semana</SelectItem>
                  <SelectItem value="this-month">Este mês</SelectItem>
                  <SelectItem value="next-month">Mês que vem</SelectItem>
                  <SelectItem value="later">Mais tarde</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.whenToFix === "now" && (
              <div className="bg-accent/10 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground italic">
                  "Ótimo! Que bom que você quer resolver isso agora. Mas quão comprometido você está em fazer isso acontecer? 
                  Você vai fazer o trabalho? Você vai agir? Você é treinável?"
                </p>
              </div>
            )}
            
            {(formData.whenToFix === "next-month" || formData.whenToFix === "later") && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <p className="text-sm text-foreground font-medium">Fechamento de Procrastinação:</p>
                <p className="text-sm text-muted-foreground italic">
                  "[NOME], a verdade é que na grande maioria das vezes, nunca é um bom momento pra começar. 
                  Até entrarmos nesta ligação, você estava adiando a resolução desse problema? 
                  Quantas vezes você já disse que o próximo mês não é um bom momento? 
                  E como tem funcionado para você ficar adiando isso?"
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <Label>Nível de Compromisso (1–5)</Label>
              <div className="flex items-center gap-4">
                <span className="text-small text-muted-foreground">Baixo</span>
                <Slider 
                  value={formData.commitmentLevel} 
                  onValueChange={v => setFormData({...formData, commitmentLevel: v})} 
                  min={1} 
                  max={5} 
                  step={1} 
                  className="flex-1" 
                />
                <span className="text-small text-muted-foreground">Alto</span>
                <span className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center">{formData.commitmentLevel[0]}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>É treinável/coachable?</Label>
              <Select value={formData.isCoachable} onValueChange={v => setFormData({...formData, isCoachable: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="yes">Sim, totalmente</SelectItem>
                  <SelectItem value="partially">Parcialmente</SelectItem>
                  <SelectItem value="no">Não parece ser</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      
      // FASE 11 - FECHAMENTO
      case 11:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">11</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 11: Fechamento</h2>
                <p className="text-sm text-muted-foreground">Orçamento, timeline e contexto final para a recomendação.</p>
              </div>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg space-y-3">
              <p className="text-sm text-muted-foreground italic">
                "Ok, agora tenho informações suficientes e, honestamente, eu ACREDITO que nós podemos ajudar você. Posso dizer como?"
              </p>
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
              <Label>Observações finais</Label>
              <Textarea 
                value={formData.additionalContext} 
                onChange={e => setFormData({...formData, additionalContext: e.target.value})} 
                placeholder="Algo mais importante? Contexto, restrições, preferências, red flags..."
                rows={3}
              />
            </div>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Lembre-se:</strong> Nunca diga "eu acho", sempre diga "eu acredito". 
                "Acho" faz parecer que você não tem certeza. "Acreditar" soa como se você tivesse certeza.
              </p>
            </div>
          </div>
        );
      
      // FASE 12 - RESULTADO/RECOMENDAÇÃO (será gerado automaticamente)
      case 12:
        return (
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0">12</div>
              <div>
                <h2 className="heading-card text-foreground">Fase 12: Gerar Recomendação</h2>
                <p className="text-sm text-muted-foreground">Clique para gerar a recomendação personalizada com base em todas as informações.</p>
              </div>
            </div>
            
            <div className="bg-accent/10 p-6 rounded-lg text-center">
              <CheckCircle className="h-12 w-12 text-accent mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Diagnóstico Completo!</h3>
              <p className="text-muted-foreground">
                Você completou todas as 12 fases do script comercial. 
                Clique em "Gerar Recomendação" para ver os produtos ideais e a trilha de evolução.
              </p>
            </div>
            
            <div className="bg-secondary p-4 rounded-lg">
              <p className="text-sm text-muted-foreground italic">
                "Bem, nossa área de especialização está ajudando [IDENTIDADE DO CLIENTE] a obter [RESULTADO QUE DESEJA] 
                para que eles possam obter [SUBPRODUTO DO RESULTADO]. E fazemos isso por [OFERTA]. 
                Agora, isso pode não ser pra você, mas vou deixar você decidir. Isso poderia funcionar pra você?"
              </p>
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
              12 Fases do Script Comercial
            </div>
            <h1 className="heading-display text-foreground mb-6">
              Diagnóstico & Recomendação de Produto
            </h1>
            <p className="text-body text-lg">
              Siga as 12 fases do script comercial para não se perder e gerar a melhor recomendação.
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
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {steps.map((step) => (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStep(step.id)}
                        className={cn(
                          "flex flex-col items-center p-2 rounded-lg transition-all min-w-[60px]",
                          currentStep === step.id 
                            ? "bg-accent text-accent-foreground" 
                            : currentStep > step.id
                            ? "bg-accent/20 text-accent"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        )}
                      >
                        <span className="text-sm font-bold">{step.id}</span>
                        <span className="text-[10px] leading-tight text-center">{step.title}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Fase {currentStep} de {steps.length}: <span className="font-medium text-foreground">{steps[currentStep - 1].title}</span> — {steps[currentStep - 1].subtitle}
                  </p>
                </div>

                {/* Current Step Form */}
                {renderStep()}

                {/* Navigation Buttons */}
                <div className="flex gap-4 mt-8">
                  {currentStep > 1 && (
                    <Button variant="outline" size="lg" onClick={handleBack} className="flex-1">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Fase Anterior
                    </Button>
                  )}
                  <Button 
                    variant="premium" 
                    size="lg" 
                    onClick={handleNext} 
                    className="flex-1"
                  >
                    {currentStep === 12 ? "Gerar Recomendação" : "Próxima Fase"}
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
                    {recommendation?.products.map((product) => {
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
