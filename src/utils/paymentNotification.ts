import { supabase } from "@/integrations/supabase/client";

/**
 * Sends payment confirmation notifications to all staff members
 * who have fin_receivables_view permission or are master/admin.
 */
export async function sendPaymentNotification(
  companyName: string,
  amount: number,
  description?: string
) {
  try {
    // Get all active staff with master/admin roles (they have full access)
    const { data: masterStaff } = await supabase
      .from("onboarding_staff")
      .select("id, role")
      .eq("is_active", true)
      .in("role", ["master", "admin"]);

    // Get staff with fin_receivables_view permission
    const { data: permStaff } = await supabase
      .from("staff_financial_permissions")
      .select("staff_id")
      .eq("permission_key", "fin_receivables_view");

    // Also check staff with financial menu permission
    const { data: menuStaff } = await supabase
      .from("staff_menu_permissions")
      .select("staff_id")
      .eq("menu_key", "financial");

    // Combine unique staff IDs
    const staffIds = new Set<string>();
    (masterStaff || []).forEach(s => staffIds.add(s.id));
    (permStaff || []).forEach(s => staffIds.add(s.staff_id));
    (menuStaff || []).forEach(s => staffIds.add(s.staff_id));

    if (staffIds.size === 0) return;

    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);

    const title = `💰 Pagamento confirmado: ${companyName}`;
    const message = `Pagamento de ${formattedAmount} confirmado${description ? ` - ${description}` : ""} para ${companyName}.`;

    const notifications = Array.from(staffIds).map(staffId => ({
      staff_id: staffId,
      type: "payment_confirmed",
      title,
      message,
    }));

    const { error } = await supabase
      .from("onboarding_notifications")
      .insert(notifications);

    if (error) {
      console.error("Error sending payment notifications:", error);
    }
  } catch (error) {
    console.error("Error in sendPaymentNotification:", error);
  }
}
