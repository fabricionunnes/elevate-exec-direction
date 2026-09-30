import { supabase } from "@/integrations/supabase/client";

/**
 * Trava de etapa do kanban (benchmark Datacrazy, item 6).
 *
 * Duas regras, checadas na hora de mover o lead:
 *  - SAIR da etapa: toda ação da etapa marcada como obrigatória (crm_stage_actions.is_required)
 *    precisa estar concluída. A atividade criada pela ação carrega stage_action_id; atividades
 *    antigas (sem o vínculo) casam pelo título.
 *  - ENTRAR na etapa: crm_stages.required_fields lista os campos que o lead precisa ter
 *    preenchidos. "phone", "email"... são colunas de crm_leads; "custom:<id>" é campo adicional
 *    (crm_custom_fields / crm_custom_field_values). Etapa de ganho sempre exige o valor.
 */

export type GateFieldType = "text" | "number" | "textarea" | "staff" | "origin" | "product" | "loss_reason";

export interface GateFieldDef {
  key: string;
  label: string;
  type: GateFieldType;
  /** campo adicional (crm_custom_fields.id) quando a chave é custom:<id> */
  customFieldId?: string;
  /** opções de um campo adicional do tipo select */
  options?: string[];
}

/** Colunas reais de crm_leads que podem ser exigidas numa etapa. */
export const LEAD_FIELD_CATALOG: GateFieldDef[] = [
  { key: "name", label: "Nome", type: "text" },
  { key: "phone", label: "Telefone", type: "text" },
  { key: "email", label: "E-mail", type: "text" },
  { key: "company", label: "Empresa", type: "text" },
  { key: "document", label: "Documento (CNPJ/CPF)", type: "text" },
  { key: "cpf", label: "CPF", type: "text" },
  { key: "role", label: "Cargo", type: "text" },
  { key: "instagram", label: "Instagram", type: "text" },
  { key: "city", label: "Cidade", type: "text" },
  { key: "state", label: "Estado", type: "text" },
  { key: "segment", label: "Segmento", type: "text" },
  { key: "estimated_revenue", label: "Faturamento informado", type: "text" },
  { key: "employee_count", label: "Número de funcionários", type: "text" },
  { key: "main_pain", label: "Dor principal", type: "textarea" },
  { key: "opportunity_value", label: "Valor da oportunidade", type: "number" },
  { key: "owner_staff_id", label: "Responsável", type: "staff" },
  { key: "closer_staff_id", label: "Closer", type: "staff" },
  { key: "sdr_staff_id", label: "SDR", type: "staff" },
  { key: "origin_id", label: "Origem", type: "origin" },
  { key: "product_id", label: "Produto", type: "product" },
  { key: "loss_reason_id", label: "Motivo de perda", type: "loss_reason" },
  { key: "payment_method", label: "Forma de pagamento", type: "text" },
  { key: "installments", label: "Parcelas", type: "text" },
  { key: "trade_name", label: "Nome fantasia", type: "text" },
  { key: "zipcode", label: "CEP", type: "text" },
  { key: "address", label: "Endereço", type: "text" },
  { key: "legal_representative_name", label: "Representante legal", type: "text" },
  { key: "notes", label: "Notas", type: "textarea" },
];

const CATALOG_COLUMNS = LEAD_FIELD_CATALOG.map((f) => f.key);

export const isCustomKey = (key: string) => key.startsWith("custom:");
export const customIdOf = (key: string) => key.slice("custom:".length);

export interface PendingActivity {
  id: string;
  title: string;
  type: string;
  scheduled_at: string | null;
}

export interface MissingField {
  def: GateFieldDef;
  current: string;
}

export interface LeadGateResult {
  leadId: string;
  leadName: string;
  fromStageId: string | null;
  pendingActivities: PendingActivity[];
  missingFields: MissingField[];
}

export const gateIsBlocked = (r: LeadGateResult | undefined | null) =>
  !!r && (r.pendingActivities.length > 0 || r.missingFields.length > 0);

/** Campos adicionais ativos (fora os que já são coluna do lead). Cache simples por sessão. */
let customFieldsCache: { id: string; label: string; field_type: string; options: string[] }[] | null = null;
export async function loadCustomFieldDefs(force = false) {
  if (customFieldsCache && !force) return customFieldsCache;
  const { data } = await supabase
    .from("crm_custom_fields")
    .select("id, field_name, field_label, field_type, options, is_system, is_active")
    .eq("is_active", true)
    .order("sort_order");
  customFieldsCache = (data || [])
    .filter((f: any) => !f.is_system && !CATALOG_COLUMNS.includes(f.field_name))
    .map((f: any) => ({
      id: f.id,
      label: f.field_label || f.field_name,
      field_type: f.field_type,
      options: Array.isArray(f.options) ? f.options.map(String) : [],
    }));
  return customFieldsCache;
}

