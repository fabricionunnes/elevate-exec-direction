import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LinkedLead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  opportunity_value: number | null;
  pipeline: { id: string; name: string } | null;
  stage: { id: string; name: string; color: string } | null;
  created_at: string;
}

interface UseLinkedLeadsParams {
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  leadId?: string | null;
}

// Clean phone number for comparison (remove all non-digits)
const cleanPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
};

/**
 * Chave de telefone brasileiro: DDD + 8 últimos dígitos (mesma regra da função br_phone_key
 * do banco). 03/11/2026, Fabrício: a conversa do Sergio (51 99733333) foi colada no lead
 * Guaciara (62 99733333) porque a tela comparava só os 8 últimos dígitos. Sem DDD não casa.
 */
export const brPhoneKey = (phone: string | null | undefined): string | null => {
  let d = cleanPhone(phone) || "";
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length >= 11 && d.startsWith("0")) d = d.slice(1);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : null;
};
export const samePhone = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const ka = brPhoneKey(a), kb = brPhoneKey(b);
  return !!ka && !!kb && ka === kb;
};

// Clean document for comparison (remove all non-digits)
const cleanDocument = (doc: string | null | undefined): string | null => {
  if (!doc) return null;
  return doc.replace(/\D/g, "");
};

export function useLinkedLeads({ phone, email, document, leadId }: UseLinkedLeadsParams) {
  const [leads, setLeads] = useState<LinkedLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkedLeads = useCallback(async () => {
    const cleanedPhone = cleanPhone(phone);
    const cleanedDocument = cleanDocument(document);
    const cleanedEmail = email?.toLowerCase().trim();

    if (!cleanedPhone && !cleanedEmail && !cleanedDocument && !leadId) {
      setLeads([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use SECURITY DEFINER RPC so users with CRM access can find linked
      // leads even when the lead is owned by another team member.
      const { data, error: fetchError } = await supabase.rpc("find_linked_crm_leads", {
        _phone_last8: cleanedPhone ? cleanedPhone.slice(-8) : null,
        _email: cleanedEmail || null,
        _document: cleanedDocument || null,
        _lead_id: leadId || null,
      });

      if (fetchError) throw fetchError;

      const mapped: LinkedLead[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        company: row.company,
        phone: row.phone,
        email: row.email,
        document: row.document,
        opportunity_value: row.opportunity_value,
        pipeline: row.pipeline_id ? { id: row.pipeline_id, name: row.pipeline_name } : null,
        stage: row.stage_id ? { id: row.stage_id, name: row.stage_name, color: row.stage_color } : null,
        created_at: row.created_at,
      }));

      // Extra last-8-digit safety filter on the client
      const filteredLeads = mapped.filter((lead) => {
        if (leadId && lead.id === leadId) return true;
        if (cleanedPhone && samePhone(lead.phone, cleanedPhone)) return true;
        if (cleanedEmail && lead.email?.toLowerCase().trim() === cleanedEmail) return true;
        if (cleanedDocument && cleanDocument(lead.document) === cleanedDocument) return true;
        return false;
      });

      setLeads(filteredLeads);
    } catch (err: any) {
      console.error("Error fetching linked leads:", err);
      setError(err.message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [phone, email, document, leadId]);

  useEffect(() => {
    fetchLinkedLeads();
  }, [fetchLinkedLeads]);

  return {
    leads,
    loading,
    error,
    refetch: fetchLinkedLeads,
  };
}
