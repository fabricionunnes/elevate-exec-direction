// Webhook de DMs do Instagram (Meta Graph API).
// - GET: verificação do webhook (hub.challenge) com IG_WEBHOOK_VERIFY_TOKEN.
// - POST: recebe eventos de messaging (object=instagram), resolve a instância
//   conectada (instagram_instances), garante contato+conversa e grava a mensagem
//   em instagram_messages — o inbox do CRM (CRMInboxPage) já lê essas tabelas
//   via realtime, então a conversa aparece no Atendimento na hora.
// Deploy com verify_jwt=false (a Meta não manda JWT); autenticidade garantida
// pela assinatura X-Hub-Signature-256 (HMAC com FACEBOOK_APP_SECRET).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("IG_WEBHOOK_VERIFY_TOKEN") ?? "";
// A entrega pode vir assinada pelo app Facebook pai OU pelo app do Instagram
// (Instagram Login) — aceita qualquer um dos dois secrets.
const APP_SECRETS = [
  Deno.env.get("FACEBOOK_APP_SECRET") ?? "",
  Deno.env.get("IG_APP_SECRET") ?? "",
].filter(Boolean);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validSignature(body: string, signatureHeader: string | null): Promise<boolean> {
  if (APP_SECRETS.length === 0) return true; // sem secret configurado não dá pra validar
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length);
  for (const secret of APP_SECRETS) {
    if ((await hmacHex(secret, body)) === expected) return true;
  }
  return false;
}

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type?: string; payload?: { url?: string } }>;
  };
};

async function fetchProfile(igsid: string, accessToken: string) {
  try {
    // Instagram Login: perfil do usuário da DM via graph.instagram.com
    const url = new URL(`https://graph.instagram.com/v21.0/${igsid}`);
    url.searchParams.set("fields", "name,username,profile_pic");
    url.searchParams.set("access_token", accessToken);
    const resp = await fetch(url.toString());
    const data = await resp.json();
    if (data.error) return null;
    return data as { name?: string; username?: string; profile_pic?: string };
  } catch {
    return null;
  }
}

async function processEvent(entryId: string, event: MessagingEvent) {
  const msg = event.message;
  if (!msg?.mid) return; // só tratamos mensagens (ignora read/reactions/postbacks por ora)

  const isEcho = !!msg.is_echo;
  // No echo (mensagem enviada pela conta), o sender é a própria conta e o
  // recipient é o usuário; no inbound é o contrário.
  const accountId = isEcho ? (event.sender?.id ?? entryId) : (event.recipient?.id ?? entryId);
  const userIgsid = isEcho ? event.recipient?.id : event.sender?.id;
  if (!userIgsid) return;

  // Instância conectada dona dessa conta
  const { data: instance } = await supabase
    .from("instagram_instances")
    .select("id, access_token, instagram_account_id")
    .or(`instagram_account_id.eq.${accountId},instagram_account_id.eq.${entryId}`)
    .eq("status", "active")
    .maybeSingle();
  if (!instance) {
    console.warn("No active instance for account", accountId, entryId);
    return;
  }

  // Dedup por message_id
  const { data: existing } = await supabase
    .from("instagram_messages")
    .select("id")
    .eq("message_id", msg.mid)
    .maybeSingle();
  if (existing) return;

  // Contato
  let { data: contact } = await supabase
    .from("instagram_contacts")
    .select("id")
    .eq("instance_id", instance.id)
    .eq("instagram_user_id", userIgsid)
    .maybeSingle();

  if (!contact) {
    const profile = await fetchProfile(userIgsid, instance.access_token);
    const { data: created, error: contactErr } = await supabase
      .from("instagram_contacts")
      .insert({
        instance_id: instance.id,
        instagram_user_id: userIgsid,
        username: profile?.username ?? null,
        name: profile?.name ?? (profile?.username ? `@${profile.username}` : null),
        profile_picture_url: profile?.profile_pic ?? null,
      })
      .select("id")
      .single();
    if (contactErr) {
      console.error("contact insert error", contactErr);
      return;
    }
    contact = created;
  }

  // Conversa
  let { data: conversation } = await supabase
    .from("instagram_conversations")
    .select("id, unread_count")
    .eq("instance_id", instance.id)
    .eq("contact_id", contact.id)
    .maybeSingle();

  if (!conversation) {
    const { data: createdConv, error: convErr } = await supabase
      .from("instagram_conversations")
      .insert({
        instance_id: instance.id,
        contact_id: contact.id,
        thread_id: userIgsid,
        status: "open",
        unread_count: 0,
      })
      .select("id, unread_count")
      .single();
    if (convErr) {
      console.error("conversation insert error", convErr);
      return;
    }
    conversation = createdConv;
  }

  // Mensagem — message_type e status têm CHECK constraint; mapear pros valores válidos
  const attachment = msg.attachments?.[0];
  const allowedTypes = new Set(["text", "image", "video", "audio", "story_reply", "story_mention", "share", "like"]);
  const rawType = msg.text ? "text" : (attachment?.type ?? "share");
  const messageType = allowedTypes.has(rawType) ? rawType : (rawType === "ig_reel" ? "video" : "share");
  const content = msg.text ?? (attachment ? `[${attachment.type ?? "mídia"}]` : "");
  const ts = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();

  const { error: msgErr } = await supabase.from("instagram_messages").insert({
    conversation_id: conversation.id,
    message_id: msg.mid,
    direction: isEcho ? "outbound" : "inbound",
    message_type: messageType,
    content,
    media_url: attachment?.payload?.url ?? null,
    status: isEcho ? "sent" : "delivered",
    timestamp: ts,
  });
  if (msgErr) {
    console.error("message insert error", msgErr);
    return;
  }

  await supabase
    .from("instagram_conversations")
    .update({
      last_message: content.substring(0, 255),
      last_message_at: ts,
      unread_count: isEcho ? conversation.unread_count ?? 0 : (conversation.unread_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Verificação do webhook (configuração no painel da Meta)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signatureOk = await validSignature(rawBody, req.headers.get("x-hub-signature-256"));
  if (!signatureOk) {
    console.warn("Invalid webhook signature");
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    if (payload.object === "instagram" || payload.object === "page") {
      for (const entry of payload.entry ?? []) {
        const events: MessagingEvent[] = entry.messaging ?? entry.standby ?? [];
        for (const event of events) {
          try {
            await processEvent(String(entry.id ?? ""), event);
          } catch (e) {
            console.error("processEvent error", e);
          }
        }
      }
    }
  } catch (e) {
    console.error("webhook parse error", e);
  }

  // Sempre 200 — a Meta desativa webhooks que respondem erro repetidamente
  return new Response("EVENT_RECEIVED", { status: 200 });
});