/** Resolve as chaves guardadas em crm_stages.required_fields pra definições com rótulo. */
export async function resolveFieldDefs(keys: string[]): Promise<GateFieldDef[]> {
  const customs = keys.some(isCustomKey) ? await loadCustomFieldDefs() : [];
  const out: GateFieldDef[] = [];
  for (const key of keys) {
    if (isCustomKey(key)) {
      const cf = customs.find((c) => c.id === customIdOf(key));
      if (cf) out.push({ key, label: cf.label, type: cf.field_type === "number" ? "number" : cf.field_type === "textarea" ? "textarea" : "text", customFieldId: cf.id, options: cf.options.length ? cf.options : undefined });
      continue;
    }
    const def = LEAD_FIELD_CATALOG.find((f) => f.key === key);
    if (def) out.push(def);
  }
  return out;
}

const isEmptyValue = (key: string, v: unknown) => {
  if (v === null || v === undefined) return true;
  if (key === "opportunity_value") return !(Number(v) > 0);
  return String(v).trim() === "";
};

const chunk = <T,>(arr: T[], size = 100): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Checa a trava pra um ou vários leads indo pra mesma etapa. Uma consulta por tabela,
 * em lotes de 100 leads, pra servir também as ações em massa.
 */
export async function checkStageGate(leadIds: string[], toStageId: string): Promise<Map<string, LeadGateResult>> {
  const result = new Map<string, LeadGateResult>();
  if (leadIds.length === 0) return result;

  // Etapa destino: campos exigidos (+ valor quando é ganho)
  const { data: toStage } = await supabase
    .from("crm_stages")
    .select("id, final_type, required_fields")
    .eq("id", toStageId)
    .maybeSingle();
  const requiredKeys = new Set<string>(((toStage as any)?.required_fields as string[] | null) || []);
  if ((toStage as any)?.final_type === "won") requiredKeys.add("opportunity_value");
  const fieldDefs = await resolveFieldDefs([...requiredKeys]);
  const columnKeys = fieldDefs.filter((d) => !d.customFieldId).map((d) => d.key);
  const customIds = fieldDefs.filter((d) => d.customFieldId).map((d) => d.customFieldId!);

  const selectCols = ["id", "name", "stage_id", ...columnKeys.filter((k) => !["id", "name", "stage_id"].includes(k))].join(", ");
  const leads: any[] = [];
  for (const ids of chunk(leadIds)) {
    // select montado em tempo de execução: o parser de tipos do supabase-js não resolve
    const { data } = await (supabase.from("crm_leads") as any).select(selectCols).in("id", ids);
    leads.push(...((data || []) as any[]));
  }

  // Ações obrigatórias das etapas de origem
  const fromStageIds = [...new Set(leads.map((l) => l.stage_id).filter(Boolean))] as string[];
  const { data: actions } = fromStageIds.length
    ? await supabase.from("crm_stage_actions").select("id, stage_id, activity_title").eq("is_required", true).in("stage_id", fromStageIds)
    : { data: [] as any[] };
  const requiredActions = (actions || []) as { id: string; stage_id: string; activity_title: string }[];

  const pendingByLead = new Map<string, PendingActivity[]>();
  if (requiredActions.length) {
    const actionIds = requiredActions.map((a) => a.id);
    const titles = [...new Set(requiredActions.map((a) => a.activity_title))];
    for (const ids of chunk(leadIds)) {
      const { data: acts } = await supabase
        .from("crm_activities")
        .select("id, lead_id, title, type, scheduled_at, stage_action_id")
        .in("lead_id", ids)
        .eq("status", "pending")
        .or(`stage_action_id.in.(${actionIds.join(",")}),and(stage_action_id.is.null,title.in.(${titles.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(",")}))`);
      for (const a of (acts || []) as any[]) {
        const lead = leads.find((l) => l.id === a.lead_id);
        if (!lead) continue;
        // só conta se a ação pertence à etapa em que o lead está agora
        const belongs = requiredActions.some(
          (ra) => ra.stage_id === lead.stage_id && (ra.id === a.stage_action_id || (!a.stage_action_id && ra.activity_title === a.title)),
        );
        if (!belongs) continue;
        const list = pendingByLead.get(a.lead_id) || [];
        if (!list.some((p) => p.id === a.id)) list.push({ id: a.id, title: a.title, type: a.type, scheduled_at: a.scheduled_at });
        pendingByLead.set(a.lead_id, list);
      }
    }
  }

  // Valores dos campos adicionais exigidos
  const customValues = new Map<string, Record<string, string | null>>();
  if (customIds.length) {
    for (const ids of chunk(leadIds)) {
      const { data: vals } = await supabase
        .from("crm_custom_field_values")
        .select("lead_id, field_id, value")
        .in("lead_id", ids)
        .in("field_id", customIds);
      for (const v of (vals || []) as any[]) {
        const m = customValues.get(v.lead_id) || {};
        m[v.field_id] = v.value;
        customValues.set(v.lead_id, m);
      }
    }
  }

  for (const lead of leads) {
    const missing: MissingField[] = [];
    for (const def of fieldDefs) {
      const raw = def.customFieldId ? customValues.get(lead.id)?.[def.customFieldId] : lead[def.key];
      if (isEmptyValue(def.key, raw)) missing.push({ def, current: raw == null ? "" : String(raw) });
    }
    result.set(lead.id, {
      leadId: lead.id,
      leadName: lead.name || "Lead",
      fromStageId: lead.stage_id || null,
      pendingActivities: pendingByLead.get(lead.id) || [],
      missingFields: missing,
    });
  }
  return result;
}

