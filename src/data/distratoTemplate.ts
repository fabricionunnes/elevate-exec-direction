/**
 * Template de cláusulas do Distrato - Universidade Nacional de Vendas
 */

export interface DistratoClause {
  id: string;
  title: string;
  content: string;
  isDynamic?: boolean;
}

export const distratoClauses: DistratoClause[] = [
  {
    id: "contrato_original",
    title: "CLÁUSULA 1 – DO CONTRATO ORIGINAL",
    content: "As partes declaram que celebraram entre si Contrato de Prestação de Serviços, firmado em {contract_date}, cujo objeto consistia na prestação de serviços relacionados a {service_description}.",
    isDynamic: true,
  },
  {
    id: "rescisao",
    title: "CLÁUSULA 2 – DA RESCISÃO",
    content: `Por meio do presente instrumento, as partes resolvem, de comum acordo, rescindir integralmente o contrato mencionado na cláusula anterior, encerrando todas as obrigações contratuais anteriormente assumidas.

A rescisão passa a produzir efeitos a partir da data de assinatura deste distrato.`,
  },
  {
    id: "quitacao",
    title: "CLÁUSULA 3 – DA QUITAÇÃO E INEXISTÊNCIA DE PENDÊNCIAS",
    content: `As partes declaram, para todos os fins de direito, que não existem quaisquer pendências financeiras, operacionais ou contratuais entre elas relacionadas ao contrato ora rescindido.

Com a assinatura do presente distrato, as partes concedem entre si plena, geral, irrevogável e irretratável quitação, nada mais tendo a reclamar ou exigir, a qualquer título, seja judicial ou extrajudicialmente.`,
  },
  {
    id: "confidencialidade",
    title: "CLÁUSULA 4 – DA CONFIDENCIALIDADE",
    content: "Permanecem válidas, mesmo após o encerramento contratual, eventuais obrigações de sigilo e confidencialidade assumidas entre as partes durante a vigência do contrato.",
  },
  {
    id: "foro",
    title: "CLÁUSULA 5 – DO FORO",
    content: "Para dirimir quaisquer controvérsias decorrentes deste distrato, as partes elegem o foro da comarca de Nova Lima/MG, renunciando a qualquer outro, por mais privilegiado que seja.",
  },
];

export const distratoCompanyInfo = {
  name: "UNIVERSIDADE NACIONAL DE VENDAS LTDA",
  cnpj: "51.356.237/0001-40",
  address: "Rua Araguaia, 130, Alphaville Lagoa dos Ingleses, Nova Lima, MG, CEP 34.018-150",
  representative: "Fabrício Nunnes",
  city: "Nova Lima",
  state: "MG",
  foro: "Comarca de Nova Lima/MG",
};
