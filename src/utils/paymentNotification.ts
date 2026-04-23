import { supabase } from "@/integrations/supabase/client";

/**
 * Sends payment confirmation notifications to staff members who have explicitly
 * subscribed to payment notifications.
 *
 * IMPORTANT: Strictly tenant-isolated. The notification is dispatched only to
 * subscribers that belong to the SAME tenant as the staff user who registered
 * the payment. This prevents White-Label tenants from receiving notifications
 * about payments from other tenants (and vice-versa).
 */
export async function sendPaymentNotification(
  companyName: string,
  amount: number,
  description?: string
) {
  try {
    // Resolve current user's tenant (null = master UNV)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: currentStaff } = await supabase
      .from("onboarding_staff")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const currentTenantId = currentStaff?.tenant_id ?? null;

    // Get subscribers and join staff to filter by tenant
    const { data: subscribers, error: subsError } = await supabase
      .from("payment_notification_subscribers")
      .select("staff_id, onboarding_staff!inner(id, tenant_id, is_active)")
      .eq("is_active", true)
      .eq("onboarding_staff.is_active", true);

    if (subsError) {
      console.error("Error loading payment subscribers:", subsError);
      return;
    }

    // Strict tenant isolation: only subscribers from the same tenant
    const staffIds = Array.from(
      new Set(
        (subscribers || [])
          .filter((s: any) => {
            const subTenant = s.onboarding_staff?.tenant_id ?? null;
            return subTenant === currentTenantId;
          })
          .map((s: any) => s.staff_id)
          .filter(Boolean)
      )
    );

    if (staffIds.length === 0) return;

    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);

    const title = `💰 Pagamento confirmado: ${companyName}`;
    const message = `Pagamento de ${formattedAmount} confirmado${description ? ` - ${description}` : ""} para ${companyName}.`;

    const notifications = staffIds.map((staffId) => ({
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
