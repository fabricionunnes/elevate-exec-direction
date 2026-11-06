// Conteúdo dos 12 encontros do Mastermind Alpha: a aula do mês e o que o empresário faz no sistema.
// Cada tarefa aponta para a aba onde ela é feita. As tarefas com `auto` são conferidas pelos dados
// do próprio projeto (plano, metas, lançamentos, participação); as demais são marcadas à mão.
import type { DadosAlpha } from "./tipos";
import { trimestres } from "./tipos";

export type Aba = "painel" | "planejamento" | "metas" | "dre" | "dfc" | "participacao" | "lancamentos";
export const NOME_ABA: Record<Aba, string> = {
  painel: "Painel de controle", planejamento: "Planejamento", metas: "Metas", dre: "DRE", dfc: "Fluxo de caixa",
  participacao: "Participação de lucro", lancamentos: "Lançamentos",
};

export type Tarefa = {
  id: string;
  texto: string;
  aba: Aba;
  /** devolve true/false quando dá pra conferir pelo sistema; ausente = marcação manual */
  auto?: (d: DadosAlpha, mes: number) => boolean;
};
export type Encontro = {
  mes: number;
  tema: string;
  objetivo: string;
  aula: { hora: string; titulo: string; texto: string }[];
  conceitos: string[];
  ferramenta: string;
  tarefas: Tarefa[];
  /** indicador que abre o encontro (na Mesa) */
  foco: "lucro" | "receita" | "margem" | "despesa" | "caixa";
  marcos: string[];
};

const metasDo = (d: DadosAlpha, mes: number, nivel?: string) => d.metas.filter((m) => m.mes === mes && (!nivel || m.nivel === nivel));
const temCategoria = (d: DadosAlpha, grupo: string, min = 1) => d.despesas_categoria.filter((c) => c.grupo === grupo).length >= min;
const tri = (d: DadosAlpha, t: number) => {
  const r = trimestres(d)[t - 1]?.registro;
  return !!r && (r.status === "aprovada" || r.status === "paga");
};
const dreMes = (d: DadosAlpha, mes: number) => d.dre.find((m) => m.mes === mes);

/** Abertura e fechamento são iguais todo mês; o meio muda com o tema. */
const abre = (foco: string) => ({ hora: "14h15", titulo: "A Mesa", texto: `Cada membro abre o painel na tela: ${foco} do mês passado contra o plano, os 3 compromissos (cumpriu ou não) e uma vitória. Quem cumpriu os 3 toca o sino.` });
const fecha = { hora: "16h30", titulo: "Compromissos no sistema", texto: "Cada membro sai com 3 compromissos lançados aqui, ligados ao tema do mês. Eles são cobrados no encontro online, 15 dias depois." };
const hot = (texto: string) => ({ hora: "15h45", titulo: "Hot seats", texto });

