import ShowcaseHeader from "@/components/showcase/ShowcaseHeader";
import ShowcaseHero from "@/components/showcase/ShowcaseHero";
import ShowcaseModuleSection from "@/components/showcase/ShowcaseModuleSection";
import ShowcaseModuleGrid from "@/components/showcase/ShowcaseModuleGrid";
import ShowcaseAccessProfiles from "@/components/showcase/ShowcaseAccessProfiles";
import ShowcaseFooter from "@/components/showcase/ShowcaseFooter";

import {
  BarChart3,
  Route,
  Users,
  ShoppingCart,
  DollarSign,
  Package,
  Briefcase,
  Brain,
  Calendar,
  HeadphonesIcon,
  Gift,
  Star,
} from "lucide-react";

// Module data
const kpisModule = {
  title: "KPIs e Metas",
  description: "Dashboard completo de performance comercial com visualização de metas, resultados e rankings.",
  features: [
    "Dashboard visual com gráficos de evolução",
    "Lançamento de vendas diário",
    "Gamificação com ranking de vendedores",
    "Metas individuais e por equipe",
    "Alertas de performance em tempo real",
  ],
  icon: BarChart3,
};

const journeyModule = {
  title: "Jornada de Onboarding",
  description: "Trilha visual de implementação com todas as etapas do projeto organizadas e acompanhadas.",
  features: [
    "Trilha visual com progresso",
    "Lista de tarefas por etapa",
    "Cronograma com datas-chave",
    "Documentos e anexos por fase",
    "Status de conclusão automático",
  ],
  icon: Route,
};

const operationalModules = [
  {
    title: "CRM / Clientes",
    description: "Gestão completa de clientes e relacionamento",
    features: [
      "Cadastro completo de clientes",
      "Histórico de interações",
      "Segmentação por perfil",
      "Dados de contato e endereço",
    ],
    icon: Users,
  },
  {
    title: "Vendas",
    description: "Controle de vendas, orçamentos e pedidos",
    features: [
      "Registro de vendas",
      "Orçamentos e propostas",
      "Histórico por cliente",
      "Relatórios de vendas",
    ],
    icon: ShoppingCart,
  },
  {
    title: "Financeiro",
    description: "Fluxo de caixa e gestão financeira completa",
    features: [
      "Contas a pagar e receber",
      "Fluxo de caixa projetado",
      "Conciliação bancária",
      "Relatórios financeiros",
    ],
    icon: DollarSign,
  },
  {
    title: "Estoque",
    description: "Controle de produtos e fornecedores",
    features: [
      "Cadastro de produtos",
      "Controle de estoque",
      "Gestão de fornecedores",
      "Pedidos de compra",
    ],
    icon: Package,
  },
];

const hrModule = {
  title: "RH e Recrutamento",
  description: "Pipeline completo de recrutamento com testes comportamentais e banco de talentos.",
  features: [
    "Cadastro de vagas abertas",
    "Pipeline visual de candidatos (Kanban)",
    "Testes DISC integrados",
    "Avaliação 360º de colaboradores",
    "Banco de talentos para futuras vagas",
  ],
  icon: Briefcase,
};

const boardModule = {
  title: "Board Virtual (IA)",
  description: "Conselho de diretores virtuais com inteligência artificial para análise de decisões estratégicas.",
  features: [
    "Diretores de IA especializados",
    "Análise de decisões de negócio",
    "Múltiplas perspectivas (financeira, comercial, RH)",
    "Recomendações baseadas em dados",
    "Histórico de consultas",
  ],
  icon: Brain,
};

const supportModules = [
  {
    title: "Reuniões",
    description: "Histórico de reuniões e acompanhamento",
    features: [
      "Histórico de reuniões",
      "Gravações disponíveis",
      "Notas e atas",
      "Agendamento integrado",
    ],
    icon: Calendar,
  },
  {
    title: "Chamados",
    description: "Sistema de tickets para suporte",
    features: [
      "Abertura de chamados",
      "Acompanhamento de status",
      "Histórico de atendimento",
      "Priorização por urgência",
    ],
    icon: HeadphonesIcon,
  },
];

const loyaltyModules = [
  {
    title: "Indicações",
    description: "Programa de indicação de novos clientes",
    features: [
      "Indicar novos clientes",
      "Acompanhar status",
      "Recompensas por indicação",
      "Relatório de indicações",
    ],
    icon: Gift,
  },
  {
    title: "Fidelidade",
    description: "Sistema de pontos e recompensas",
    features: [
      "Acúmulo de pontos",
      "QR Code para clientes",
      "Catálogo de prêmios",
      "Resgate de pontos",
    ],
    icon: Star,
  },
];

const SystemShowcasePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <ShowcaseHeader />
      
      <main>
        <ShowcaseHero />
        
        {/* KPIs Module */}
        <ShowcaseModuleSection
          title={kpisModule.title}
          description={kpisModule.description}
          features={kpisModule.features}
          icon={kpisModule.icon}
          reversed={false}
        />
        
        {/* Journey Module */}
        <ShowcaseModuleSection
          title={journeyModule.title}
          description={journeyModule.description}
          features={journeyModule.features}
          icon={journeyModule.icon}
          reversed={true}
        />
        
        {/* Operational Modules Grid */}
        <ShowcaseModuleGrid
          title="Gestão Operacional"
          subtitle="CRM, vendas, financeiro e estoque integrados em uma única plataforma"
          modules={operationalModules}
        />
        
        {/* HR Module */}
        <ShowcaseModuleSection
          title={hrModule.title}
          description={hrModule.description}
          features={hrModule.features}
          icon={hrModule.icon}
          reversed={false}
        />
        
        {/* Board Virtual Module */}
        <ShowcaseModuleSection
          title={boardModule.title}
          description={boardModule.description}
          features={boardModule.features}
          icon={boardModule.icon}
          reversed={true}
        />
        
        {/* Support Modules Grid */}
        <ShowcaseModuleGrid
          title="Suporte e Acompanhamento"
          subtitle="Reuniões, chamados e comunicação centralizada"
          modules={supportModules}
        />
        
        {/* Loyalty Modules Grid */}
        <ShowcaseModuleGrid
          title="Indicações e Fidelidade"
          subtitle="Programas para engajar clientes e gerar novas oportunidades"
          modules={loyaltyModules}
        />
        
        {/* Access Profiles */}
        <ShowcaseAccessProfiles />
      </main>
      
      <ShowcaseFooter />
    </div>
  );
};

export default SystemShowcasePage;
