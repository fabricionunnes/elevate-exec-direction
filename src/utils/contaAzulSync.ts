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
  type: "receivable" | "payable",
  data: {
    description?: string;
    amount?: number;
    due_date?: string;
    client_name?: string;
    supplier_name?: string;
  },
  contaAzulId?: string | null
): Promise<string | null> {
  try {
    const connected = await isContaAzulConnected();
    if (!connected) return null;

    const { data: result, error } = await supabase.functions.invoke("conta-azul-oauth", {
      body: {
        action: "create-entry",
        type,
        data,
        conta_azul_id: contaAzulId || undefined,
      },
    });

    if (error) {
      console.error("Conta Azul sync error:", error);
      toast.warning("Salvo localmente, mas falha ao sincronizar com Conta Azul");
      return null;
    }

    if (result?.conta_azul_id) {
      console.log("Synced to Conta Azul:", result.conta_azul_id);
      return result.conta_azul_id;
    }

    return null;
  } catch (err) {
    console.error("Conta Azul sync error:", err);
    toast.warning("Salvo localmente, mas falha ao sincronizar com Conta Azul");
    return null;
  }
}

/**
 * Confirm payment (baixa) in Conta Azul.
 * Non-blocking: errors only show a warning.
 */
export async function syncPaymentToContaAzul(
  contaAzulId: string,
  type: "receivable" | "payable",
  paidAt?: string,
  paidAmount?: number
): Promise<boolean> {
  try {
    const connected = await isContaAzulConnected();
    if (!connected) return false;

    const { error } = await supabase.functions.invoke("conta-azul-oauth", {
      body: {
        action: "confirm-payment",
        conta_azul_id: contaAzulId,
        type,
        paid_at: paidAt || new Date().toISOString().split("T")[0],
        paid_amount: paidAmount,
      },
    });

    if (error) {
      console.error("Conta Azul payment sync error:", error);
      toast.warning("Baixa local OK, mas falha ao sincronizar com Conta Azul");
      return false;
    }

    return true;
  } catch (err) {
    console.error("Conta Azul payment sync error:", err);
    toast.warning("Baixa local OK, mas falha ao sincronizar com Conta Azul");
    return false;
  }
}
