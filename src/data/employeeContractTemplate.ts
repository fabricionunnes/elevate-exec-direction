/**
 * Template de contrato de prestação de serviços autônomos com colaboradores
 * A CLÁUSULA PRIMEIRA (DO OBJETO) muda de acordo com o cargo selecionado
 */

export interface EmployeeContractClause {
  id: string;
  title: string;
  content: string;
  isDynamic?: boolean; // True for clauses that change per role
}

// Dynamic CLÁUSULA PRIMEIRA content per role
export const clauseFirstByRole: Record<string, string> = {
  consultor: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços de gerenciamento de vendas (Consultor conduzir o cliente no processo de entrega dos serviços da CONTRATANTE) de todos os produtos da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Reuniões periódicas com empresários
- Acompanhamento de vendedores nos grupos das empresas parceiras
- Criação e acompanhamento de estratégias de vendas
- Seguir os processos estipulados pela CONTRATANTE
- Gravar todas as reuniões com empresários e/ou vendedores
- Ministrar aulas em grupo de 1 a 2 vezes na semana para vendedores
- Mandar relatórios semanais e diários para as empresas parceiras do que foi feito
- Preenchimento de planilhas, relatórios e sistemas estipulados pela CONTRATANTE
- Reuniões diárias de treinamentos com vendedores, empresários ou gestores parceiros da CONTRATANTE
- A CONTRATADA é obrigada a gravar 100% (cem por cento) das gravações com os clientes da CONTRATANTE caso não seja realizado será descontado na remuneração da CONTRATADA.
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. Considerando o presente Termo Aditivo ao Contrato celebrado, em que as partes concordam com os termos e condições a seguir relacionados à não concorrência:
1.4. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes com as atividades de serviços de gerenciamento de vendas, consultoria, treinamento e controle de equipes utilizando materiais e/ou a metodologia da CONTRATANTE, objeto do presente contrato, durante o período de vigência deste contrato e por um período adicional de 5 (cinco) anos após o término deste, seja por rescisão, expiração ou qualquer outra forma.

2. Restrições
2.1. Durante o período de não concorrência, a CONTRATADA concorda em não oferecer serviços ou produtos que sejam similares ou concorrentes e que utilizem dos materiais da CONTRATANTE às atividades realizadas para a Contratante, exceto mediante consentimento prévio por escrito da Contratante.
3. Multa por Violação
3.1. Em caso de violação desta cláusula de não concorrência, a CONTRATADA concorda em pagar uma multa à Contratante no valor de R$ 50.000,00 (cinquenta mil reais), sem prejuízo de outras medidas legais cabíveis.
4. Disposições Gerais
4.1. Esta cláusula de não concorrência é considerada parte integrante do contrato original celebrado entre as partes e permanecerá em vigor mesmo após a expiração ou término do contrato principal.
4.2. Qualquer renúncia a esta cláusula de não concorrência deve ser feita por escrito e assinada por ambas as partes.`,

  closer: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços de vendas consultivas (Closer) de todos os produtos da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Conduzir reuniões de fechamento com leads qualificados
- Apresentar propostas comerciais e negociar condições
- Seguir os processos e scripts estipulados pela CONTRATANTE
- Gravar todas as reuniões de vendas com leads e prospects
- Atualizar o CRM com status e informações de cada negociação
- Preenchimento de relatórios de vendas e sistemas estipulados pela CONTRATANTE
- Participar de reuniões de alinhamento com o time comercial
- A CONTRATADA é obrigada a gravar 100% (cem por cento) das reuniões com os leads da CONTRATANTE caso não seja realizado será descontado na remuneração da CONTRATADA.
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes durante o período de vigência deste contrato e por um período adicional de 3 (três) anos após o término deste.`,

  sdr: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços de prospecção e qualificação de leads (SDR) de todos os produtos da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Prospecção ativa de potenciais clientes
- Qualificação de leads conforme critérios definidos pela CONTRATANTE
- Agendamento de reuniões para o time de closers
- Seguir os processos e cadências de prospecção estipulados pela CONTRATANTE
- Atualizar o CRM com informações de cada lead prospectado
- Preenchimento de relatórios e sistemas estipulados pela CONTRATANTE
- Participar de reuniões de alinhamento com o time comercial
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes durante o período de vigência deste contrato e por um período adicional de 3 (três) anos após o término deste.`,

  sdr_terceirizado: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços terceirizados de prospecção e qualificação de leads (SDR Terceirizado) para clientes da CONTRATANTE, fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Prospecção ativa de potenciais clientes para as empresas atendidas (clientes da CONTRATANTE)
- Qualificação de leads conforme critérios definidos pela CONTRATANTE e por cada cliente atendido
- Agendamento de reuniões para o time de closers da empresa atendida
- Seguir os processos e cadências de prospecção estipulados pela CONTRATANTE
- Atualizar o CRM com informações de cada lead prospectado
- Preenchimento de relatórios e sistemas estipulados pela CONTRATANTE
- Participar de reuniões de alinhamento com o time comercial e com os clientes atendidos
1.2. A CONTRATADA atuará exclusivamente como prestadora de serviço terceirizada, atendendo simultaneamente um ou mais clientes ativos indicados pela CONTRATANTE, sendo a remuneração calculada por cliente ativo conforme Cláusula Quinta.
1.3. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.`,

  cs: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços de Customer Success (CS) de todos os produtos da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Acompanhamento de clientes ativos para garantir o sucesso na utilização dos serviços
- Monitoramento de indicadores de satisfação e engajamento dos clientes
- Reuniões periódicas de acompanhamento com clientes
- Identificação de oportunidades de upsell e cross-sell
- Seguir os processos estipulados pela CONTRATANTE
- Gravar todas as reuniões com clientes
- Preenchimento de relatórios e sistemas estipulados pela CONTRATANTE
- A CONTRATADA é obrigada a gravar 100% (cem por cento) das reuniões com os clientes da CONTRATANTE caso não seja realizado será descontado na remuneração da CONTRATADA.
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes durante o período de vigência deste contrato e por um período adicional de 3 (três) anos após o término deste.`,

  head_comercial: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços de gestão comercial (Head Comercial) de todos os produtos da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Gestão e liderança do time comercial (SDRs, Closers)
- Definição e acompanhamento de metas de vendas
- Desenvolvimento de estratégias comerciais
- Análise de indicadores de performance da equipe
- Treinamento e desenvolvimento do time de vendas
- Seguir e aprimorar os processos estipulados pela CONTRATANTE
- Reuniões de alinhamento estratégico com a diretoria
- Preenchimento de relatórios gerenciais e sistemas estipulados pela CONTRATANTE
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes durante o período de vigência deste contrato e por um período adicional de 5 (cinco) anos após o término deste.`,

  rh: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços de Recursos Humanos de todos os produtos da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Gestão de processos seletivos e recrutamento
- Acompanhamento de onboarding de novos colaboradores
- Gestão de clima organizacional e cultura
- Administração de contratos e documentação de colaboradores
- Seguir os processos estipulados pela CONTRATANTE
- Preenchimento de relatórios e sistemas estipulados pela CONTRATANTE
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes durante o período de vigência deste contrato e por um período adicional de 3 (três) anos após o término deste.`,

  admin: `1. Objeto
1.1. O presente contrato tem por objeto a execução de serviços administrativos e de gestão da CONTRATANTE fora de suas dependências, sem controle de jornada, importando na realização dos seguintes procedimentos:

- Gestão administrativa e operacional
- Supervisão de processos internos
- Coordenação de equipes e departamentos
- Análise de indicadores e relatórios gerenciais
- Seguir e aprimorar os processos estipulados pela CONTRATANTE
- Preenchimento de relatórios e sistemas estipulados pela CONTRATANTE
1.2. Todos os procedimentos cobertos pelo contrato estão de acordo com os termos do DEL 5452 (CLT) sobretudo o disposto no artigo 442-B do referido instrumento, e de acordo com os termos e condições detalhados neste contrato, afastando qualquer tipo de relação de emprego entre as partes.
1.3. A CONTRATADA compromete-se a não se envolver direta ou indiretamente em atividades concorrentes durante o período de vigência deste contrato e por um período adicional de 5 (cinco) anos após o término deste.`,
};

// Default fallback for roles not specifically defined
export const clauseFirstDefault = clauseFirstByRole.consultor;

// Commission tier structure for building dynamic payment clauses
export interface CommissionTier {
  minPercent: number;
  maxPercent: number | null; // null = unlimited
  value: string; // e.g. "R$ 1.200,00" or "5%"
  label: string; // description for the contract text
}

// Unit used for tiers: by default "percent" (% of meta).
// For SDR Terceirizado we use "clients" (number of active client companies).
export type CommissionUnit = "percent" | "clients";

export interface RoleCommissionConfig {
  hasCommission: boolean;
  description: string; // What the commission is based on (meta, vendas, reuniões, etc.)
  tiers: CommissionTier[];
  unit?: CommissionUnit;
}

// Default commission configs per role
export const defaultCommissionByRole: Record<string, RoleCommissionConfig> = {
  closer: {
    hasCommission: true,
    description: "atingimento de meta de vendas",
    tiers: [
      { minPercent: 0, maxPercent: 70, value: "R$ 0,00", label: "Até 70% da meta — sem comissão" },
      { minPercent: 70, maxPercent: 85, value: "R$ 1.200,00", label: "Entre 70% e 85% da meta — comissão de R$ 1.200,00" },
      { minPercent: 85, maxPercent: 100, value: "R$ 2.000,00", label: "Entre 85% e 99% da meta — comissão de R$ 2.000,00" },
      { minPercent: 100, maxPercent: 120, value: "R$ 3.000,00", label: "Entre 100% e 120% da meta — comissão de R$ 3.000,00" },
      { minPercent: 120, maxPercent: 150, value: "R$ 5.000,00", label: "Entre 120% e 150% da meta — comissão de R$ 5.000,00" },
    ],
  },
  sdr: {
    hasCommission: true,
    description: "atingimento de meta de reuniões qualificadas",
    tiers: [
      { minPercent: 0, maxPercent: 70, value: "R$ 0,00", label: "Até 70% da meta — sem comissão" },
      { minPercent: 70, maxPercent: 85, value: "R$ 800,00", label: "Entre 70% e 85% da meta — comissão de R$ 800,00" },
      { minPercent: 85, maxPercent: 100, value: "R$ 1.200,00", label: "Entre 85% e 99% da meta — comissão de R$ 1.200,00" },
      { minPercent: 100, maxPercent: 120, value: "R$ 2.000,00", label: "Entre 100% e 120% da meta — comissão de R$ 2.000,00" },
      { minPercent: 120, maxPercent: 150, value: "R$ 3.000,00", label: "Entre 120% e 150% da meta — comissão de R$ 3.000,00" },
    ],
  },
  consultor: {
    hasCommission: true,
    description: "atingimento de meta de renovações",
    tiers: [
      { minPercent: 0, maxPercent: 70, value: "R$ 0,00", label: "Até 70% da meta — sem comissão" },
      { minPercent: 70, maxPercent: 85, value: "R$ 1.000,00", label: "Entre 70% e 85% da meta — comissão de R$ 1.000,00" },
      { minPercent: 85, maxPercent: 100, value: "R$ 1.500,00", label: "Entre 85% e 99% da meta — comissão de R$ 1.500,00" },
      { minPercent: 100, maxPercent: 120, value: "R$ 2.500,00", label: "Entre 100% e 120% da meta — comissão de R$ 2.500,00" },
      { minPercent: 120, maxPercent: 150, value: "R$ 4.000,00", label: "Entre 120% e 150% da meta — comissão de R$ 4.000,00" },
    ],
  },
  head_comercial: {
    hasCommission: true,
    description: "atingimento de meta da equipe comercial",
    tiers: [
      { minPercent: 0, maxPercent: 70, value: "R$ 0,00", label: "Até 70% da meta — sem comissão" },
      { minPercent: 70, maxPercent: 100, value: "R$ 2.000,00", label: "Entre 70% e 99% da meta — comissão de R$ 2.000,00" },
      { minPercent: 100, maxPercent: 150, value: "R$ 5.000,00", label: "Entre 100% e 150% da meta — comissão de R$ 5.000,00" },
    ],
  },
  cs: { hasCommission: false, description: "", tiers: [] },
  rh: { hasCommission: false, description: "", tiers: [] },
  admin: { hasCommission: false, description: "", tiers: [] },
  master: { hasCommission: false, description: "", tiers: [] },
};

// Build the payment clause text from commission config
export function buildPaymentClauseText(commissionConfig: RoleCommissionConfig): string {
  const base = `5.1 Os serviços OBJETO deste contrato serão remunerados pela quantia especificada neste instrumento. O CONTRATANTE deverá efetuar o pagamento até o quinto dia útil do mês subsequente, por pagamento de boleto enviado, servindo o comprovante de pagamento como recibo de pagamento para todos os efeitos legais. Deverá a CONTRATADA emitir Recibo de Pagamento de Autônomo (RPA) ou nota fiscal a cada mês de serviço prestado.
5.2 A CONTRATADA apresentará ao CONTRATANTE, em formulário próprio, até o último dia de cada mês o memorial descritivo, contendo todos os atendimentos prestados durante o mês anterior.`;

  if (!commissionConfig.hasCommission || commissionConfig.tiers.length === 0) {
    return base;
  }

  const tiersText = commissionConfig.tiers.map((t) => `- ${t.label}`).join("\n");

  return `${base}
5.3 COMISSÃO: Além da remuneração fixa, a CONTRATADA fará jus a comissão variável conforme ${commissionConfig.description}, nas seguintes faixas:
${tiersText}
As comissões serão pagas no mês subsequente ao período de apuração.`;
}

// Legacy compat: build clausePaymentByRole dynamically
export const clausePaymentByRole: Record<string, string> = Object.fromEntries(
  Object.entries(defaultCommissionByRole).map(([role, config]) => [role, buildPaymentClauseText(config)])
);

export const clausePaymentDefault = clausePaymentByRole.consultor;

export const employeeContractClauses: EmployeeContractClause[] = [
  {
    id: "objeto",
    title: "CLÁUSULA PRIMEIRA - DO OBJETO",
    content: "", // Will be filled dynamically based on role
    isDynamic: true,
  },
  {
    id: "obrigacoes_contratante",
    title: "CLÁUSULA SEGUNDA - OBRIGAÇÕES DO CONTRATANTE",
    content: `2.1 O CONTRATANTE deverá fornecer à CONTRATADA todas as informações necessárias à realização do serviço, devendo especificar os detalhes necessários à perfeita consecução do contrato.`,
  },
  {
    id: "obrigacoes_contratada",
    title: "CLÁUSULA TERCEIRA - OBRIGAÇÕES DA CONTRATADA",
    content: `3.1 A CONTRATADA deverá prestar serviços e atendimentos conforme descritivo e especificações, cabendo alteração por deliberação das partes.
3.2 A CONTRATADA se obriga a manter absoluto sigilo sobre os dados a que tem acesso, sejam de clientes, terceiros ou da própria CONTRATANTE, atendimentos e informações que tomar conhecimento por força deste contrato, mesmo após a conclusão dos serviços ou do término da relação contratual sob pena de responsabilização civil e criminal.
3.3 Os contratos, informações, dados, materiais e documentos inerentes ao CONTRATANTE ou a seus clientes deverão ser utilizados, pela CONTRATADA, estritamente para cumprimento dos serviços solicitados pela CONTRATANTE, sendo VEDADO a comercialização ou utilização para outros fins.
3.4 A CONTRATADA se obriga a aplicar todos os recursos e técnicas disponíveis para atender as demandas indicadas e criar soluções para os procedimentos propostos.
3.5 A CONTRATADA se obriga a cumprir agenda mínima semanal de 31 atendimentos semanais de 1 (uma) hora em seu próprio escritório e de forma autônoma por 3 meses, prorrogáveis por mais 3 meses nos termos da cláusula 3.1. A CONTRATADA terá autonomia para delimitar seus horários de trabalho, respeitando a jornada de trabalho dos clientes do CONTRATANTE. As atividades serão medidas e quitadas mensalmente, considerando as horas trabalhadas e/ou as tarefas realizadas durante o período.
3.6 É de responsabilidade da CONTRATADA comunicar a impossibilidade de cumprimento da agenda, bem como os motivos para tal em até 72 (setenta e duas) horas antes dos atendimentos. Nos dias e horários da prestação de serviços ora contratados, a CONTRATADA poderá, face o caráter empresarial/autônomo de sua prestação de serviços, escolher livremente o profissional que realiza os atendimentos junto à CONTRATANTE, contudo, deve garantir o nível de excelência técnica e ética para CONTRATADA, além de se responsabilizar por eventuais indicações.
3.7 O descumprimento da agenda sem justificativa implicará no não recebimento dos valores correspondentes à prestação de serviços, com incidência de multa de 10% dos valores mensais que teria direito a receber a título de sanção pelo descumprimento contratual.
3.8 O abandono de qualquer tarefa indicada pela CONTRATADA ensejará a retenção de 30% (trinta por cento) de todo e qualquer honorário previsto, a título de multa não compensatória, autorizada desde já a sua compensação com honorários eventualmente devidos pela CONTRATANTE.
3.9 Pela autonomia dos serviços, a CONTRATADA é responsável pelo pagamento de todos os tributos diretos e indiretos resultantes da prestação dos serviços prestados e sobre ela incidentes, além de suas despesas trabalhistas e administrativas.
3.10 A CONTRATADA é responsável por todos os danos pessoais e materiais que venha a causar à CONTRATANTE ou a terceiros, por culpa ou dolo, ficando determinado que toda e qualquer intervenção especializada e seus efeitos, serão da responsabilidade exclusiva da CONTRATADA que a realizou.
3.11 A CONTRATADA é inteiramente responsável por corrigir e/ou refazer, conforme o caso, em no máximo 48 horas, por sua inteira conta e responsabilidade, os serviços em que se verificarem vícios ou incorreções resultantes de sua execução.
3.12 Além das obrigações e responsabilidades já estipuladas neste instrumento, a CONTRATADA compromete-se a observar as orientações técnicas da CONTRATANTE, especialmente no que diz respeito à qualidade e pontualidade na prestação dos serviços.
3.13 A CONTRATADA tem ciência e reconhece que a CONTRATANTE é uma prestadora de serviço na área de vendas que além de prezar pela excelência no atendimento aos clientes, deve cumprir de forma satisfatória os contratos com seus contratantes. Assim, o desrespeito, pela CONTRATADA, aos horários agendados para a prestação de serviços objeto do presente contrato, poderá ser causa de resolução motivada do presente Contrato.
3.14 A CONTRATADA declara conhecer o Código de Ética e o Regulamento Interno da CONTRATANTE, comprometendo-se, ainda, a observá-los estritamente.
3.15 A CONTRATADA deverá proteger adequadamente o patrimônio da CONTRATANTE e dos clientes desta, zelando pela conservação de suas instalações, equipamentos instrumentais e materiais, móveis e utensílios quando em serviço presencial.
3.16 A CONTRATADA é solidariamente responsável civil, penal e administrativamente pelos atos próprios ou de seus prepostos que venham a causar prejuízos aos diretores, funcionários e visitantes da CONTRATANTE ou dos clientes deste onde esteja executando os serviços ou a quaisquer terceiros.
Parágrafo Único: O CONTRATANTE, em caso de culpa grave ou de dolo por parte da CONTRATADA, poderá ingressar com ação de regresso em face da CONTRATADA para reaver os eventuais prejuízos que tenha suportado.
3.17 A CONTRATANTE terá livre acesso aos documentos, gravações, e-mails ou quaisquer trabalhos que evidenciem os serviços executados pela CONTRATADA, sendo-lhe facultado o direito de fiscalização no que se refere à conservação dos equipamentos e manutenção do padrão de qualidade dos serviços contratados.
3.18 A CONTRATADA assume, para todos os fins de direito, que é a única empregadora dos trabalhadores por ela utilizados na execução dos serviços objeto deste contrato, competindo-lhe total e exclusiva responsabilidade pelo atendimento de toda a legislação que rege tal relação jurídica e por todas as obrigações, despesas, encargos ou compromissos relacionados a estes empregados, inclusive se decorrentes de eventuais acidentes do trabalho, mesmo que ocorridos no interior das dependências da CONTRATANTE ou nos locais externos de prestação de serviços.`,
  },
  {
    id: "servicos",
    title: "CLÁUSULA QUARTA - DOS SERVIÇOS",
    content: `4.1 A CONTRATADA atuará nos serviços contratados de acordo com as especificações apontadas, que passa ser parte integrante do presente contrato.
4.2 Os serviços terão início na data especificada neste contrato.
4.3 Não há qualquer vínculo de emprego entre as partes em razão da celebração do presente instrumento, razão pela qual nenhum colaborador da CONTRATADA não se subordina como empregado em nenhuma hipótese e nem está sujeito ao poder diretivo da CONTRATANTE. A CONTRATADA pode exercer livremente suas atividades, quando o desejar, de acordo com sua conveniência, em qualquer horário, excetuando-se os dias e horários que se prontifiquem ao atendimento das demandas indicadas pela CONTRATANTE. Os equipamentos e ferramentas necessários para a execução dos serviços serão providenciados pela CONTRATANTE. A CONTRATADA trará sua expertise e conhecimento técnico para realizar as atividades.
4.4 A CONTRATADA atuará SEM EXCLUSIVIDADE dentro do segmento da CONTRATANTE, podendo exercer sua atividade para outras pessoas ou empresas, ou por conta própria, desde que não atue para outras empresas do mesmo setor em conflito de interesses.`,
  },
  {
    id: "pagamento",
    title: "CLÁUSULA QUINTA - DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO",
    content: "", // Will be filled dynamically based on role (includes commission)
    isDynamic: true,
  },
  {
    id: "descumprimento",
    title: "CLÁUSULA SEXTA - DO DESCUMPRIMENTO",
    content: `6.1 Além das demais penalidades já previstas, o descumprimento de qualquer uma das cláusulas por qualquer parte, implicará na rescisão imediata deste contrato, não isentando a CONTRATADA de suas responsabilidades referentes ao zelo com informações e dados da CONTRATANTE.`,
  },
  {
    id: "prazo",
    title: "CLÁUSULA SÉTIMA - DO PRAZO E VALIDADE",
    content: `7.1 Este instrumento é válido por 3 meses, com renovação automática pelo mesmo período se não houver manifestação expressa de alguma das partes. As partes não se isentam de seus compromissos éticos, principalmente no que concerne aos dados sigilosos após cumprimento ou invalidação do contrato.`,
  },
  {
    id: "rescisao",
    title: "CLÁUSULA OITAVA - DA RESCISÃO",
    content: `8.1 Poderá o presente instrumento ser rescindido por qualquer das partes, em qualquer momento, sem que haja qualquer tipo de motivo relevante, devendo então somente ser finalizadas e quitadas todas as obrigações decorrentes dos procedimentos já realizados.`,
  },
  {
    id: "disposicoes",
    title: "CLÁUSULA NONA - DAS DISPOSIÇÕES GERAIS",
    content: `9.1 Fica pactuada a total inexistência de vínculo trabalhista entre as partes ou quaisquer de seus empregados ou prestadores de serviços, excluindo as obrigações previdenciárias e os encargos sociais, não havendo entre CONTRATANTE e CONTRATADA qualquer tipo de relação de subordinação ou pessoalidade.
9.3 A tolerância, por qualquer das partes, com relação ao descumprimento de qualquer termo ou condição aqui ajustado, não será considerada como desistência em exigir o cumprimento de disposição nele contida, nem representará novação com relação à obrigação passada, presente ou futura, no tocante ao termo ou condição cujo descumprimento foi tolerado.
9.5 As Partes não poderão assumir qualquer obrigação em nome da outra ou, por qualquer forma ou condição, obrigar a outra parte perante terceiros.
9.6 Na excepcionalidade de o CONTRATANTE ser compelido a pagar qualquer importância, encargo ou indenização de responsabilidade da CONTRATADA, por imposição de órgão ou repartição pública, Juízo ou Tribunal, a CONTRATADA obriga-se a exonerá-la de qualquer obrigação, ressarcindo de imediato as importâncias que vierem a ser desembolsadas pela CONTRATANTE, incluindo, honorários de advogados, custas judiciais e demais despesas, principalmente em virtude de:
a) Reconhecimento judicial de vínculo empregatício de empregados da CONTRATADA com a CONTRATANTE;
b) Reconhecimento judicial de solidariedade ou subsidiariedade da CONTRATANTE, no cumprimento das obrigações trabalhistas, previdenciárias ou fiscais da CONTRATADA;
c) Multa e autuação de qualquer espécie ou condenação judicial de qualquer natureza, aplicada à CONTRATANTE em decorrência do presente Contrato.
d) Não-Oferta de Serviços: O Colaborador compromete-se a não ofertar, de maneira direta ou indireta, qualquer serviço ou produto a clientes da Universidade Nacional de Vendas LTDA, durante o período de vigência de seu contrato e pelos 3 (três) anos subsequentes ao término do mesmo.
e) Não-Concorrência: Durante o período de 3 (três) anos após o término do contrato de trabalho com a Universidade Nacional de Vendas LTDA, o Colaborador se compromete a não replicar, copiar, ou reproduzir as metodologias, práticas, sistemas ou processos utilizados pela Universidade Nacional de Vendas LTDA.
f) Penalidade: Caso ocorra violação dos termos acima mencionados, o Colaborador será responsabilizado pelas perdas e danos causados à Universidade Nacional de Vendas LTDA, estando sujeito a ações legais para ressarcimento de tais prejuízos além de uma multa no valor de R$ 50.000,00 (cinquenta mil reais).`,
  },
  {
    id: "foro",
    title: "CLÁUSULA DÉCIMA - DO FORO",
    content: `10.1 Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de Nova Lima do Estado de MG.`,
  },
];

export const employeeContractCompanyInfo = {
  name: "UNIVERSIDADE NACIONAL DE VENDAS LTDA",
  fantasyName: "UNIVERSIDADE NACIONAL DE VENDAS",
  cnpj: "51.356.237/0001-40",
  address: "Rua Araguaia, 130, Alphaville Lagoa dos Ingleses, Nova Lima, MG, CEP 34.018-150",
  email: "fabricio@universidadevendas.com.br",
  representative: "FABRÍCIO AUGUSTO NUNES OLIVEIRA",
  cpf: "078.102.716-0",
  rg: "MG 14.314.694",
  maritalStatus: "casado",
  role: "CEO",
  city: "Nova Lima",
  state: "MG",
  foro: "Comarca de Nova Lima do Estado de MG",
};

export const roleLabels: Record<string, string> = {
  consultor: "Consultor(a)",
  closer: "Closer",
  sdr: "SDR",
  cs: "Customer Success",
  head_comercial: "Head Comercial",
  rh: "Recursos Humanos",
  admin: "Administrativo",
  master: "Master",
};
