import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Check if Conta Azul integration is active
 */
export async function isContaAzulConnected(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("conta-azul-oauth?action=status");
    if (error) return false;
    return data?.connected === true;
  } catch {
    return false;
  }
}

/**
 * Sync an entry (receivable or payable) to Conta Azul.
 * Creates if no contaAzulId, updates if contaAzulId is provided.
 * Returns the conta_azul_id or null on failure.
 * Errors are non-blocking (only shows a warning toast).
 */
export async function syncEntryToContaAzul(
  _type: "receivable" | "payable",
  _data: {
    description?: string;
    amount?: number;
    due_date?: string;
    client_name?: string;
    supplier_name?: string;
  },
  _contaAzulId?: string | null
): Promise<string | null> {
  // Sincronização desativada temporariamente
  return null;
}

/**
 * Confirm payment (baixa) in Conta Azul.
 * Non-blocking: errors only show a warning.
 */
export async function syncPaymentToContaAzul(
  _contaAzulId: string,
  _type: "receivable" | "payable",
  _paidAt?: string,
  _paidAmount?: number
): Promise<boolean> {
  // Sincronização desativada temporariamente
  return false;
}
