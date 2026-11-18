// Mastermind Alpha: diagnóstico automático, saúde do sistema e as regras do Capital do Próximo Salto.
// Tudo aqui é conta em cima dos dados que o painel já carrega; nada grava.
import type { DadosAlpha, DreMes, Resumo } from "./tipos";
import { MESES_NOME, despesaFixa, lucroPlano, lucroReal, soma, ultimoMesFechado } from "./tipos";

export type Fechamento = { mes: number; fechado_em: string; observacao: string | null };
export type Acao = {
  id: string; ano: number; origem: string | null; texto: string; responsavel: string | null; prazo: string | null;
  impacto_mensal: number | null; status: "aberta" | "andamento" | "feita" | "cancelada"; created_at: string;
};
export type Negocio = {
  id: string; data: string; tipo: "venda" | "compra" | "indicacao" | "parceria"; com_quem: string; descricao: string | null;
  valor: number; status: "em_conversa" | "fechado" | "perdido";
};
export type Salto = { tipo: string | null; descricao: string | null; investimento_total: number | null; retorno_esperado: string | null; inicio: string | null };
export type CobrancasAlpha = { atrasadas: number; pagas: number; abertas: number };
export type ExtrasAlpha = {
  fechamentos: Fechamento[]; acoes: Acao[]; negocios: Negocio[]; salto: Salto | null; cobrancas: CobrancasAlpha | null;
  presencas: number; encontrosRegistrados: number; pronto: boolean;
  /** Data em que o projeto do membro começou: meses anteriores não contam para fechamento nem para o Capital. */
  inicio: string | null;
};
export const EXTRAS_VAZIO: ExtrasAlpha = { fechamentos: [], acoes: [], negocios: [], salto: null, cobrancas: null, presencas: 0, encontrosRegistrados: 0, pronto: false, inicio: null };

/* ---------- indicadores de base ---------- */
export type Base = {
  meses: number; receita: number; deducao: number; custoVariavel: number; fixa: number; financeiro: number; lucro: number;
  margemContribuicao: number | null; pontoEquilibrio: number | null; folegoMeses: number | null;
};
/** Média mensal dos últimos meses fechados com lançamento (até 3). É a base do diagnóstico e do simulador. */
export function baseMensal(d: DadosAlpha, caixaAtual: number): Base {
  const fechado = ultimoMesFechado(d.ano);
  const ms = d.dre.filter((m) => m.mes <= fechado && m.lancamentos > 0).slice(-3);
  const n = ms.length || 1;
  const med = (f: (m: DreMes) => number) => soma(ms.map(f)) / n;
  const receita = med((m) => m.receita), deducao = med((m) => m.deducao), custoVariavel = med((m) => m.custo_variavel);
  const fixa = med(despesaFixa), financeiro = med((m) => m.financeiro);
  const mc = receita > 0 ? (receita - deducao - custoVariavel) / receita : null;
  return {
    meses: ms.length, receita, deducao, custoVariavel, fixa, financeiro, lucro: receita - deducao - custoVariavel - fixa - financeiro,
    margemContribuicao: mc,
    pontoEquilibrio: mc && mc > 0 ? (fixa + financeiro) / mc : null,
    folegoMeses: fixa + financeiro > 0 ? caixaAtual / (fixa + financeiro) : null,
  };
}

/* ---------- desvios contra o plano ---------- */
export type Desvio = { k: string; nome: string; real: number; plano: number; dif: number; pct: number | null; ruim: boolean; efeitoLucro: number };
export function desvios(d: DadosAlpha): Desvio[] {
  const fechado = ultimoMesFechado(d.ano);
  const dre = d.dre.filter((m) => m.mes <= fechado), pl = d.plano_meses.filter((p) => p.mes <= fechado);
  const linha = (k: string, nome: string, real: number, plano: number, receita: boolean): Desvio => {
    const dif = real - plano;
    return { k, nome, real, plano, dif, pct: plano ? dif / plano : null, ruim: receita ? dif < 0 : dif > 0, efeitoLucro: receita ? dif : -dif };
  };
  return [
    linha("receita", "Faturamento", soma(dre.map((m) => m.receita)), soma(pl.map((p) => p.receita)), true),
    linha("deducao", "Impostos e deduções", soma(dre.map((m) => m.deducao)), soma(pl.map((p) => p.deducoes)), false),
    linha("custo_variavel", "Custo variável", soma(dre.map((m) => m.custo_variavel)), soma(pl.map((p) => p.custo_variavel)), false),
    linha("fixa", "Despesas fixas", soma(dre.map(despesaFixa)), soma(pl.map((p) => p.despesa_fixa)), false),
    linha("financeiro", "Financeiro", soma(dre.map((m) => m.financeiro)), soma(pl.map((p) => p.financeiro)), false),
  ];
}

