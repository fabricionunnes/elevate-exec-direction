// Visões salvas do CRM (crm_saved_views): tipos e utilidades de serialização.
// O conteúdo da visão é um JSON livre por tela; aqui ficam só as peças comuns.
import type { DateRange } from "react-day-picker";

export type SavedViewScope = "pipeline" | "contatos" | "atendimento";

export interface SavedView {
  id: string;
  staff_id: string;
  scope: SavedViewScope;
  name: string;
  filters: Record<string, any>;
  pipeline_id: string | null;
  is_shared: boolean;
  sort_order: number;
  created_at: string;
  owner?: { name: string } | null;
  /** preferências de quem está logado */
  is_pinned: boolean;
  is_default: boolean;
}

/** Tira o que é "vazio" (null, "", [], false, {}) e ordena as chaves: duas visões com os
 *  mesmos filtros viram o mesmo texto, não importa a ordem em que o banco devolve o JSON. */
export function normalizeView(value: any): any {
  if (value === null || value === undefined || value === "" || value === false) return undefined;
  if (Array.isArray(value)) {
    const arr = value.map(normalizeView).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) {
      const v = normalizeView(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

export const viewSignature = (value: any): string => JSON.stringify(normalizeView(value) ?? {});

export const dateToJson = (d: Date | undefined | null): string | null => (d ? new Date(d).toISOString() : null);
export const dateFromJson = (s: unknown): Date | undefined => {
  if (typeof s !== "string" || !s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
};

export const rangeToJson = (r: DateRange | undefined | null): { from: string | null; to: string | null } | null =>
  r?.from ? { from: dateToJson(r.from), to: dateToJson(r.to) } : null;
export const rangeFromJson = (r: any): DateRange | undefined => {
  const from = dateFromJson(r?.from);
  if (!from) return undefined;
  return { from, to: dateFromJson(r?.to) };
};
