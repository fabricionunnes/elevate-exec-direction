// Exportação de dashboards pra Excel (benchmark Datacrazy, 30/09/2026).
// Cada bloco vira uma aba da planilha. Usa a lib xlsx que já está no projeto.
import * as XLSX from "xlsx";

export interface BlocoExport {
  /** nome da aba (máx. 31 caracteres no Excel) */
  aba: string;
  linhas: Record<string, unknown>[];
}

export function exportarXlsx(nomeArquivo: string, blocos: BlocoExport[]) {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const b of blocos) {
    if (!b.linhas.length) continue;
    let aba = b.aba.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    let i = 2;
    while (usados.has(aba)) { aba = `${aba.slice(0, 28)} ${i++}`; }
    usados.add(aba);
    const ws = XLSX.utils.json_to_sheet(b.linhas);
    // largura das colunas pelo maior conteúdo
    const chaves = Object.keys(b.linhas[0]);
    ws["!cols"] = chaves.map((k) => ({ wch: Math.min(60, Math.max(k.length, ...b.linhas.map((l) => String(l[k] ?? "").length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, aba);
  }
  if (!wb.SheetNames.length) {
    const ws = XLSX.utils.aoa_to_sheet([["Sem dados no período"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Vazio");
  }
  XLSX.writeFile(wb, nomeArquivo.endsWith(".xlsx") ? nomeArquivo : `${nomeArquivo}.xlsx`);
}

/** segundos → "2h 15min", "45min", "30s" */
export const duracao = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(Number(s))) return "-";
  const n = Math.round(Number(s));
  if (n < 60) return `${n}s`;
  const m = Math.round(n / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 48) return r ? `${h}h ${r}min` : `${h}h`;
  return `${Math.round(h / 24)}d`;
};
