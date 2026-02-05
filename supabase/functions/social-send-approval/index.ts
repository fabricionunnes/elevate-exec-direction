import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Get approval contacts
    const { data: approvalContacts } = await supabase
      .from("social_approval_contacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true);

    // Check if we have targets (phone contacts or group)
    const sendToGroup = settings.send_to_group && settings.group_jid;
    const hasContacts = approvalContacts && approvalContacts.length > 0;
    const hasLegacyPhone = settings.client_phone;

    if (!sendToGroup && !hasContacts && !hasLegacyPhone) {
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

    // Build approval URL - use the published domain
    const baseUrl = Deno.env.get("SITE_URL") || "https://elevate-exec-direction.lovable.app";

    const contentTypes: Record<string, string> = { 
      feed: "Feed", 
      estatico: "Estático",
      carrossel: "Carrossel",
      reels: "Reels", 
      stories: "Stories",
      outro: "Outro"
    };

    // Collect all targets to send to
    interface SendTarget {
      phone: string;
      name: string;
      isGroup: boolean;
      contactId?: string;
    }
    const targets: SendTarget[] = [];

    // Add group if configured
    if (sendToGroup) {
      targets.push({
        phone: settings.group_jid,
        name: settings.group_name || "Grupo",
        isGroup: true,
      });
    }

    // Add individual contacts from new table
    if (hasContacts) {
      for (const contact of approvalContacts!) {
        let phone = contact.phone.replace(/\D/g, "");
        if (!phone.startsWith("55")) {
          phone = "55" + phone;
        }
        targets.push({
          phone,
          name: contact.name || "",
          isGroup: false,
          contactId: contact.id,
        });
      }
    }

    // Fallback to legacy client_phone if no new contacts
    if (!hasContacts && hasLegacyPhone && !sendToGroup) {
      let phone = settings.client_phone.replace(/\D/g, "");
      if (!phone.startsWith("55")) {
        phone = "55" + phone;
      }
      targets.push({
        phone,
        name: settings.client_name || "",
        isGroup: false,
      });
    }

    let successCount = 0;
    const sentToContactIds: string[] = [];

    for (const target of targets) {
      try {
        // Create individual approval link for each contact
        const { data: approvalLink, error: linkError } = await supabase
          .from("social_approval_links")
          .insert({
            card_id: cardId,
            status: "pending",
            sent_at: new Date().toISOString(),
            sent_via: "whatsapp",
            contact_id: target.contactId || null,
          })
          .select("access_token")
          .single();

        if (linkError || !approvalLink) {
          console.error("Error creating approval link:", linkError);
          continue;
        }

        // Use the edge function URL for OG preview, it will redirect to the app
        const approvalUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-approval-preview?token=${approvalLink.access_token}`;

        const recipientName = target.isGroup 
          ? "" 
          : (target.name ? ` ${target.name}` : "");

        const message = `Olá${recipientName}! 👋

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
            number: target.phone,
            text: message,
          }),
        });

        if (sendResponse.ok) {
          successCount++;
          if (target.contactId) {
            sentToContactIds.push(target.contactId);
          }
        } else {
          const errorText = await sendResponse.text();
          console.error(`Error sending to ${target.phone}:`, errorText);
        }
      } catch (err) {
        console.error(`Error sending to ${target.phone}:`, err);
      }
    }

    // Log history
    await supabase.from("social_content_history").insert({
      card_id: cardId,
      action: "sent_for_approval",
      details: { 
        targets_count: targets.length,
        success_count: successCount,
        sent_to_contact_ids: sentToContactIds,
      },
    });

    if (successCount === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Não foi possível enviar para nenhum destinatário" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const successMessage = successCount === 1 
      ? "Link de aprovação enviado!"
      : `Links de aprovação enviados para ${successCount} contatos!`;

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
