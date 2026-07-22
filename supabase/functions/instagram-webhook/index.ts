// Webhook do Instagram (Meta Graph API — Instagram Login).
// - GET: verificação do webhook (hub.challenge) com IG_WEBHOOK_VERIFY_TOKEN.
// - POST messaging: DMs inbound/echo → instagram_messages (inbox do CRM via realtime).
// - POST changes: motor de gatilhos estilo ManyChat (crm_ig_triggers) —
//   comentário/menção com palavra-chave → resposta pública + private reply (DM)
//   + criação/roteamento de lead + agente de IA assumindo a conversa.
//   Tipos story_reply e dm_keyword rodam em cima das DMs recebidas; o tipo
//   'follow' (novo seguidor) já está previsto mas a Meta ainda não abriu esse
//   campo pro público — quando abrir, o handler abaixo passa a receber.
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
  // secret opcional pra testes assinados (só vale se a env existir no projeto)
  Deno.env.get("IG_WEBHOOK_TEST_SECRET") ?? "",
].filter(Boolean);

const GRAPH = "https://graph.instagram.com/v21.0";

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
    reply_to?: { story?: { id?: string; url?: string } };
  };
};

type ChangeEvent = {
  field?: string;
  value?: {
    id?: string; // comment_id
    text?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string; media_product_type?: string };
    parent_id?: string;
    comment_id?: string; // mentions
    media_id?: string; // mentions
    follower?: { id?: string; username?: string }; // follow (beta Meta)
    follower_id?: string;
  };
};

type Instance = { id: string; access_token: string; instagram_account_id: string };

type TriggerRow = {
  id: string;
  instance_id: string;
  trigger_type: string;
  media_ids: string[] | null;
  keywords: string[];
  match_type: string;
  public_replies: string[];
  dm_message: string | null;
  create_lead: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  agent_id: string | null;
  cooldown_hours: number;
  priority: number;
};

