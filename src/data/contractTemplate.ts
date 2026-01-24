/**
 * Template de cláusulas contratuais padrão - Universidade Nacional de Vendas
 */

export interface ContractClause {
  id: string;
  title: string;
  content: string;
  isDynamic?: boolean; // For clauses with dynamic content
}

export const contractClauses: ContractClause[] = [
  {
    id: "objeto",
    title: "CLÁUSULA 1ª - OBJETO",
    content: "O presente contrato tem por objeto a prestação dos serviços descritos neste instrumento, conforme especificações e entregáveis detalhados na Cláusula 2ª."
  },
  {
    id: "entrega",
    title: "CLÁUSULA 2ª - ENTREGA DOS SERVIÇOS",
    content: "Durante a vigência do contrato, a CONTRATADA se compromete a entregar os serviços do plano contratado, conforme descrito abaixo:",
    isDynamic: true
  },
  {
    id: "formato",
    title: "CLÁUSULA 3ª - FORMATO DO PROGRAMA",
    content: `I. A CONTRATADA disponibilizará acesso a um gerente de conta e canais diretos de suporte via WhatsApp para alinhamentos durante a vigência do contrato.

II. Os serviços serão prestados de forma 100% online, com reuniões mensais (quando previstas no pacote contratado) por videoconferência.

III. Todo conteúdo será produzido e entregue mensalmente, de acordo com o cronograma definido pela CONTRATADA.

IV. O material publicado permanecerá no perfil da CONTRATANTE, porém as artes e arquivos editáveis são de uso exclusivo durante o contrato, não sendo entregues em sua totalidade após o fim da prestação de serviço.`
  },
  {
    id: "vigencia",
    title: "CLÁUSULA 4ª - VIGÊNCIA",
    content: "O presente contrato terá vigência de tempo indeterminada, contados a partir da assinatura, podendo ser renovado automaticamente ou mediante novo acordo entre as partes."
  },
  {
    id: "investimento",
    title: "CLÁUSULA 5ª - INVESTIMENTO E CONDIÇÕES DE PAGAMENTO",
    content: `I. O valor do presente contrato será conforme especificado nas condições comerciais deste instrumento.

II. O pagamento deverá ser realizado na forma e condições acordadas.

III. Em caso de atraso no pagamento, incidirão:
• Multa moratória de 2%
• Juros de mora de 1% ao dia

IV. Este contrato caracteriza-se como prestação de serviço com pagamento parcelado. O não uso dos serviços não isenta a CONTRATANTE do pagamento das parcelas acordadas.

V. A rescisão poderá ser feita com aviso prévio de 30 dias do vencimento da próxima parcela.`
  },
  {
    id: "confidencialidade",
    title: "CLÁUSULA 6ª - CONFIDENCIALIDADE E DIREITOS AUTORAIS",
    content: `I. Todo material, identidade visual, roteiros e estratégias desenvolvidas são de propriedade intelectual da CONTRATADA.

II. É vedada a reprodução, comercialização ou uso indevido do material fora do escopo do contrato.

III. A CONTRATADA compromete-se a manter em sigilo todas as informações fornecidas pela CONTRATANTE.`
  },
  {
    id: "conduta",
    title: "CLÁUSULA 7ª - CONDUTA E ÉTICA",
    content: `I. Ambas as partes comprometem-se com uma relação ética e respeitosa.

II. Fica proibida a tentativa de contratação direta de membros da equipe da CONTRATADA por até 180 dias após o encerramento deste contrato, sob pena de multa de 50% do valor total contratado.`
  },
  {
    id: "disposicoes",
    title: "CLÁUSULA 8ª - DISPOSIÇÕES GERAIS",
    content: `I. A CONTRATANTE declara ter lido e entendido os termos do contrato, estando de acordo com todas as cláusulas.

II. O foro eleito para dirimir qualquer questão será o da Comarca de Nova Lima/MG.`
  }
];

export const companyInfo = {
  name: "UNIVERSIDADE NACIONAL DE VENDAS LTDA",
  cnpj: "51.356.237/0001-40",
  address: "Rua Araguaia, 130, Alphaville Lagoa dos Ingleses, Nova Lima, MG, CEP 34.018-150",
  email: "fabricio@universidadevendas.com.br",
  representative: "FABRÍCIO AUGUSTO NUNES OLIVEIRA",
  cpf: "078.102.716-01",
  rg: "MG 14.314.694",
  role: "CEO",
  city: "Nova Lima",
  state: "MG",
  foro: "Comarca de Nova Lima/MG"
};
