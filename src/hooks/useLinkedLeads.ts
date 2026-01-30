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
}

// Clean phone number for comparison (remove all non-digits)
const cleanPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
};

// Clean document for comparison (remove all non-digits)
const cleanDocument = (doc: string | null | undefined): string | null => {
  if (!doc) return null;
  return doc.replace(/\D/g, "");
};

export function useLinkedLeads({ phone, email, document }: UseLinkedLeadsParams) {
  const [leads, setLeads] = useState<LinkedLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkedLeads = useCallback(async () => {
    const cleanedPhone = cleanPhone(phone);
    const cleanedDocument = cleanDocument(document);
    const cleanedEmail = email?.toLowerCase().trim();

    // Only search if we have at least one identifier
    if (!cleanedPhone && !cleanedEmail && !cleanedDocument) {
      setLeads([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build OR conditions for matching leads
      const conditions: string[] = [];
      
      if (cleanedPhone) {
        // Match phone with or without country code, cleaning both sides
        conditions.push(`phone.ilike.%${cleanedPhone.slice(-9)}%`);
      }
      
      if (cleanedEmail) {
        conditions.push(`email.ilike.${cleanedEmail}`);
      }
      
      if (cleanedDocument) {
        // Match document with any formatting
        conditions.push(`document.ilike.%${cleanedDocument}%`);
      }

      // Fetch leads matching any of the identifiers
      const { data, error: fetchError } = await supabase
        .from("crm_leads")
        .select(`
          id,
          name,
          company,
          phone,
          email,
          document,
          opportunity_value,
          pipeline:crm_pipelines(id, name),
          stage:crm_stages(id, name, color),
          created_at
        `)
        .or(conditions.join(","))
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Filter results to ensure actual matches (due to ilike limitations)
      const filteredLeads = (data || []).filter(lead => {
        const leadPhone = cleanPhone(lead.phone);
        const leadEmail = lead.email?.toLowerCase().trim();
        const leadDocument = cleanDocument(lead.document);

        // Match if any identifier matches
        if (cleanedPhone && leadPhone) {
          // Match last 9 digits (common phone matching)
          if (leadPhone.slice(-9) === cleanedPhone.slice(-9)) return true;
        }
        
        if (cleanedEmail && leadEmail === cleanedEmail) return true;
        
        if (cleanedDocument && leadDocument === cleanedDocument) return true;

        return false;
      });

      setLeads(filteredLeads as LinkedLead[]);
    } catch (err: any) {
      console.error("Error fetching linked leads:", err);
      setError(err.message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [phone, email, document]);

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
