export const fmtMoney = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro", "13º Salário"];

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const parseValor = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

// INSS progressivo: aplica cada alíquota só sobre a parcela da faixa (faixas ordenadas por faixa_ate asc)
export interface InssFaixa { faixa_ate: number; aliquota: number }
export function calcInss(base: number, faixas: InssFaixa[]): number {
  if (!base || !faixas.length) return 0;
  const ord = [...faixas].sort((a, b) => a.faixa_ate - b.faixa_ate);
  let inss = 0, anterior = 0;
  for (const f of ord) {
    const teto = Math.min(base, f.faixa_ate);
    if (teto > anterior) inss += (teto - anterior) * (f.aliquota / 100);
    anterior = f.faixa_ate;
    if (base <= f.faixa_ate) break;
  }
  return Math.round(inss * 100) / 100;
}
