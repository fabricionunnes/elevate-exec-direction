// Traduz o erro de entrega da API oficial do WhatsApp (Meta) para português.
// O texto gravado vem em inglês no formato "<código> <título> — <detalhe>".
const POR_CODIGO: Record<string, string> = {
  "131026": "Mensagem não pôde ser entregue. O número pode não ter WhatsApp, estar com o app desatualizado ou não ter aceitado os termos.",
  "131048": "Limite de envio por suspeita de spam. A Meta restringiu a quantidade de mensagens deste número por causa de bloqueios ou denúncias.",
  "131049": "A Meta não entregou para preservar a experiência do usuário: esse contato já recebeu muitas mensagens de marketing de empresas nos últimos dias. Tente de novo mais tarde.",
  "131042": "Problema de pagamento na conta do WhatsApp Business. Regularize a forma de pagamento no Gerenciador de Negócios da Meta.",
  "141006": "Problema de pagamento na conta do WhatsApp Business. Regularize a forma de pagamento no Gerenciador de Negócios da Meta.",
  "130472": "O número deste contato faz parte de um experimento da Meta e não recebe mensagens de marketing agora.",
  "131047": "Passaram mais de 24 horas desde a última resposta do contato. Só é possível enviar um modelo de mensagem aprovado.",
  "131051": "Tipo de mensagem não suportado.",
  "131052": "Não foi possível baixar a mídia enviada pelo contato.",
  "131053": "Não foi possível enviar a mídia. Confira o formato e o tamanho do arquivo.",
  "131056": "Muitas mensagens para o mesmo contato em pouco tempo. Aguarde um pouco e tente de novo.",
  "131021": "O destinatário não pode ser o mesmo número que envia.",
  "131031": "A conta do WhatsApp Business foi bloqueada pela Meta.",
  "131045": "Número de envio não está registrado corretamente na Meta.",
  "131000": "Erro interno da Meta. Tente de novo em instantes.",
  "131016": "Serviço da Meta indisponível no momento. Tente de novo em instantes.",
  "131005": "Acesso negado pela Meta. Confira as permissões do token.",
  "131008": "Faltou um campo obrigatório no envio.",
  "131009": "Algum dado do envio está inválido.",
  "130429": "Limite de velocidade de envio atingido. Aguarde um pouco e tente de novo.",
  "130497": "A conta não pode enviar mensagens para contatos deste país.",
  "132000": "O número de variáveis não bate com o modelo de mensagem.",
  "132001": "Modelo de mensagem não existe ou ainda não foi aprovado neste idioma.",
  "132005": "O texto do modelo ficou longo demais depois de preencher as variáveis.",
  "132007": "O modelo de mensagem viola as políticas da Meta.",
  "132012": "Variáveis do modelo em formato inválido.",
  "132015": "Modelo de mensagem pausado pela Meta por baixa qualidade.",
  "132016": "Modelo de mensagem desativado pela Meta por baixa qualidade.",
  "133010": "Número de envio não registrado na API do WhatsApp.",
  "190": "Token de acesso da Meta expirado. Reconecte a conta.",
};

export function waErrorPt(raw?: string | null): string {
  const txt = String(raw || "").trim();
  if (!txt) return "";
  const code = txt.match(/^\(?#?(\d{3,6})\)?/)?.[1];
  if (code && POR_CODIGO[code]) return `${POR_CODIGO[code]} (código ${code})`;
  return txt;
}
