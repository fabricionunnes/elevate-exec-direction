// UNV Mastermind Alpha: tipos do RPC alpha_painel e as contas do painel.
// Régua: DRE por competência (vencimento/competência do lançamento), caixa por pagamento.
// Lucro líquido = receita − deduções − custos variáveis − despesas fixas − financeiro.
// Investimento e retirada (participação de lucro) ficam abaixo do lucro e só mexem no caixa.

export type DreMes = {
  mes: number; receita: number; deducao: number; custo_variavel: number; pessoal: number; administrativa: number;
  comercial: number; sem_categoria: number; financeiro: number; investimento: number; retirada: number; lancamentos: number;
};
export type DfcMes = {
  mes: number; entradas: number; saidas_operacionais: number; saidas_financeiras: number; investimentos: number;
  retiradas: number; a_receber: number; a_pagar: number;
};
export type PlanoMes = {
  mes: number; receita: number; deducoes: number; custo_variavel: number; despesa_fixa: number; financeiro: number; investimento: number;
};
export type Plano = {
  ano: number; crescimento_pct: number; faturamento_ano_anterior: number | null; lucro_ano_anterior: number | null;
  reserva_caixa_alvo: number; pct_reinvestimento: number; saldo_caixa_inicial: number; observacoes: string | null;
};
export type Meta = {
  id: string; ano: number; mes: number | null; nivel: "empresa" | "produto" | "vendedor" | "indicador"; nome: string;
  unidade: "brl" | "qtd" | "pct"; meta: number; realizado: number | null; ordem: number;
};
export type Participacao = {
  ano: number; trimestre: number; lucro_apurado: number | null; reserva: number; reinvestimento: number;
  distribuido: number | null; status: "aberta" | "aprovada" | "paga"; pago_em: string | null; observacao: string | null;
};
export type Compromisso = { id: string; mes: string; texto: string; status: "aberto" | "cumprido" | "nao_cumprido"; created_at: string };
export type DespesaCategoria = { categoria: string; grupo: string; valor: number };

export type DadosAlpha = {
  ano: number; gerado_em: string; empresa: string | null;
  plano: Plano | null; plano_meses: PlanoMes[]; dre: DreMes[]; dfc: DfcMes[];
  despesas_categoria: DespesaCategoria[]; metas: Meta[]; participacoes: Participacao[]; compromissos: Compromisso[];
  fonte: { receber: number; pagar: number; ultimo_lancamento: string | null; origens: Record<string, number>; categorias_sem_grupo: number };
};

export const MESES_NOME = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MESES_CURTO = MESES_NOME.map((m) => m.slice(0, 3));

export const GRUPOS_DRE: { k: string; nome: string; tipo: "receita" | "despesa" }[] = [
  { k: "receita", nome: "Receita", tipo: "receita" },
  { k: "deducao", nome: "Impostos e deduções", tipo: "despesa" },
  { k: "custo_variavel", nome: "Custo variável", tipo: "despesa" },
  { k: "pessoal", nome: "Pessoal", tipo: "despesa" },
  { k: "administrativa", nome: "Administrativa", tipo: "despesa" },
  { k: "comercial", nome: "Comercial e marketing", tipo: "despesa" },
  { k: "financeiro", nome: "Financeiro (juros, tarifas)", tipo: "despesa" },
  { k: "investimento", nome: "Investimento", tipo: "despesa" },
  { k: "retirada", nome: "Retirada / participação de lucro", tipo: "despesa" },
];

export const despesaFixa = (m: DreMes) => m.pessoal + m.administrativa + m.comercial + m.sem_categoria;
export const lucroReal = (m: DreMes) => m.receita - m.deducao - m.custo_variavel - despesaFixa(m) - m.financeiro;
export const lucroPlano = (p: PlanoMes) => p.receita - p.deducoes - p.custo_variavel - p.despesa_fixa - p.financeiro;
export const despesaTotalReal = (m: DreMes) => m.deducao + m.custo_variavel + despesaFixa(m) + m.financeiro;
export const despesaTotalPlano = (p: PlanoMes) => p.deducoes + p.custo_variavel + p.despesa_fixa + p.financeiro;

/** Último mês fechado do ano consultado: ano passado = 12, ano atual = mês anterior, ano futuro = 0. */
export function ultimoMesFechado(ano: number, hoje = new Date()): number {
  const a = hoje.getFullYear();
  if (ano < a) return 12;
  if (ano > a) return 0;
  return hoje.getMonth(); // getMonth() é 0-based: em novembro devolve 10 (outubro fechado)
}

export const planoDoMes = (d: DadosAlpha, mes: number): PlanoMes | null => d.plano_meses.find((p) => p.mes === mes) ?? null;
export const soma = (xs: number[]) => xs.reduce((a, b) => a + (Number(b) || 0), 0);