export const ENCONTROS: Encontro[] = [
  {
    mes: 1, tema: "Planejamento anual", foco: "lucro", marcos: ["Iniciação e kit", "Conselho: diagnóstico"],
    objetivo: "Sair do encontro com o ano inteiro planejado no sistema: faturamento 15% maior, orçamento de despesas, meta de lucro e a regra de distribuição.",
    aula: [
      { hora: "14h15", titulo: "Iniciação", texto: "Leitura de onde cada um vai estar em 12 meses, assinatura do Livro da Turma, pin e Código Alpha." },
      { hora: "14h45", titulo: "Aula: o ano começa pelo lucro", texto: "Do DRE do ano passado ao plano deste ano. Faturamento é consequência: primeiro a meta de lucro, depois o faturamento e o teto de despesa que fecham a conta." },
      { hora: "15h30", titulo: "Mão na massa", texto: "Cada membro monta o plano no sistema, ao vivo: faturamento do ano anterior, crescimento de 15%, impostos, custo variável, despesa fixa e reserva de caixa." },
      hot("2 membros apresentam o plano e a mesa questiona as premissas: o crescimento está ancorado em quê?"),
      fecha,
    ],
    conceitos: ["Lucro líquido como placar", "Sazonalidade: o plano segue o ano anterior", "Reserva de caixa antes de distribuir", "Reinvestimento é decisão, não sobra"],
    ferramenta: "Aba Planejamento: premissas, plano mês a mês e regra de distribuição.",
    tarefas: [
      { id: "fat_anterior", texto: "Informar o faturamento do ano anterior", aba: "planejamento", auto: (d) => (d.plano?.faturamento_ano_anterior ?? 0) > 0 },
      { id: "plano_15", texto: "Montar o plano mês a mês com 15% ou mais de crescimento", aba: "planejamento", auto: (d) => d.plano_meses.some((p) => p.receita > 0) && (d.plano?.crescimento_pct ?? 0) >= 15 },
      { id: "reserva", texto: "Definir a reserva de caixa e o percentual de reinvestimento", aba: "planejamento", auto: (d) => (d.plano?.reserva_caixa_alvo ?? 0) > 0 },
      { id: "saldo_ini", texto: "Informar o saldo de caixa de 1º de janeiro", aba: "planejamento", auto: (d) => (d.plano?.saldo_caixa_inicial ?? 0) !== 0 },
      { id: "lanc_jan", texto: "Ligar o sistema da empresa ou lançar as vendas e despesas de janeiro", aba: "lancamentos", auto: (d) => (dreMes(d, 1)?.lancamentos ?? 0) > 0 },
      { id: "categorias", texto: "Classificar todas as categorias no grupo certo do DRE", aba: "lancamentos", auto: (d) => d.fonte.receber + d.fonte.pagar > 0 && d.fonte.categorias_sem_grupo === 0 },
    ],
  },
  {
    mes: 2, tema: "Metas estruturadas", foco: "receita", marcos: [],
    objetivo: "A meta da empresa desce para mês, produto e vendedor, e passa a ser acompanhada toda semana.",
    aula: [
      abre("faturamento"),
      { hora: "14h45", titulo: "Aula: meta que ninguém assina não existe", texto: "Como quebrar a meta do plano por produto e por vendedor, como definir o indicador de rotina (ticket, conversão, reuniões) e como fazer a reunião semanal com número na tela." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Cadastro das metas do mês no sistema, por vendedor e por produto, e réplica até dezembro." },
      hot("Quem tem time comercial maior mostra como distribuiu a meta. A mesa testa se a soma bate com o plano."),
      fecha,
    ],
    conceitos: ["Meta da empresa = soma das metas individuais", "Indicador de rotina antecipa o resultado", "Reunião semanal de funil"],
    ferramenta: "Aba Metas: metas por vendedor, produto e indicador, com o realizado ao lado.",
    tarefas: [
      { id: "meta_vend", texto: "Cadastrar a meta de cada vendedor", aba: "metas", auto: (d, m) => metasDo(d, m, "vendedor").length > 0 },
      { id: "meta_prod", texto: "Cadastrar a meta de cada produto ou linha", aba: "metas", auto: (d, m) => metasDo(d, m, "produto").length > 0 },
      { id: "meta_ind", texto: "Cadastrar um indicador de rotina (ticket, conversão ou reuniões)", aba: "metas", auto: (d, m) => metasDo(d, m, "indicador").length > 0 },
      { id: "meta_rep", texto: "Replicar as metas até dezembro", aba: "metas", auto: (d) => metasDo(d, 12).length > 0 },
      { id: "reuniao_sem", texto: "Fazer a primeira reunião semanal com o time usando o painel", aba: "painel" },
    ],
  },
  {
    mes: 3, tema: "Margem e preço", foco: "margem", marcos: ["Fecha o 1º trimestre"],
    objetivo: "Saber quanto sobra de cada venda e qual produto dá lucro de verdade, e ajustar preço e desconto a partir disso.",
    aula: [
      abre("margem líquida"),
      { hora: "14h45", titulo: "Aula: margem de contribuição", texto: "Receita menos imposto menos custo variável. O produto que mais vende nem sempre é o que mais lucra. Política de desconto com teto e com troca." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Separar o custo variável em categorias no sistema e ler a margem de contribuição de fevereiro no DRE." },
      hot("Quem dá mais desconto mostra o efeito no lucro. A mesa propõe a regra."),
      fecha,
    ],
    conceitos: ["Margem de contribuição", "Ponto de equilíbrio", "Desconto come margem, não faturamento"],
    ferramenta: "Abas DRE e Lançamentos: custo variável categorizado e margem por mês.",
    tarefas: [
      { id: "cv_cat", texto: "Ter o custo variável separado em categorias próprias", aba: "lancamentos", auto: (d) => temCategoria(d, "custo_variavel") },
      { id: "margem_fev", texto: "Conferir a margem de contribuição de fevereiro no DRE", aba: "dre" },
      { id: "desconto", texto: "Definir a política de desconto da empresa (teto e contrapartida)", aba: "planejamento" },
      { id: "ajuste_plano", texto: "Ajustar o plano se a margem real ficou abaixo da planejada", aba: "planejamento" },
    ],
  },
  {
    mes: 4, tema: "Despesas e caixa", foco: "caixa", marcos: ["1ª participação de lucro"],
    objetivo: "Fechar o 1º trimestre, cortar o que não gera receita e transformar lucro em caixa, com a primeira participação de lucro.",
    aula: [
      abre("caixa"),
      { hora: "14h45", titulo: "Aula: lucro não é caixa", texto: "Leitura do fluxo de caixa do trimestre: prazo de recebimento, despesa que cresce sozinha, capital de giro. Como a reserva protege a distribuição." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Cada membro aprova a participação do 1º trimestre no sistema e lista 3 despesas para cortar." },
      hot("Quem está com caixa apertado abre o fluxo. A mesa acha o vazamento."),
      fecha,
    ],
    conceitos: ["Regime de caixa x competência", "Capital de giro", "Despesa que não gera receita"],
    ferramenta: "Abas Fluxo de caixa e Participação de lucro.",
    tarefas: [
      { id: "dfc_t1", texto: "Conferir o fluxo de caixa de janeiro a março", aba: "dfc" },
      { id: "part_t1", texto: "Aprovar a participação de lucro do 1º trimestre", aba: "participacao", auto: (d) => tri(d, 1) },
      { id: "retirada_t1", texto: "Lançar a retirada da participação como despesa do grupo Retirada", aba: "lancamentos", auto: (d) => (dreMes(d, 4)?.retirada ?? 0) > 0 },
      { id: "cortes", texto: "Registrar 3 despesas para cortar nos compromissos do mês", aba: "painel", auto: (d, m) => d.compromissos.filter((c) => Number(c.mes.slice(5, 7)) === m).length >= 3 },
    ],
  },
  {
    mes: 5, tema: "IA comercial", foco: "receita", marcos: ["GP de kart, dia inteiro"],
    objetivo: "Colocar um agente de IA no comercial (atendimento, follow-up ou reativação) e medir quanto ele vende.",
    aula: [
      { hora: "09h00", titulo: "A Mesa (manhã, antes do kart)", texto: "Painel na tela e compromissos de abril. O dia de GP começa com número." },
      { hora: "09h30", titulo: "Aula: o agente que vende enquanto você dorme", texto: "Onde a IA entra no funil: primeiro atendimento, follow-up, reativação da base. Como medir: meta própria para vendas da IA." },
      { hora: "11h00", titulo: "Mão na massa", texto: "Cada membro escolhe o agente, define a meta de vendas da IA no sistema e marca a data de entrada no ar." },
      { hora: "14h00", titulo: "GP de kart", texto: "Tomada de tempo, corrida e premiação." },
    ],
    conceitos: ["IA no topo do funil", "Follow-up que não esquece", "Reativação da base parada"],
    ferramenta: "Aba Metas: indicador de vendas da IA.",
    tarefas: [
      { id: "agente", texto: "Escolher o agente de IA que entra no comercial", aba: "painel" },
      { id: "meta_ia", texto: "Criar a meta de vendas da IA (indicador com IA no nome)", aba: "metas", auto: (d) => d.metas.some((m) => /\bIA\b/i.test(m.nome)) },
      { id: "ia_no_ar", texto: "Colocar o agente no ar e lançar as vendas que ele gerar", aba: "lancamentos" },
    ],
  },
  {
    mes: 6, tema: "Revisão do semestre", foco: "lucro", marcos: ["Conselho: revisão", "Fecha o 2º trimestre"],
    objetivo: "Comparar o semestre com o plano e replanejar julho a dezembro com o que aprendeu.",
    aula: [
      abre("lucro acumulado"),
      { hora: "14h45", titulo: "Aula: replanejar sem se enganar", texto: "O que segue, o que muda e o que para. Como corrigir o plano sem baixar a meta do ano." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Revisão do plano de julho a dezembro no sistema." },
      hot("Quem está no amarelo ou no vermelho do semáforo vai pro hot seat obrigatório."),
      fecha,
    ],
    conceitos: ["Semáforo do plano", "Replanejamento", "Meta do ano não se renegocia, o caminho sim"],
    ferramenta: "Abas Painel e Planejamento.",
    tarefas: [
      { id: "semaforo", texto: "Ler o semáforo do semestre no painel", aba: "painel" },
      { id: "replan", texto: "Revisar o plano de julho a dezembro", aba: "planejamento" },
      { id: "conselho_rev", texto: "Fazer o conselho individual de revisão com o Fabrício", aba: "painel" },
    ],
  },
  {
    mes: 7, tema: "Time e remuneração", foco: "despesa", marcos: ["2ª participação de lucro"],
    objetivo: "Ligar a remuneração do time a meta e margem, para o time ganhar quando a empresa lucra.",
    aula: [
      abre("despesa com pessoal"),
      { hora: "14h45", titulo: "Aula: comissão que dá lucro", texto: "Comissão sobre margem, não só sobre faturamento. Piso, variável e teto. Custo do time como percentual da receita." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Conferir o custo do time no DRE e aprovar a participação do 2º trimestre." },
      hot("Quem tem o time mais caro em relação à receita abre os números."),
      fecha,
    ],
    conceitos: ["Custo de pessoal sobre receita", "Comissão sobre margem", "Remuneração variável"],
    ferramenta: "Abas DRE, Lançamentos e Participação de lucro.",
    tarefas: [
      { id: "pessoal", texto: "Ter salários e encargos no grupo Pessoal do DRE", aba: "lancamentos", auto: (d) => temCategoria(d, "pessoal") },
      { id: "comissao", texto: "Definir a regra de comissão ligada a meta e margem", aba: "metas" },
      { id: "part_t2", texto: "Aprovar a participação de lucro do 2º trimestre", aba: "participacao", auto: (d) => tri(d, 2) },
    ],
  },
  {
    mes: 8, tema: "Marketing e CAC", foco: "despesa", marcos: [],
    objetivo: "Saber quanto custa trazer cada cliente e qual canal devolve o investimento.",
    aula: [
      abre("despesa comercial"),
      { hora: "14h45", titulo: "Aula: CAC e retorno por canal", texto: "Custo de aquisição, retorno do investimento em mídia e o canal que você deveria cortar." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Separar a despesa comercial por canal e criar a meta de CAC." },
      hot("Quem investe mais em mídia mostra o retorno de cada canal."),
      fecha,
    ],
    conceitos: ["CAC", "Retorno por canal", "Corte do canal que não paga"],
    ferramenta: "Abas Lançamentos e Metas.",
    tarefas: [
      { id: "canais", texto: "Separar a despesa comercial em pelo menos 2 canais", aba: "lancamentos", auto: (d) => temCategoria(d, "comercial", 2) },
      { id: "meta_cac", texto: "Criar o indicador de CAC nas metas", aba: "metas", auto: (d) => d.metas.some((m) => /cac/i.test(m.nome)) },
    ],
  },
  {
    mes: 9, tema: "Ticket e recorrência", foco: "receita", marcos: ["Fecha o 3º trimestre"],
    objetivo: "Crescer vendendo mais para quem já compra: ticket médio, recompra e carteira.",
    aula: [
      abre("faturamento"),
      { hora: "14h45", titulo: "Aula: o cliente que você já tem", texto: "Ticket médio, recompra, oferta para a carteira. Receita da carteira separada da venda nova." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Separar a receita da carteira e criar a meta de ticket médio." },
      hot("Quem tem a maior carteira parada desenha a campanha de reativação."),
      fecha,
    ],
    conceitos: ["Ticket médio", "LTV", "Receita recorrente"],
    ferramenta: "Abas Lançamentos e Metas.",
    tarefas: [
      { id: "receita_carteira", texto: "Separar a receita em categorias de carteira e de venda nova", aba: "lancamentos" },
      { id: "meta_ticket", texto: "Criar o indicador de ticket médio nas metas", aba: "metas", auto: (d) => d.metas.some((m) => /ticket/i.test(m.nome)) },
      { id: "campanha", texto: "Rodar uma campanha para a carteira e lançar as vendas", aba: "lancamentos" },
    ],
  },
  {
    mes: 10, tema: "Processos e IA na operação", foco: "despesa", marcos: ["3ª participação de lucro"],
    objetivo: "Tirar custo da operação com processo e automação, e liberar o dono do operacional.",
    aula: [
      abre("despesas"),
      { hora: "14h45", titulo: "Aula: a empresa que roda sem você", texto: "Mapa das tarefas do dono, o que automatizar, o que delegar e quanto isso devolve no DRE." },
      { hora: "15h20", titulo: "Mão na massa", texto: "Registrar os cortes no sistema e aprovar a participação do 3º trimestre." },
      hot("Quem ainda faz tudo sozinho mostra a agenda da semana."),
      fecha,
    ],
    conceitos: ["Dependência do dono", "Automação com IA", "Processo documentado"],
    ferramenta: "Abas DRE e Participação de lucro.",
    tarefas: [
      { id: "cortes_dre", texto: "Conferir no DRE a queda das despesas cortadas", aba: "dre" },
      { id: "part_t3", texto: "Aprovar a participação de lucro do 3º trimestre", aba: "participacao", auto: (d) => tri(d, 3) },
      { id: "delegar", texto: "Listar 3 tarefas que o dono deixa de fazer", aba: "painel", auto: (d, m) => d.compromissos.filter((c) => Number(c.mes.slice(5, 7)) === m).length >= 3 },
    ],
  },
  {
    mes: 11, tema: "Orçamento do próximo ano", foco: "lucro", marcos: ["GP de kart, dia inteiro", "Conselho: balanço"],
    objetivo: "Começar o próximo ano agora: metas, investimentos e reserva de caixa do ano seguinte.",
    aula: [
      { hora: "09h00", titulo: "A Mesa (manhã, antes do kart)", texto: "Painel na tela com a projeção do ano." },
      { hora: "09h30", titulo: "Aula: o orçamento que começa em novembro", texto: "Projeção de fechamento do ano, meta do ano seguinte e o investimento que destrava o próximo salto." },
      { hora: "11h00", titulo: "Mão na massa", texto: "Rascunho do planejamento do próximo ano no sistema (troque o ano no topo)." },
      { hora: "14h00", titulo: "GP de kart", texto: "Tomada de tempo, corrida e premiação." },
    ],
    conceitos: ["Projeção de fechamento", "Orçamento base zero", "Investimento com retorno"],
    ferramenta: "Aba Planejamento, com o ano seguinte selecionado no topo.",
    tarefas: [
      { id: "projecao", texto: "Ler a projeção de lucro do ano no painel", aba: "painel" },
      { id: "plano_prox", texto: "Montar o rascunho do planejamento do próximo ano", aba: "planejamento" },
      { id: "conselho_bal", texto: "Fazer o conselho individual de balanço com o Fabrício", aba: "painel" },
    ],
  },
  {
    mes: 12, tema: "Fechamento do ano", foco: "lucro", marcos: ["4ª participação de lucro", "Renovação"],
    objetivo: "Fechar o ano no sistema, comparar com o plano de janeiro e distribuir o lucro do último trimestre.",
    aula: [
      abre("lucro do ano"),
      { hora: "14h45", titulo: "Aula: o ano no papel", texto: "DRE do ano contra o plano, crescimento contra o ano anterior, quanto virou participação de lucro." },
      { hora: "15h30", titulo: "Abertura das cartas", texto: "Cada membro abre a carta que escreveu na iniciação e compara com o número de hoje." },
      fecha,
    ],
    conceitos: ["Fechamento anual", "Crescimento real", "Distribuição de lucro"],
    ferramenta: "Abas DRE, Painel e Participação de lucro.",
    tarefas: [
      { id: "dez_lanc", texto: "Lançar todas as vendas e despesas de dezembro", aba: "lancamentos", auto: (d) => (dreMes(d, 12)?.lancamentos ?? 0) > 0 },
      { id: "part_t4", texto: "Aprovar a participação de lucro do 4º trimestre", aba: "participacao", auto: (d) => tri(d, 4) },
      { id: "dre_ano", texto: "Conferir o DRE do ano contra o plano", aba: "dre" },
      { id: "carta", texto: "Abrir a carta da iniciação", aba: "painel" },
    ],
  },
];

/** Situação de cada tarefa: automática pelo sistema, ou manual pela marcação salva. */
export function situacao(t: Tarefa, d: DadosAlpha, mes: number, feitas: Record<string, boolean>): { feito: boolean; automatico: boolean } {
  if (t.auto) return { feito: t.auto(d, mes), automatico: true };
  return { feito: !!feitas[t.id], automatico: false };
}

export function progressoMes(d: DadosAlpha, mes: number, feitas: Record<string, boolean>) {
  const e = ENCONTROS[mes - 1];
  const s = e.tarefas.map((t) => situacao(t, d, mes, feitas));
  return { feitas: s.filter((x) => x.feito).length, total: s.length };
}
