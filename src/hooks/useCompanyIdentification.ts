import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IdentifiedCompany {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  contract_value: number | null;
  billing_day: number | null;
  is_billing_blocked: boolean;
  segment: string | null;
}

export interface CompanyInvoice {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount_cents: number | null;
  discount_cents: number;
  interest_cents: number;
  late_fee_cents: number;
  payment_link_url: string | null;
  public_token: string;
}

interface UseCompanyIdentificationParams {
  phone?: string | null;
  cnpj?: string | null;
}

const cleanPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
};

const cleanDocument = (doc: string | null | undefined): string | null => {
  if (!doc) return null;
  return doc.replace(/\D/g, "");
};

export function useCompanyIdentification({ phone, cnpj }: UseCompanyIdentificationParams) {
  const [company, setCompany] = useState<IdentifiedCompany | null>(null);
  const [invoices, setInvoices] = useState<CompanyInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    const cleanedPhone = cleanPhone(phone);
    const cleanedCnpj = cleanDocument(cnpj);

    if (!cleanedPhone && !cleanedCnpj) {
      setCompany(null);
      setInvoices([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query conditions
      const conditions: string[] = [];
      
      if (cleanedPhone) {
        // Match last 8 digits to handle cases where WhatsApp strips the 9
        const last8 = cleanedPhone.slice(-8);
        conditions.push(`phone.ilike.%${last8}%`);
      }
      
      if (cleanedCnpj) {
        conditions.push(`cnpj.ilike.%${cleanedCnpj}%`);
      }

      const { data, error: fetchError } = await supabase
        .from("onboarding_companies")
        .select("id, name, cnpj, phone, email, status, contract_value, billing_day, is_billing_blocked, segment")
        .or(conditions.join(","))
        .limit(5);

      if (fetchError) throw fetchError;

      // Filter for actual matches using last 8 digits (handles missing 9 and country code differences)
      const matched = (data || []).filter(comp => {
        const compPhone = cleanPhone(comp.phone);
        const compCnpj = cleanDocument(comp.cnpj);

        if (cleanedPhone && compPhone) {
          const phoneLast8 = cleanedPhone.slice(-8);
          const compLast8 = compPhone.slice(-8);
          if (phoneLast8 === compLast8) return true;
        }
        if (cleanedCnpj && compCnpj === cleanedCnpj) return true;
        return false;
      });

      if (matched.length > 0) {
        const found = matched[0] as IdentifiedCompany;
        setCompany(found);
        // Auto-fetch invoices
        fetchInvoices(found.id);
      } else {
        setCompany(null);
        setInvoices([]);
      }
    } catch (err: any) {
      console.error("Error identifying company:", err);
      setError(err.message);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [phone, cnpj]);

  const fetchInvoices = async (companyId: string) => {
    setLoadingInvoices(true);
    try {
      const { data, error: invError } = await supabase
        .from("company_invoices")
        .select("id, description, amount_cents, due_date, status, paid_at, paid_amount_cents, discount_cents, interest_cents, late_fee_cents, payment_link_url, public_token")
        .eq("company_id", companyId)
        .in("status", ["pending", "overdue", "parcial"])
        .order("due_date", { ascending: true });

      if (invError) throw invError;
      setInvoices((data || []) as CompanyInvoice[]);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return {
    company,
    invoices,
    loading,
    loadingInvoices,
    error,
    refetch: fetchCompany,
    refetchInvoices: () => company && fetchInvoices(company.id),
  };
}
