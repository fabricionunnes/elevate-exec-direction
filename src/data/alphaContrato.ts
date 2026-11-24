/**
 * Cláusulas próprias do UNV Mastermind Alpha no gerador de contratos.
 * Entram no lugar das cláusulas 3ª (formato) e 4ª (vigência) do modelo geral
 * quando o produto escolhido é o Alpha. A forma de pagamento fica na 5ª
 * (buildInvestimentoContent com alpha: true) e a rescisão segue a cláusula padrão
 * (aviso prévio de 30 dias), decisão do Fabrício em 24/11/2026.
 */

export const ALPHA_PRODUCT_ID = "mastermind-alpha";

export const isAlpha = (productId?: string | null) => productId === ALPHA_PRODUCT_ID;

export const ALPHA_CAPITAL = 6000;

/** Texto da exclusividade: só existe quando o Fabrício concede na conversa. */
function exclusividadeTexto(segmento?: string | null): string {
  const s = (segmento || "").trim();
  if (s) {
    return `VII. Exclusividade de segmento: a CONTRATADA concede à CONTRATANTE exclusividade no segmento de ${s} durante a vigência deste contrato, de modo que nenhuma outra empresa desse segmento será admitida na turma enquanto este contrato estiver vigente e adimplente.`;
  }
  return "VII. Exclusividade de segmento: este contrato NÃO inclui exclusividade de segmento. Outras empresas do mesmo segmento da CONTRATANTE podem participar da turma.";
}

export function buildAlphaFormato(segmento?: string | null): string {
  return [
    "I. O UNV Mastermind Alpha é um programa em turma fechada de até 60 (sessenta) empresários, com duração de 12 (doze) meses, conduzido por Fabrício Nunes, com foco no crescimento do lucro líquido da empresa da CONTRATANTE.",
    "II. Encontros presenciais: 1 (um) encontro por mês, aos sábados, das 14h às 20h, em Alphaville, Nova Lima/MG, no local informado pela CONTRATADA, conforme o calendário anual da turma divulgado pela CONTRATADA. Em 2 (dois) meses do ano o encontro presencial é substituído por um GP de kart, em dia inteiro, com almoço.",
    "III. Encontros online: 1 (um) encontro por mês de prestação de contas, por videoconferência, cerca de 15 (quinze) dias depois de cada encontro presencial.",
    "IV. Também integram o programa: 3 (três) conselhos individuais de 45 (quarenta e cinco) minutos com Fabrício Nunes, nos meses 1, 6 e 11; acesso ao sistema UNV Nexus Alpha durante a vigência; a mesa de negócios (células, rodada de pedidos, um a um mensal, Vitrine Alpha e placar de negócios); o grupo de WhatsApp da turma; e o kit de boas-vindas com o cartão de membro.",
    "V. A CONTRATADA poderá alterar a data ou o local de um encontro por motivo relevante, comunicando a CONTRATANTE com antecedência mínima de 15 (quinze) dias, salvo caso fortuito ou força maior.",
    "VI. A participação é pessoal e intransferível do representante da CONTRATANTE que assina este contrato. A ausência em encontros não gera reposição, desconto ou abatimento nas mensalidades.",
    exclusividadeTexto(segmento),
    "VIII. As informações compartilhadas pelos membros nos encontros, no grupo e no sistema são confidenciais e não podem ser divulgadas a terceiros, durante e após a vigência deste contrato.",
    `IX. Capital do Próximo Salto: ao final dos 12 (doze) meses, a CONTRATADA fará um aporte de R$ 6.000,00 (seis mil reais), por PIX, na conta da empresa da CONTRATANTE, desde que a CONTRATANTE cumpra, cumulativamente, os 3 (três) critérios abaixo:
(a) as 12 (doze) mensalidades pagas, todas em dia;
(b) presença em pelo menos 10 (dez) dos 12 (doze) encontros presenciais;
(c) o sistema UNV Nexus Alpha alimentado todos os meses, com o fechamento do mês feito até o dia 10 (dez) do mês seguinte.`,
    "X. O Capital do Próximo Salto só é devido com os 3 (três) critérios cumpridos por inteiro. Se o contrato for cancelado ou rescindido antes do fim dos 12 (doze) meses, por qualquer motivo, ou se qualquer critério deixar de ser cumprido, a CONTRATANTE não terá direito a nenhum valor do Capital, nem integral nem proporcional, e nenhuma quantia já paga será restituída a esse título.",
    "XI. O aporte será feito em até 30 (trinta) dias após o último encontro da turma, e deve ser aplicado pela CONTRATANTE no primeiro passo do ciclo seguinte, como a contratação de um vendedor, investimento em tráfego ou um agente de inteligência artificial.",
  ].join("\n\n");
}

export const ALPHA_VIGENCIA =
  "O presente contrato terá vigência de 12 (doze) meses, contados a partir da assinatura, abrangendo os 12 (doze) encontros do calendário da turma. A renovação depende de novo acordo entre as partes.";