/** Grava os valores preenchidos no diálogo de pendências (coluna do lead ou campo adicional). */
export async function saveGateFieldValues(leadId: string, values: Record<string, string>) {
  const columnUpdate: Record<string, any> = {};
  const customUpserts: { lead_id: string; field_id: string; value: string | null }[] = [];
  for (const [key, raw] of Object.entries(values)) {
    const v = (raw ?? "").trim();
    if (isCustomKey(key)) {
      customUpserts.push({ lead_id: leadId, field_id: customIdOf(key), value: v || null });
      continue;
    }
    if (key === "opportunity_value") columnUpdate[key] = v ? Number(v.replace(",", ".")) : null;
    else columnUpdate[key] = v || null;
  }
  if (Object.keys(columnUpdate).length) {
    const { error } = await supabase.from("crm_leads").update(columnUpdate).eq("id", leadId);
    if (error) throw error;
  }
  if (customUpserts.length) {
    const { error } = await supabase.from("crm_custom_field_values").upsert(customUpserts, { onConflict: "lead_id,field_id" });
    if (error) throw error;
  }
}

export async function completePendingActivity(activityId: string) {
  const { error } = await supabase
    .from("crm_activities")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", activityId);
  if (error) throw error;
}

/** Master/admin passou por cima da trava: fica registrado no histórico do lead. */
export async function logGateOverride(params: {
  leadIds: string[];
  staffId: string | null;
  targetStageName: string;
  results: Map<string, LeadGateResult>;
}) {
  const rows = params.leadIds
    .map((id) => params.results.get(id))
    .filter((r): r is LeadGateResult => !!r && gateIsBlocked(r))
    .map((r) => {
      const partes: string[] = [];
      if (r.pendingActivities.length) partes.push(`atividades pendentes: ${r.pendingActivities.map((a) => a.title).join(", ")}`);
      if (r.missingFields.length) partes.push(`campos em branco: ${r.missingFields.map((m) => m.def.label).join(", ")}`);
      return {
        lead_id: r.leadId,
        action: "stage_gate_override",
        field_changed: "stage_id",
        new_value: params.targetStageName,
        notes: `Movido apesar das pendências (${partes.join("; ")})`,
        staff_id: params.staffId,
      };
    });
  if (!rows.length) return;
  const { error } = await supabase.from("crm_lead_history").insert(rows);
  if (error) console.error("logGateOverride:", error);
}

/** Opções pros campos de seleção do diálogo (responsável, origem, produto, motivo). */
export interface GateSelectOptions {
  staff: { value: string; label: string }[];
  origins: { value: string; label: string }[];
  products: { value: string; label: string }[];
  lossReasons: { value: string; label: string }[];
}
export async function loadGateSelectOptions(): Promise<GateSelectOptions> {
  const [staff, origins, products, reasons] = await Promise.all([
    supabase.from("onboarding_staff").select("id, name").eq("is_active", true)
      .in("role", ["master", "admin", "head_comercial", "closer", "sdr", "social_setter", "bdr"]).order("name"),
    supabase.from("crm_origins").select("id, name").eq("is_active", true).order("name"),
    supabase.from("onboarding_services").select("id, name").eq("is_active", true).order("name"),
    supabase.from("crm_loss_reasons").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  const map = (rows: any[] | null) => (rows || []).map((r) => ({ value: r.id, label: r.name }));
  return { staff: map(staff.data), origins: map(origins.data), products: map(products.data), lossReasons: map(reasons.data) };
}
