// Peças comuns do mapa de calor por UF do bloco "Onde estão nossos clientes" (Visão geral):
// escala de calor de um matiz só (claro → escuro no tema claro, invertida no escuro), projeção
// simples lng/lat → plano, malha das UFs (IBGE, qualidade mínima, embutida em src/assets e
// carregada por import dinâmico) e detecção do tema.
import { useEffect, useState } from "react";

export interface PontoUF { uf: string; /** métrica do toggle (clientes ou leads do período) */ valor: number; leads: number; clientes: number; ganhos: number; ativos: number; receita: number }

/** UF → polígonos → anéis → [lng, lat] (o 1º anel de cada polígono é o contorno, os demais são furos) */
export type MalhaUF = Record<string, [number, number][][][]>;

let malhaCache: Promise<MalhaUF> | null = null;
/** Malha das 27 UFs (IBGE, ~75 KB). Import dinâmico: só baixa quando o bloco do mapa aparece. */
export function carregarMalha(): Promise<MalhaUF> {
  if (!malhaCache) malhaCache = import("@/assets/br-uf.json").then((m: any) => (m.default || m) as MalhaUF);
  return malhaCache;
}

// ------------------------------------------------------------------ escala de calor
const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: string, b: string, t: number) => {
  const A = hex(a), B = hex(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};
/** Pontas da escala: claro → navy no tema claro; no escuro a leitura inverte (mais valor = mais claro). */
export const ESCALA = {
  claro: { min: "#DCE6F5", max: "#0D2B5E", vazio: "#E5E7EB", borda: "#FFFFFF", oceano: "#EDF1F7", terra: "#C9D2E0", destaque: "#CC1B1B" },
  escuro: { min: "#22324D", max: "#A9C3F2", vazio: "#2A3140", borda: "#0F1726", oceano: "#0F1726", terra: "#263247", destaque: "#F87171" },
};
export const paleta = (escuro: boolean) => (escuro ? ESCALA.escuro : ESCALA.claro);
/** 0..1 da escala (raiz quadrada: UF pequena não some ao lado da maior) */
export const intensidade = (valor: number, max: number) => (max > 0 && valor > 0 ? Math.sqrt(valor / max) : 0);
export function corCalor(valor: number, max: number, escuro: boolean): string {
  const p = paleta(escuro);
  if (!(valor > 0) || !(max > 0)) return p.vazio;
  return mix(p.min, p.max, intensidade(valor, max));
}
/** O texto em cima da cor precisa ser claro? (luminância da cor de fundo) */
export function fundoEscuro(cor: string): boolean {
  const [r, g, b] = hex(cor);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

// ------------------------------------------------------------------ geometria
/** Projeção plana centrada no Brasil (equiretangular com correção de latitude). Unidades ~ -1..1. */
const LNG0 = -54, LAT0 = -15, K = 1 / 19, COS = Math.cos((15 * Math.PI) / 180);
export const projetar = (lng: number, lat: number): [number, number] => [(lng - LNG0) * COS * K, (lat - LAT0) * K];

export function areaAnel(r: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
/** Centro visual da UF: centroide do maior polígono, em lng/lat. */
export function centroUF(pols: [number, number][][][]): { lng: number; lat: number; area: number } {
  let melhor = pols[0][0], maior = 0;
  for (const p of pols) { const a = areaAnel(p[0]); if (a > maior) { maior = a; melhor = p[0]; } }
  let cx = 0, cy = 0, s = 0;
  for (let i = 0; i < melhor.length; i++) {
    const a = melhor[i], b = melhor[(i + 1) % melhor.length];
    const f = a[0] * b[1] - b[0] * a[1];
    cx += (a[0] + b[0]) * f; cy += (a[1] + b[1]) * f; s += f;
  }
  return s ? { lng: cx / (3 * s), lat: cy / (3 * s), area: maior } : { lng: melhor[0][0], lat: melhor[0][1], area: maior };
}
function dentroAnel(lng: number, lat: number, r: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
/** Em qual UF cai o ponto (lng, lat)? Usado no hover/clique do globo. */
export function ufDoPonto(malha: MalhaUF, lng: number, lat: number): string | null {
  if (lng < -75 || lng > -33 || lat < -35 || lat > 6) return null;
  for (const uf of Object.keys(malha)) {
    for (const pol of malha[uf]) {
      if (dentroAnel(lng, lat, pol[0]) && !pol.slice(1).some((furo) => dentroAnel(lng, lat, furo))) return uf;
    }
  }
  return null;
}

// ------------------------------------------------------------------ tema
/** true quando o app está no tema escuro (classe .dark no <html>), reagindo à troca. */
export function useTemaEscuro(): boolean {
  const ler = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [escuro, setEscuro] = useState(ler);
  useEffect(() => {
    const obs = new MutationObserver(() => setEscuro(ler()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return escuro;
}