async function fetchProfile(igsid: string, accessToken: string) {
  try {
    // Instagram Login: perfil do usuário da DM via graph.instagram.com
    const url = new URL(`${GRAPH}/${igsid}`);
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

async function findInstance(accountId: string, entryId: string): Promise<Instance | null> {
  const { data } = await supabase
    .from("instagram_instances")
    .select("id, access_token, instagram_account_id")
    .or(`instagram_account_id.eq.${accountId},instagram_account_id.eq.${entryId}`)
    .eq("status", "active")
    .maybeSingle();
  return data ?? null;
}

// Garante contato + conversa; retorna também se a conversa é nova (pra saber se
// o lead veio do autolead desse evento e pode ser roteado pro funil do gatilho).
async function ensureContactConversation(
  instance: Instance,
  igsid: string,
  hint?: { username?: string | null; name?: string | null },
) {
  let { data: contact } = await supabase
    .from("instagram_contacts")
    .select("id, username, name")
    .eq("instance_id", instance.id)
    .eq("instagram_user_id", igsid)
    .maybeSingle();

  if (!contact) {
    const profile = await fetchProfile(igsid, instance.access_token);
    const username = profile?.username ?? hint?.username ?? null;
    const name = profile?.name ?? hint?.name ?? (username ? `@${username}` : null);
    const { data: created, error: contactErr } = await supabase
      .from("instagram_contacts")
      .insert({
        instance_id: instance.id,
        instagram_user_id: igsid,
        username,
        name,
        profile_picture_url: profile?.profile_pic ?? null,
      })
      .select("id, username, name")
      .single();
    if (contactErr) {
      console.error("contact insert error", contactErr);
      return null;
    }
    contact = created;
  }

  let isNew = false;
  let { data: conversation } = await supabase
    .from("instagram_conversations")
    .select("id, unread_count, lead_id")
    .eq("instance_id", instance.id)
    .eq("contact_id", contact.id)
    .maybeSingle();

  if (!conversation) {
    const { data: createdConv, error: convErr } = await supabase
      .from("instagram_conversations")
      .insert({
        instance_id: instance.id,
        contact_id: contact.id,
        thread_id: igsid,
        status: "open",
        unread_count: 0,
      })
      .select("id, unread_count, lead_id")
      .single();
    if (convErr) {
      console.error("conversation insert error", convErr);
      return null;
    }
    conversation = createdConv;
    isNew = true;
  }
  return { contact, conversation, isNew };
}

// ---------------------------------------------------------------------------
// Motor de gatilhos
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function matchKeyword(trg: TriggerRow, text: string): string | null {
  if (trg.match_type === "any" || (trg.keywords ?? []).length === 0) return "*";
  const t = norm(text);
  if (!t) return null;
  for (const k of trg.keywords) {
    const nk = norm(k);
    if (!nk) continue;
    if (trg.match_type === "exact" && t === nk) return k;
    if (trg.match_type === "starts_with" && t.startsWith(nk)) return k;
    if (trg.match_type === "contains" && t.includes(nk)) return k;
  }
  return null;
}

function renderTemplate(msg: string, ctx: { name?: string | null; username?: string | null }): string {
  const firstName = (ctx.name ?? "").trim().split(/\s+/)[0] || (ctx.username ? `@${ctx.username}` : "");
  return msg
    .replaceAll("{{nome}}", firstName)
    .replaceAll("{{username}}", ctx.username ? `@${ctx.username}` : "")
    .replace(/ {2,}/g, " ")
    .trim();
}

async function activeTriggers(instanceId: string, type: string): Promise<TriggerRow[]> {
  const { data } = await supabase
    .from("crm_ig_triggers")
    .select("id, instance_id, trigger_type, media_ids, keywords, match_type, public_replies, dm_message, create_lead, pipeline_id, stage_id, agent_id, cooldown_hours, priority")
    .eq("instance_id", instanceId)
    .eq("trigger_type", type)
    .eq("is_active", true)
    .order("priority", { ascending: false });
  return (data ?? []) as TriggerRow[];
}

type TriggerEvent = {
  eventType: string;
  externalId: string; // comment_id / mid / igsid-follow — chave de dedup
  igsid?: string | null;
  username?: string | null;
  name?: string | null;
  commentId?: string | null; // presente → DM sai como private reply do comentário
  mediaId?: string | null;
  text?: string;
  matchedKeyword?: string;
  // conversa já garantida pelo fluxo de DM (story_reply/dm_keyword) — evita refazer
  pre?: { contactId: string; conversationId: string; leadId: string | null } | null;
};

async function igPost(path: string, accessToken: string, body: Record<string, unknown>) {
  const url = new URL(`${GRAPH}/${path}`);
  url.searchParams.set("access_token", accessToken);
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (data.error) {
    console.error(`IG API error em ${path}:`, data.error);
    return { ok: false as const, data };
  }
  return { ok: true as const, data };
}

async function runTrigger(instance: Instance, trg: TriggerRow, ev: TriggerEvent) {
  // Dedup: 1 disparo por evento por gatilho — o índice único segura corridas
  const { data: run, error: runErr } = await supabase
    .from("crm_ig_trigger_runs")
    .insert({
      trigger_id: trg.id,
      instance_id: instance.id,
      event_type: ev.eventType,
      external_id: ev.externalId,
      contact_igsid: ev.igsid ?? null,
      contact_username: ev.username ?? null,
      media_id: ev.mediaId ?? null,
      matched_keyword: ev.matchedKeyword ?? null,
      event_text: (ev.text ?? "").substring(0, 500),
    })
    .select("id")
    .single();
  if (runErr) {
    if (runErr.code !== "23505") console.error("trigger run insert error", runErr);
    return true; // já processado (ou sem telemetria) — não tenta outro gatilho
  }

  const patch: Record<string, unknown> = {};
  const finish = async (error?: string) => {
    if (error) patch.error = error;
    await supabase.from("crm_ig_trigger_runs").update(patch).eq("id", run.id);
  };

  // Cooldown por usuário: evita metralhar quem comenta em vários posts
  if (ev.igsid && trg.cooldown_hours > 0) {
    const since = new Date(Date.now() - trg.cooldown_hours * 3600_000).toISOString();
    const { data: recent } = await supabase
      .from("crm_ig_trigger_runs")
      .select("id")
      .eq("trigger_id", trg.id)
      .eq("contact_igsid", ev.igsid)
      .gte("created_at", since)
      .neq("id", run.id)
      .is("error", null)
      .limit(1);
    if (recent?.length) {
      await finish("cooldown");
      return true;
    }
  }

  const tplCtx = { name: ev.name, username: ev.username };

  // 1) Resposta pública ao comentário (sorteia uma variação)
  if (ev.commentId && (trg.public_replies ?? []).length > 0) {
    const pool = trg.public_replies.filter((r) => r?.trim());
    if (pool.length) {
      const reply = renderTemplate(pool[Math.floor(Math.random() * pool.length)], tplCtx);
      const res = await igPost(`${ev.commentId}/replies`, instance.access_token, { message: reply });
      patch.public_reply_sent = res.ok;
    }
  }

  // 2) DM: private reply (comentário) ou mensagem direta (story/dm — janela aberta)
  let dmMessageId: string | null = null;
  const dmText = trg.dm_message?.trim() ? renderTemplate(trg.dm_message, tplCtx) : null;
  if (dmText) {
    const recipient = ev.commentId ? { comment_id: ev.commentId } : ev.igsid ? { id: ev.igsid } : null;
    if (recipient) {
      const res = await igPost(`${instance.instagram_account_id}/messages`, instance.access_token, {
        recipient,
        message: { text: dmText },
      });
      patch.dm_sent = res.ok;
      if (res.ok) dmMessageId = res.data.message_id ?? null;
    }
  }

  // 3) Contato + conversa + registro da DM no inbox
  let conversationId = ev.pre?.conversationId ?? null;
  let leadId = ev.pre?.leadId ?? null;
  let conversationIsNew = false;
  if (!ev.pre && ev.igsid) {
    const ensured = await ensureContactConversation(instance, ev.igsid, {
      username: ev.username,
      name: ev.name,
    });
    if (ensured) {
      conversationId = ensured.conversation.id;
      conversationIsNew = ensured.isNew;
      // o autolead (trigger do banco) roda no INSERT da conversa — relê o lead_id
      if (ensured.isNew) {
        const { data: fresh } = await supabase
          .from("instagram_conversations")
          .select("lead_id")
          .eq("id", ensured.conversation.id)
          .maybeSingle();
        leadId = fresh?.lead_id ?? null;
      } else {
        leadId = ensured.conversation.lead_id ?? null;
      }
    }
  }
  patch.conversation_id = conversationId;

  if (conversationId && dmMessageId && dmText) {
    // grava a DM outbound no inbox (o echo do webhook deduplica por message_id)
    const now = new Date().toISOString();
    await supabase.from("instagram_messages").insert({
      conversation_id: conversationId,
      message_id: dmMessageId,
      direction: "outbound",
      message_type: "text",
      content: dmText,
      status: "sent",
      timestamp: now,
    });
    await supabase
      .from("instagram_conversations")
      .update({ last_message: dmText.substring(0, 255), last_message_at: now, updated_at: now })
      .eq("id", conversationId);
  }

  // 4) Lead: roteia pro funil/etapa do gatilho (só lead recém-criado pelo autolead —
  //    lead antigo no meio do funil não é movido por comentário)
  if (trg.create_lead && conversationId) {
    if (leadId && conversationIsNew && (trg.pipeline_id || trg.stage_id)) {
      const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (trg.pipeline_id) upd.pipeline_id = trg.pipeline_id;
      if (trg.stage_id) {
        upd.stage_id = trg.stage_id;
        upd.stage_entered_at = new Date().toISOString();
      }
      await supabase.from("crm_leads").update(upd).eq("id", leadId);
    } else if (!leadId && trg.pipeline_id && trg.stage_id) {
      // conversa antiga sem lead (ou autolead falhou) — cria direto no funil do gatilho
      const { data: newLead } = await supabase
        .from("crm_leads")
        .insert({
          name: ev.name?.trim() || (ev.username ? `@${ev.username}` : `Instagram ${ev.igsid ?? ""}`),
          pipeline_id: trg.pipeline_id,
          stage_id: trg.stage_id,
          instagram: ev.username ?? null,
        })
        .select("id")
        .single();
      if (newLead) {
        leadId = newLead.id;
        await supabase.from("instagram_conversations").update({ lead_id: leadId }).eq("id", conversationId);
      }
    }
  }
  patch.lead_id = leadId;

  // 5) Agente de IA assume a conversa (override por conversa, modo auto)
  if (trg.agent_id && conversationId) {
    const { data: existing } = await supabase
      .from("crm_ai_agent_conversation_overrides")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("channel", "instagram")
      .maybeSingle();
    if (existing) {
      await supabase
        .from("crm_ai_agent_conversation_overrides")
        .update({ agent_id: trg.agent_id, enabled: true, reply_mode: "auto", updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("crm_ai_agent_conversation_overrides").insert({
        agent_id: trg.agent_id,
        conversation_id: conversationId,
        channel: "instagram",
        enabled: true,
        reply_mode: "auto",
      });
    }
  }

  await finish();
  return true;
}

// Avalia os gatilhos de um tipo pra um evento; primeiro que casar dispara (1 resposta por evento)
async function fireTriggers(instance: Instance, type: string, ev: Omit<TriggerEvent, "matchedKeyword">) {
  const triggers = await activeTriggers(instance.id, type);
  for (const trg of triggers) {
    // filtro por post (null/vazio = todos)
    if (ev.mediaId && trg.media_ids?.length && !trg.media_ids.includes(ev.mediaId)) continue;
    const matched = matchKeyword(trg, ev.text ?? "");
    if (!matched) continue;
    try {
      await runTrigger(instance, trg, { ...ev, matchedKeyword: matched });
    } catch (e) {
      console.error("runTrigger error", trg.id, e);
    }
    return; // um gatilho por evento
  }
}

// changes[] — comentários, menções, live e (futuro) novos seguidores
async function processChange(entryId: string, change: ChangeEvent) {
  const field = change.field ?? "";
  const value = change.value ?? {};
  if (!["comments", "live_comments", "mentions", "follow", "follows"].includes(field)) return;

  const instance = await findInstance(entryId, entryId);
  if (!instance) {
    console.warn("No active instance for changes entry", entryId);
    return;
  }

  if (field === "comments" || field === "live_comments") {
    const from = value.from ?? {};
    // ignora comentários da própria conta (inclui as respostas públicas que o
    // motor envia — sem isso vira loop)
    if (!from.id || from.id === instance.instagram_account_id || from.id === entryId) return;
    if (!value.id) return;
    await fireTriggers(instance, field === "comments" ? "comment" : "live_comment", {
      eventType: field,
      externalId: value.id,
      igsid: from.id,
      username: from.username ?? null,
      commentId: value.id,
      mediaId: value.media?.id ?? null,
      text: value.text ?? "",
    });
    return;
  }

  if (field === "mentions") {
    const commentId = value.comment_id ?? null;
    let text = value.text ?? "";
    let from: { id?: string; username?: string } = value.from ?? {};
    // menção em comentário: busca texto e autor pra casar palavra-chave
    if (commentId && (!text || !from.id)) {
      try {
        const url = new URL(`${GRAPH}/${commentId}`);
        url.searchParams.set("fields", "text,from{id,username}");
        url.searchParams.set("access_token", instance.access_token);
        const data = await (await fetch(url.toString())).json();
        if (!data.error) {
          text = data.text ?? text;
          from = data.from ?? from;
        }
      } catch { /* segue sem texto — gatilhos "any" ainda funcionam */ }
    }
    if (from.id && (from.id === instance.instagram_account_id || from.id === entryId)) return;
    await fireTriggers(instance, "mention", {
      eventType: "mention",
      externalId: commentId ?? `mention-${value.media_id ?? crypto.randomUUID()}`,
      igsid: from.id ?? null,
      username: from.username ?? null,
      commentId,
      mediaId: value.media_id ?? null,
      text,
    });
    return;
  }

  // 'follow' — beta da Meta, ainda não liberado pro público. Fica pronto:
  // quando o campo chegar, loga a telemetria e tenta a DM de boas-vindas.
  if (field === "follow" || field === "follows") {
    console.log("follow event payload:", JSON.stringify(value));
    const igsid = value.follower?.id ?? value.follower_id ?? value.from?.id ?? null;
    const username = value.follower?.username ?? value.from?.username ?? null;
    if (!igsid) return;
    await fireTriggers(instance, "follow", {
      eventType: "follow",
      externalId: `${igsid}-follow`,
      igsid,
      username,
      text: "",
    });
  }
}

// ---------------------------------------------------------------------------
// DMs (fluxo original) + gatilhos story_reply / dm_keyword
// ---------------------------------------------------------------------------

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
  const instance = await findInstance(accountId, entryId);
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

  const ensured = await ensureContactConversation(instance, userIgsid);
  if (!ensured) return;
  const { contact, conversation } = ensured;

  // Mensagem — message_type e status têm CHECK constraint; mapear pros valores válidos
  const attachment = msg.attachments?.[0];
  const allowedTypes = new Set(["text", "image", "video", "audio", "story_reply", "story_mention", "share", "like"]);
  const isStoryReply = !!msg.reply_to?.story;
  const rawType = isStoryReply ? "story_reply" : msg.text ? "text" : (attachment?.type ?? "share");
  const messageType = allowedTypes.has(rawType) ? rawType : (rawType === "ig_reel" ? "video" : "share");
  const content = msg.text ?? (attachment ? `[${attachment.type ?? "mídia"}]` : "");
  const ts = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();

  const { error: msgErr } = await supabase.from("instagram_messages").insert({
    conversation_id: conversation.id,
    message_id: msg.mid,
    direction: isEcho ? "outbound" : "inbound",
    message_type: messageType,
    content,
    media_url: attachment?.payload?.url ?? msg.reply_to?.story?.url ?? null,
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

  // Gatilhos sobre DMs recebidas: resposta a story e palavra-chave na DM
  if (!isEcho && content) {
    try {
      const { data: fresh } = await supabase
        .from("instagram_conversations")
        .select("lead_id")
        .eq("id", conversation.id)
        .maybeSingle();
      await fireTriggers(instance, isStoryReply ? "story_reply" : "dm_keyword", {
        eventType: isStoryReply ? "story_reply" : "dm_keyword",
        externalId: msg.mid,
        igsid: userIgsid,
        username: contact.username ?? null,
        name: contact.name ?? null,
        text: content,
        pre: {
          contactId: contact.id,
          conversationId: conversation.id,
          leadId: fresh?.lead_id ?? conversation.lead_id ?? null,
        },
      });
    } catch (e) {
      console.error("dm trigger error", e);
    }
  }
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
        const changes: ChangeEvent[] = entry.changes ?? [];
        for (const change of changes) {
          try {
            await processChange(String(entry.id ?? ""), change);
          } catch (e) {
            console.error("processChange error", e);
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
