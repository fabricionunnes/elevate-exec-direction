// Classificação compartilhada entre DFC e Ponto de Equilíbrio.
// cost_type da categoria manda; sem cost_type, cai na heurística por nome.
const VARIABLE_NAME_PATTERNS = [/imposto/i, /tr[aá]fego/i, /marketing/i, /comiss/i, /estorno/i, /devolu/i, /taxa/i];

export interface FinCategory {
  id: string;
  name: string;
  type: string;
  group_name: string;
  dfc_section: string | null;
  dre_line: string | null;
  cost_type?: string | null;
  sort_order: number;
}

export function isVariableCategory(cat: FinCategory | undefined | null): boolean {
  if (!cat) return false;
  if (cat.cost_type === "variavel") return true;
  if (cat.cost_type === "fixo") return false;
  return VARIABLE_NAME_PATTERNS.some((re) => re.test(cat.name));
}

export function dfcSectionOf(cat: FinCategory | undefined | null): "operacional" | "investimento" | "financiamento" {
  if (cat?.dfc_section === "investimento") return "investimento";
  if (cat?.dfc_section === "financiamento") return "financiamento";
  return "operacional";
}

export function monthKey(dateStr: string | null | undefined): string | null {
  if (!dateStr || dateStr.length < 7) return null;
  return dateStr.substring(0, 7);
}

export function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (out.length >= 24) break;
  }
  return out;
}