export type Semaforo = "verde" | "amarelo" | "vermelho" | "sem_plano" | "sem_dados";
export function semaforo(real: number, plano: number, temPlano: boolean, temDados: boolean): Semaforo {
  if (!temPlano || plano === 0) return "sem_plano";
  if (!temDados) return "sem_dados";
  const r = plano > 0 ? real / plano : real >= plano ? 1 : 0;
  if (r >= 1) return "verde";
  if (r >= 0.85) return "amarelo";
  return "vermelho";
}
export const SEMAFORO_TXT: Record<Semaforo, { titulo: string; acao: string; cls: string }> = {
  verde: { titulo: "No plano", acao: "Lucro acumulado em 100% ou mais do planejado. Segue o ritmo e a participação de lucro sai no trimestre.", cls: "g" },
  amarelo: { titulo: "Atenção", acao: "Entre 85% e 99% do planejado. Montar plano de ação no próximo encontro online, com prazo e responsável.", cls: "a" },
  vermelho: { titulo: "Fora do plano", acao: "Abaixo de 85% do planejado. Hot seat obrigatório no presencial, revisão de despesas e conselho extra com o Fabrício.", cls: "r" },
  sem_plano: { titulo: "Sem planejamento", acao: "O ano ainda não foi planejado no sistema. Monte o plano na aba Planejamento.", cls: "n" },
  sem_dados: { titulo: "Sem lançamentos", acao: "Ainda não há vendas e despesas nos meses fechados. Conecte o sistema da empresa ou lance na aba Lançamentos.", cls: "n" },
};

export type Resumo = {
  fechado: number; temPlano: boolean; temDados: boolean;
  receitaAcum: number; receitaPlanoAcum: number; lucroAcum: number; lucroPlanoAcum: number;
  despesaAcum: number; despesaPlanoAcum: number; receitaAnoPlano: number; lucroAnoPlano: number;
  receitaAnoAnteriorMesmoPeriodo: number | null; crescimento: number | null; margem: number | null;
  projecaoLucroAno: number; projecaoReceitaAno: number; caixaAtual: number; status: Semaforo;
};

export function resumir(d: DadosAlpha, anterior: DadosAlpha | null): Resumo {
  const fechado = ultimoMesFechado(d.ano);
  const ate = (m: number) => m <= fechado;
  const dreF = d.dre.filter((m) => ate(m.mes));
  const planoF = d.plano_meses.filter((p) => ate(p.mes));
  const temPlano = d.plano_meses.some((p) => p.receita > 0);
  const temDados = dreF.some((m) => m.lancamentos > 0);
  const receitaAcum = soma(dreF.map((m) => m.receita));
  const lucroAcum = soma(dreF.map(lucroReal));
  const despesaAcum = soma(dreF.map(despesaTotalReal));
  const receitaPlanoAcum = soma(planoF.map((p) => p.receita));
  const lucroPlanoAcum = soma(planoF.map(lucroPlano));
  const despesaPlanoAcum = soma(planoF.map(despesaTotalPlano));
  const restantes = d.plano_meses.filter((p) => p.mes > fechado);
  const ant = anterior ? soma(anterior.dre.filter((m) => m.mes <= fechado).map((m) => m.receita)) : null;
  const caixaAtual = (d.plano?.saldo_caixa_inicial ?? 0) + soma(d.dfc.map((f) => f.entradas - f.saidas_operacionais - f.saidas_financeiras - f.investimentos - f.retiradas));
  return {
    fechado, temPlano, temDados, receitaAcum, receitaPlanoAcum, lucroAcum, lucroPlanoAcum, despesaAcum, despesaPlanoAcum,
    receitaAnoPlano: soma(d.plano_meses.map((p) => p.receita)), lucroAnoPlano: soma(d.plano_meses.map(lucroPlano)),
    receitaAnoAnteriorMesmoPeriodo: ant && ant > 0 ? ant : null,
    crescimento: ant && ant > 0 ? receitaAcum / ant - 1 : null,
    margem: receitaAcum > 0 ? lucroAcum / receitaAcum : null,
    projecaoLucroAno: lucroAcum + soma(restantes.map(lucroPlano)),
    projecaoReceitaAno: receitaAcum + soma(restantes.map((p) => p.receita)),
    caixaAtual,
    status: semaforo(lucroAcum, lucroPlanoAcum, temPlano, temDados),
  };
}

/** Saldo de caixa no fim de cada mês (DFC). */
export function saldosMensais(d: DadosAlpha): { mes: number; inicial: number; final: number }[] {
  let s = d.plano?.saldo_caixa_inicial ?? 0;
  return d.dfc.map((f) => {
    const inicial = s;
    s = s + f.entradas - f.saidas_operacionais - f.saidas_financeiras - f.investimentos - f.retiradas;
    return { mes: f.mes, inicial, final: s };
  });
}

