export type Grupo = "receita" | "custo" | "reserva" | "indicador" | "distribuicao";
export type Unidade = "brl" | "qtd" | "pct";

export type Linha = {
  id: string;
  ano: number;
  grupo: Grupo;
  linha: string;
  /** chave que casa com o realizado; nulo = linha que só existe no plano */
  fonte: string | null;
  unidade: Unidade;
  ordem: number;
  /** soma = fluxo (contratos no mês); ultimo = estoque (clientes na carteira) */
  acumulacao: "soma" | "ultimo";
  /** linha derivada: acompanha a receita em vez de ter valor próprio */
  formula: "pct_receita" | null;
  formula_pct: number | null;
  /** 12 posições, janeiro a dezembro */
  valores: number[];
  observacao: string | null;
};

export type Ano = {
  ano: number;
  titulo: string;
  /** saldo de caixa no início do ano, ponto de partida do acúmulo */
  caixa_inicial: number;
  /** 1 a 12: primeiro mês com dado. 2026 só tem registro a partir de maio */
  mes_inicial: number;
  observacao: string | null;
  atualizado_em: string;
};

/** { fonte: { "1": valor, ..., "12": valor } } */
export type Realizado = Record<string, Record<string, number>>;

export const GRUPOS: { k: Grupo; nome: string; sinal: 1 | -1 | 0 }[] = [
  { k: "receita", nome: "Receita", sinal: 1 },
  { k: "custo", nome: "Custos e despesas", sinal: -1 },
  { k: "reserva", nome: "Reservas", sinal: -1 },
  { k: "distribuicao", nome: "Destinação do lucro", sinal: 0 },
  { k: "indicador", nome: "Indicadores", sinal: 0 },
];
