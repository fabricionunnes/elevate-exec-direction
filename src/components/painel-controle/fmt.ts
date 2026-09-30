// Formatação do Painel de Controle. Segue a referência: "R$ 39,5 mil", "R$ 1,2 mi",
// e "-" quando não tem dado (nunca zero falso).

export const brl = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  const s = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toFixed(2).replace(".", ",")} mi`;
  if (a >= 1000) return `${s}R$ ${(a / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
};

/** Valor cheio, com centavos, pra tabela de registros. */
export const brlFull = (v: number | null | undefined): string =>
  v == null || Number.isNaN(Number(v)) ? "-" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const usd = (v: number | null | undefined): string =>
  v == null || Number.isNaN(Number(v)) ? "-" : `US$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const num = (v: number | null | undefined, casas = 1): string =>
  v == null || Number.isNaN(Number(v)) ? "-" : Number(Number(v).toFixed(casas)).toLocaleString("pt-BR");

export const pct = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a == null || !b ? null : Number(a) / Number(b);

export const fp = (p: number | null | undefined): string => (p == null || Number.isNaN(Number(p)) ? "-" : `${Math.round(Number(p) * 100)}%`);

/** Rótulo curto pras barras: "39k", "1,2 mi". */
export const kfmt = (v: number | null | undefined): string => {
  if (v == null) return "-";
  const a = Math.abs(Number(v));
  const s = Number(v) < 0 ? "-" : "";
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (a >= 1000) return `${s}${Math.round(a / 1000)}k`;
  return `${s}${Math.round(a)}`;
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-09-01" -> "setembro de 2026" */
export const mesLabel = (iso: string): string => {
  const m = Number(iso.slice(5, 7)) - 1;
  return `${MESES[m] ?? iso} de ${iso.slice(0, 4)}`;
};
/** "2026-09-01" -> "set" */
export const mesCurto = (iso: string): string => (MESES[Number(iso.slice(5, 7)) - 1] ?? "").slice(0, 3);
/** "2026-09-01" -> "set/26" */
export const mesAno = (iso: string): string => `${mesCurto(iso)}/${iso.slice(2, 4)}`;

export const dataBR = (v: string | null | undefined): string => {
  if (!v) return "-";
  const s = String(v);
  const d = s.length > 10 ? new Date(s) : new Date(`${s.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
export const dataHoraBR = (v: string | null | undefined): string => {
  if (!v) return "-";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const plural = (n: number, s: string, p: string): string => `${n.toLocaleString("pt-BR")} ${n === 1 ? s : p}`;

/** Últimos 12 meses terminando no mês atual, mais antigo primeiro. */
export const ultimos12Meses = (): string[] => {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
};

export const mesAtual = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const RISCO: Record<string, string> = { excellent: "Excelente", healthy: "Saudável", attention: "Atenção", at_risk: "Em risco", critical: "Crítico" };
export const nivelLabel = (k: string | null | undefined): string => (k ? RISCO[k] ?? k : "-");

const EVENTO: Record<string, string> = { scheduled: "Agendada", realized: "Realizada", no_show: "No-show", out_of_icp: "Fora do ICP", realized_out_of_icp: "Realizada, fora do ICP" };
export const eventoLabel = (k: string | null | undefined): string => (k ? EVENTO[k] ?? k : "-");

const PAPEL: Record<string, string> = { master: "Master", admin: "Admin", cs: "CS", consultant: "Consultor", head_comercial: "Head comercial", closer: "Closer", sdr: "SDR", social_setter: "Social setter", bdr: "BDR", rh: "RH", financeiro: "Financeiro", marketing: "Marketing", pending: "Pendente" };
export const papelLabel = (k: string | null | undefined): string => (k ? PAPEL[k] ?? k : "-");

const PROJ: Record<string, string> = { active: "Ativo", notice_period: "Em aviso", cancellation_signaled: "Sinal de cancelamento", closed: "Encerrado", completed: "Concluído", pending: "Pendente" };
export const projetoLabel = (k: string | null | undefined): string => (k ? PROJ[k] ?? k : "-");