export type Trimestre = {
  t: number; meses: number[]; fechado: boolean; receita: number; lucro: number; lucroPlano: number;
  caixaFim: number; sugestao: { reserva: number; reinvestimento: number; distribuir: number }; registro: Participacao | null;
};
export function trimestres(d: DadosAlpha): Trimestre[] {
  const fechado = ultimoMesFechado(d.ano);
  const saldos = saldosMensais(d);
  const alvo = d.plano?.reserva_caixa_alvo ?? 0;
  const pctRe = (d.plano?.pct_reinvestimento ?? 0) / 100;
  return [1, 2, 3, 4].map((t) => {
    const meses = [t * 3 - 2, t * 3 - 1, t * 3];
    const dre = d.dre.filter((m) => meses.includes(m.mes));
    const lucro = soma(dre.map(lucroReal));
    const caixaFim = saldos.find((s) => s.mes === t * 3)?.final ?? 0;
    const lucroPos = Math.max(lucro, 0);
    // reserva: o que falta pro caixa chegar no alvo, limitado ao lucro do trimestre
    const reserva = Math.min(lucroPos, Math.max(alvo - caixaFim, 0));
    const reinvestimento = (lucroPos - reserva) * pctRe;
    return {
      t, meses, fechado: fechado >= t * 3, receita: soma(dre.map((m) => m.receita)), lucro,
      lucroPlano: soma(d.plano_meses.filter((p) => meses.includes(p.mes)).map(lucroPlano)),
      caixaFim, sugestao: { reserva, reinvestimento, distribuir: Math.max(lucroPos - reserva - reinvestimento, 0) },
      registro: d.participacoes.find((p) => p.trimestre === t) ?? null,
    };
  });
}

/** Cronograma do ano do Alpha: o que cada encontro trabalha e o que precisa estar no sistema. */
export const CRONOGRAMA: { mes: number; tema: string; aula: string; sistema: string; marcos: string[] }[] = [
  { mes: 1, tema: "Planejamento anual", aula: "DRE do ano passado, meta de faturamento 15% maior, orçamento de despesas, meta de lucro e regra de distribuição.", sistema: "Planejamento anual preenchido e integrações ligadas.", marcos: ["Iniciação e kit", "Conselho: diagnóstico"] },
  { mes: 2, tema: "Metas estruturadas", aula: "A meta da empresa vira meta por mês, semana, produto e vendedor.", sistema: "Metas cadastradas e acompanhadas.", marcos: [] },
  { mes: 3, tema: "Margem e preço", aula: "Margem de contribuição por produto, política de desconto e o produto que dá lucro.", sistema: "Custos variáveis categorizados no DRE.", marcos: ["Fecha o 1º trimestre"] },
  { mes: 4, tema: "Despesas e caixa", aula: "Fluxo de caixa, corte de despesa que não gera receita e capital de giro.", sistema: "DFC conferido e despesas categorizadas.", marcos: ["1ª participação de lucro"] },
  { mes: 5, tema: "IA comercial", aula: "Agentes de IA no atendimento, no follow-up e na reativação de clientes.", sistema: "Vendas da IA lançadas e medidas.", marcos: ["GP de kart"] },
  { mes: 6, tema: "Revisão do semestre", aula: "Plano contra realizado e replanejamento do segundo semestre.", sistema: "Planejamento revisado de julho a dezembro.", marcos: ["Conselho: revisão", "Fecha o 2º trimestre"] },
  { mes: 7, tema: "Time e remuneração", aula: "Comissão ligada a meta e margem.", sistema: "Custo do time no DRE.", marcos: ["2ª participação de lucro"] },
  { mes: 8, tema: "Marketing e CAC", aula: "Investimento em mídia, custo por cliente e retorno por canal.", sistema: "Despesa comercial separada por canal.", marcos: [] },
  { mes: 9, tema: "Ticket e recorrência", aula: "Ticket médio, recompra e venda para a carteira.", sistema: "Receita da carteira separada da venda nova.", marcos: ["Fecha o 3º trimestre"] },
  { mes: 10, tema: "Processos e IA na operação", aula: "Automação que tira custo e libera o dono.", sistema: "Despesas cortadas medidas no DRE.", marcos: ["3ª participação de lucro"] },
  { mes: 11, tema: "Orçamento do próximo ano", aula: "Metas, investimentos e reserva de caixa do ano seguinte.", sistema: "Rascunho do planejamento do próximo ano.", marcos: ["GP de kart", "Conselho: balanço"] },
  { mes: 12, tema: "Fechamento do ano", aula: "DRE do ano, lucro realizado contra o planejado e abertura das cartas.", sistema: "Ano fechado no sistema.", marcos: ["4ª participação de lucro", "Renovação"] },
];
