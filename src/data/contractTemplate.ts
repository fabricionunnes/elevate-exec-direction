/**
 * Template de cláusulas contratuais padrão - Universidade Nacional de Vendas
 */

export interface ContractClause {
  id: string;
  title: string;
  content: string;
  isDynamic?: boolean; // For clauses with dynamic content
}

export const rescisaoClause: ContractClause = {
  id: "rescisao",
  title: "CLÁUSULA 6ª - SOBRE RESCISÃO DE CONTRATO",
  content: `I. O CONTRATANTE que desejar rescindir o presente contrato deverá comunicar a CONTRATADA, por escrito, com antecedência mínima de 30 (trinta) dias do próximo vencimento, ficando obrigado ao pagamento integral da parcela referente ao período de aviso prévio.

II. A ausência de comunicação formal ou o não pagamento da parcela de aviso prévio na data de vencimento implicará na manutenção automática do contrato em pleno vigor, gerando regularmente as parcelas subsequentes, as quais serão devidas e exigíveis nos termos deste instrumento.

III. As parcelas vencidas e não pagas ficarão sujeitas a:
(a) multa moratória de 2% (dois por cento) sobre o valor do débito;
(b) juros de mora de 1% (um por cento) ao mês, calculados pro rata die;
(c) correção monetária pelo IGP-M/FGV ou índice que venha a substituí-lo;
(d) honorários advocatícios de 20% (vinte por cento) sobre o valor atualizado do débito, em caso de cobrança judicial ou extrajudicial, sem prejuízo das demais despesas processuais e custas judiciais.

IV. A rescisão contratual somente produzirá efeitos após o cumprimento integral do aviso prévio e a quitação de todos os valores devidos até a data efetiva do encerramento.`
};

// Item V da CLÁUSULA 5 quando o pagamento é CARTÃO DE CRÉDITO (pagamento integral antecipado):
// não cabe rescisão unilateral por desistência. ATENÇÃO: validar com advogado antes de uso.
export const RESCISAO_V_CARTAO =
  "V. Em razão de o pagamento ter sido realizado de forma integral e antecipada por meio de Cartão de Crédito, referente à contratação dos serviços ora ajustados, o presente contrato é celebrado em caráter IRRETRATÁVEL e IRREVOGÁVEL, não sendo admitida a rescisão unilateral pela CONTRATANTE por simples desistência ou arrependimento, nem cabível o reembolso dos valores pagos em razão da eventual não utilização dos serviços, permanecendo a CONTRATADA integralmente obrigada a disponibilizar e prestar os serviços contratados durante toda a vigência, nos termos deste instrumento e dos artigos 389 e 475 do Código Civil.";

// Item V padrão (PIX/Boleto parcelado/recorrente): mantém rescisão com aviso prévio.
export const RESCISAO_V_PADRAO =
  "V. A rescisão poderá ser feita com aviso prévio de 30 (trinta) dias do vencimento da próxima parcela.";

const PAYMENT_LABELS: Record<string, string> = {
  card: "Cartão de Crédito",
  pix: "PIX",
  boleto: "Boleto Bancário",
};

export interface InvestimentoFormData {
  paymentMethod: string;
  isRecurring: boolean;
  installments: number | null;
  contractValue: number;
  dueDay?: number | string | null;
}

function fmtBRL(v: number): string {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Monta o texto COMPLETO da CLÁUSULA 5 (itens I a V) a partir dos dados do formulário.
// Fica tudo editável no editor; o gerador do PDF usa este conteúdo como está.
export function buildInvestimentoContent(fd: InvestimentoFormData): string {
  const label = PAYMENT_LABELS[fd.paymentMethod] || fd.paymentMethod;
  const parts: string[] = [];
  if (fd.isRecurring) {
    parts.push(`I. O valor do presente contrato será de ${fmtBRL(fd.contractValue)} mensais, com cobrança recorrente.`);
    parts.push(`II. O pagamento será realizado mensalmente via ${label}, de forma recorrente.`);
    parts.push(`Parágrafo único — Desconto por pagamento antecipado: a CONTRATANTE terá 5% (cinco por cento) de desconto sobre o valor da parcela mensal caso efetue o pagamento até 1 (um) dia antes da data de vencimento. Caso a data de vencimento recaia em sábado, domingo ou feriado, o prazo para pagamento com desconto permanece sendo o dia imediatamente anterior à data de vencimento original, NÃO havendo prorrogação para data posterior. O desconto não se aplica a pagamentos realizados na data do vencimento ou após.`);
  } else {
    parts.push(`I. O valor total do presente contrato será de ${fmtBRL(fd.contractValue)}.`);
    if (fd.installments > 1) {
      parts.push(`II. O pagamento será realizado em ${fd.installments}x de ${fmtBRL(fd.contractValue / fd.installments)}, sem juros, via ${label}.`);
    } else {
      parts.push(`II. O pagamento será realizado à vista via ${label}.`);
    }
  }
  if (fd.dueDay) {
    // dia de vencimento sempre 1-31 (já chegou "2032" aqui por parse errado de data)
    const dd = Math.min(31, Math.max(1, Math.round(Number(fd.dueDay)) || 1));
    parts.push(`Vencimento: todo dia ${dd} de cada mês.`);
  }
  parts.push(`III. Em caso de atraso no pagamento, incidirão multa moratória de 2% (dois por cento) e juros de mora de 1% (um por cento) ao mês sobre o valor em atraso.`);
  parts.push(`IV. Este contrato caracteriza-se como prestação de serviço com pagamento ${fd.isRecurring ? "recorrente" : fd.installments > 1 ? "parcelado" : "à vista"}. O não uso dos serviços não isenta a CONTRATANTE do pagamento dos valores acordados.`);
  parts.push(fd.paymentMethod === "card" ? RESCISAO_V_CARTAO : RESCISAO_V_PADRAO);
  return parts.join("\n\n");
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
