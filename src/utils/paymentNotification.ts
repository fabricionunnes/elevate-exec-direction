import { supabase } from "@/integrations/supabase/client";

/**
 * Sends payment confirmation notifications to all subscribed staff members.
 */
export async function sendPaymentNotification(
  companyName: string,
  amount: number,
  description?: string
) {
  try {
    // Get all active subscribers
    const { data: subscribers } = await supabase
      .from("payment_notification_subscribers")
      .select("staff_id")
      .eq("is_active", true);

    if (!subscribers || subscribers.length === 0) return;

    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);

    const title = `💰 Pagamento confirmado: ${companyName}`;
    const message = `Pagamento de ${formattedAmount} confirmado${description ? ` - ${description}` : ""} para ${companyName}.`;

    // Insert notifications for all subscribers
    const notifications = subscribers.map(sub => ({
      staff_id: sub.staff_id,
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
