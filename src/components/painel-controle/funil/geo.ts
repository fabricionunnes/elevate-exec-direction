// Geometria do funil do mês, compartilhada pela cena 3D e pelo SVG de reserva.
//
// Cada etapa vira um tronco de cone. A largura segue a raiz quadrada do volume
// (9 vendas contra 177 leads não pode virar uma agulha) com um piso, e a cor
// desce do azul pro vermelho da UNV. Raios normalizados de 0 a 1.

export type EtapaFunil = {
  k: string;
  nome: string;
  /** volume da etapa no mês */
  v: number;
  /** leitura em relação à etapa anterior: "42% dos leads" */
  conv: string;
  /** observação que não cabe na linha (vira title) */
  dica?: string;
  onClick: () => void;
};

export type Peca = {
  i: number;
  /** raio do topo e da base, 0 a 1 */
  rT: number;
  rB: number;
  cor: string;
  corClara: string;
  corEscura: string;
  /** etapa sem volume: anel fino e apagado */
  fantasma: boolean;
};

export type Ancora = { x: number; y: number };

const AZUL = [61, 99, 184];    // #3D63B8, o navy da UNV clareado pra aparecer no fundo escuro
const VERMELHO = [204, 27, 27]; // #CC1B1B
const R_PISO = 0.24, R_VAZIO = 0.17;

const hex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

export function montarFunil(etapas: { v: number }[]): Peca[] {
  const n = etapas.length;
  const max = Math.max(...etapas.map((e) => e.v || 0), 0);
  const raio = (v: number) => (max > 0 && v > 0 ? R_PISO + (1 - R_PISO) * Math.sqrt(v / max) : R_VAZIO);
  return etapas.map((e, i) => {
    const rT = raio(e.v);
    // a base aponta pra largura da próxima etapa, mas nunca abre: se a próxima é
    // maior (compareceram mais do que agendaram no mês), o degrau fica visível
    const alvo = i < n - 1 ? 0.35 * rT + 0.65 * raio(etapas[i + 1].v) : rT * 0.62;
    const rB = Math.max(0.1, Math.min(rT * 0.93, alvo));
    const base = mix(AZUL, VERMELHO, n > 1 ? i / (n - 1) : 0);
    return {
      i, rT, rB,
      cor: hex(base),
      corClara: hex(mix(base, [255, 255, 255], 0.38)),
      corEscura: hex(mix(base, [8, 8, 10], 0.62)),
      fantasma: !(e.v > 0),
    };
  });
}

/** WebGL disponível neste navegador? */
export function temWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export const semMovimentoPreferido = (): boolean => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
