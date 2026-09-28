// Leitura do contrato da empresa: periodicidade e próxima renovação.
//
// Por que existe: a tela testava `payment_method === "monthly"` pra decidir se o
// contrato era recorrente. Só que `payment_method` guarda a FORMA de pagamento
// (PIX, Cartão de Crédito, boleto — em boa parte dos cadastros é o UUID da opção
// em crm_payment_method_options), não a periodicidade. Quem diz a periodicidade
// é `renewal_plan_type`.
//
// O teste antigo só acertava nas 8 empresas em que alguém digitou "monthly" no
// campo de forma de pagamento. As outras 39 mensais caíam no caminho da data e
// apareciam com o fim do PRIMEIRO ciclo — 11 delas em vermelho, "vencido", sendo
// que contrato mensal não vence, renova. (Fabrício, 28/09/2026.)

export interface ContratoEmpresa {
  renewal_plan_type?: string | null;
  payment_method?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
}

/** Contrato que se renova sozinho todo mês: não tem data de vencimento. */
export function ehRecorrente(c: ContratoEmpresa | null | undefined): boolean {
  const plano = String(c?.renewal_plan_type || "").trim().toLowerCase();
  if (plano === "monthly" || plano === "mensal") return true;
  // Legado: cadastros antigos gravaram a periodicidade no campo de forma de
  // pagamento. Continua valendo pra não mudar o que já estava certo.
  const pgto = String(c?.payment_method || "").trim().toLowerCase();
  return pgto === "monthly" || pgto === "mensal";
}

/**
 * Próxima renovação de um contrato mensal: o próximo aniversário da data de
 * início que ainda não passou. Nunca devolve data no passado.
 * Dia 31 em mês de 30 cai no último dia do mês, igual a cobrança.
 */
export function proximaRenovacaoMensal(inicio: string | null | undefined): Date | null {
  if (!inicio) return null;
  const base = new Date(`${String(inicio).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dia = base.getDate();
  const proxima = new Date(base);
  // avança de mês em mês até passar de hoje
  let voltas = 0;
  while (proxima < hoje && voltas < 600) {
    const mes = proxima.getMonth();
    proxima.setDate(1);                       // evita o pulo de mês no dia 31
    proxima.setMonth(mes + 1);
    const ultimoDia = new Date(proxima.getFullYear(), proxima.getMonth() + 1, 0).getDate();
    proxima.setDate(Math.min(dia, ultimoDia));
    voltas++;
  }
  return proxima >= hoje ? proxima : null;
}