/* ---------- alertas priorizados ---------- */
export type Alerta = { nivel: "r" | "a" | "g"; titulo: string; texto: string; acao?: string; impacto?: number };
const brl0 = (v: number) => `R$ ${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`;
const pc0 = (v: number) => `${Math.round(v * 100)}%`;

export function alertas(d: DadosAlpha, r: Resumo, b: Base): Alerta[] {
  const out: Alerta[] = [];
  if (!r.temPlano) return [{ nivel: "r", titulo: "O ano ainda não tem plano", texto: "Sem plano não existe desvio para medir. Monte o planejamento antes de qualquer análise.", acao: "Montar o planejamento do ano" }];
  if (!r.temDados) return [{ nivel: "r", titulo: "Sem lançamentos nos meses fechados", texto: "O diagnóstico precisa das vendas e despesas no sistema. Conecte o financeiro da empresa ou lance na aba Lançamentos.", acao: "Lançar vendas e despesas do mês" }];
  const dv = desvios(d);
  const pior = [...dv].filter((x) => x.ruim).sort((a, c) => a.efeitoLucro - c.efeitoLucro)[0];
  const faltaLucro = r.lucroPlanoAcum - r.lucroAcum;
  if (faltaLucro > 0 && pior) {
    out.push({
      nivel: r.status === "vermelho" ? "r" : "a",
      titulo: `O lucro está ${brl0(faltaLucro)} abaixo do plano`,
      texto: `A linha que mais puxou para baixo foi ${pior.nome.toLowerCase()}: ${brl0(pior.dif)} ${pior.k === "receita" ? "a menos" : "a mais"} que o planejado${pior.pct != null ? ` (${pc0(Math.abs(pior.pct))})` : ""}.`,
      acao: pior.k === "receita" ? "Recuperar o faturamento que ficou abaixo do plano" : `Trazer ${pior.nome.toLowerCase()} de volta para o orçado`,
      impacto: Math.abs(pior.efeitoLucro) / Math.max(r.fechado, 1),
    });
  } else if (faltaLucro <= 0) {
    out.push({ nivel: "g", titulo: `O lucro está ${brl0(faltaLucro)} acima do plano`, texto: "Mantenha o ritmo e confira se a reserva de caixa já chegou no alvo antes da próxima participação." });
  }
  const restam = 12 - r.fechado;
  const faltaAno = r.lucroAnoPlano - r.lucroAcum;
  if (restam > 0 && faltaAno > 0) {
    const porMes = faltaAno / restam;
    const dif = porMes - b.lucro;
    if (b.meses && dif > 0) {
      out.push({
        nivel: dif > Math.abs(b.lucro) * 0.25 ? "r" : "a",
        titulo: `Para fechar o ano no plano: ${brl0(porMes)} de lucro por mês`,
        texto: `Nos últimos ${b.meses} meses a média foi ${brl0(b.lucro)}. Faltam ${brl0(dif)} por mês${b.margemContribuicao && b.margemContribuicao > 0 ? `, o que pede cerca de ${brl0(dif / b.margemContribuicao)} a mais de faturamento mensal ou o mesmo valor em corte de despesa fixa` : ""}.`,
        acao: `Fechar a diferença de ${brl0(dif)} por mês até dezembro`, impacto: dif,
      });
    }
  }
  if (b.pontoEquilibrio != null && b.receita > 0) {
    const folga = b.receita / b.pontoEquilibrio - 1;
    if (folga < 0) out.push({ nivel: "r", titulo: "A empresa está abaixo do ponto de equilíbrio", texto: `Para pagar as contas ela precisa faturar ${brl0(b.pontoEquilibrio)} por mês e a média recente foi ${brl0(b.receita)}.`, acao: "Voltar para acima do ponto de equilíbrio", impacto: b.pontoEquilibrio - b.receita });
    else if (folga < 0.15) out.push({ nivel: "a", titulo: `Folga de só ${pc0(folga)} sobre o ponto de equilíbrio`, texto: `O ponto de equilíbrio é ${brl0(b.pontoEquilibrio)} por mês. Uma queda de ${pc0(folga)} no faturamento zera o lucro.` });
  }
  if (b.folegoMeses != null) {
    if (b.folegoMeses < 1) out.push({ nivel: "r", titulo: "O caixa cobre menos de um mês de despesa fixa", texto: `Fôlego de ${b.folegoMeses.toFixed(1).replace(".", ",")} mês. Antes de distribuir lucro, recomponha a reserva.`, acao: "Recompor a reserva de caixa" });
    else if (b.folegoMeses < 2) out.push({ nivel: "a", titulo: `Fôlego de caixa de ${b.folegoMeses.toFixed(1).replace(".", ",")} meses`, texto: "O recomendado é pelo menos 2 meses de despesa fixa guardados." });
  }
  const fech = d.dre.filter((m) => m.mes <= r.fechado && m.lancamentos > 0);
  if (fech.length >= 3) {
    const [a, c2, c3] = fech.slice(-3).map((m) => (m.receita > 0 ? lucroReal(m) / m.receita : 0));
    if (c3 < c2 && c2 < a) out.push({ nivel: "a", titulo: "A margem caiu três meses seguidos", texto: `Foi de ${pc0(a)} para ${pc0(c3)}. Olhe o custo variável e os descontos antes de olhar a despesa fixa.`, acao: "Descobrir por que a margem caiu três meses seguidos" });
    const fx = fech.slice(-3).map(despesaFixa), rc = fech.slice(-3).map((m) => m.receita);
    if (fx[2] > fx[0] * 1.08 && rc[2] <= rc[0] * 1.02) out.push({ nivel: "a", titulo: "A despesa fixa cresce e o faturamento não", texto: `A despesa fixa subiu ${pc0(fx[2] / fx[0] - 1)} em três meses, com o faturamento parado.`, acao: "Rever as despesas fixas que cresceram no trimestre", impacto: fx[2] - fx[0] });
  }
  const tot = soma(d.despesas_categoria.map((c) => c.valor));
  const semCat = soma(d.despesas_categoria.filter((c) => c.grupo === "sem_categoria").map((c) => c.valor));
  if (tot > 0 && semCat / tot > 0.05) out.push({ nivel: "a", titulo: `${pc0(semCat / tot)} das despesas estão sem categoria`, texto: "Enquanto estiver assim, o DRE não mostra onde o dinheiro vai. Classifique na aba Lançamentos.", acao: "Classificar as despesas sem categoria" });
  if (r.crescimento != null && r.crescimento < 0.15) out.push({ nivel: r.crescimento < 0 ? "r" : "a", titulo: `Crescimento de ${pc0(r.crescimento)} contra o ano anterior`, texto: "A meta do Alpha é crescer 15% ou mais. Use o simulador para ver qual alavanca fecha essa conta." });
  const ordem = { r: 0, a: 1, g: 2 };
  return out.sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);
}

