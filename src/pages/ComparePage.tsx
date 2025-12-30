import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle,
  Layers,
  RefreshCw,
  TrendingUp,
  MapPin,
  Crown,
  Users2,
  BarChart3,
  Calendar,
  MessageSquare,
  Sparkles,
  Home,
  FileText,
  Target,
  Megaphone,
  Star,
  Brain,
  X,
  Heart,
  Users,
  DollarSign,
  Scale,
  Bot,
  Handshake
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientDiagnosticForm } from "@/components/ClientDiagnosticForm";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  icp: string;
  revenue: string;
  team: string;
  price: string;
  priceType: string;
  link: string;
  keyDiff: string;
  bestFor: string;
  notFor: string;
}

const products: Product[] = [
  {
    id: "core",
    name: "UNV Core",
    tagline: "Fundação Comercial Inicial",
    icon: Layers,
    color: "bg-blue-500",
    icp: "Empresas organizando a base comercial",
    revenue: "R$ 50k–150k/mês",
    team: "1–5 vendedores",
    price: "R$ 1.997",
    priceType: "único",
    link: "/core",
    keyDiff: "Produto de entrada — estrutura básica de vendas para quem está começando",
    bestFor: "Donos que vendem sozinhos ou com time pequeno e precisam de processo inicial",
    notFor: "Quem já tem processo estruturado ou busca aceleração"
  },
  {
    id: "control",
    name: "UNV Control",
    tagline: "Direção Comercial Recorrente",
    icon: RefreshCw,
    color: "bg-emerald-500",
    icp: "Empresas que precisam de constância e disciplina",
    revenue: "R$ 100k–400k/mês",
    team: "Qualquer tamanho",
    price: "R$ 5.997",
    priceType: "/ano",
    link: "/control",
    keyDiff: "Acompanhamento mensal recorrente — mantém a disciplina comercial ativa",
    bestFor: "Empresas que já vendem mas perdem ritmo sem cobrança externa",
    notFor: "Quem precisa de estruturação completa ou treinamento de time"
  },
  {
    id: "sales-acceleration",
    name: "UNV Sales Acceleration",
    tagline: "Aceleração Comercial Completa",
    icon: TrendingUp,
    color: "bg-accent",
    icp: "Empresas prontas para acelerar vendas",
    revenue: "R$ 150k–1M/mês",
    team: "3–20 vendedores",
    price: "R$ 24.000",
    priceType: "/ano",
    link: "/sales-acceleration",
    keyDiff: "Produto principal — direção + treinamento + cobrança integrados por 12 meses",
    bestFor: "Empresas com time comercial que querem acelerar resultados com método",
    notFor: "Quem não tem time ou busca apenas padronização"
  },
  {
    id: "growth-room",
    name: "UNV Growth Room",
    tagline: "Imersão Presencial Estratégica",
    icon: MapPin,
    color: "bg-orange-500",
    icp: "Empresas que precisam de clareza estratégica",
    revenue: "R$ 150k–600k/mês",
    team: "Decisores apenas",
    price: "R$ 3.997",
    priceType: "por pessoa (3 dias)",
    link: "/growth-room",
    keyDiff: "Imersão presencial de 3 dias — clareza estratégica e plano de 90 dias",
    bestFor: "CEOs/donos que precisam parar e repensar a direção comercial",
    notFor: "Quem busca acompanhamento recorrente ou treinamento de time"
  },
  {
    id: "partners",
    name: "UNV Partners",
    tagline: "Direção Estratégica & Board Externo",
    icon: Crown,
    color: "bg-amber-500",
    icp: "Empresas buscando parceria estratégica de decisão",
    revenue: "R$ 300k–2M/mês",
    team: "CEO/fundador decisor",
    price: "R$ 30.000",
    priceType: "/ano",
    link: "/partners",
    keyDiff: "Board externo — Fabrício como diretor comercial de fato, não consultor",
    bestFor: "Empresários que querem um parceiro de decisão, não apenas orientação",
    notFor: "Quem quer apenas treinamento ou precisa de execução"
  },
  {
    id: "sales-ops",
    name: "UNV Sales Ops",
    tagline: "Padronização & Treinamento de Times",
    icon: Users2,
    color: "bg-violet-500",
    icp: "Empresas padronizando operação comercial",
    revenue: "R$ 200k+/mês",
    team: "5+ vendedores",
    price: "R$ 12.000",
    priceType: "/ano",
    link: "/sales-ops",
    keyDiff: "Operação comercial — trilhas por cargo, onboarding, treinamentos com acompanhamento mensal em grupo",
    bestFor: "Empresas com time comercial que perdem padrão quando alguém sai",
    notFor: "Quem não tem time ou busca aceleração estratégica"
  },
  {
    id: "ads",
    name: "UNV Ads",
    tagline: "Tráfego & Geração de Demanda",
    icon: Megaphone,
    color: "bg-green-500",
    icp: "Empresas gerando demanda qualificada",
    revenue: "R$ 100k–1M+/mês",
    team: "Time comercial ativo",
    price: "R$ 1.800 a R$ 4.000",
    priceType: "/mês + mídia",
    link: "/ads",
    keyDiff: "Geração de demanda — campanhas de tráfego pago integradas com vendas",
    bestFor: "Empresas que precisam de mais leads qualificados para o time comercial",
    notFor: "Quem não tem time comercial para atender os leads"
  },
  {
    id: "social",
    name: "UNV Social",
    tagline: "Social Media como Canal de Vendas",
    icon: MessageSquare,
    color: "bg-pink-500",
    icp: "Empresas construindo autoridade",
    revenue: "R$ 80k–1M+/mês",
    team: "Negócios de confiança",
    price: "R$ 1.500 a R$ 3.500",
    priceType: "/mês",
    link: "/social",
    keyDiff: "Autoridade digital — conteúdo estratégico para pré-venda e aquecimento",
    bestFor: "Empresas onde a venda depende de confiança e autoridade do dono",
    notFor: "Quem busca leads imediatos ou não quer aparecer"
  },
  {
    id: "sales-force",
    name: "UNV Sales Force",
    tagline: "Outsourced SDR & Closing",
    icon: Users2,
    color: "bg-red-500",
    icp: "Empresas com demanda que precisam de conversão",
    revenue: "R$ 100k–1M+/mês",
    team: "200+ leads qualificados/mês",
    price: "R$ 6.000",
    priceType: "/mês + comissão",
    link: "/sales-force",
    keyDiff: "Operação de vendas terceirizada — SDR e Closer executando para você",
    bestFor: "Empresas com demanda qualificada que não conseguem converter internamente",
    notFor: "Quem não gera leads ou quer testar"
  },
  {
    id: "leadership",
    name: "UNV Leadership",
    tagline: "Formação de Liderança",
    icon: Brain,
    color: "bg-cyan-500",
    icp: "Empresas formando líderes intermediários",
    revenue: "R$ 100k–2M+/mês",
    team: "Gestores, coordenadores, heads",
    price: "R$ 15.000",
    priceType: "/ano",
    link: "/leadership",
    keyDiff: "Formação de líderes — liderança que sustenta pessoas, performance e crescimento",
    bestFor: "Empresas onde fundador centraliza, líderes não cobram e execução depende do dono",
    notFor: "Quem busca motivação, coaching vazio ou RH terceirizado"
  },
  {
    id: "people",
    name: "UNV People",
    tagline: "Gestão Estratégica de Pessoas",
    icon: Users,
    color: "bg-indigo-500",
    icp: "Empresas escalando time comercial",
    revenue: "R$ 100k–2M+/mês",
    team: "5+ colaboradores",
    price: "R$ 2.500 a R$ 8.000",
    priceType: "/mês ou por vaga",
    link: "/people",
    keyDiff: "Gestão de pessoas estratégica — contratação, onboarding e desenvolvimento estruturado",
    bestFor: "Empresas com turnover alto, contratações erradas ou time despadronizado",
    notFor: "Quem busca RH operacional ou recrutamento pontual"
  },
  {
    id: "finance",
    name: "UNV Finance",
    tagline: "Controle Financeiro Estratégico",
    icon: DollarSign,
    color: "bg-emerald-600",
    icp: "Empresas sem clareza financeira",
    revenue: "R$ 100k–2M+/mês",
    team: "Decisores",
    price: "R$ 3.000",
    priceType: "/mês",
    link: "/finance",
    keyDiff: "Clareza financeira — DRE, fluxo de caixa e margem por produto sem burocracia",
    bestFor: "Empresários que faturam alto mas não sabem onde ganham ou perdem dinheiro",
    notFor: "Quem busca contabilidade ou assessoria de investimentos"
  },
  {
    id: "safe",
    name: "UNV Safe",
    tagline: "Legal, Risk & Compliance Advisory",
    icon: Scale,
    color: "bg-blue-600",
    icp: "Empresas B2B em crescimento",
    revenue: "R$ 50k–2M/mês",
    team: "Operações com contratos",
    price: "R$ 3.000",
    priceType: "/mês",
    link: "/safe",
    keyDiff: "Jurídico terceirizado preventivo — contratos, compliance e LGPD sem surpresas",
    bestFor: "Empresas que crescem rápido mas não têm suporte jurídico estruturado",
    notFor: "Pessoa física ou quem busca advogado para causa pontual"
  },
  {
    id: "ai-sales-system",
    name: "UNV Sales System",
    tagline: "Inteligência Comercial Autônoma",
    icon: Bot,
    color: "bg-cyan-500",
    icp: "Empresas escalando vendas com IA",
    revenue: "R$ 100k–2M+/mês",
    team: "B2B e B2C",
    price: "R$ 297 a R$ 9.997",
    priceType: "/mês + setup",
    link: "/ai-sales-system",
    keyDiff: "IA comercial — CRM inteligente + agentes autônomos + atendimento WhatsApp/Instagram",
    bestFor: "Empresas que querem escalar vendas com IA, reduzindo custo e aumentando velocidade",
    notFor: "Quem não tem volume de leads ou busca só CRM tradicional"
  },
  {
    id: "fractional-cro",
    name: "UNV Fractional CRO",
    tagline: "Diretor Comercial Terceirizado",
    icon: Target,
    color: "bg-amber-500",
    icp: "Empresas com vendedores sem direção",
    revenue: "R$ 50k–500k/mês",
    team: "2–8 vendedores",
    price: "R$ 4.000 + comissão",
    priceType: "/mês",
    link: "/fractional-cro",
    keyDiff: "Direção comercial diária — reunião diária com time + cobrança de metas + CRM incluso",
    bestFor: "Donos cansados de cobrar vendas que precisam de direção comercial todos os dias",
    notFor: "Empresa sem vendedores ou dono que não aceita cobrança"
  },
  {
    id: "mastermind",
    name: "UNV Mastermind",
    tagline: "Inner Circle de Líderes",
    icon: Star,
    color: "bg-amber-500",
    icp: "Empresários em estágio avançado",
    revenue: "R$ 1M–10M/mês",
    team: "Donos reais",
    price: "R$ 50.000",
    priceType: "/ano",
    link: "/mastermind",
    keyDiff: "Conselho de decisão — grupo ultra seletivo com hot seats e mansão empresarial",
    bestFor: "Empresários que já cresceram e querem decidir melhor com pares à altura",
    notFor: "Quem busca execução, networking frouxo ou palco para ego"
  },
  {
    id: "le-desir",
    name: "Le Désir",
    tagline: "Análise Estratégica para Líderes",
    icon: Heart,
    color: "bg-rose-500",
    icp: "Líderes com peso psicológico da liderança",
    revenue: "R$ 200k–3M+/mês",
    team: "CEO/Fundador",
    price: "R$ 2.000",
    priceType: "/mês",
    link: "/le-desir",
    keyDiff: "Análise estratégica — suporte emocional e psicológico para decisores sob pressão",
    bestFor: "Líderes exaustos, reativos ou com padrões destrutivos que afetam decisões",
    notFor: "Quem busca terapia clínica ou mentoria de negócios"
  },
  {
    id: "execution-partnership",
    name: "UNV Execution Partnership",
    tagline: "Parceria de Execução Intensiva",
    icon: Handshake,
    color: "bg-purple-600",
    icp: "Empresas que precisam de execução imediata",
    revenue: "R$ 500k+/mês",
    team: "CEO + time comercial",
    price: "R$ 40.000",
    priceType: "(3 meses)",
    link: "/execution-partnership",
    keyDiff: "Imersão de 3 meses — direção comercial intensiva com execução direta",
    bestFor: "Empresas que precisam resolver gargalos comerciais rapidamente com acompanhamento intensivo",
    notFor: "Quem busca consultoria pontual ou não tem urgência"
  }
];

