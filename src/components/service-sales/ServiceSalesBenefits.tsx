import { ServiceData } from "@/pages/ServiceSalesPage";
import { Check } from "lucide-react";

const defaultBenefits: Record<string, string[]> = {
  prospeccao_b2b: [
    "Busca de leads reais por nicho e localização",
    "Dados completos de empresas e contatos",
    "Exportação para CRM integrada",
    "Filtros avançados por segmento e região",
    "Atualização constante da base de dados",
    "Integração com seu funil de vendas",
  ],
  pontuacao: [
    "Sistema de cashback personalizado",
    "Campanhas de pontuação flexíveis",
    "QR Codes para resgate fácil",
    "Dashboard de engajamento em tempo real",
    "Aumento da recorrência de clientes",
    "Relatórios de fidelização detalhados",
  ],
  testes: [
    "Avaliações comportamentais DISC completas",
    "Testes de conhecimento personalizáveis",
    "Pesquisas de clima organizacional",
    "Relatórios detalhados por colaborador",
    "Perfil comportamental individual",
    "Suporte à tomada de decisão estratégica",
  ],
  rh: [
    "Pipeline completo de recrutamento",
    "Publicação e gestão de vagas",
    "Avaliações 360° de desempenho",
    "Banco de talentos com IA",
    "Análise inteligente de currículos",
    "Controle do ciclo de seleção",
  ],
  board: [
    "Board estratégico virtual completo",
    "Organização de pautas de reunião",
    "Registro de decisões e deliberações",
    "Planos de ação com acompanhamento",
    "Histórico de todas as reuniões",
    "Acesso seguro para diretoria",
  ],
  trafego_pago: [
    "Dashboard de campanhas em tempo real",
    "Métricas de ROI e custo por lead",
    "Integração com Google e Meta Ads",
    "Relatórios automatizados de performance",
    "Otimização baseada em dados",
    "Acompanhamento de conversões",
  ],
  funil_vendas: [
    "Funil visual com etapas customizáveis",
    "Previsão de receita automática",
    "Taxas de conversão por etapa",
    "Alertas de oportunidades paradas",
    "Gestão completa de oportunidades",
    "Histórico de cada negociação",
  ],
  diretor_comercial_ia: [
    "Diagnósticos comerciais em tempo real",
    "Score de saúde do negócio (0-100)",
    "Insights estratégicos com IA",
    "Plano de crescimento personalizado",
    "Simulações de cenários futuros",
    "Análise contínua dos seus KPIs",
  ],
  gestao_clientes: [
    "CRM completo para gestão de clientes",
    "Controle de vendas com metas",
    "Gestão financeira (pagar/receber/DRE)",
    "Controle de estoque com alertas",
    "Agenda de agendamentos profissional",
    "Fluxo de caixa integrado",
  ],
  unv_academy: [
    "Trilhas de aprendizado completas",
    "Vídeo-aulas com acompanhamento",
    "Quizzes e certificados automáticos",
    "Gamificação com pontos e badges",
    "Ranking e competição saudável",
    "Progresso individual de cada aluno",
  ],
  instagram: [
    "Métricas de alcance e engajamento",
    "Análise de crescimento de seguidores",
    "Análises estratégicas com IA",
    "Benchmark de concorrentes",
    "Score do perfil e sugestões",
    "Conteúdo personalizado por IA",
  ],
  contrato_rotina: [
    "Estruturação de rotinas diárias",
    "Rotinas semanais otimizadas",
    "Análise por inteligência artificial",
    "PDF institucional profissional",
    "Diagnóstico de produtividade",
    "Implementação orientada por dados",
  ],
  unv_disparador: [
    "Disparos em massa via WhatsApp",
    "Campanhas segmentadas inteligentes",
    "Mensagens automáticas programáveis",
    "Taxas de entrega e leitura",
    "Comunicação ágil com clientes",
    "Templates pré-configurados",
  ],
};

interface Props {
  service: ServiceData;
}

export function ServiceSalesBenefits({ service }: Props) {
  const config = service.landing_page_config || {};
  const benefits = config.benefits || defaultBenefits[service.menu_key] || [
    "Acesso completo ao módulo",
    "Suporte dedicado para dúvidas",
    "Atualizações automáticas incluídas",
    "Dashboard intuitivo e fácil de usar",
    "Relatórios e métricas detalhados",
    "Integração com outros módulos UNV",
  ];

  return (
    <section className="py-20 px-4 bg-[hsl(214,65%,18%)]">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          O que está incluso
        </h2>
        <p className="text-white/50 text-center mb-12 text-lg">
          Tudo que você precisa para potencializar seus resultados
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {benefits.map((benefit: string, index: number) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[hsl(355,85%,50%)]/30 transition-colors"
            >
              <div className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-full bg-[hsl(355,85%,50%)]/15 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-[hsl(355,85%,50%)]" />
              </div>
              <span className="text-white/90 text-sm leading-relaxed">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
