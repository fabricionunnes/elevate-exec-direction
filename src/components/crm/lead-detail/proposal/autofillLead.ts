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

/**
 * Extrai dados da transcrição (IA) e preenche os campos VAZIOS do lead no CRM.
 * Nunca sobrescreve o que já está preenchido. Retorna os rótulos preenchidos.
 */
export async function autofillLeadFromTranscription({ leadId, leadName, companyName, transcription }: Args): Promise<string[]> {
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
  if (!f) return [];

  const cur = (lead || {}) as any;
  const patch: Record<string, unknown> = {};
  const setIfEmpty = (col: string, val: unknown) => {
    const empty = cur[col] === null || cur[col] === undefined || cur[col] === "" || cur[col] === 0;
    if (val !== null && val !== undefined && val !== "" && empty) patch[col] = val;
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
  return keys.map((k) => FIELD_LABEL[k] || k);
}
