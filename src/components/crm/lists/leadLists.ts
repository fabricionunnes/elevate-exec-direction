// Listas de leads (crm_lead_lists / crm_lead_list_items): tipos e operações comuns.
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";

export interface LeadList {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_by: string | null;
  owner_name: string | null;
  is_shared: boolean;
  created_at: string;
  lead_count: number;
}

export const LIST_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#dc2626", "#7c3aed", "#0891b2", "#ca8a04", "#64748b"];

const db = supabase as any;
const CHUNK = 200;

/** Listas que a pessoa enxerga, com a contagem de leads feita no banco. */
export async function fetchLeadLists(): Promise<LeadList[]> {
  const { data, error } = await db.rpc("crm_lead_lists_overview");
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({ ...r, lead_count: Number(r.lead_count || 0) }));
}

export async function createLeadList(input: { name: string; description?: string; color?: string | null; is_shared: boolean }): Promise<{ id: string; name: string }> {
  const { data, error } = await db.from("crm_lead_lists")
    .insert({ name: input.name.trim(), description: input.description?.trim() || null, color: input.color || null, is_shared: input.is_shared })
    .select("id, name").single();
  if (error) throw error;
  return data;
}

/** Inclui os leads na lista (quem já está é ignorado). Devolve quantos entraram de fato. */
export async function addLeadsToList(listId: string, leadIds: string[]): Promise<number> {
  let added = 0;
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const part = leadIds.slice(i, i + CHUNK);
    const { data, error } = await db.from("crm_lead_list_items")
      .upsert(part.map((lead_id) => ({ list_id: listId, lead_id })), { onConflict: "list_id,lead_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    added += (data || []).length;
  }
  return added;
}

export async function removeLeadsFromList(listId: string, leadIds: string[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const part = leadIds.slice(i, i + CHUNK);
    const { data, error } = await db.from("crm_lead_list_items").delete().eq("list_id", listId).in("lead_id", part).select("id");
    if (error) throw error;
    removed += (data || []).length;
  }
  return removed;
}

/** Ids dos leads que estão em qualquer uma das listas (paginado: PostgREST corta em 1000). */
export async function fetchListLeadIds(listIds: string[]): Promise<Set<string>> {
  if (!listIds.length) return new Set();
  const rows = await fetchAllRows<{ lead_id: string }>((from, to) =>
    db.from("crm_lead_list_items").select("lead_id").in("list_id", listIds).order("id").range(from, to),
  );
  return new Set(rows.map((r) => r.lead_id));
}

/** Baixa a lista em CSV (separador ; e BOM, que é como o Excel em pt-BR abre certo). */
export async function exportLeadListCsv(list: { id: string; name: string }): Promise<number> {
  const rows = await fetchAllRows<any>((from, to) =>
    db.from("crm_lead_list_items")
      .select(`added_at, lead:crm_leads(
        name, company, phone, email, document, city, state, opportunity_value, created_at, last_activity_at,
        stage:crm_stages(name), pipeline:crm_pipelines(name),
        owner:onboarding_staff!crm_leads_owner_staff_id_fkey(name),
        tags:crm_lead_tags(tag:crm_tags(name))
      )`)
      .eq("list_id", list.id)
      .order("id")
      .range(from, to),
  );
  const leads = rows.filter((r) => r.lead);
  const cols: { h: string; get: (r: any) => string }[] = [
    { h: "Nome", get: (r) => r.lead.name || "" },
    { h: "Empresa", get: (r) => r.lead.company || "" },
    { h: "Telefone", get: (r) => r.lead.phone || "" },
    { h: "Email", get: (r) => r.lead.email || "" },
    { h: "Documento", get: (r) => r.lead.document || "" },
    { h: "Cidade", get: (r) => r.lead.city || "" },
    { h: "UF", get: (r) => r.lead.state || "" },
    { h: "Funil", get: (r) => r.lead.pipeline?.name || "" },
    { h: "Etapa", get: (r) => r.lead.stage?.name || "" },
    { h: "Responsavel", get: (r) => r.lead.owner?.name || "" },
    { h: "Valor", get: (r) => (r.lead.opportunity_value == null ? "" : String(r.lead.opportunity_value).replace(".", ",")) },
    { h: "Tags", get: (r) => (r.lead.tags || []).map((t: any) => t.tag?.name).filter(Boolean).join(" | ") },
    { h: "Criado em", get: (r) => (r.lead.created_at ? new Date(r.lead.created_at).toLocaleString("pt-BR") : "") },
    { h: "Ultima atividade", get: (r) => (r.lead.last_activity_at ? new Date(r.lead.last_activity_at).toLocaleString("pt-BR") : "") },
    { h: "Entrou na lista em", get: (r) => (r.added_at ? new Date(r.added_at).toLocaleString("pt-BR") : "") },
  ];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const csv = [cols.map((c) => esc(c.h)).join(";"), ...leads.map((r) => cols.map((c) => esc(c.get(r))).join(";"))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lista-${list.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "leads"}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return leads.length;
}
