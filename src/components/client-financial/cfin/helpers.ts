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
