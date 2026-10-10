// Trava de sanidade pro custo do insumo: evita a nota entrar com "1 kg" lido como 1 g
// (custo por grama mil vezes maior, que estoura o custo do bolo no Financeiro).
import type { Ingredient } from "./types";
import { brl } from "./format";

/** Teto plausível por unidade: R$ 0,50/g (= R$ 500/kg), R$ 0,50/ml, R$ 200/un. */
const CEILING: Record<Ingredient["unit"], number> = { g: 0.5, ml: 0.5, kg: 500, l: 500, un: 200 };

/** Converte o tamanho da embalagem lido no cupom pra unidade do insumo (kg→g, l→ml). */
export function toStockUnit(packSize: number | null, fromUnit: string | null, stockUnit: Ingredient["unit"]): number | null {
  if (packSize == null || !Number.isFinite(packSize)) return null;
  const f = (fromUnit ?? "").toLowerCase();
  if ((f === "kg" && stockUnit === "g") || (f === "l" && stockUnit === "ml")) return packSize * 1000;
  if ((f === "g" && stockUnit === "kg") || (f === "ml" && stockUnit === "l")) return packSize / 1000;
  return packSize;
}

/**
 * Problema com o custo unitário que vai entrar, ou null se está plausível.
 * Compara com o custo anterior (20x pra mais ou pra menos é erro de embalagem, não de preço) e com o teto da unidade.
 */
export function costProblem(name: string, unit: Ingredient["unit"], unitCost: number | null, previous: number | null | undefined): string | null {
  if (unitCost == null || !(unitCost > 0)) return null;
  const prev = Number(previous ?? 0);
  const fmt = (v: number) => `${brl(v)}/${unit}`;
  if (prev > 0 && (unitCost / prev >= 20 || prev / unitCost >= 20)) {
    return `${name}: o custo ficaria ${fmt(unitCost)}, e antes era ${fmt(prev)} (${Math.round(Math.max(unitCost / prev, prev / unitCost))}x). Confira "cada uma tem" (1 kg = 1000 g, 1 L = 1000 ml).`;
  }
  if (unitCost > CEILING[unit]) {
    return `${name}: ${fmt(unitCost)} é alto demais pra ${unit === "un" ? "uma unidade" : `1 ${unit}`}. Confira "cada uma tem" (1 kg = 1000 g, 1 L = 1000 ml).`;
  }
  return null;
}
