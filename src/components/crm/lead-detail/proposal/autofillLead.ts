import { supabase } from "@/integrations/supabase/client";

interface Args {
  leadId: string;
  leadName: string;
  companyName?: string | null;
  transcription: string;
}

const FIELD_LABEL: Record<string, string> = {
  product_id: "Produto",
  opportunity_value: "Valor",
  payment_method: "Forma de pagamento",
  segment: "Segmento",
  estimated_revenue: "Faturamento",
  employee_count: "Funcionários",
  main_pain: "Dor principal",
};

export interface AutofillResult {
  filled: string[];
  /** a IA extraiu ALGO da transcrição (mesmo que já estivesse preenchido) */
  extractedAny: boolean;
}

/**
 * Extrai dados da transcrição (IA) e preenche os campos VAZIOS do lead no CRM.
 * Nunca sobrescreve o que já está preenchido. Retorna os rótulos preenchidos.
 */
export async function autofillLeadFromTranscription({ leadId, leadName, companyName, transcription }: Args): Promise<AutofillResult> {
  const [{ data: lead }, { data: services }, { data: pms }] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("product_id, opportunity_value, payment_method, segment, estimated_revenue, employee_count, main_pain")
      .eq("id", leadId)
      .maybeSingle(),
    supabase.from("onboarding_services").select("id, name").eq("is_active", true),
    supabase.from("crm_payment_method_options").select("id, name"),
  ]);

  const { data, error } = await supabase.functions.invoke("crm-autofill", {
    body: {
      transcription,
      services: services || [],
      paymentMethods: pms || [],
      leadName,
      companyName,
    },
  });
  if (error) throw new Error(error.message || "Falha ao extrair dados");
  const f = (data as any)?.fields;
  if (!f) return { filled: [], extractedAny: false };

  const cur = (lead || {}) as any;
  const patch: Record<string, unknown> = {};
  // Vazio = null/undefined/"" OU zero — inclusive zero como TEXTO ("0.00"),
  // que é como o numeric do Postgres chega no supabase-js. Sem isso, um lead
  // com Valor R$ 0,00 era tratado como "já preenchido" e o autofill pulava.
  const isEmptyVal = (v: unknown): boolean => {
    if (v === null || v === undefined || v === "") return true;
    if (typeof v === "number") return v === 0;
    if (typeof v === "string") {
      const n = parseFloat(v);
      return !Number.isNaN(n) && n === 0 && /^[\d.,\s-]+$/.test(v.trim());
    }
    return false;
  };
  const setIfEmpty = (col: string, val: unknown) => {
    if (val !== null && val !== undefined && val !== "" && isEmptyVal(cur[col])) patch[col] = val;
  };

  setIfEmpty("product_id", f.product_id);
  setIfEmpty("opportunity_value", typeof f.opportunity_value === "number" ? f.opportunity_value : null);
  setIfEmpty("payment_method", f.payment_method_id);
  setIfEmpty("segment", f.segment);
  setIfEmpty("estimated_revenue", f.estimated_revenue);
  setIfEmpty("employee_count", f.employee_count);
  setIfEmpty("main_pain", f.main_pain);

  const keys = Object.keys(patch);
  if (keys.length) {
    const { error: upErr } = await supabase.from("crm_leads").update(patch).eq("id", leadId);
    if (upErr) throw upErr;
  }
  const extractedAny = [f.product_id, f.opportunity_value, f.payment_method_id, f.segment, f.estimated_revenue, f.employee_count, f.main_pain]
    .some((v) => v !== null && v !== undefined && v !== "");
  return { filled: keys.map((k) => FIELD_LABEL[k] || k), extractedAny };
}
