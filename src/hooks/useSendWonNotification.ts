import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadData {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  document: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  opportunity_value: number | null;
  trade_name: string | null;
  zipcode: string | null;
  installments: string | null;
  due_day: number | null;
  payment_method: string | null;
  address: string | null;
  closed_at: string | null;
  closer_staff_id: string | null;
  sdr_staff_id: string | null;
  product_id: string | null;
  plan_id: string | null;
}

interface NotificationConfig {
  enabled: boolean;
  instanceId: string | null;
  groupJid: string | null;
}

export async function sendWonLeadNotification(leadId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Load notification settings
    const { data: settings } = await supabase
      .from("crm_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "won_notification_enabled",
        "won_notification_instance_id",
        "won_notification_group_jid",
      ]);

    if (!settings || settings.length === 0) {
      return { success: false, error: "Configurações não encontradas" };
    }

    const config: NotificationConfig = {
      enabled: false,
      instanceId: null,
      groupJid: null,
    };

    settings.forEach((s) => {
      if (s.setting_key === "won_notification_enabled") {
        config.enabled = s.setting_value === "true";
      } else if (s.setting_key === "won_notification_instance_id") {
        config.instanceId = s.setting_value as string || null;
      } else if (s.setting_key === "won_notification_group_jid") {
        config.groupJid = s.setting_value as string || null;
      }
    });

    // Check if notifications are enabled and configured
    if (!config.enabled) {
      return { success: false, error: "Notificações desativadas" };
    }

    if (!config.instanceId || !config.groupJid) {
      return { success: false, error: "Configuração incompleta" };
    }

    // 2. Load full lead data with relationships
    const { data: lead, error: leadError } = await supabase
      .from("crm_leads")
      .select(`
        *,
        closer:onboarding_staff!crm_leads_closer_staff_id_fkey(name),
        sdr:onboarding_staff!crm_leads_sdr_staff_id_fkey(name),
        product:onboarding_services!crm_leads_product_id_fkey(name),
        plan:crm_plans!crm_leads_plan_id_fkey(name)
      `)
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: "Lead não encontrado" };
    }

    // 2.1 Load payment method name if payment_method is an ID
    let paymentMethodName = lead.payment_method;
    if (lead.payment_method) {
      const { data: pmData } = await supabase
        .from("crm_payment_method_options")
        .select("name")
        .eq("id", lead.payment_method)
        .single();
      
      if (pmData?.name) {
        paymentMethodName = pmData.name;
      }
    }

    // 3. Format the message
    const message = formatWonMessage(lead, paymentMethodName);

    // 4. Send message via evolution-api
    const { data: response, error: sendError } = await supabase.functions.invoke("evolution-api", {
      body: {
        action: "sendGroupText",
        instanceId: config.instanceId,
        groupId: config.groupJid,
        message: message,
      },
    });

    if (sendError) {
      console.error("Error sending won notification:", sendError);
      return { success: false, error: sendError.message };
    }

    if (response?.error) {
      console.error("Evolution API error:", response.error);
      return { success: false, error: response.error };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in sendWonLeadNotification:", error);
    return { success: false, error: error.message };
  }
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPhone(phone: string | null): string {
  if (!phone) return "Não informado";
  // Clean and format phone number
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  } else if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function formatCEP(zipcode: string | null): string {
  if (!zipcode) return "Não informado";
  const clean = zipcode.replace(/\D/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return zipcode;
}

function formatCNPJ(document: string | null): string {
  if (!document) return "Não informado";
  const clean = document.replace(/\D/g, "");
  if (clean.length === 14) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
  return document;
}

function formatWonMessage(lead: any, paymentMethodName: string | null): string {
  const closedAt = lead.closed_at ? new Date(lead.closed_at) : new Date();
  const formattedDate = format(closedAt, "dd/MM/yyyy", { locale: ptBR });

  const sdrName = lead.sdr?.name || "Não informado";
  const closerName = lead.closer?.name || "Não informado";
  const serviceName = lead.product?.name || "Não informado";
  const planName = lead.plan?.name || "Não informado";

  const lines: string[] = [
    "🎉 *NOVA VENDA FECHADA!* 🎉",
    "",
    `📅 *Data:* ${formattedDate}`,
    `👥 *SDR:* ${sdrName}`,
    `👔 *Closer:* ${closerName}`,
    "",
    "📋 *DADOS DO NEGÓCIO*",
    `🏢 *Serviço:* ${serviceName}`,
    `🏪 *Empresa:* ${lead.company || "Não informado"}`,
  ];

  if (lead.trade_name) {
    lines.push(`📝 *Nome Fantasia:* ${lead.trade_name}`);
  }

  lines.push(`📄 *CNPJ:* ${formatCNPJ(lead.document)}`);
  lines.push(`🏷️ *Segmento:* ${lead.segment || "Não informado"}`);
  lines.push(`📦 *Plano:* ${planName}`);

  lines.push("");
  lines.push("💰 *FINANCEIRO*");
  lines.push(`💵 *Valor:* ${formatCurrency(lead.opportunity_value)}`);

  if (lead.installments) {
    lines.push(`🔢 *Parcelas:* ${lead.installments}`);
  }

  if (lead.due_day) {
    lines.push(`📆 *Vencimento:* Dia ${lead.due_day}`);
  }

  if (paymentMethodName) {
    lines.push(`💳 *Forma:* ${paymentMethodName}`);
  }

  lines.push("");
  lines.push("👤 *CONTATO*");
  lines.push(`📛 *Nome:* ${lead.name || "Não informado"}`);
  lines.push(`📱 *Telefone:* ${formatPhone(lead.phone)}`);
  lines.push(`✉️ *E-mail:* ${lead.email || "Não informado"}`);

  lines.push("");
  lines.push("📍 *ENDEREÇO*");
  
  if (lead.address) {
    lines.push(`🏠 *Rua:* ${lead.address}`);
  }
  
  lines.push(`🏙️ *Cidade:* ${lead.city || "Não informado"}`);
  lines.push(`🗺️ *Estado:* ${lead.state || "Não informado"}`);
  lines.push(`📮 *CEP:* ${formatCEP(lead.zipcode)}`);

  lines.push("");
  lines.push("🚀 *Parabéns à equipe!*");

  if (lead.notes) {
    lines.push("");
    lines.push("📝 *BRIEFING*");
    // Truncate if too long
    const briefing = lead.notes.length > 500 ? lead.notes.substring(0, 500) + "..." : lead.notes;
    lines.push(briefing);
  }

  return lines.join("\n");
}