interface Feature {
  name: string;
  description: string;
  category: string;
  products: Record<string, boolean | string>;
}

const features: Feature[] = [
  // Direção
  {
    name: "Direção Estratégica",
    description: "Definição de prioridades e rumo comercial",
    category: "Direção",
    products: {
      core: false,
      control: "Mensal",
      "sales-acceleration": "Mensal + Semanal",
      "growth-room": "3 dias intensivos",
      partners: "Board + Semanal",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Board coletivo",
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Acompanhamento Semanal",
    description: "Check-ins semanais de execução",
    category: "Direção",
    products: {
      core: false,
      control: "Via AI",
      "sales-acceleration": true,
      "growth-room": "Pós-imersão",
      partners: true,
      "sales-ops": "Mensal em grupo",
      ads: "Otimização",
      social: false,
      mastermind: false,
      "sales-force": "Semanal",
      leadership: "Contínuo",
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Cobrança de Execução",
    description: "Responsabilização ativa do time",
    category: "Direção",
    products: {
      core: "Básica",
      control: true,
      "sales-acceleration": true,
      "growth-room": "90 dias",
      partners: true,
      "sales-ops": "Via trilhas",
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": true,
      leadership: true,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  // Estrutura
  {
    name: "Diagnóstico Comercial",
    description: "Análise profunda da operação",
    category: "Estrutura",
    products: {
      core: "Direcional",
      control: false,
      "sales-acceleration": "Completo",
      "growth-room": "Pré-imersão",
      partners: "Completo+",
      "sales-ops": false,
      ads: "De demanda",
      social: "Posicionamento",
      mastermind: false,
      "sales-force": "Onboarding",
      leadership: "De liderança",
      "le-desir": false,
      people: "De pessoas",
      finance: "Financeiro"
    }
  },
  {
    name: "Estruturação de Funil",
    description: "Definição de etapas e critérios",
    category: "Estrutura",
    products: {
      core: "Básico",
      control: false,
      "sales-acceleration": "Completo",
      "growth-room": "Completo",
      partners: "Completo+",
      "sales-ops": false,
      ads: "Aquisição",
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Scripts e Roteiros",
    description: "Padronização de discurso",
    category: "Estrutura",
    products: {
      core: "Essenciais",
      control: "Templates",
      "sales-acceleration": "Por fase",
      "growth-room": true,
      partners: "Por fase+",
      "sales-ops": "Por cargo",
      ads: "Copies",
      social: "Conteúdo",
      mastermind: false,
      "sales-force": "Adaptados",
      leadership: "Feedback",
      "le-desir": false,
      people: "Entrevistas",
      finance: false
    }
  },
  {
    name: "Metas e KPIs",
    description: "Definição de indicadores",
    category: "Estrutura",
    products: {
      core: "Básicas",
      control: false,
      "sales-acceleration": "Completas",
      "growth-room": true,
      partners: "Completas+",
      "sales-ops": "Por cargo",
      ads: "CPL/CAC",
      social: false,
      mastermind: false,
      "sales-force": "Conversão",
      leadership: "De liderança",
      "le-desir": false,
      people: "De pessoas",
      finance: "Financeiros"
    }
  },
  // Treinamento
  {
    name: "Treinamento do Time",
    description: "Capacitação dos vendedores",
    category: "Treinamento",
    products: {
      core: false,
      control: false,
      "sales-acceleration": "5 fases",
      "growth-room": "3 dias",
      partners: "5 fases+",
      "sales-ops": "Trilhas por cargo",
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: "Onboarding",
      finance: false
    }
  },
  {
    name: "Trilhas por Cargo",
    description: "SDR, Closer, Gestor",
    category: "Treinamento",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: "Por cargo",
      "sales-ops": true,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: "Por função",
      finance: false
    }
  },
  {
    name: "Avaliações e Scorecards",
    description: "Medição de performance individual",
    category: "Treinamento",
    products: {
      core: false,
      control: false,
      "sales-acceleration": "Por vendedor",
      "growth-room": false,
      partners: "Por vendedor+",
      "sales-ops": true,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": "Mensal",
      leadership: "Por líder",
      "le-desir": false,
      people: "Por colaborador",
      finance: false
    }
  },
  // Suporte
  {
    name: "UNV AI Advisor",
    description: "Suporte via inteligência artificial",
    category: "Suporte",
    products: {
      core: "Básico",
      control: "Execução",
      "sales-acceleration": "Máximo",
      "growth-room": "Configurado",
      partners: "Estratégico",
      "sales-ops": "Por cargo",
      ads: "Ads",
      social: "Social",
      mastermind: "Mastermind",
      "sales-force": false,
      leadership: "Leadership",
      "le-desir": false,
      people: "People",
      finance: "Finance"
    }
  },
  {
    name: "Comunidade",
    description: "Acesso a grupo de empresários",
    category: "Suporte",
    products: {
      core: false,
      control: true,
      "sales-acceleration": false,
      "growth-room": false,
      partners: "Elite",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Ultra seletiva",
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  // Aquisição
  {
    name: "Gestão de Tráfego",
    description: "Campanhas de mídia paga",
    category: "Aquisição",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: "Completa",
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Geração de Leads",
    description: "Captação de demanda qualificada",
    category: "Aquisição",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: true,
      social: "Indireta",
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Integração Marketing/Vendas",
    description: "Alinhamento de canais",
    category: "Aquisição",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: true,
      social: true,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  // Social
  {
    name: "Estratégia de Conteúdo",
    description: "Linhas editoriais comerciais",
    category: "Social",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: "Completa",
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Construção de Autoridade",
    description: "Posicionamento e credibilidade",
    category: "Social",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: true,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Conteúdo de Pré-Venda",
    description: "Aquecimento de leads",
    category: "Social",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: true,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  // Mastermind
  {
    name: "Sessões de Hot Seat",
    description: "Decisões estratégicas em grupo",
    category: "Mastermind",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Mensal",
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Mansão Empresarial",
    description: "Encontros presenciais privados",
    category: "Mastermind",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Mensal",
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Direção Individual",
    description: "Sessões privadas com Fabrício",
    category: "Mastermind",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: "Recorrente",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "2x/ano",
      "sales-force": false,
      leadership: false,
      "le-desir": "Recorrente",
      people: false,
      finance: false
    }
  },
  // Experiências
  {
    name: "Encontros Presenciais",
    description: "Sessões ao vivo",
    category: "Experiências",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": "3 dias",
      partners: "Eventos exclusivos",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Mensais",
      "sales-force": false,
      leadership: "Híbrido",
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Experiência Mansão",
    description: "Networking de elite",
    category: "Experiências",
    products: {
      core: false,
      control: false,
      "sales-acceleration": "1 convite/ano",
      "growth-room": false,
      partners: "Recorrente+",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Recorrente",
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Benchmark com Pares",
    description: "Comparativo com outras empresas",
    category: "Experiências",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: true,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: "Real e profundo",
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  // Leadership Development
  {
    name: "Formação de Líderes",
    description: "Desenvolvimento de gestores intermediários",
    category: "Leadership",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: "4 dimensões",
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Gestão de Pessoas",
    description: "Cobrança, feedback e desenvolvimento",
    category: "Leadership",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: "Completo",
      "le-desir": false,
      people: "Estruturado",
      finance: false
    }
  },
  {
    name: "PDI Individual",
    description: "Plano de desenvolvimento do líder",
    category: "Leadership",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: true,
      "le-desir": false,
      people: true,
      finance: false
    }
  },
  {
    name: "Rituais de Cultura",
    description: "Sustentação de cultura organizacional",
    category: "Leadership",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: true,
      "le-desir": false,
      people: true,
      finance: false
    }
  },
  // Sales Force
  {
    name: "SDR Terceirizado",
    description: "Prospecção e qualificação de leads",
    category: "Sales Force",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": "Completo",
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Closer Terceirizado",
    description: "Fechamento de vendas",
    category: "Sales Force",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": "Completo",
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  {
    name: "Operação de Vendas",
    description: "Execução diária de vendas",
    category: "Sales Force",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": "Diária",
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false
    }
  },
  // Le Désir
  {
    name: "Sessões Analíticas",
    description: "Análise estratégica individual",
    category: "Le Désir",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": "Semanal/Quinzenal",
      people: false,
      finance: false
    }
  },
  {
    name: "Suporte Emocional Executivo",
    description: "Resiliência para decisores sob pressão",
    category: "Le Désir",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": true,
      people: false,
      finance: false
    }
  },
  // People
  {
    name: "Contratação Estratégica",
    description: "Processo completo de hiring",
    category: "People",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: "Completo",
      finance: false
    }
  },
  {
    name: "Onboarding Estruturado",
    description: "30-60-90 dias de integração",
    category: "People",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": "Por cargo",
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: "Completo",
      finance: false
    }
  },
  {
    name: "Estrutura de Cargos",
    description: "Definição de funções e carreiras",
    category: "People",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: true,
      finance: false
    }
  },
  // Finance
  {
    name: "DRE Gerencial",
    description: "Demonstrativo de resultados mensal",
    category: "Finance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: "Mensal"
    }
  },
  {
    name: "Controle de Fluxo de Caixa",
    description: "Projeções e acompanhamento",
    category: "Finance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: "90 dias"
    }
  },
  {
    name: "Margem por Produto",
    description: "Análise de rentabilidade",
    category: "Finance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: "Completo",
      safe: false
    }
  },
  // Legal & Compliance (UNV Safe)
  {
    name: "Jurídico Preventivo",
    description: "Análise de riscos antes de problemas",
    category: "Legal & Compliance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: "Completo"
    }
  },
  {
    name: "Padronização de Contratos",
    description: "Contratos de serviço, comerciais, parceiros",
    category: "Legal & Compliance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: "Completo"
    }
  },
  {
    name: "Consultoria Jurídica Contínua",
    description: "Suporte para decisões estratégicas",
    category: "Legal & Compliance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: "Recorrente"
    }
  },
  {
    name: "Orientação Trabalhista",
    description: "CLT, PJ, terceirização",
    category: "Legal & Compliance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: "Interface",
      finance: false,
      safe: "Completo"
    }
  },
  {
    name: "LGPD & Compliance",
    description: "Adequação e políticas",
    category: "Legal & Compliance",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: "Básico"
    }
  },
  // Sales System
  {
    name: "CRM Inteligente",
    description: "CRM com lead scoring por IA",
    category: "Sales System",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": "Completo",
      "fractional-cro": "Bônus incluso"
    }
  },
  {
    name: "Agentes de IA Autônomos",
    description: "SDR, Atendimento, Qualificação por IA",
    category: "Sales System",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": "1 a 10+ agentes",
      "fractional-cro": false
    }
  },
  {
    name: "Atendimento WhatsApp/Instagram",
    description: "Automação de canais de mensagem",
    category: "Sales System",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": "24/7",
      "fractional-cro": false
    }
  },
  {
    name: "Prospecção Automatizada B2B",
    description: "IA prospectando leads B2B",
    category: "Sales System",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": "B2B only",
      "fractional-cro": false
    }
  },
  // Fractional CRO
  {
    name: "Reunião Diária com Vendedores",
    description: "Cobrança e acompanhamento diário",
    category: "Fractional CRO",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": false,
      "fractional-cro": "Seg a Sex"
    }
  },
  {
    name: "Reunião Semanal com Dono",
    description: "Decisões estratégicas baseadas em dados",
    category: "Fractional CRO",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: "Board",
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": false,
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": false,
      "fractional-cro": "60 min"
    }
  },
  {
    name: "Gestão de Pipeline",
    description: "Acompanhamento diário do funil",
    category: "Fractional CRO",
    products: {
      core: false,
      control: false,
      "sales-acceleration": false,
      "growth-room": false,
      partners: false,
      "sales-ops": false,
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": "Terceirizada",
      leadership: false,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": "IA",
      "fractional-cro": "Diária"
    }
  },
  {
    name: "Cobrança de Metas",
    description: "Acompanhamento e cobrança de resultados",
    category: "Fractional CRO",
    products: {
      core: "Básica",
      control: true,
      "sales-acceleration": true,
      "growth-room": "90 dias",
      partners: true,
      "sales-ops": "Via trilhas",
      ads: false,
      social: false,
      mastermind: false,
      "sales-force": true,
      leadership: true,
      "le-desir": false,
      people: false,
      finance: false,
      safe: false,
      "ai-sales-system": false,
      "fractional-cro": "Diária"
    }
  }
];

