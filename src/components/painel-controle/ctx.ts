import type { Filtro, Nav, Painel } from "./tipos";

/** O que toda tela do painel recebe: dados do mês e as ações de navegação. */
export type Ctx = {
  d: Painel;
  mes: string;
  setMes: (m: string) => void;
  /** empilha uma tela de área */
  go: (nav: Nav) => void;
  /** empilha uma tela de detalhe (lista de registros) */
  det: (bloco: string, filtro?: Filtro, titulo?: string, sub?: string) => void;
  /** abre um registro no Nexus, em outra aba, pra não perder o painel */
  abrir: (url: string) => void;
  /** filtros da tela atual (funil, closer, sdr, consultor) */
  f: Filtro;
  setF: (f: Filtro) => void;
};
