/**
 * PostgREST devolve no máximo 1000 linhas por resposta. Sem paginar, telas que somam
 * lançamentos (dashboard de KPIs, histórico) mostravam totais parciais e divergentes.
 * Este helper busca de 1000 em 1000 até acabar.
 */
export async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000,
  maxPages = 60
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