const categories = [...new Set(features.map(f => f.category))];

export default function ComparePage() {
  const [selectedProducts, setSelectedProducts] = useState<string[]>(["core", "sales-acceleration"]);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      if (selectedProducts.length > 1) {
        setSelectedProducts(selectedProducts.filter(id => id !== productId));
      }
    } else {
      if (selectedProducts.length < 4) {
        setSelectedProducts([...selectedProducts, productId]);
      }
    }
  };

  const selectedProductsData = products.filter(p => selectedProducts.includes(p.id));

  const renderFeatureValue = (value: boolean | string) => {
    if (value === true) {
      return <CheckCircle className="h-5 w-5 text-accent mx-auto" />;
    }
    if (value === false) {
      return <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />;
    }
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="section-padding bg-card border-b border-border/30">
        <div className="container-premium">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="heading-display text-foreground mb-6">
              Compare os Produtos
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Selecione até 4 produtos para comparar lado a lado e encontrar 
              o melhor fit para o momento da sua empresa.
            </p>
          </div>
        </div>
      </section>

      {/* Product Selector - Not sticky, scrolls away */}
      <section className="py-8 bg-secondary border-b border-border">
        <div className="container-premium">
          <div className="flex flex-wrap justify-center gap-3">
            {products.map((product) => {
              const isSelected = selectedProducts.includes(product.id);
              const Icon = product.icon;
              return (
                <button
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all",
                    isSelected
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-accent/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isSelected && "text-accent")} />
                  <span className="font-medium text-sm">{product.name}</span>
                  {isSelected && (
                    <CheckCircle className="h-4 w-4 text-accent" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-center text-small text-muted-foreground mt-3">
            {selectedProducts.length}/4 produtos selecionados
          </p>
        </div>
      </section>

      {/* Comparison Header - Sticky product headers */}
      <section className="py-4 bg-background/95 backdrop-blur-sm border-b border-border sticky top-16 md:top-20 z-40 shadow-sm">
        <div className="container-premium">
          <div className="overflow-x-auto overflow-y-visible">
            <div className="min-w-[800px]">
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 flex items-center">
                  <span className="text-sm font-medium text-muted-foreground">Comparando:</span>
                </div>
                {selectedProductsData.map((product, index) => {
                  const Icon = product.icon;
                  return (
                    <div 
                      key={product.id} 
                      className={cn(
                        "px-4 pb-4 pt-8 text-center border-b-4 relative",
                        product.color.replace('bg-', 'border-')
                      )}
                      style={{ 
                        borderBottomColor: product.color === 'bg-accent' ? 'hsl(var(--accent))' : undefined 
                      }}
                    >
                      {/* Product number indicator */}
                      <div className={cn(
                        "absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground",
                        product.color
                      )}>
                        {index + 1}
                      </div>
                      
                      <div className="flex items-center justify-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", product.color)}>
                          <Icon className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-foreground text-base leading-tight">{product.name}</h3>
                          <p className="text-accent font-semibold text-sm">{product.price}<span className="text-muted-foreground font-normal"> {product.priceType}</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ICP Comparison */}
      <section className="py-6 bg-secondary">
        <div className="container-premium">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4">
                  <h4 className="font-semibold text-foreground">Perfil Ideal</h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center">
                    <p className="text-sm text-foreground">{product.icp}</p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Faturamento
                  </h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center">
                    <p className="text-sm font-medium text-foreground">{product.revenue}</p>
                  </div>
                ))}
              </div>
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-secondary/50">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-accent" />
                    Time
                  </h4>
                </div>
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="p-4 text-center bg-secondary/50">
                    <p className="text-sm font-medium text-foreground">{product.team}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Differences Section - NEW */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-8">
            Diferenças-Chave
          </h2>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Principal diferença */}
              <div className="grid mb-4" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-accent/10 rounded-l-lg border-l-4 border-accent">
                  <h4 className="font-bold text-foreground">🎯 Principal Diferença</h4>
                  <p className="text-xs text-muted-foreground">O que torna cada produto único</p>
                </div>
                {selectedProductsData.map((product, i) => (
                  <div key={product.id} className={cn("p-4 bg-accent/5", i === selectedProductsData.length - 1 && "rounded-r-lg")}>
                    <p className="text-sm font-medium text-foreground">{product.keyDiff}</p>
                  </div>
                ))}
              </div>

              {/* Para quem é */}
              <div className="grid mb-4" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-emerald-500/10 rounded-l-lg border-l-4 border-emerald-500">
                  <h4 className="font-bold text-foreground">✅ Melhor Para</h4>
                  <p className="text-xs text-muted-foreground">Quem deve escolher este produto</p>
                </div>
                {selectedProductsData.map((product, i) => (
                  <div key={product.id} className={cn("p-4 bg-emerald-500/5", i === selectedProductsData.length - 1 && "rounded-r-lg")}>
                    <p className="text-sm text-foreground">{product.bestFor}</p>
                  </div>
                ))}
              </div>

              {/* Para quem NÃO é */}
              <div className="grid" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-4 bg-destructive/10 rounded-l-lg border-l-4 border-destructive">
                  <h4 className="font-bold text-foreground">❌ Não É Para</h4>
                  <p className="text-xs text-muted-foreground">Quem não deve escolher este produto</p>
                </div>
                {selectedProductsData.map((product, i) => (
                  <div key={product.id} className={cn("p-4 bg-destructive/5", i === selectedProductsData.length - 1 && "rounded-r-lg")}>
                    <p className="text-sm text-muted-foreground">{product.notFor}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="section-padding bg-background">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-8">
            Comparativo Detalhado de Features
          </h2>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Column indicators */}
              <div className="grid mb-4" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                <div className="p-2" />
                {selectedProductsData.map((product, index) => {
                  const Icon = product.icon;
                  return (
                    <div key={product.id} className="px-2 flex justify-center">
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs font-medium",
                        product.color
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                        <span>{product.name.replace('UNV ', '')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {categories.map((category) => (
                <div key={category} className="mb-6">
                  <div className="grid mb-2" style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}>
                    <div className="p-4 bg-secondary rounded-l-lg">
                      <h3 className="font-bold text-foreground text-lg">{category}</h3>
                    </div>
                    {selectedProductsData.map((product, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "p-4 bg-secondary border-t-2",
                          i === selectedProductsData.length - 1 && "rounded-r-lg"
                        )}
                        style={{ 
                          borderTopColor: product.color === 'bg-accent' 
                            ? 'hsl(var(--accent))' 
                            : product.color === 'bg-blue-500' ? '#3b82f6'
                            : product.color === 'bg-emerald-500' ? '#10b981'
                            : product.color === 'bg-orange-500' ? '#f97316'
                            : product.color === 'bg-amber-500' ? '#f59e0b'
                            : product.color === 'bg-violet-500' ? '#8b5cf6'
                            : product.color === 'bg-green-500' ? '#22c55e'
                            : product.color === 'bg-pink-500' ? '#ec4899'
                            : product.color === 'bg-cyan-500' ? '#06b6d4'
                            : '#3b82f6'
                        }}
                      />
                    ))}
                  </div>
                  {features
                    .filter(f => f.category === category)
                    .map((feature) => (
                      <div 
                        key={feature.name} 
                        className="grid border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                        style={{ gridTemplateColumns: `250px repeat(${selectedProductsData.length}, 1fr)` }}
                      >
                        <div className="p-4">
                          <h4 className="font-medium text-foreground text-sm">{feature.name}</h4>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                        {selectedProductsData.map((product, i) => (
                          <div 
                            key={product.id} 
                            className={cn(
                              "p-4 flex items-center justify-center",
                              i % 2 === 0 ? "bg-muted/10" : "bg-transparent"
                            )}
                          >
                            {renderFeatureValue(feature.products[product.id])}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product Links */}
      <section className="section-padding bg-secondary">
        <div className="container-premium">
          <h2 className="heading-section text-foreground text-center mb-12">
            Saiba Mais Sobre Cada Serviço
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {selectedProductsData.map((product) => {
              const Icon = product.icon;
              return (
                <Link 
                  key={product.id} 
                  to={product.link}
                  className="card-premium p-6 group hover:border-accent/50 transition-all"
                >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", product.color)}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">{product.name}</h3>
                  <p className="text-small text-muted-foreground mb-4">{product.tagline}</p>
                  <div className="flex items-center text-accent text-sm font-medium group-hover:gap-2 transition-all">
                    Ver detalhes
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      {isLoggedIn && (
        <section className="section-padding bg-card border-y border-border/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-30 pointer-events-none" />
          <div className="container-premium text-center relative">
            <h2 className="heading-section text-foreground mb-4">
              Ainda em Dúvida?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Responda algumas perguntas rápidas e receba uma recomendação 
              personalizada baseada no momento da sua empresa.
            </p>
            <Button variant="hero" size="xl" onClick={() => setShowDiagnostic(true)}>
              Qual Serviço é Ideal Para Mim?
              <ArrowRight className="ml-2" />
            </Button>
          </div>
        </section>
      )}

      {/* Diagnostic Modal */}
      {showDiagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Descubra o Serviço Ideal
              </h2>
              <button 
                onClick={() => setShowDiagnostic(false)}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6">
              <ClientDiagnosticForm onClose={() => setShowDiagnostic(false)} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
