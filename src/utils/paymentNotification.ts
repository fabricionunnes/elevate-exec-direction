import { supabase } from "@/integrations/supabase/client";

/**
 * Sends payment confirmation notifications to staff members who have explicitly
 * subscribed to payment notifications (same list used for WhatsApp alerts).
 */
export async function sendPaymentNotification(
  companyName: string,
  amount: number,
  description?: string
) {
  try {
    // Get only staff who are subscribed to payment notifications
    const { data: subscribers, error: subsError } = await supabase
      .from("payment_notification_subscribers")
      .select("staff_id")
      .eq("is_active", true);

    if (subsError) {
      console.error("Error loading payment subscribers:", subsError);
      return;
    }

    const staffIds = Array.from(
      new Set((subscribers || []).map((s) => s.staff_id).filter(Boolean))
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
