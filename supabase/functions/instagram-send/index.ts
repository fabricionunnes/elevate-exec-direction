// Envia DM do Instagram a partir do inbox do CRM.
// body: { conversationId, message, staffId }
// Resolve a instância/contato da conversa, chama a Send API da Meta com o page
// token e grava a mensagem outbound em instagram_messages.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, message, staffId } = await req.json();
    if (!conversationId || !message?.trim()) {
      throw new Error("conversationId e message são obrigatórios");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Conversa + contato + instância
    const { data: conversation, error: convErr } = await supabase
      .from("instagram_conversations")
      .select(`
        id, instance_id, contact_id,
        contact:instagram_contacts(id, instagram_user_id),
        instance:instagram_instances(id, access_token, instagram_account_id, status)
      `)
      .eq("id", conversationId)
      .single();

    if (convErr || !conversation) throw new Error("Conversa não encontrada");
    const instance = (conversation as any).instance;
    const contact = (conversation as any).contact;
    if (!instance || instance.status !== "active") throw new Error("Conta do Instagram desconectada — reconecte nas configurações");
    if (!contact?.instagram_user_id) throw new Error("Contato sem Instagram ID");

    // Send API do Instagram Login (graph.instagram.com), janela de 24h de resposta
    const sendUrl = new URL(`https://graph.instagram.com/v21.0/${instance.instagram_account_id}/messages`);
    sendUrl.searchParams.set("access_token", instance.access_token);

    const sendResp = await fetch(sendUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: contact.instagram_user_id },
        messaging_type: "RESPONSE",
        message: { text: message.trim() },
      }),
    });
    const sendData = await sendResp.json();
    if (sendData.error) {
      console.error("IG send error:", sendData.error);
      throw new Error(sendData.error.message || "Falha ao enviar DM");
    }

    const now = new Date().toISOString();

    // Grava a mensagem (o webhook pode entregar o echo depois — dedup por message_id evita duplicar)
    await supabase.from("instagram_messages").insert({
      conversation_id: conversation.id,
      message_id: sendData.message_id ?? null,
      direction: "outbound",
      message_type: "text",
      content: message.trim(),
      status: "sent",
      sent_by: staffId ?? null,
      timestamp: now,
    });

    await supabase
      .from("instagram_conversations")
      .update({ last_message: message.trim().substring(0, 255), last_message_at: now, updated_at: now })
      .eq("id", conversation.id);

    return new Response(JSON.stringify({ success: true, messageId: sendData.message_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("instagram-send error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
