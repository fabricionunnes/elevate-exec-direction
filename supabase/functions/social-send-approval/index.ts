import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cardId, projectId } = await req.json();

    if (!cardId || !projectId) {
      return new Response(
        JSON.stringify({ error: "cardId e projectId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get WhatsApp settings for the project
    const { data: settings, error: settingsError } = await supabase
      .from("social_whatsapp_settings")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .single();

    if (settingsError || !settings?.whatsapp_instance_id) {
      console.log("WhatsApp settings not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Configurações de WhatsApp não encontradas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we have either a phone or a group configured
    const sendToGroup = settings.send_to_group && settings.group_jid;
    const hasPhoneTarget = settings.client_phone;

    if (!sendToGroup && !hasPhoneTarget) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum destinatário configurado (telefone ou grupo)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the card details
    const { data: card, error: cardError } = await supabase
      .from("social_content_cards")
      .select("*")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      throw new Error("Card não encontrado");
    }

    // Get WhatsApp instance details
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("api_url, api_key, instance_name")
      .eq("id", settings.whatsapp_instance_id)
      .single();

    if (instanceError || !instance?.api_url || !instance?.api_key) {
      return new Response(
        JSON.stringify({ success: false, message: "Instância WhatsApp não configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create approval link
    const { data: approvalLink, error: linkError } = await supabase
      .from("social_approval_links")
      .insert({
        card_id: cardId,
        status: "pending",
        sent_at: new Date().toISOString(),
        sent_via: "whatsapp",
      })
      .select("access_token")
      .single();

    if (linkError || !approvalLink) {
      throw new Error("Erro ao criar link de aprovação");
    }

    // Build approval URL - use the published domain
    const baseUrl = Deno.env.get("SITE_URL") || "https://elevate-exec-direction.lovable.app";
    const approvalUrl = `${baseUrl}/#/social/approval?token=${approvalLink.access_token}`;

    // Determine target (phone or group)
    let targetNumber: string;
    let isGroup = false;

    if (sendToGroup) {
      targetNumber = settings.group_jid;
      isGroup = true;
    } else {
      // Format phone number
      let phone = settings.client_phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) {
        phone = "55" + phone;
      }
      targetNumber = phone;
    }

    // Build message
    const contentTypes: Record<string, string> = { 
      feed: "Feed", 
      estatico: "Estático",
      carrossel: "Carrossel",
      reels: "Reels", 
      stories: "Stories",
      outro: "Outro"
    };

    const recipientName = isGroup 
      ? (settings.group_name || "Grupo") 
      : (settings.client_name ? ` ${settings.client_name}` : "");

    const message = `Olá${isGroup ? "" : recipientName}! 👋

Temos um novo conteúdo para sua aprovação:

📱 *${contentTypes[card.content_type] || card.content_type}*
📝 *Tema:* ${card.theme}

Clique no link abaixo para visualizar e aprovar ou solicitar ajustes:

🔗 ${approvalUrl}

Aguardamos seu feedback! ✨`;

    // Send via Evolution API
    const sendResponse = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: instance.api_key,
      },
      body: JSON.stringify({
        number: targetNumber,
        text: message,
      }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Error sending WhatsApp:", errorText);
      throw new Error("Erro ao enviar WhatsApp");
    }

    // Log history
    await supabase.from("social_content_history").insert({
      card_id: cardId,
      action: "sent_for_approval",
      details: { 
        target: targetNumber, 
        is_group: isGroup,
        approval_link_id: approvalLink.access_token 
      },
    });

    const successMessage = isGroup 
      ? `Link enviado para o grupo "${settings.group_name || "WhatsApp"}"!`
      : "Link enviado com sucesso!";

    return new Response(
      JSON.stringify({ success: true, message: successMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
