import { supabase } from "@/integrations/supabase/client";

function normalizeBrPhoneDigits(phoneRaw: string) {
  const digits = (phoneRaw || "").replace(/\D/g, "");
  if (!digits) return { digits: "", formatted: "", suffix8: "", suffix9: "" };

  const suffix8 = digits.slice(-8);
  const suffix9 = digits.slice(-9);
  const formatted = digits.startsWith("55") ? digits : `55${digits}`;

  return { digits, formatted, suffix8, suffix9 };
}

type SendLoggedWhatsAppTextArgs = {
  instanceId: string;
  phoneRaw: string;
  message: string;
  leadId?: string;
  leadName?: string;
  staffId?: string;
};

export async function sendLoggedWhatsAppText({
  instanceId,
  phoneRaw,
  message,
  leadId,
  leadName,
  staffId,
}: SendLoggedWhatsAppTextArgs): Promise<{ conversationId: string; messageId: string }>
{
  const msg = (message || "").trim();
  if (!msg) throw new Error("Mensagem vazia");

  const { formatted, suffix8, suffix9 } = normalizeBrPhoneDigits(phoneRaw);
  if (!formatted) throw new Error("Telefone inválido");

  // 1) Find or create contact
  const { data: suffixMatches, error: suffixErr } = await supabase
    .from("crm_whatsapp_contacts")
    .select("id, phone, lead_id, name")
    .or(`phone.ilike.%${suffix8},phone.ilike.%${suffix9}`);

  if (suffixErr) throw suffixErr;

  const contactMatch = (suffixMatches || []).find((c: any) => {
    const cDigits = (c.phone || "").replace(/\D/g, "");
    if (cDigits.length > 13 || cDigits.length < 8) return false;
    if ((c.phone || "").includes("@") || (c.phone || "").includes("-")) return false;
    return cDigits.slice(-8) === suffix8 || cDigits.slice(-9) === suffix9;
  });

  let contactId: string;
  if (contactMatch?.id) {
    contactId = contactMatch.id;

    // Best-effort enrichment
    const updates: Record<string, any> = {};
    if (leadId && !contactMatch.lead_id) updates.lead_id = leadId;
    if (leadName && !contactMatch.name) updates.name = leadName;
    if (Object.keys(updates).length > 0) {
      await supabase.from("crm_whatsapp_contacts").update(updates).eq("id", contactId);
    }
  } else {
    const { data: created, error: createErr } = await supabase
      .from("crm_whatsapp_contacts")
      .insert({
        phone: formatted,
        name: leadName || null,
        lead_id: leadId || null,
      })
      .select("id")
      .single();

    if (createErr) throw createErr;
    contactId = created.id;
  }

  // 2) Find or create conversation (scoped by instance)
  const { data: existingConv, error: convErr } = await supabase
    .from("crm_whatsapp_conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("instance_id", instanceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (convErr) throw convErr;

  let conversationId = existingConv?.id as string | undefined;
  if (!conversationId) {
    const { data: createdConv, error: createConvErr } = await supabase
      .from("crm_whatsapp_conversations")
      .insert({
        contact_id: contactId,
        instance_id: instanceId,
        status: "open",
        unread_count: 0,
        lead_id: leadId || null,
      })
      .select("id")
      .single();

    if (createConvErr) throw createConvErr;
    conversationId = createdConv.id;
  } else if (leadId) {
    // If conversation exists but not linked, link it (best-effort)
    await supabase
      .from("crm_whatsapp_conversations")
      .update({ lead_id: leadId })
      .eq("id", conversationId);
  }

  // 3) Insert outbound message (pending)
  const { data: newMsg, error: insertMsgErr } = await supabase
    .from("crm_whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      content: msg,
      type: "text",
      direction: "outbound",
      status: "pending",
      sent_by: staffId || null,
    })
    .select("id")
    .single();

  if (insertMsgErr) throw insertMsgErr;

  // 4) Send via backend function
  const { data: sendData, error: sendErr } = await supabase.functions.invoke("evolution-api", {
    body: {
      action: "sendText",
      instanceId,
      phone: formatted,
      message: msg,
    },
  });

  const remoteId = sendData?.key?.id;

  if (sendErr || sendData?.error) {
    await supabase
      .from("crm_whatsapp_messages")
      .update({ status: "failed" })
      .eq("id", newMsg.id);

    throw sendErr || new Error(sendData?.error || "Erro ao enviar mensagem");
  }

  // 5) Mark message sent + update conversation
  await supabase
    .from("crm_whatsapp_messages")
    .update({ status: "sent", remote_id: remoteId || null })
    .eq("id", newMsg.id);

  await supabase
    .from("crm_whatsapp_conversations")
    .update({
      last_message: msg,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return { conversationId, messageId: newMsg.id };
}
