// wa-media-fetch: resolve mídia de mensagem do WhatsApp que ficou com URL
// criptografada do CDN (mmg.whatsapp.net) — baixa o arquivo descriptografado
// pela API da instância (Evolution/Stevo), salva no Storage e atualiza a
// mensagem. Chamada on-demand pelo player do Atendimento.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const j = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ROUTE_PREFIXES = ["", "/api/v1", "/api/v2", "/v1", "/v2"];

function extFor(mime: string, type: string) {
  const m = (mime || "").toLowerCase();
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4")) return type === "audio" ? "m4a" : "mp4";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("pdf")) return "pdf";
  return "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    // Só staff logado pode resolver mídia
    const authHeader = req.headers.get("Authorization") || "";
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return j({ ok: false, error: "não autenticado" }, 401);
    const { data: staff } = await supabase.from("onboarding_staff")
      .select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!staff) return j({ ok: false, error: "sem permissão" }, 403);

    const body = await req.json();

    // Admin (master): inspeciona/ajusta o webhook da instância pra incluir a
    // mídia em base64 (necessário pro áudio tocar — o CDN do WhatsApp é
    // criptografado e o Evolution daqui não guarda store pra baixar depois).
    if (body.action === "webhook_config") {
      const { data: master } = await supabase.from("onboarding_staff")
        .select("id").eq("user_id", user.id).eq("is_active", true).eq("role", "master").maybeSingle();
      if (!master) return j({ ok: false, error: "só master" }, 403);
      const { data: inst2 } = await supabase.from("whatsapp_instances")
        .select("instance_name, api_url, api_key").eq("id", body.instance_id).maybeSingle();
      if (!inst2?.api_url) return j({ ok: false, error: "instância não encontrada" }, 404);
      const b = String(inst2.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
      const h = { "Content-Type": "application/json", apikey: inst2.api_key, Authorization: `Bearer ${inst2.api_key}`, "x-api-key": inst2.api_key };
      const cur = await fetch(`${b}/webhook/find/${inst2.instance_name}`, { headers: h, signal: AbortSignal.timeout(20000) });
      const curBody = await cur.json().catch(() => null);
      if (!body.set_base64) return j({ ok: true, current: curBody });
      const w = curBody?.webhook || curBody || {};
      const payload = { webhook: { enabled: w.enabled ?? true, url: w.url, events: w.events, base64: true, byEvents: w.byEvents ?? w.webhookByEvents ?? false } };
      const set = await fetch(`${b}/webhook/set/${inst2.instance_name}`, { method: "POST", headers: h, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      const setBody = await set.json().catch(() => null);
      return j({ ok: set.ok, result: setBody, sent: payload });
    }

    const { message_id } = body;
    if (!message_id) return j({ ok: false, error: "message_id obrigatório" }, 400);

    const { data: msg } = await supabase.from("crm_whatsapp_messages")
      .select("id, remote_id, type, direction, media_url, media_mimetype, conversation_id")
      .eq("id", message_id).maybeSingle();
    if (!msg) return j({ ok: false, error: "mensagem não encontrada" }, 404);

    // Já resolvida?
    if (msg.media_url && msg.media_url.includes("supabase")) {
      return j({ ok: true, url: msg.media_url, cached: true });
    }
    if (!msg.remote_id) return j({ ok: false, error: "mensagem sem id remoto — não dá pra baixar" }, 422);

    const { data: conv } = await supabase.from("crm_whatsapp_conversations")
      .select("instance_id, contact:crm_whatsapp_contacts(phone)").eq("id", msg.conversation_id).maybeSingle();
    if (!conv?.instance_id) return j({ ok: false, error: "conversa sem instância" }, 422);
    const contactPhone = String((conv as any).contact?.phone || "").replace(/\D/g, "");
    const remoteJid = contactPhone ? `${contactPhone}@s.whatsapp.net` : null;

    const { data: inst } = await supabase.from("whatsapp_instances")
      .select("instance_name, api_url, api_key").eq("id", conv.instance_id).maybeSingle();
    if (!inst?.api_url || !inst?.api_key) return j({ ok: false, error: "instância sem credenciais" }, 422);

    const baseUrl = String(inst.api_url).replace(/\/manager\/?$/i, "").replace(/\/+$/g, "");
    const headers = {
      "Content-Type": "application/json",
      apikey: inst.api_key,
      Authorization: `Bearer ${inst.api_key}`,
      "x-api-key": inst.api_key,
    };

    let base64Data: string | null = null;
    let mimetype = msg.media_mimetype || "";
    let lastErr = "";
    // Variações de chave aceitas pelas versões do Evolution: só id; id +
    // remoteJid + fromMe (versões novas exigem a chave completa pra achar
    // a mensagem no store).
    const keyVariants: Record<string, unknown>[] = [
      { id: msg.remote_id },
      ...(remoteJid ? [{ id: msg.remote_id, remoteJid, fromMe: msg.direction === "outbound" }] : []),
    ].reverse();
    outer:
    for (const key of keyVariants) {
      for (const prefix of ROUTE_PREFIXES) {
        try {
          const r = await fetch(`${baseUrl}${prefix}/chat/getBase64FromMediaMessage/${inst.instance_name}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ message: { key }, convertToMp4: false }),
            signal: AbortSignal.timeout(45000),
          });
          if (r.status === 404 || r.status === 405) { lastErr = `HTTP ${r.status}`; continue; }
          if (!r.ok) { lastErr = `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`; break; }
          const data = await r.json();
          let b64: string | null = data.base64 || data.media || null;
          if (b64?.includes("base64,")) b64 = b64.split("base64,").pop() || null;
          if (b64) {
            base64Data = b64;
            mimetype = data.mimetype || mimetype || "application/octet-stream";
            break outer;
          }
          lastErr = "resposta sem base64";
          break;
        } catch (e) {
          lastErr = String((e as Error).message || e).slice(0, 200);
        }
      }
    }
    if (!base64Data) return j({ ok: false, error: `falha ao baixar da API: ${lastErr}` }, 502);

    const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const ext = extFor(mimetype, msg.type);
    const path = `resolved/${msg.type}/${msg.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("whatsapp-media")
      .upload(path, binary, { contentType: mimetype || "application/octet-stream", upsert: true });
    if (upErr) return j({ ok: false, error: `storage: ${upErr.message}` }, 500);

    const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("crm_whatsapp_messages")
      .update({ media_url: url, media_mimetype: mimetype || msg.media_mimetype })
      .eq("id", msg.id);

    return j({ ok: true, url });
  } catch (e) {
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