/* ---------- fechamento do mês ---------- */
export type SituacaoMes = { mes: number; estado: "antes" | "futuro" | "aberto" | "atrasado" | "fechado" | "fechado_fora"; prazo: Date; fechadoEm: string | null };
/** Prazo de fechamento: dia 10 do mês seguinte. */
export const prazoFechamento = (ano: number, mes: number) => new Date(ano, mes, 10, 23, 59, 59);
export function situacaoMeses(d: DadosAlpha, fechamentos: Fechamento[], hoje = new Date(), inicio: string | null = null): SituacaoMes[] {
  const fechado = ultimoMesFechado(d.ano, hoje);
  // primeiro mês que conta: o mês em que o membro entrou (antes disso ele ainda não tinha o sistema)
  const ini = inicio ? new Date(inicio) : null;
  const primeiro = !ini ? 1 : ini.getFullYear() > d.ano ? 13 : ini.getFullYear() < d.ano ? 1 : ini.getMonth() + 1;
  return d.dre.map((m) => {
    const prazo = prazoFechamento(d.ano, m.mes);
    const f = fechamentos.find((x) => x.mes === m.mes);
    if (f) return { mes: m.mes, estado: new Date(f.fechado_em) <= prazo || m.mes < primeiro ? "fechado" : "fechado_fora", prazo, fechadoEm: f.fechado_em };
    if (m.mes < primeiro) return { mes: m.mes, estado: "antes", prazo, fechadoEm: null };
    if (m.mes > fechado) return { mes: m.mes, estado: "futuro", prazo, fechadoEm: null };
    return { mes: m.mes, estado: hoje > prazo ? "atrasado" : "aberto", prazo, fechadoEm: null };
  });
}

