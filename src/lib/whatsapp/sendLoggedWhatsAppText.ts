import { supabase } from "@/integrations/supabase/client";

function normalizeBrPhoneDigits(phoneRaw: string) {
  let digits = (phoneRaw || "").replace(/\D/g, "");
  if (!digits) return { digits: "", formatted: "", suffix8: "", suffix9: "" };

  // Ensure country code
  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }

  // Brazilian mobile numbers: 55 + 2-digit DDD + 9 digits = 13 total
  // If we have 12 digits (55 + DDD + 8-digit number), insert the 9th digit
  if (digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    digits = `55${ddd}9${number}`;
  }

  const suffix8 = digits.slice(-8);
  const suffix9 = digits.slice(-9);

  return { digits, formatted: digits, suffix8, suffix9 };
}

type SendLoggedWhatsAppTextArgs = {
  instanceId: string;
  phoneRaw: string;
  message: string;
  leadId?: string;
  leadName?: string;
  staffId?: string;
};


/**
 * Acha (ou cria) o contato e a conversa do número nessa instância, sem mandar mensagem.
 * 03/11/2026, Fabrício: o botão de mensagem do lead abre direto a conversa no Atendimento;
 * quando o lead ainda não tem conversa na instância escolhida, ela nasce aqui.
 */
export async function ensureWhatsAppConversation({
  instanceId,
  phoneRaw,
  leadId,
  leadName,
}: { instanceId: string; phoneRaw: string; leadId?: string; leadName?: string }): Promise<{ conversationId: string; contactId: string; formatted: string }> {
  const { formatted, suffix8, suffix9 } = normalizeBrPhoneDigits(phoneRaw);
  if (!formatted) throw new Error("Telefone inválido");

  // 1) Find or create contact
  //    Primeiro pelo número exato (cobre número fora do padrão, ex.: 14 dígitos,
  //    que o filtro por sufixo abaixo rejeitava e acabava em "duplicate key").
  const { data: exactMatches, error: exactErr } = await supabase
    .from("crm_whatsapp_contacts")
    .select("id, phone, lead_id, name")
    .eq("phone", formatted)
    .limit(1);
  if (exactErr) throw exactErr;

  const { data: suffixMatches, error: suffixErr } = await supabase
    .from("crm_whatsapp_contacts")
    .select("id, phone, lead_id, name")
    .or(`phone.ilike.%${suffix8},phone.ilike.%${suffix9}`);

  if (suffixErr) throw suffixErr;

  let contactMatch: any = (exactMatches || [])[0] || (suffixMatches || []).find((c: any) => {
    const cDigits = (c.phone || "").replace(/\D/g, "");
    if (cDigits.length > 15 || cDigits.length < 8) return false;
    if ((c.phone || "").includes("@") || (c.phone || "").includes("-")) return false;
    // mesmo DDD + mesmos 8 últimos dígitos (03/11/2026: só o final casava 51 99733333 com 62 99733333)
    const chave = (d: string) => { let x = d; if (x.length >= 12 && x.startsWith("55")) x = x.slice(2); if (x.length >= 11 && x.startsWith("0")) x = x.slice(1); return x.length >= 10 ? x.slice(0, 2) + x.slice(-8) : null; };
    const kc = chave(cDigits), kf = chave(formatted);
    return !!kc && !!kf && kc === kf;
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

    if (createErr) {
      // Corrida/duplicidade (23505): o contato já existe com esse telefone — reaproveita
      if ((createErr as any).code === "23505") {
        const { data: again } = await supabase
          .from("crm_whatsapp_contacts")
          .select("id")
          .eq("phone", formatted)
          .limit(1)
          .maybeSingle();
        if (!again?.id) throw createErr;
        contactId = again.id;
      } else {
        throw createErr;
      }
    } else {
      contactId = created.id;
    }
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

  return { conversationId: conversationId as string, contactId, formatted };
}

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

  const { formatted } = normalizeBrPhoneDigits(phoneRaw);
  if (!formatted) throw new Error("Telefone inválido");

  const { conversationId } = await ensureWhatsAppConversation({ instanceId, phoneRaw, leadId, leadName });

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

  // A conversa sobe pro topo do Atendimento na hora do disparo (mesmo que o envio
  // falhe depois, ela precisa aparecer em primeiro, com a mensagem marcada como falha)
  await supabase
    .from("crm_whatsapp_conversations")
    .update({ last_message: msg.substring(0, 255), last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

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