/* ---------- saúde do sistema ---------- */
export type ItemSaude = { ok: boolean; nome: string; dica: string; aba: string };
export function saude(d: DadosAlpha, r: Resumo, x: ExtrasAlpha, hoje = new Date()): { itens: ItemSaude[]; nota: number } {
  const mesAtual = hoje.getFullYear() === d.ano ? hoje.getMonth() + 1 : 12;
  const sit = situacaoMeses(d, x.fechamentos, hoje, x.inicio);
  const pendentes = sit.filter((s) => s.estado === "atrasado").length;
  const ultimo = d.fonte.ultimo_lancamento ? (hoje.getTime() - new Date(d.fonte.ultimo_lancamento).getTime()) / 86400000 : null;
  const itens: ItemSaude[] = [
    { ok: r.temPlano, nome: "Plano do ano montado", dica: "Monte o planejamento com a meta de lucro", aba: "planejamento" },
    { ok: (d.plano?.reserva_caixa_alvo ?? 0) > 0, nome: "Reserva de caixa definida", dica: "Defina a reserva alvo no planejamento", aba: "planejamento" },
    { ok: d.metas.some((m) => m.mes === mesAtual || m.mes == null), nome: `Metas de ${MESES_NOME[mesAtual - 1].toLowerCase()} cadastradas`, dica: "Cadastre as metas do mês", aba: "metas" },
    { ok: ultimo != null && ultimo <= 10, nome: "Lançamentos em dia", dica: ultimo == null ? "Nenhum lançamento no sistema" : `Último lançamento há ${Math.round(ultimo)} dias`, aba: "lancamentos" },
    { ok: d.fonte.categorias_sem_grupo === 0, nome: "Categorias ligadas ao DRE", dica: `${d.fonte.categorias_sem_grupo} categorias sem grupo`, aba: "lancamentos" },
    { ok: pendentes === 0, nome: "Meses fechados no prazo", dica: pendentes ? `${pendentes} mês(es) passaram do prazo sem fechar` : "Feche o mês até o dia 10", aba: "fechamento" },
    { ok: d.compromissos.some((c) => Number(c.mes.slice(5, 7)) === mesAtual), nome: "Compromissos do mês registrados", dica: "Registre os 3 compromissos do encontro", aba: "cronograma" },
  ];
  return { itens, nota: Math.round((itens.filter((i) => i.ok).length / itens.length) * 100) };
}

/* ---------- Capital do Próximo Salto ---------- */
export const CAPITAL_VALOR = 6000;
export const PRESENCA_MINIMA = 10;
export type Criterio = { k: string; nome: string; ok: boolean; risco: boolean; feito: string; regra: string };
export function criteriosCapital(d: DadosAlpha, x: ExtrasAlpha, hoje = new Date()): { criterios: Criterio[]; estado: "garantido" | "caminho" | "risco" | "fora" } {
  const sit = situacaoMeses(d, x.fechamentos, hoje, x.inicio);
  const passados = sit.filter((s) => s.estado !== "futuro" && s.estado !== "antes");
  const noPrazo = sit.filter((s) => s.estado === "fechado").length;
  const perdidos = sit.filter((s) => s.estado === "atrasado" || s.estado === "fechado_fora").length;
  const mesAtual = hoje.getFullYear() === d.ano ? hoje.getMonth() + 1 : hoje.getFullYear() > d.ano ? 12 : 0;
  const faltasPossiveis = 12 - PRESENCA_MINIMA;
  const faltas = Math.max(Math.min(mesAtual, x.encontrosRegistrados) - x.presencas, 0);
  const atr = x.cobrancas?.atrasadas ?? 0;
  const criterios: Criterio[] = [
    { k: "mensalidades", nome: "Mensalidades em dia", ok: atr === 0, risco: false, feito: atr === 0 ? `${x.cobrancas?.pagas ?? 0} pagas, nenhuma em atraso` : `${atr} em atraso`, regra: "As 12 mensalidades pagas em dia." },
    { k: "presenca", nome: "Presença nos encontros", ok: faltas <= faltasPossiveis, risco: faltas === faltasPossiveis, feito: `${x.presencas} presenças, ${faltas} falta${faltas === 1 ? "" : "s"}`, regra: `Pelo menos ${PRESENCA_MINIMA} dos 12 encontros presenciais.` },
    { k: "sistema", nome: "Sistema alimentado", ok: perdidos === 0, risco: sit.some((s) => s.estado === "aberto"), feito: `${noPrazo} de ${passados.length} meses fechados no prazo`, regra: "Cada mês fechado no sistema até o dia 10 do mês seguinte." },
  ];
  const todos = criterios.every((c) => c.ok);
  const estado = !todos ? "fora" : mesAtual >= 12 && !criterios.some((c) => c.risco) ? "garantido" : criterios.some((c) => c.risco) ? "risco" : "caminho";
  return { criterios, estado };
}

/* ---------- simulador ---------- */
export type Alavancas = { preco: number; volume: number; custo: number; fixa: number };
export function simular(b: Base, a: Alavancas) {
  const receita = b.receita * (1 + a.preco) * (1 + a.volume);
  const deducao = b.receita > 0 ? (b.deducao / b.receita) * receita : 0;
  const custoVariavel = b.custoVariavel * (1 + a.volume) * (1 + a.custo);
  const fixa = b.fixa * (1 + a.fixa);
  const lucro = receita - deducao - custoVariavel - fixa - b.financeiro;
  return { receita, deducao, custoVariavel, fixa, lucro, margem: receita > 0 ? lucro / receita : null };
}
export const lucroPlanoMes = (d: DadosAlpha, mes: number) => {
  const p = d.plano_meses.find((x) => x.mes === mes);
  return p ? lucroPlano(p) : 0;
};
